from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # Health check — Vercel uses this to verify deployment
    path("api/health/", lambda request: __import__('django.http', fromlist=['JsonResponse']).JsonResponse({"status": "ok"})),

    # OpenAPI docs
    path("api/schema/", SpectacularAPIView.as_view(),                      name="schema"),
    path("api/docs/",   SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/",  SpectacularRedocView.as_view(url_name="schema"),   name="redoc"),

    # App routes
    path("api/users/",   include("apps.users.urls")),
    path("api/ai/",      include("apps.jobs.urls")),
    path("api/ai/",      include("apps.ai.urls")),
    path("api/scraper/", include("apps.scraper.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)