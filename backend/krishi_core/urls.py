from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import views_ml
from . import views_predictions

router = DefaultRouter(trailing_slash=False)
router.register(r'users', views.UserViewSet)
router.register(r'farms', views.FarmViewSet)
router.register(r'crop-plans', views.CropPlanViewSet)
router.register(r'recommendations', views.RecommendationViewSet)
router.register(r'alerts', views.AlertViewSet)
router.register(r'expenses', views.ExpenseViewSet)
router.register(r'notifications', views.NotificationViewSet)
router.register(r'chat/messages', views.ChatMessageViewSet)
router.register(r'market/prices', views.MarketPriceViewSet)

urlpatterns = [
    path('', include(router.urls)),

    # Auth endpoints — matching the old Node.js /api/auth/* routes exactly
    path('auth/register', views.auth_register, name='auth_register'),
    path('auth/login', views.auth_login, name='auth_login'),
    path('auth/me', views.auth_me, name='auth_me'),
    path('auth/profile', views.auth_update_profile, name='auth_update_profile'),
    path('auth/check-exists', views.auth_check_exists, name='auth_check_exists'),
    path('auth/change-password', views.auth_change_password, name='auth_change_password'),
    path('auth/forgot-password', views.auth_forgot_password, name='auth_forgot_password'),
    path('auth/reset-password', views.auth_reset_password, name='auth_reset_password'),

    # OTP Login
    path('auth/otp/request', views.auth_request_otp, name='auth_request_otp'),
    path('auth/otp/verify', views.auth_verify_otp, name='auth_verify_otp'),
    path('soil-reports', views.soil_reports, name='soil_reports'),
    
    # Weather cache
    path('weather/cache/<str:key>', views.weather_cache_get, name='weather_cache_get'),
    path('weather/cache', views.weather_cache_set, name='weather_cache_set'),
    
    # Chat AI endpoints
    path('chat/sessions', views.chat_sessions, name='chat_sessions'),
    path('chat/sync-plan', views.chat_sync_plan, name='chat_sync_plan'),
    path('chat', views.chat_stream, name='chat_stream'),
    path('chat/<str:sid>', views.chat_history, name='chat_history'),
    
    # Market endpoints
    path('market/locations', views.market_locations, name='market_locations'),
    
    # ML & Weather endpoints
    path("retrieve", views_ml.RetrieveView.as_view()),
    path("soil_recommend", views_ml.SoilRecommendView.as_view()),
    path("crop_stage_tips", views_ml.CropStageTipsView.as_view()),
    path("disease/predict", views_ml.PredictDiseaseView.as_view()),
    path("health", views_ml.HealthView.as_view()),
    path("weather", views_ml.WeatherView.as_view()),

    # Advanced AI Predictions
    path("predict_yield", views_predictions.CropYieldPredictionView.as_view()),
    path("recommend_fertilizer", views_predictions.FertilizerRecommendationView.as_view()),
    path("predict_irrigation", views_predictions.IrrigationPredictionView.as_view()),
    
    # Decision Engine Orchestrator
    path("ai_recommendation", views_ml.DecisionEngineView.as_view()),
]
