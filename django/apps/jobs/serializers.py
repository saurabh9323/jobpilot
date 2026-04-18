from rest_framework import serializers
from .models import Job, Application, Company, ScrapeRun


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = "__all__"


class JobListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — no embedding field."""
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_logo = serializers.URLField(source="company.logo_url", read_only=True)

    class Meta:
        model = Job
        fields = [
            "id", "title", "company_name", "company_logo",
            "location", "remote", "salary_min", "salary_max",
            "experience_min", "experience_max", "skills_required",
            "source", "source_url", "status",
            "ai_match_score", "ats_score",
            "posted_at", "discovered_at",
        ]


class JobDetailSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)

    class Meta:
        model = Job
        exclude = ["description_embedding"]   # never expose raw vectors


class ApplicationSerializer(serializers.ModelSerializer):
    job = JobListSerializer(read_only=True)

    class Meta:
        model = Application
        fields = "__all__"
        read_only_fields = ["id", "user", "applied_at", "last_activity_at"]


class ScrapeRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScrapeRun
        fields = "__all__"
