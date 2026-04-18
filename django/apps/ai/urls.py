"""
apps/ai/urls.py + apps/ai/views.py combined for brevity.
Split into separate files as the project grows.
"""
# ── urls.py ──────────────────────────────────────────────────────────────────
from django.urls import path
from .views import (
    CoverLetterView,
    ATSScoreView,
    JobIngestView,
)

urlpatterns = [
    path("cover-letter/",  CoverLetterView.as_view(),  name="cover-letter"),
    path("ats-score/",     ATSScoreView.as_view(),     name="ats-score"),
    path("jobs/ingest/",   JobIngestView.as_view(),    name="jobs-ingest"),
]
