from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated


class TriggerScrapeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        portal = request.data.get("portal", "all")

        try:
            # Only works on Railway/local where Celery is installed
            from apps.scraper.tasks import scrape_portal, scrape_all_portals
            if portal == "all":
                scrape_all_portals.apply_async(queue="scraping")
                return Response({"status": "queued", "portals": "all"})
            else:
                task = scrape_portal.apply_async(args=[portal], queue="scraping")
                return Response({"status": "queued", "portal": portal, "task_id": str(task.id)})
        except Exception:
            # On Vercel — scraping runs from local PC directly
            return Response({
                "status": "unavailable",
                "message": "Scraper runs locally. Run: npm run scrape:naukri from your PC"
            })


urlpatterns = [
    path("trigger/", TriggerScrapeView.as_view(), name="scrape-trigger"),
]