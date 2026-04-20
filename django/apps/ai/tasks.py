"""
apps/ai/tasks.py — AI/ML Celery tasks
On Vercel: scoring is done inline (fast mode)
On Railway: full sentence-transformer scoring
"""
import logging
import os

logger = logging.getLogger(__name__)

IS_VERCEL = os.environ.get("VERCEL", False)

# Graceful Celery import
try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        if len(args) == 1 and callable(args[0]):
            return args[0]
        return decorator


@shared_task(
    bind=True,
    queue="ai_scoring",
    max_retries=3,
    default_retry_delay=60,
    name="apps.ai.tasks.score_job_match",
)
def score_job_match(self, job_id: str):
    """Score a job against user profile."""
    from apps.jobs.models import Job
    from apps.users.models import UserProfile

    try:
        job = Job.objects.select_related("company").get(id=job_id)
        profile = UserProfile.objects.filter(is_active=True).first()
        if not profile:
            return

        # Fast keyword-based scoring (works on Vercel)
        job_skills = {s.lower() for s in job.skills_required}
        user_skills = {s.lower() for s in profile.skills}
        skills_score = len(job_skills & user_skills) / max(len(job_skills), 1)

        # Salary match
        salary_score = 1.0
        if job.salary_max and profile.salary_floor:
            if job.salary_max < profile.salary_floor * 0.8:
                salary_score = 0.2
        
        # Title match
        title_score = 0.5
        job_title_lower = job.title.lower()
        for target in profile.target_roles:
            if any(word in job_title_lower for word in target.lower().split()):
                title_score = 0.9
                break

        match_score = (
            skills_score * 0.45 +
            title_score  * 0.40 +
            salary_score * 0.15
        )

        job.ai_match_score = round(match_score, 4)
        job.status = "scored"
        job.save(update_fields=["ai_match_score", "status"])

        logger.info("Scored job %s → %.2f", job.title, match_score)
        return {"job_id": job_id, "score": match_score}

    except Exception as exc:
        logger.error("score_job_match failed for %s: %s", job_id, exc)
        if hasattr(self, 'retry'):
            raise self.retry(exc=exc)


@shared_task(
    queue="ai_scoring",
    name="apps.ai.tasks.rescore_pending_applications"
)
def rescore_pending_applications():
    """Batch score all unscored jobs."""
    from apps.jobs.models import Job

    pending = Job.objects.filter(
        status="discovered",
        ai_match_score__isnull=True,
    ).values_list("id", flat=True)

    count = 0
    for job_id in pending:
        score_job_match(str(job_id))  # inline on Vercel
        count += 1

    logger.info("Scored %d jobs", count)
    return {"scored": count}


@shared_task(
    queue="ai_scoring",
    name="apps.ai.tasks.generate_cover_letter"
)
def generate_cover_letter(job_id: str, user_id: int) -> str:
    """Generate cover letter using Claude API."""
    from apps.jobs.models import Job, Application
    from apps.users.models import UserProfile
    from django.conf import settings

    if not settings.ANTHROPIC_API_KEY:
        return "Cover letter generation requires ANTHROPIC_API_KEY."

    try:
        import anthropic
        job = Job.objects.select_related("company").get(id=job_id)
        profile = UserProfile.objects.get(user_id=user_id)

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = f"""Write a concise cover letter (max 200 words) for:
Role: {job.title} at {job.company.name}
Job description: {job.description[:500]}

Candidate:
- Skills: {", ".join(profile.skills[:10])}
- Experience: {profile.years_experience} years
- Current role: {profile.current_role}

Be direct and specific. No clichés. Start with the first paragraph directly."""

        message = client.messages.create(
            model="claude-opus-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )

        cover_letter = message.content[0].text

        try:
            app = Application.objects.get(job_id=job_id, user_id=user_id)
            app.cover_letter = cover_letter
            app.save(update_fields=["cover_letter"])
        except Application.DoesNotExist:
            pass

        return cover_letter

    except Exception as e:
        logger.error("Cover letter generation failed: %s", e)
        return f"Generation failed: {str(e)}"