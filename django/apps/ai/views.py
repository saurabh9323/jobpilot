"""
JobPilot AI — AI/ML REST views
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from apps.jobs.models import Job, Company
from .tasks import generate_cover_letter, score_job_match

logger = logging.getLogger(__name__)


class CoverLetterView(APIView):
    """
    POST /api/ai/cover-letter/
    Body: { "job_id": "<uuid>" }
    Returns: { "cover_letter": "..." }
    """
    def post(self, request):
        job_id = request.data.get("job_id")
        if not job_id:
            return Response({"error": "job_id required"}, status=400)

        task = generate_cover_letter.delay(str(job_id), request.user.id)
        return Response({"task_id": task.id, "status": "queued"})


class ATSScoreView(APIView):
    """
    POST /api/ai/ats-score/
    Body: { "job_id": "<uuid>", "resume_text": "..." }
    Returns: { "score": 0.82, "gaps": ["Add 'Kubernetes' to resume", ...] }
    """
    def post(self, request):
        job_id = request.data.get("job_id")
        resume_text = request.data.get("resume_text", "")

        if not job_id or not resume_text:
            return Response({"error": "job_id and resume_text required"}, status=400)

        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found"}, status=404)

        # Inline scoring for immediate response (< 500ms)
        score, gaps = _compute_ats_score(job.description, resume_text, job.skills_required)

        # Also kick off full AI scoring in background
        score_job_match.apply_async(args=[job_id], queue="ai_scoring")

        return Response({"score": score, "gaps": gaps})


def _compute_ats_score(jd: str, resume: str, required_skills: list) -> tuple[float, list]:
    """
    Fast ATS gap analysis:
    1. Keyword presence check (required_skills vs resume)
    2. Keyword density scoring
    Returns (score 0-1, gap_list)
    """
    jd_lower = jd.lower()
    resume_lower = resume.lower()

    missing = []
    present = 0

    for skill in required_skills:
        if skill.lower() in resume_lower:
            present += 1
        else:
            # Check if similar term exists
            aliases = _skill_aliases(skill)
            if any(a in resume_lower for a in aliases):
                present += 0.7
            else:
                missing.append(skill)

    coverage = present / max(len(required_skills), 1)

    # Bonus: check for action verbs and impact statements
    power_words = ["improved", "reduced", "built", "designed", "led", "scaled", "shipped"]
    power_score = sum(1 for w in power_words if w in resume_lower) / len(power_words)

    final_score = round(coverage * 0.75 + power_score * 0.25, 3)

    gaps = [f"Add '{s}' to your resume" for s in missing[:5]]
    if power_score < 0.4:
        gaps.append("Add more impact-driven action verbs (e.g. 'reduced latency by 40%')")

    return final_score, gaps


def _skill_aliases(skill: str) -> list[str]:
    ALIASES = {
        "node.js": ["nodejs", "node js"],
        "react":   ["reactjs", "react.js"],
        "python":  ["python3", "py"],
        "postgresql": ["postgres", "psql"],
        "kubernetes": ["k8s"],
        "typescript": ["ts"],
    }
    return ALIASES.get(skill.lower(), [])


class JobIngestView(APIView):
    """
    POST /api/ai/jobs/ingest/
    Called by the Playwright scraper — authenticated via X-Scraper-Key header.
    Body: { "jobs": [...raw job objects] }
    """
    permission_classes = [AllowAny]  # protected by X-Scraper-Key check below

    def post(self, request):
        # Validate scraper key
        key = request.headers.get("X-Scraper-Key", "")
        from django.conf import settings
        if key != getattr(settings, "SCRAPER_API_KEY", "dev-scraper-key"):
            return Response({"error": "Forbidden"}, status=403)

        jobs_data = request.data.get("jobs", [])
        if not jobs_data:
            return Response({"error": "jobs array required"}, status=400)

        created = 0
        skipped = 0

        for raw in jobs_data:
            try:
                # Get or create company
                company, _ = Company.objects.get_or_create(
                    name=raw.get("company_name", "Unknown"),
                    defaults={"domain": _extract_domain(raw.get("source_url", ""))},
                )

                # Skip if already ingested (dedup by source_url)
                if Job.objects.filter(source_url=raw["source_url"]).exists():
                    skipped += 1
                    continue

                Job.objects.create(
                    company=company,
                    title=raw.get("title", ""),
                    description=raw.get("description", ""),
                    location=raw.get("location", ""),
                    remote=raw.get("remote", False),
                    salary_min=raw.get("salary_min"),
                    salary_max=raw.get("salary_max"),
                    experience_min=raw.get("experience_min"),
                    experience_max=raw.get("experience_max"),
                    skills_required=raw.get("skills_required", []),
                    source=raw.get("source", "direct"),
                    source_url=raw["source_url"],
                    source_job_id=raw.get("source_job_id", ""),
                    posted_at=raw.get("posted_at"),
                    status="discovered",
                )
                created += 1

                # Queue AI scoring for newly ingested jobs
                if created % 10 == 0:  # batch-queue to avoid flooding
                    from apps.ai.tasks import rescore_pending_applications
                    rescore_pending_applications.apply_async(queue="ai_scoring")

            except Exception as e:
                logger.error("Failed to ingest job: %s — %s", raw.get("source_url"), e)

        logger.info("Ingested %d new jobs, skipped %d dupes", created, skipped)
        return Response({"created": created, "skipped": skipped})


def _extract_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""
