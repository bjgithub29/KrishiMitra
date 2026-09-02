import json
from django.conf import settings
from django.http import StreamingHttpResponse
import requests
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from .models import (
    User, Farm, CropPlan, MarketPrice, 
    Recommendation, Alert, Expense, Notification,
    WeatherCache, ChatMessage, PasswordResetOTP
)
from .serializers import (
    UserSerializer, FarmSerializer, CropPlanSerializer,
    MarketPriceSerializer, 
    RecommendationSerializer, AlertSerializer,
    ExpenseSerializer, NotificationSerializer,
    WeatherCacheSerializer, ChatMessageSerializer
)
from . import ml_loader
import pandas as pd
import os

# ─── Helpers ────────────────────────────────────────────────────────────


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user


class OwnerViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

# ─── Auth Views ─────────────────────────────────────────────────────────


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_register(request):
    """Register a new user. Returns { token, user }."""
    data = request.data
    email = data.get('email', '').lower().strip()
    phone = data.get('phone', '').strip()
    password = data.get('password', '')
    first_name = data.get('firstName', '').strip()
    last_name = data.get('lastName', '').strip()

    if not email or not password:
        return Response(
            {'message': 'Email and password are required.'}, status=400)
            
    otp_code = data.get('otp', '').strip()
    if not otp_code:
        return Response({'message': 'OTP is required for registration.'}, status=400)
        
    from .models import AuthOTP
    otp_record = AuthOTP.objects.filter(email=email).last()
    
    if not otp_record or not otp_record.is_valid():
        return Response({'message': 'OTP has expired or does not exist.'}, status=400)
        
    if otp_record.otp != otp_code:
        return Response({'message': 'Invalid OTP.'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response(
            {'message': 'An account with this email already exists.'}, status=400)

    if phone and User.objects.filter(phone=phone).exists():
        return Response(
            {'message': 'Phone number already registered.'}, status=400)

    if not phone:
        import random
        import string
        phone = ''.join(random.choices(string.digits, k=10))

    user = User.objects.create(
        username=email,
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        password=make_password(password),
        role=data.get('role', 'farmer'),
        location=data.get('location', {}),
        farmingMode=data.get('farmingMode', 'moderate'),
    )

    token = get_tokens_for_user(user)
    serializer = UserSerializer(user)
    otp_record.delete()
    return Response({'token': token, 'user': serializer.data}, status=201)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_login(request):
    """Login with email + password. Returns { token, user }."""
    email = request.data.get('email', '').lower().strip()
    password = request.data.get('password', '')

    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'message': 'Invalid email or password.'}, status=401)

    user = authenticate(request, username=user_obj.username, password=password)
    if not user:
        return Response({'message': 'Invalid email or password.'}, status=401)

    token = get_tokens_for_user(user)
    serializer = UserSerializer(user)
    return Response({'token': token, 'user': serializer.data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def auth_me(request):
    """Get logged-in user profile."""
    serializer = UserSerializer(request.user)
    # Frontend expects { user: {...} }
    return Response({'user': serializer.data})


@api_view(['PATCH', 'PUT'])
@permission_classes([permissions.IsAuthenticated])
def auth_update_profile(request):
    """Update the logged-in user's profile."""
    user = request.user
    data = request.data

    if 'firstName' in data:
        user.first_name = data['firstName']
    if 'lastName' in data:
        user.last_name = data['lastName']
    if 'phone' in data:
        user.phone = data['phone']
    if 'language' in data:
        user.language = data['language']
    if 'farmingMode' in data:
        user.farmingMode = data['farmingMode']
    if 'avatarUrl' in data:
        user.avatarUrl = data['avatarUrl']
    if 'location' in data:
        user.location = data['location']
    if 'settings' in data:
        user.settings = data['settings']

    user.save()
    serializer = UserSerializer(user)
    return Response({'user': serializer.data})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def auth_change_password(request):
    """Change the logged-in user's password."""
    user = request.user
    old_password = request.data.get('oldPassword')
    new_password = request.data.get('newPassword')

    if not user.check_password(old_password):
        return Response({'message': 'Incorrect current password.'}, status=400)

    if not new_password or len(new_password) < 6:
        return Response({'message': 'New password must be at least 6 characters long.'}, status=400)

    user.set_password(new_password)
    user.save()
    
    # Optional: Keep user logged in after password change by re-issuing token, or let frontend handle it
    return Response({'message': 'Password changed successfully.'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_request_otp(request):
    from django.core.mail import send_mail
    from django.conf import settings
    from django.utils import timezone
    from datetime import timedelta
    import random
    from .models import AuthOTP

    email = request.data.get('email')
    if not email:
        return Response({'message': 'Email is required'}, status=400)

    otp_code = str(random.randint(100000, 999999))
    
    AuthOTP.objects.filter(email=email).delete()
    AuthOTP.objects.create(
        email=email,
        otp=otp_code,
        expires_at=timezone.now() + timedelta(minutes=15)
    )
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #10b981; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">KrishiMitra</h1>
        </div>
        <div style="padding: 32px 24px; background-color: #ffffff;">
            <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Verify your email address</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                Hello, <br/><br/>
                Please use the following One-Time Password (OTP) to verify your email address and securely log in to your KrishiMitra account.
            </p>
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">{otp_code}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                This code will expire in 15 minutes. If you did not request this, please ignore this email.
            </p>
        </div>
        <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                &copy; {timezone.now().year} KrishiMitra. All rights reserved.<br/>
                Empowering farmers with AI-driven insights.
            </p>
        </div>
    </div>
    """
    
    try:
        send_mail(
            'KrishiMitra - Your Verification Code',
            f'Your login OTP is: {otp_code}. It will expire in 15 minutes.',
            getattr(settings, 'EMAIL_HOST_USER', 'noreply@krishimitra.com'),
            [email],
            fail_silently=False,
            html_message=html_content
        )
    except Exception as e:
        import logging
        logging.getLogger("krishi_core").error("Failed to send email: %s", e)
        return Response({'message': 'Failed to send email. Check SMTP settings.'}, status=500)
        
    return Response({'message': 'OTP sent successfully.'})

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_verify_otp(request):
    from .models import AuthOTP
    
    email = request.data.get('email')
    otp_code = request.data.get('otp')
    
    if not email or not otp_code:
        return Response({'message': 'Email and OTP are required'}, status=400)
        
    otp_record = AuthOTP.objects.filter(email=email).last()
    
    if not otp_record or not otp_record.is_valid():
        return Response({'message': 'OTP has expired or does not exist.'}, status=400)
        
    if otp_record.otp != otp_code:
        return Response({'message': 'Invalid OTP.'}, status=400)
        
    otp_record.delete()
    
    user = User.objects.filter(email=email).first()
    if not user:
        # Create a new user with random string for phone to avoid unique constraint issues initially
        import uuid
        user = User.objects.create(
            username=email,
            email=email,
            first_name="Farmer",
            isVerified=True,
            phone=str(uuid.uuid4())[:15]
        )
        user.set_unusable_password()
        user.save()
        
    refresh = RefreshToken.for_user(user)
    return Response({
        'token': str(refresh.access_token),
        'user': UserSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_check_exists(request):
    from django.db.models import Q
    email = request.data.get('email')
    phone = request.data.get('phone')
    
    if email and User.objects.filter(email=email).exists():
        return Response({'message': 'An account with this email already exists.', 'field': 'email'}, status=400)
        
    if phone and User.objects.filter(phone=phone).exists():
        return Response({'message': 'An account with this phone number already exists.', 'field': 'phone'}, status=400)
        
    return Response({'message': 'Available'})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_forgot_password(request):
    from django.core.mail import send_mail
    from django.conf import settings
    from django.utils import timezone
    from datetime import timedelta
    import random
    
    email = request.data.get('email')
    user = User.objects.filter(email=email).first()
    
    if user:
        # Generate 6-digit OTP
        otp_code = str(random.randint(100000, 999999))
        
        # Save OTP to DB
        PasswordResetOTP.objects.filter(user=user).delete() # Remove old OTPs
        PasswordResetOTP.objects.create(
            user=user,
            otp=otp_code,
            expires_at=timezone.now() + timedelta(minutes=15)
        )
        
        # Send email
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <div style="background-color: #10b981; padding: 24px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">KrishiMitra</h1>
                </div>
                <div style="padding: 32px 24px; background-color: #ffffff;">
                    <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Password Reset Request</h2>
                    <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
                        Hello, <br/><br/>
                        We received a request to reset your KrishiMitra password. Use the following One-Time Password (OTP) to proceed.
                    </p>
                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827;">{otp_code}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                        This code will expire in 15 minutes. If you did not request this, please safely ignore this email.
                    </p>
                </div>
            </div>
            """
            
            send_mail(
                'KrishiMitra - Password Reset OTP',
                f'Your password reset OTP is: {otp_code}. It will expire in 15 minutes.',
                getattr(settings, 'EMAIL_HOST_USER', 'noreply@krishimitra.com'),
                [email],
                fail_silently=False,
                html_message=html_content
            )
        except Exception as e:
            import logging
            logging.getLogger("krishi_core").error("Failed to send email: %s", e)
            return Response({'message': 'Failed to send email. Check SMTP settings.'}, status=500)
            
        return Response({'message': 'If this email is registered, a reset OTP has been sent.'})
    else:
        return Response({'message': 'This email is not registered. Please create an account first.'}, status=404)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def auth_reset_password(request):
    email = request.data.get('email')
    otp_code = request.data.get('otp')
    new_password = request.data.get('newPassword')
    
    user = User.objects.filter(email=email).first()
    if not user:
        return Response({'message': 'Invalid request.'}, status=400)
        
    otp_record = PasswordResetOTP.objects.filter(user=user).last()
    
    if not otp_record or not otp_record.is_valid():
        return Response({'message': 'OTP has expired or does not exist.'}, status=400)
        
    if otp_record.otp != otp_code:
        return Response({'message': 'Invalid OTP.'}, status=400)
        
    user.set_password(new_password)
    user.save()
    
    # Clean up OTP
    otp_record.delete()
    
    return Response({'message': 'Password has been reset successfully. You can now login.'})

# ─── CRUD ViewSets ──────────────────────────────────────────────────────


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return User.objects.filter(id=self.request.user.id)


class FarmViewSet(OwnerViewSet):
    queryset = Farm.objects.all()
    serializer_class = FarmSerializer

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        # Frontend expects a plain array for /api/farms
        return Response(serializer.data)


class CropPlanViewSet(OwnerViewSet):
    queryset = CropPlan.objects.all()
    serializer_class = CropPlanSerializer

    def get_queryset(self):
        if not self.request.user or self.request.user.is_anonymous:
            qs = CropPlan.objects.none()
        else:
            qs = super().get_queryset()
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        return qs

    def perform_create(self, serializer):
        plan = serializer.save(owner=self.request.user)
        # Note: We now only generate crop plan timelines via /api/recommendations 
        # and do not pre-generate daily schedules automatically here.

    @action(detail=True, methods=['post'], url_path='drop')
    def drop_plan(self, request, pk=None):
        plan = self.get_object()
        plan.delete()
        return Response({'message': 'Plan dropped', 'tasksRemoved': 0})



    @action(detail=False,
            methods=['get'],
            url_path='supported-crops',
            permission_classes=[permissions.AllowAny])
    def supported_crops(self, request):
        try:
            csv_path = os.path.join(
                os.path.dirname(__file__),
                'data',
                '01_crop_profile.csv')
            df = pd.read_csv(csv_path)
            crops = df['crop_name'].dropna().unique().tolist()
            return Response(sorted(crops))
        except Exception:
            # Fallback
            return Response(['Wheat', 'Cotton', 'Soybean',
                            'Groundnut', 'Onion', 'Tomato'])

    @action(detail=False,
            methods=['get'],
            url_path='companion-suggestions',
            permission_classes=[permissions.AllowAny])
    def companion_suggestions(self, request):
        crop = request.query_params.get('crop', '').strip().lower()
        
        # Intercropping Compatibility Matrix
        matrix = {
            'wheat': ['Mustard', 'Chickpea', 'Linseed'],
            'cotton': ['Pigeon Pea', 'Cowpea', 'Soybean'],
            'soybean': ['Maize', 'Pigeon Pea', 'Sorghum'],
            'groundnut': ['Sunflower', 'Pearl Millet'],
            'tomato': ['Marigold', 'Basil', 'Onion'],
            'onion': ['Tomato', 'Cabbage', 'Carrot'],
            'maize': ['Soybean', 'Cowpea', 'Pumpkin']
        }
        
        if crop in matrix:
            return Response(matrix[crop])
        
        # Fallback to generic beneficial cover crops for unmapped crops
        return Response(['Clover', 'Alfalfa', 'Cowpea'])

class MarketPriceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MarketPrice.objects.all()
    serializer_class = MarketPriceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = MarketPrice.objects.all()
        state = self.request.query_params.get('state')
        district = self.request.query_params.get('district')
        market_q = self.request.query_params.get('market')
        commodity = self.request.query_params.get('commodity')
        limit = int(self.request.query_params.get('limit', 200))
        if state:
            qs = qs.filter(state__iexact=state)
        if district:
            qs = qs.filter(district__iexact=district)
        if market_q:
            qs = qs.filter(market__iexact=market_q)
        if commodity:
            qs = qs.filter(commodity__icontains=commodity)
        return qs[:limit]

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        last = MarketPrice.objects.order_by('-fetchedAt').first()
        return Response({
            'source': 'database',
            'records': serializer.data,
            'lastUpdated': last.fetchedAt if last else None,
            'needsRefresh': False,
        })


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def market_locations(request):
    """Return distinct states and commodities for dropdowns."""
    state_filter = request.query_params.get('state')
    qs = MarketPrice.objects.all()
    if state_filter:
        qs = qs.filter(state__iexact=state_filter)
    states = list(MarketPrice.objects.values_list(
        'state', flat=True).distinct().order_by('state'))
    commodities = list(
        qs.values_list(
            'commodity',
            flat=True).distinct().order_by('commodity'))
    districts = []
    if state_filter:
        districts = list(
            qs.values_list(
                'district',
                flat=True).distinct().order_by('district'))
    return Response({'states': states,
                     'commodities': commodities,
                     'districts': districts})





class RecommendationViewSet(OwnerViewSet):
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        return qs


class AlertViewSet(OwnerViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer


class ExpenseViewSet(OwnerViewSet):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer


class NotificationViewSet(OwnerViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer


class ChatMessageViewSet(OwnerViewSet):
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        session_id = self.request.query_params.get('sessionId')
        if session_id:
            qs = qs.filter(sessionId=session_id)
        return qs.order_by('created_at')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def chat_stream(request):
    """Streams a chat response from Ollama (or Gemini if preferred)."""
    user_msg = request.data.get('message', '')
    session_id = request.data.get('sessionId', 'default')
    force_json = request.data.get('forceJson', False)
    field_id = request.data.get('field_id', None)

    # Retrieve RAG context from ChromaDB if available
    rag_context = ""
    chroma_client = ml_loader.state.get("chroma_client")
    if chroma_client:
        try:
            all_collections = chroma_client.list_collections()
            pooled_results = []
            main_col = ml_loader.state.get("collection")
            ef = main_col._embedding_function if main_col else None
            for col_meta in all_collections:
                col_name = col_meta.name if hasattr(
                    col_meta, "name") else col_meta
                col = chroma_client.get_collection(
                    col_name, embedding_function=ef)
                if col.count() > 0:
                    res = col.query(
                        query_texts=[user_msg], n_results=min(
                            col.count(), 3))
                    if res.get("documents") and len(res["documents"]) > 0:
                        pooled_results.extend(res["documents"][0])
            if pooled_results:
                rag_context = "\n\nContext from Knowledge Base:\n" + \
                    "\n---\n".join(pooled_results[:4])
        except Exception:
            pass



    farm_id = request.data.get('farmId')

    from datetime import datetime
    datetime.now().strftime("%Y-%m-%d")

    if force_json:
        import re
        import os
        import pandas as pd
        from datetime import datetime, timedelta

        crop_match = re.search(r"Crop:\s*([^,]+)", user_msg, re.IGNORECASE)
        season_match = re.search(r"Season:\s*([^,]+)", user_msg, re.IGNORECASE)

        req_crop = crop_match.group(1).strip(
        ).capitalize() if crop_match else "Soybean"
        req_season = season_match.group(
            1).strip() if season_match else "Kharif"

        sowing_date_obj = datetime.now()
        sowing_date_str = sowing_date_obj.strftime("%Y-%m-%d")

        data_dir = os.path.join(settings.BASE_DIR, "krishi_core", "data")
        tasks_csv = os.path.join(data_dir, "02_crop_task_calendar.csv")
        fert_csv = os.path.join(data_dir, "06_crop_fertilizer_plan.csv")
        profile_csv = os.path.join(data_dir, "01_crop_profile.csv")

        milestones = []
        tasks = []
        irrigation_cycles = []
        fertilizer_events = []
        harvest_date_obj = sowing_date_obj + timedelta(days=100)  # Default

        try:
            # 1. Load data
            df_tasks = pd.read_csv(tasks_csv)
            df_fert = pd.read_csv(fert_csv)
            df_prof = pd.read_csv(profile_csv)

            # Filter for crop
            crop_tasks = df_tasks[df_tasks['crop_name'].str.lower(
            ) == req_crop.lower()]
            crop_fert = df_fert[df_fert['crop_name'].str.lower()
                                == req_crop.lower()]
            crop_prof = df_prof[df_prof['crop_name'].str.lower()
                                == req_crop.lower()]

            if not crop_prof.empty:
                harvest_days = crop_prof.iloc[0].get('harvest_days', 100)
                harvest_date_obj = sowing_date_obj + \
                    timedelta(days=int(harvest_days))

            if not crop_tasks.empty:
                # Group by stage to create milestones
                stages = crop_tasks['stage'].unique()
                for stage in stages:
                    stage_tasks = crop_tasks[crop_tasks['stage'] == stage]
                    start_day = stage_tasks['day_from_sowing_start'].min()
                    end_day = stage_tasks['day_from_sowing_end'].max()
                    start_date = sowing_date_obj + \
                        timedelta(days=int(start_day))

                    milestones.append({
                        "stage": stage,
                        "plannedDate": start_date.strftime("%Y-%m-%d"),
                        "description": f"Expected duration around {int(end_day - start_day)} days."
                    })

                # Create detailed tasks
                for _, row in crop_tasks.iterrows():
                    start_day = int(row['day_from_sowing_start'])
                    task_date = sowing_date_obj + timedelta(days=start_day)

                    tasks.append({
                        "title": row['task'],
                        "date": task_date.strftime("%Y-%m-%d"),
                        "category": row['task_category'].lower().replace(' ', '_'),
                        "priority": row['priority'].lower(),
                        "description": row['description']
                    })

                    if "irrigat" in row['task_category'].lower(
                    ) or "irrigat" in row['task'].lower():
                        irrigation_cycles.append({
                            "day": start_day,
                            "method": "As per profile",
                            "duration": row['description']
                        })

            if not crop_fert.empty:
                # Inject basic fertilizer doses as tasks
                for _, row in crop_fert.iterrows():
                    stage = row['stage'].lower()
                    # Determine approx day
                    day_offset = 0
                    if "basal" in stage:
                        day_offset = 0
                    elif "top-dress 1" in stage:
                        day_offset = 30
                    elif "top-dress 2" in stage:
                        day_offset = 60

                    task_date = sowing_date_obj + timedelta(days=day_offset)

                    tasks.append({
                        "title": f"Apply Fertilizer ({row['stage']})",
                        "date": task_date.strftime("%Y-%m-%d"),
                        "category": "fertilizer",
                        "priority": "high",
                        "description": f"{row['products_and_dose']} - {row['purpose']}"
                    })
                    fertilizer_events.append({
                        "day": day_offset,
                        "type": "Specific",
                        "amount": row['products_and_dose']
                    })
                    
            # 2. Add AI-driven Soil Fixes & Smart Fertilizer Suggestions
            try:
                from .services.ai_engine.llm_service import llm_service
                
                farm = Farm.objects.filter(id=farm_id).first() if farm_id else None
                if farm and (farm.ph or farm.nitrogen or farm.ec):
                    ideal_soil_text = crop_prof.iloc[0]['soil_type'] if not crop_prof.empty else "well drained, neutral pH"
                    
                    prompt = f"""
You are an expert agronomist. 
We are creating a crop plan for {req_crop}. The ideal soil condition for this crop is: {ideal_soil_text}.
The user's farm soil test report shows:
pH: {farm.ph or 'Unknown'}
Nitrogen: {farm.nitrogen or 'Unknown'} kg/ha
Phosphorus: {farm.phosphorus or 'Unknown'} kg/ha
Potassium: {farm.potassium or 'Unknown'} kg/ha
Organic Carbon: {farm.organicCarbon or 'Unknown'} %
EC: {farm.ec or 'Unknown'} dS/m

Output ONLY a raw JSON object with this exact schema:
{{
  "fixes": "A short, actionable paragraph explaining exactly what needs to be fixed to reach ideal conditions for {req_crop}.",
  "fertilizer_recommendation": "A specific fertilizer suggestion based on the deficiencies.",
  "add_as_task": true,
  "task_title": "Soil Correction & Pre-sowing Fertilization",
  "task_description": "Short summary of the fertilizer action required."
}}
"""
                    ai_response = llm_service.generate_response(prompt)
                    if isinstance(ai_response, dict) and not "error" in ai_response:
                        milestones.insert(0, {
                            "stage": "Pre-sowing Soil Correction",
                            "plannedDate": sowing_date_str,
                            "description": ai_response.get("fixes", "Adjust soil nutrients before sowing.")
                        })
                        fertilizer_events.append({
                            "day": 0,
                            "type": "Custom AI Recommendation",
                            "amount": ai_response.get("fertilizer_recommendation", "Apply standard NPK basal dose.")
                        })
                        if ai_response.get("add_as_task"):
                            tasks.append({
                                "title": ai_response.get("task_title", "Soil Correction"),
                                "date": sowing_date_str,
                                "category": "fertilizer",
                                "priority": "high",
                                "description": ai_response.get("task_description", "Apply recommended fertilizers to correct soil profile.")
                            })
            except Exception as e:
                print(f"Error calling LLM for soil fixes: {e}")

        except Exception as e:
            print(f"Error parsing pandas plan: {e}")

        result = {
            "cropPlan": {
                "cropName": req_crop,
                "season": req_season,
                "sowingDate": sowing_date_str,
                "expectedHarvestDate": harvest_date_obj.strftime("%Y-%m-%d"),
                "milestones": milestones,
                "irrigationCycles": irrigation_cycles,
                "fertilizerEvents": fertilizer_events
            },
            "tasks": tasks
        }
        return Response({"result": result})

    # Save user message
    ChatMessage.objects.create(
        owner=request.user,
        sessionId=session_id,
        role='user',
        content=user_msg
    )

    def generate():
        ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        ollama_model = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:1b')

        system_prompt = "You are KrishiMitra, an agricultural AI assistant for Indian farmers. "
        if rag_context:
            system_prompt += f"You MUST answer the user's question ONLY using the following context. If the context does not contain the answer, explicitly state 'I do not have enough information to answer that based on the provided documents.' Do not hallucinate external information.\n{rag_context}\n\n"

        prompt_text = f"{system_prompt}User Question: {user_msg}\nAnswer concisely:"

        full_response = ""
        provider_used = None

        # ── Tier 1: Try Local Ollama ──────────────────────────────────────────
        try:
            payload = {
                "model": ollama_model,
                "prompt": prompt_text,
                "stream": True,
            }
            with requests.post(ollama_url, json=payload, stream=True, timeout=(1.5, 30)) as r:
                if r.status_code == 200:
                    for line in r.iter_lines():
                        if line:
                            decoded = line.decode('utf-8')
                            try:
                                data = json.loads(decoded)
                                chunk = data.get("response", "")
                                if chunk:
                                    provider_used = "ollama"
                                    full_response += chunk
                                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                            except json.JSONDecodeError:
                                pass
        except Exception:
            pass

        # ── Tier 2: Try Cloud Gemini 2.5 Flash ────────────────────────────────
        if not provider_used:
            gemini_key = getattr(settings, "GEMINI_API_KEY", "")
            if gemini_key:
                try:
                    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
                    gemini_payload = {
                        "contents": [{"parts": [{"text": prompt_text}]}]
                    }
                    res = requests.post(gemini_url, json=gemini_payload, headers={"Content-Type": "application/json"}, timeout=(3.0, 20.0))
                    if res.status_code == 200:
                        candidates = res.json().get("candidates", [])
                        if candidates:
                            text_resp = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            if text_resp:
                                provider_used = "gemini"
                                full_response = text_resp
                                chunk_size = 48
                                for i in range(0, len(text_resp), chunk_size):
                                    yield f"data: {json.dumps({'chunk': text_resp[i:i+chunk_size]})}\n\n"
                except Exception:
                    pass

        # ── Tier 3: Direct ChromaDB Knowledge Base Fallback ───────────────────
        if not provider_used:
            if rag_context and rag_context.strip():
                provider_used = "chroma_direct"
                header = "### Verified Knowledge Base Information\n\n*(AI generation offline — displaying verified agronomic records from KrishiMitra Knowledge Base)*\n\n"
                body = header + rag_context.strip()
                full_response = body
                chunk_size = 64
                for i in range(0, len(body), chunk_size):
                    yield f"data: {json.dumps({'chunk': body[i:i+chunk_size]})}\n\n"
            else:
                # ── Tier 4: Clean Insufficient Information Notice ─────────────
                provider_used = "none"
                msg = "I do not have enough verified information in the KrishiMitra knowledge base to answer this question, and the AI server is currently offline. Please ask an agronomic question regarding crop plans, diseases, soil, or farming practices."
                full_response = msg
                yield f"data: {json.dumps({'chunk': msg})}\n\n"

        yield "data: [DONE]\n\n"

        # Save AI response
        if full_response:
            try:
                ChatMessage.objects.create(
                    owner=request.user,
                    sessionId=session_id,
                    role='assistant',
                    content=full_response,
                    contextSnapshot={"provider": provider_used}
                )
            except Exception:
                pass

    response = StreamingHttpResponse(
        generate(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    return response


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def chat_sync_plan(request):
    """Saves a generated crop plan or schedule from the AI."""
    sync_data = request.data.get('syncData', {})
    farm_id = request.data.get('farmId')

    try:
        farm = Farm.objects.get(id=farm_id, owner=request.user)
    except Farm.DoesNotExist:
        return Response({'message': 'Farm not found.'}, status=404)

    tasks_generated = 0
    plan_obj = None

    import uuid
    plan_data = sync_data.get('cropPlan')
    if plan_data:
        # Match MongoDB structure for milestones
        milestones = plan_data.get('milestones', [])
        for m in milestones:
            m['_id'] = m.get('_id', str(uuid.uuid4()))
            m['status'] = m.get('status', 'pending')
            m['notes'] = m.get('notes', '')

        plan_obj = CropPlan.objects.create(
            owner=request.user,
            farm=farm,
            cropName=plan_data.get('cropName', 'Unknown Crop'),
            season=plan_data.get('season', 'Unknown'),
            sowingDate=plan_data.get('sowingDate', '2025-01-01'),
            expectedHarvestDate=plan_data.get('expectedHarvestDate', '2025-06-01'),
            milestones=plan_data.get('milestones', []),
            irrigationCycles=plan_data.get('irrigationCycles', []),
            fertilizerEvents=plan_data.get('fertilizerEvents', []),
            estimatedCost=plan_data.get('estimatedCost', 0) or 0,
            targetYieldKg=plan_data.get('targetYieldKg', 0) or 0,
            status='active'
        )

    return Response({'success': True})


@api_view(['GET'])
def soil_reports(request):
    # Dummy mock returning empty array for compatibility with frontend
    return Response([])


@api_view(['GET'])
def chat_sessions(request):
    # Get distinct session ids
    messages = ChatMessage.objects.filter(
        owner=request.user).order_by('-created_at')
    sessions = []
    seen = set()
    for msg in messages:
        if msg.sessionId not in seen:
            seen.add(msg.sessionId)
            sessions.append({
                'sessionId': msg.sessionId,
                'preview': str(msg.content)[:50] + '...' if msg.content else '',
                'timestamp': msg.created_at
            })
    return Response(sessions)


@api_view(['GET'])
def chat_history(request, sid):
    messages = ChatMessage.objects.filter(
        owner=request.user,
        sessionId=sid).order_by('created_at')
    data = []
    for m in messages:
        data.append({
            'role': m.role,
            'content': m.content,
            'timestamp': m.created_at
        })
    return Response(data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def weather_cache_get(request, key):
    try:
        cache = WeatherCache.objects.get(locationKey=key)
        return Response(WeatherCacheSerializer(cache).data)
    except WeatherCache.DoesNotExist:
        return Response({'message': 'Not found'}, status=404)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def weather_cache_set(request):
    key = request.data.get('locationKey')
    if not key:
        return Response({'error': 'locationKey required'}, status=400)

    cache, created = WeatherCache.objects.update_or_create(
        locationKey=key,
        defaults={
            'cityName': request.data.get('cityName', ''),
            'lat': request.data.get('lat'),
            'lon': request.data.get('lon'),
            'data': request.data.get('data', {})
        }
    )
    return Response(WeatherCacheSerializer(cache).data)



