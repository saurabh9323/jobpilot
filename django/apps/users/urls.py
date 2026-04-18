from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
import jwt
from django.conf import settings
from datetime import datetime, timedelta, timezone

from .models import User, UserProfile


def _make_token(user: User) -> str:
    payload = {
        "userId": user.id,
        "email": user.email,
        "exp": datetime.now(tz=timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").lower().strip()
        password = request.data.get("password", "")

        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({"detail": "Invalid credentials"}, status=401)

        token = _make_token(user)
        return Response({
            "token": token,
            "user": {"id": user.id, "email": user.email, "name": user.get_full_name()},
        })


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").lower().strip()
        password = request.data.get("password", "")
        name = request.data.get("name", "")

        if User.objects.filter(email=email).exists():
            return Response({"detail": "Email already registered"}, status=400)

        first, *rest = name.split(" ") if name else ["", ""]
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first,
            last_name=" ".join(rest),
        )
        UserProfile.objects.create(user=user)

        token = _make_token(user)
        return Response({"token": token, "user": {"id": user.id, "email": user.email}}, status=201)


class ProfileView(APIView):
    def get(self, request):
        try:
            profile = request.user.profile
        except UserProfile.DoesNotExist:
            profile = UserProfile.objects.create(user=request.user)

        return Response({
            "id": request.user.id,
            "email": request.user.email,
            "name": request.user.get_full_name(),
            "profile": {
                "current_role":        profile.current_role,
                "target_roles":        profile.target_roles,
                "years_experience":    profile.years_experience,
                "skills":              profile.skills,
                "salary_floor":        profile.salary_floor,
                "salary_ceiling":      profile.salary_ceiling,
                "preferred_locations": profile.preferred_locations,
                "remote_only":         profile.remote_only,
                "auto_apply":          profile.auto_apply,
                "auto_outreach":       profile.auto_outreach,
            },
        })

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        fields = [
            "current_role", "target_roles", "years_experience", "skills",
            "salary_floor", "salary_ceiling", "preferred_locations",
            "remote_only", "auto_apply", "auto_outreach", "resume_text",
            "blacklisted_companies", "preferred_company_sizes",
        ]
        for field in fields:
            if field in request.data:
                setattr(profile, field, request.data[field])
        profile.save()
        return Response({"status": "updated"})


urlpatterns = [
    path("login/",    LoginView.as_view(),   name="login"),
    path("register/", RegisterView.as_view(), name="register"),
    path("me/",       ProfileView.as_view(),  name="profile"),
]
