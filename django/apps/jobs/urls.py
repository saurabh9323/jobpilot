from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import JobViewSet, ApplicationViewSet, ScrapeRunViewSet

router = DefaultRouter()
router.register("jobs",         JobViewSet,         basename="job")
router.register("applications", ApplicationViewSet, basename="application")
router.register("scrape-runs",  ScrapeRunViewSet,   basename="scrape-run")

urlpatterns = [
    path("", include(router.urls)),
]
