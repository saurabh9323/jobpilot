from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.scraper.tasks import scrape_portal, scrape_all_portals


class TriggerScrapeView(APIView):
    def post(self, request):
        portal = request.data.get("portal", "all")
        if portal == "all":
            scrape_all_portals.apply_async(queue="scraping")
            return Response({"status": "queued", "portals": "all"})
        else:
            task = scrape_portal.apply_async(args=[portal], queue="scraping")
            return Response({"status": "queued", "portal": portal, "task_id": task.id})


urlpatterns = [
    path("trigger/", TriggerScrapeView.as_view(), name="scrape-trigger"),
]
