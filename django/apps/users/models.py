"""
apps/users/models.py — Custom User model + UserProfile
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        verbose_name = "User"


class UserProfile(models.Model):
    """
    The AI brain. This is what the scoring model reads.
    Populated during onboarding — editable from Settings.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    is_active = models.BooleanField(default=True)

    # Career preferences
    current_role = models.CharField(max_length=100, blank=True)
    target_roles = models.JSONField(default=list)       # ["Senior Backend Engineer", ...]
    years_experience = models.IntegerField(default=0)
    skills = models.JSONField(default=list)             # ["Python", "Django", "PostgreSQL", ...]
    top_achievement = models.TextField(blank=True)

    # Salary preferences (INR lakhs per annum)
    salary_floor = models.IntegerField(default=0)       # won't apply below this
    salary_ceiling = models.IntegerField(default=100)

    # Location
    preferred_locations = models.JSONField(default=list)  # ["Bengaluru", "Remote", ...]
    willing_to_relocate = models.BooleanField(default=False)
    remote_only = models.BooleanField(default=False)

    # Company preferences
    preferred_company_sizes = models.JSONField(
        default=list,
        help_text='["startup", "small", "medium", "large", "enterprise"]',
    )
    blacklisted_companies = models.JSONField(default=list)

    # Resume
    resume_text = models.TextField(blank=True)          # plain text for embeddings
    resume_url = models.URLField(blank=True)

    # Automation toggles
    auto_apply = models.BooleanField(default=False)
    auto_outreach = models.BooleanField(default=False)
    auto_schedule_interviews = models.BooleanField(default=False)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile: {self.user.email}"
