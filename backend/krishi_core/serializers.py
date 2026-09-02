from rest_framework import serializers
from .models import (
    User, Farm, CropPlan, MarketPrice,
    Recommendation, Alert, Expense, Notification,
    WeatherCache, ChatMessage
)


class BaseModelSerializer(serializers.ModelSerializer):
    _id = serializers.SerializerMethodField()
    def get__id(self, obj):
        return str(obj.id)

class UserSerializer(BaseModelSerializer):
    firstName = serializers.CharField(source='first_name')
    lastName = serializers.CharField(source='last_name', allow_blank=True, default='')
    # Expose `_id` as string so frontend code that checks `user._id` still works
    _id = serializers.SerializerMethodField()

    def get__id(self, obj):
        return str(obj.id)

    class Meta:
        model = User
        fields = [
            'id', '_id', 'username', 'firstName', 'lastName', 'email', 'phone',
            'role', 'farmingMode', 'language', 'avatarUrl', 'location',
            'isVerified', 'settings', 'date_joined'
        ]

class FarmSerializer(BaseModelSerializer):
    class Meta:
        model = Farm
        fields = '__all__'
        read_only_fields = ['owner']

class CropPlanSerializer(BaseModelSerializer):
    class Meta:
        model = CropPlan
        fields = '__all__'
        read_only_fields = ['owner']

class MarketPriceSerializer(BaseModelSerializer):
    class Meta:
        model = MarketPrice
        fields = '__all__'



class RecommendationSerializer(BaseModelSerializer):
    class Meta:
        model = Recommendation
        fields = '__all__'
        read_only_fields = ['owner']

class AlertSerializer(BaseModelSerializer):
    class Meta:
        model = Alert
        fields = '__all__'
        read_only_fields = ['owner']

class ExpenseSerializer(BaseModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'
        read_only_fields = ['owner']

class NotificationSerializer(BaseModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'
        read_only_fields = ['owner']

class WeatherCacheSerializer(BaseModelSerializer):
    class Meta:
        model = WeatherCache
        fields = '__all__'

class ChatMessageSerializer(BaseModelSerializer):
    class Meta:
        model = ChatMessage
        fields = '__all__'
        read_only_fields = ['owner']
from rest_framework import serializers


class RetrieveRequestSerializer(serializers.Serializer):
    query = serializers.CharField(allow_blank=False)
    n_results = serializers.IntegerField(required=False, default=3, min_value=1, max_value=20)


class SoilRecommendRequestSerializer(serializers.Serializer):
    ph = serializers.FloatField(default=7.0)
    nitrogen = serializers.FloatField(default=180)
    phosphorus = serializers.FloatField(default=20)
    potassium = serializers.FloatField(default=250)
    organicCarbon = serializers.FloatField(default=0.5)
    ec = serializers.FloatField(default=0.4)
    season = serializers.CharField(default="kharif")
    areaAcres = serializers.FloatField(default=1)
    waterAvailability = serializers.CharField(default="medium")
    temperature = serializers.FloatField(required=False, default=25.0)
    humidity = serializers.FloatField(required=False, default=60.0)
    rainfall = serializers.FloatField(required=False, default=100.0)
    state = serializers.CharField(required=False, default="Maharashtra")
    soilType = serializers.CharField(required=False, default="Black")
    startPreparationDate = serializers.CharField(required=False, default="")
    irrigationType = serializers.CharField(required=False, default="Drip")


class CropStageTipsRequestSerializer(serializers.Serializer):
    crop = serializers.CharField(allow_blank=False)
    stage = serializers.CharField(allow_blank=False)
