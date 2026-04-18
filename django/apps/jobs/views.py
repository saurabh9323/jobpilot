from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Avg

from .models import Job, Application, ScrapeRun
from .serializers import (
    JobListSerializer, JobDetailSerializer,
    ApplicationSerializer, ScrapeRunSerializer,
)
from apps.scraper.tasks import scrape_portal
from apps.ai.tasks import score_job_match


class JobViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Job.objects.select_related("company").all()
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["status", "source", "remote"]
    search_fields = ["title", "company__name", "location", "skills_required"]
    ordering_fields = ["ai_match_score", "discovered_at", "salary_max"]
    ordering = ["-ai_match_score"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return JobDetailSerializer
        return JobListSerializer

    @action(detail=False, methods=["get"])
    def funnel(self, request):
        """Aggregated funnel stats for the analytics dashboard."""
        stats = (
            Job.objects.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        return Response({s["status"]: s["count"] for s in stats})

    @action(detail=True, methods=["post"])
    def score(self, request, pk=None):
        """Manually trigger AI match scoring for a job."""
        job = self.get_object()
        task = score_job_match.delay(str(job.id))
        return Response({"task_id": task.id, "status": "queued"})

    @action(detail=False, methods=["get"])
    def top_matches(self, request):
        """Top 10 AI-scored jobs above 0.75 match."""
        jobs = (
            Job.objects.filter(ai_match_score__gte=0.75, status="scored")
            .select_related("company")
            .order_by("-ai_match_score")[:10]
        )
        return Response(JobListSerializer(jobs, many=True).data)


class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        return (
            Application.objects
            .filter(user=self.request.user)
            .select_related("job", "job__company")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        return Response({
            "total": qs.count(),
            "by_status": dict(
                qs.values_list("job__status")
                  .annotate(c=Count("id"))
                  .values_list("job__status", "c")
            ),
            "avg_match_score": qs.aggregate(
                avg=Avg("job__ai_match_score")
            )["avg"],
        })


class ScrapeRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScrapeRun.objects.all().order_by("-started_at")
    serializer_class = ScrapeRunSerializer

    @action(detail=False, methods=["post"])
    def trigger(self, request):
        """Manually kick off a scrape for a specific portal."""
        portal = request.data.get("portal")
        valid = ["linkedin", "naukri", "indeed", "wellfound", "instahyre"]
        if portal not in valid:
            return Response(
                {"error": f"Unknown portal. Choose from: {valid}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        task = scrape_portal.delay(portal)
        return Response({"task_id": task.id, "portal": portal, "status": "queued"})
