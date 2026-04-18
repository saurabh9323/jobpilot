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

    # OpenAPI schema
    path("api/schema/",              SpectacularAPIView.as_view(),       name="schema"),
    path("api/schema/swagger-ui/",   SpectacularSwaggerView.as_view(),   name="swagger-ui"),
    path("api/schema/redoc/",        SpectacularRedocView.as_view(),     name="redoc"),

    # App routes
    path("api/users/",   include("apps.users.urls")),
    path("api/ai/",      include("apps.jobs.urls")),        # jobs, applications, scrape-runs
    path("api/ai/",      include("apps.ai.urls")),          # cover-letter, ats-score, scoring
    path("api/scraper/", include("apps.scraper.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
