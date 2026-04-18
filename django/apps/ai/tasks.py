"""
JobPilot AI — Celery tasks for AI/ML scoring pipeline
"""
import logging
from django.conf import settings

try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(func):
            return func
        if len(args) == 1 and callable(args[0]):
            return args[0]
        return decorator

logger = logging.getLogger(__name__)

# Lazy-load heavy models so worker startup stays fast
_embedder = None


def get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


@shared_task(
    bind=True,
    queue="ai_scoring",
    max_retries=3,
    default_retry_delay=60,
    name="apps.ai.tasks.score_job_match",
)
def score_job_match(self, job_id: str):
    """
    Score a single job against the user's profile using:
    1. Sentence-transformer cosine similarity (description vs resume)
    2. Skills overlap ratio
    3. Salary band match
    4. Seniority alignment
    Final score = weighted sum → 0.0–1.0
    """
    from apps.jobs.models import Job
    from apps.users.models import UserProfile

    try:
        job = Job.objects.select_related("company").get(id=job_id)
        profile = UserProfile.objects.filter(is_active=True).first()
        if not profile:
            logger.warning("No active user profile — skipping scoring for %s", job_id)
            return

        embedder = get_embedder()

        # 1. Semantic similarity
        job_embedding = embedder.encode(job.description, normalize_embeddings=True)
        resume_embedding = embedder.encode(profile.resume_text, normalize_embeddings=True)
        semantic_score = float((job_embedding @ resume_embedding).clip(0, 1))

        job.description_embedding = job_embedding.tolist()

        # 2. Skills overlap
        job_skills = {s.lower() for s in job.skills_required}
        user_skills = {s.lower() for s in profile.skills}
        skills_score = len(job_skills & user_skills) / max(len(job_skills), 1)

        # 3. Salary match
        salary_score = 1.0
        if job.salary_min and profile.salary_floor:
            if job.salary_max and job.salary_max < profile.salary_floor * 0.8:
                salary_score = 0.2
            elif job.salary_min and job.salary_min > profile.salary_ceiling * 1.3:
                salary_score = 0.5

        # 4. Weighted final score
        match_score = (
            semantic_score * 0.50 +
            skills_score   * 0.35 +
            salary_score   * 0.15
        )

        job.ai_match_score = round(match_score, 4)
        job.status = "scored"
        job.save(update_fields=["ai_match_score", "status", "description_embedding"])

        logger.info("Scored job %s → %.2f", job.title, match_score)
        return {"job_id": job_id, "score": match_score}

    except Exception as exc:
        logger.error("score_job_match failed for %s: %s", job_id, exc)
        if hasattr(self, 'retry'):
            raise self.retry(exc=exc)
        raise exc


@shared_task(queue="ai_scoring", name="apps.ai.tasks.rescore_pending_applications")
def rescore_pending_applications():
    """Batch re-score all 'discovered' jobs. Runs hourly via Celery Beat."""
    from apps.jobs.models import Job

    pending = Job.objects.filter(
        status="discovered",
        ai_match_score__isnull=True,
    ).values_list("id", flat=True)

    count = 0
    for job_id in pending:
        score_job_match.apply_async(args=[str(job_id)], queue="ai_scoring")
        count += 1

    logger.info("Queued %d jobs for AI scoring", count)
    return {"queued": count}


@shared_task(queue="ai_scoring", name="apps.ai.tasks.generate_cover_letter")
def generate_cover_letter(job_id: str, user_id: int) -> str:
    """
    Use Claude to generate a tailored cover letter.
    """
    from apps.jobs.models import Job, Application
    from apps.users.models import UserProfile
    import anthropic

    job = Job.objects.select_related("company").get(id=job_id)
    profile = UserProfile.objects.get(user_id=user_id)

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt = f"""Write a concise, compelling cover letter (max 250 words) for this role.

Role: {job.title} at {job.company.name}
Job description excerpt: {job.description[:800]}

Candidate profile:
- Skills: {", ".join(profile.skills[:15])}
- Total experience: {profile.years_experience} years
- Current/last role: {profile.current_role}
- Key achievement: {profile.top_achievement}

Tone: professional but direct. Avoid clichés. Highlight the top 2 relevant skills.
Do NOT include "Dear Hiring Manager" or a salutation — start with the first paragraph.
"""

    message = client.messages.create(
        model="claude-opus-4-20250514",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )

    cover_letter = message.content[0].text

    try:
        application = Application.objects.get(job_id=job_id, user_id=user_id)
        application.cover_letter = cover_letter
        application.save(update_fields=["cover_letter"])
    except Application.DoesNotExist:
        pass

    return cover_letter