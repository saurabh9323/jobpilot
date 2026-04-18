"""
JobPilot AI — Core job & application models
"""
from django.db import models
from pgvector.django import VectorField
import uuid


class Company(models.Model):
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, blank=True)
    size = models.CharField(
        max_length=20,
        choices=[
            ("startup", "1–50"),
            ("small", "51–200"),
            ("medium", "201–1000"),
            ("large", "1001–5000"),
            ("enterprise", "5000+"),
        ],
        blank=True,
    )
    industry = models.CharField(max_length=100, blank=True)
    glassdoor_rating = models.FloatField(null=True, blank=True)
    linkedin_url = models.URLField(blank=True)
    logo_url = models.URLField(blank=True)
    blacklisted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "companies"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Job(models.Model):
    SOURCE_CHOICES = [
        ("linkedin", "LinkedIn"),
        ("naukri", "Naukri"),
        ("indeed", "Indeed"),
        ("wellfound", "Wellfound"),
        ("instahyre", "Instahyre"),
        ("cutshort", "Cutshort"),
        ("direct", "Company Site"),
        ("referral", "Referral"),
    ]
    STATUS_CHOICES = [
        ("discovered", "Discovered"),
        ("scored", "AI Scored"),
        ("queued", "In Queue"),
        ("applied", "Applied"),
        ("viewed", "Viewed by HR"),
        ("screening", "Phone Screen"),
        ("interview", "Interview"),
        ("offer", "Offer"),
        ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="jobs")
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    remote = models.BooleanField(default=False)
    salary_min = models.IntegerField(null=True, blank=True)     # INR lakhs per annum
    salary_max = models.IntegerField(null=True, blank=True)
    experience_min = models.IntegerField(null=True, blank=True)  # years
    experience_max = models.IntegerField(null=True, blank=True)
    skills_required = models.JSONField(default=list)             # ["Python", "Django", ...]
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    source_url = models.URLField(unique=True)
    source_job_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="discovered")

    # AI scoring
    ai_match_score = models.FloatField(null=True, blank=True)   # 0.0 – 1.0
    ats_score = models.FloatField(null=True, blank=True)
    description_embedding = VectorField(dimensions=384, null=True, blank=True)

    posted_at = models.DateTimeField(null=True, blank=True)
    discovered_at = models.DateTimeField(auto_now_add=True)
    applied_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-ai_match_score", "-discovered_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["source"]),
            models.Index(fields=["ai_match_score"]),
        ]

    def __str__(self):
        return f"{self.title} @ {self.company.name}"


class Application(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.OneToOneField(Job, on_delete=models.CASCADE, related_name="application")
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="applications")

    resume_version = models.CharField(max_length=50, blank=True)  # e.g. "v3_backend_focused"
    cover_letter = models.TextField(blank=True)
    custom_answers = models.JSONField(default=dict)                # portal-specific Q&A
    hr_email = models.EmailField(blank=True)
    hr_name = models.CharField(max_length=100, blank=True)
    outreach_sent = models.BooleanField(default=False)
    outreach_sent_at = models.DateTimeField(null=True, blank=True)
    outreach_reply_received = models.BooleanField(default=False)

    # Timeline
    applied_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-applied_at"]

    def __str__(self):
        return f"Application → {self.job}"


class ScrapeRun(models.Model):
    """Audit log for every scraper execution."""
    portal = models.CharField(max_length=30)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    jobs_found = models.IntegerField(default=0)
    jobs_new = models.IntegerField(default=0)
    error = models.TextField(blank=True)
    status = models.CharField(
        max_length=15,
        choices=[("running", "Running"), ("done", "Done"), ("failed", "Failed")],
        default="running",
    )

    def __str__(self):
        return f"{self.portal} run @ {self.started_at:%Y-%m-%d %H:%M}"
