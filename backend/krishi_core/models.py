from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class User(AbstractUser):
    # Override standard fields if needed, but AbstractUser gives us username, first_name, last_name, email, password
    phone = models.CharField(max_length=20, unique=True)
    googleId = models.CharField(max_length=100, unique=True, null=True, blank=True)
    role = models.CharField(
        max_length=20,
        choices=[("farmer", "Farmer"), ("advisor", "Advisor")],
        default="farmer"
    )
    farmingMode = models.CharField(
        max_length=20,
        choices=[("organic", "Organic"), ("moderate", "Moderate"), ("flexible", "Flexible")],
        default="moderate"
    )
    language = models.CharField(
        max_length=10,
        choices=[("en", "English"), ("hi", "Hindi"), ("mr", "Marathi"), ("gu", "Gujarati"), ("kn", "Kannada")],
        default="en"
    )
    avatarUrl = models.URLField(blank=True, default="")
    # Location stored as JSON for simplicity, matching Mongo schema
    location = models.JSONField(default=dict, blank=True)
    isVerified = models.BooleanField(default=False)
    settings = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.username})"

class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def is_valid(self):
        from django.utils import timezone
        return timezone.now() <= self.expires_at

class AuthOTP(models.Model):
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def is_valid(self):
        from django.utils import timezone
        return timezone.now() <= self.expires_at

class Farm(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="farms")
    name = models.CharField(max_length=255)
    areaAcres = models.FloatField()
    soilType = models.CharField(
        max_length=50,
        choices=[
            ("alluvial", "Alluvial"), ("black", "Black"), ("red", "Red"),
            ("laterite", "Laterite"), ("sandy", "Sandy"), ("clay", "Clay"),
            ("loamy", "Loamy"), ("other", "Other")
        ],
        default="other"
    )
    ph = models.FloatField(null=True, blank=True)
    nitrogen = models.FloatField(null=True, blank=True)
    phosphorus = models.FloatField(null=True, blank=True)
    potassium = models.FloatField(null=True, blank=True)
    ec = models.FloatField(null=True, blank=True)
    organicCarbon = models.FloatField(null=True, blank=True)
    waterResources = models.JSONField(default=list, blank=True) # Array of strings
    waterLevel = models.CharField(
        max_length=20,
        choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")],
        default="medium"
    )
    currentCrop = models.CharField(max_length=100, blank=True, default="")
    cropHealthIndex = models.IntegerField(default=0)
    location = models.JSONField(default=dict, blank=True)
    riskRadarData = models.JSONField(default=dict, blank=True)
    isActive = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class CropPlan(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="crop_plans")
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="crop_plans")
    cropName = models.CharField(max_length=100)
    areaAcres = models.FloatField(default=1.0)
    season = models.CharField(max_length=100)
    sowingDate = models.DateTimeField()
    expectedHarvestDate = models.DateTimeField()
    seedRateKgPerAcre = models.FloatField(null=True, blank=True)
    rowSpacingCm = models.FloatField(null=True, blank=True)
    # Embedded arrays stored as JSON
    irrigationCycles = models.JSONField(default=list, blank=True)
    fertilizerEvents = models.JSONField(default=list, blank=True)
    milestones = models.JSONField(default=list, blank=True)
    estimatedCost = models.FloatField(default=0)
    targetYieldKg = models.FloatField(default=0)
    seasonProgressPct = models.FloatField(default=0)
    driftDays = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20,
        choices=[("active", "Active"), ("completed", "Completed"), ("abandoned", "Abandoned")],
        default="active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class MarketPrice(models.Model):
    state = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    market = models.CharField(max_length=100)
    commodity = models.CharField(max_length=100)
    variety = models.CharField(max_length=100, blank=True, null=True)
    arrival_date = models.CharField(max_length=50, blank=True, null=True)
    parsedDate = models.DateTimeField(blank=True, null=True)
    min_price = models.FloatField(null=True, blank=True)
    max_price = models.FloatField(null=True, blank=True)
    modal_price = models.FloatField(null=True, blank=True)
    fetchedAt = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('state', 'district', 'market', 'commodity', 'arrival_date')




class Recommendation(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recommendations")
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="recommendations")
    budgetRs = models.FloatField(null=True, blank=True)
    season = models.CharField(max_length=100)
    cropOptions = models.JSONField(default=list, blank=True)
    selectedCrop = models.CharField(max_length=100, null=True, blank=True)
    generatedAt = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Alert(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="alerts")
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, null=True, blank=True, related_name="alerts")
    category = models.CharField(
        max_length=50,
        choices=[("weather", "Weather"), ("schedule_delay", "Schedule Delay"), ("crop_health", "Crop Health"), ("equipment", "Equipment")]
    )
    severity = models.CharField(
        max_length=20,
        choices=[("critical", "Critical"), ("warning", "Warning"), ("info", "Info")],
        default="info"
    )
    riskScorePct = models.FloatField(null=True, blank=True)
    title = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[("active", "Active"), ("actioned", "Actioned"), ("dismissed", "Dismissed")],
        default="active"
    )
    actionTaken = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Expense(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="expenses")
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="expenses")
    cropPlan = models.ForeignKey(CropPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")
    label = models.CharField(max_length=255)
    category = models.CharField(
        max_length=50,
        choices=[
            ("seeds", "Seeds"), ("fertilizer", "Fertilizer"), ("pesticide", "Pesticide"),
            ("labor", "Labor"), ("irrigation", "Irrigation"), ("equipment", "Equipment"),
            ("transport", "Transport"), ("other", "Other")
        ]
    )
    amountRs = models.FloatField()
    date = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Notification(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    type = models.CharField(
        max_length=50,
        choices=[("alert", "Alert"), ("schedule", "Schedule"), ("ai", "AI"), ("system", "System")]
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    refModel = models.CharField(max_length=100, null=True, blank=True)
    refId = models.CharField(max_length=100, null=True, blank=True) # Storing as CharField to allow generic IDs
    isRead = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class WeatherCache(models.Model):
    locationKey = models.CharField(max_length=255, unique=True, db_index=True)
    cityName = models.CharField(max_length=255)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    data = models.JSONField(default=dict) # stores current, daily, hourly
    fetchedAt = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chat_messages")
    sessionId = models.CharField(max_length=255, db_index=True)
    role = models.CharField(
        max_length=20,
        choices=[("user", "User"), ("assistant", "Assistant"), ("system", "System")]
    )
    content = models.TextField()
    contextSnapshot = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
