from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers

from .services.yield_service import yield_service
from .services.irrigation_service import irrigation_service
from .services.fertilizer_service import fertilizer_service

class CropYieldPredictionSerializer(serializers.Serializer):
    Crop = serializers.CharField(required=True, allow_blank=False)
    Crop_Year = serializers.IntegerField(required=False, default=2026)
    Season = serializers.CharField(required=False, default="Kharif")
    State = serializers.CharField(required=False, default="Gujarat")
    Area = serializers.FloatField(required=True, min_value=0.01)
    Annual_Rainfall = serializers.FloatField(required=False, default=800.0)
    Fertilizer = serializers.FloatField(required=False, default=100.0)
    Pesticide = serializers.FloatField(required=False, default=20.0)

class FertilizerRecommendationSerializer(serializers.Serializer):
    Soil_Type = serializers.CharField(required=False, default="Black")
    Crop_Type = serializers.CharField(required=True, allow_blank=False)
    Crop_Growth_Stage = serializers.CharField(required=False, default="Vegetative")
    Season = serializers.CharField(required=False, default="Kharif")
    Irrigation_Type = serializers.CharField(required=False, default="Drip")
    Previous_Crop = serializers.CharField(required=False, default="Wheat")
    Region = serializers.CharField(required=False, default="West")
    Soil_pH = serializers.FloatField(required=False, default=7.5)
    Soil_Moisture = serializers.FloatField(required=False, default=40.0)
    Organic_Carbon = serializers.FloatField(required=False, default=0.8)
    Electrical_Conductivity = serializers.FloatField(required=False, default=1.2)
    Nitrogen_Level = serializers.FloatField(required=False, default=120)
    Phosphorus_Level = serializers.FloatField(required=False, default=40)
    Potassium_Level = serializers.FloatField(required=False, default=200)
    Temperature = serializers.FloatField(required=False, default=30.0)
    Humidity = serializers.FloatField(required=False, default=60.0)
    Rainfall = serializers.FloatField(required=False, default=800.0)
    Fertilizer_Used_Last_Season = serializers.FloatField(required=False, default=100.0)
    Yield_Last_Season = serializers.FloatField(required=False, default=2500.0)

class IrrigationPredictionSerializer(serializers.Serializer):
    Soil_Type = serializers.CharField(required=False, default="Black")
    Soil_pH = serializers.FloatField(required=False, default=7.5)
    Soil_Moisture = serializers.FloatField(required=False, default=40.0)
    Organic_Carbon = serializers.FloatField(required=False, default=0.8)
    Electrical_Conductivity = serializers.FloatField(required=False, default=1.2)
    Temperature_C = serializers.FloatField(required=False, default=30.0)
    Humidity = serializers.FloatField(required=False, default=60.0)
    Rainfall_mm = serializers.FloatField(required=False, default=800.0)
    Sunlight_Hours = serializers.FloatField(required=False, default=8.0)
    Wind_Speed_kmh = serializers.FloatField(required=False, default=12.0)
    Crop_Type = serializers.CharField(required=True, allow_blank=False)
    Crop_Growth_Stage = serializers.CharField(required=False, default="Vegetative")
    Season = serializers.CharField(required=False, default="Kharif")
    Irrigation_Type = serializers.CharField(required=False, default="Drip")
    Water_Source = serializers.CharField(required=False, default="Well")
    Field_Area_hectare = serializers.FloatField(required=False, default=1.0)
    Mulching_Used = serializers.CharField(required=False, default="Yes")
    Previous_Irrigation_mm = serializers.FloatField(required=False, default=20.0)
    Forecast_Rainfall_7Days_mm = serializers.FloatField(required=False, default=0.0)
    Forecast_Temp_7Days_Avg = serializers.FloatField(required=False, default=31.0)
    Region = serializers.CharField(required=False, default="West")

class CropYieldPredictionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CropYieldPredictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            prediction = yield_service.predict(serializer.validated_data)
            return Response({"predicted_yield": prediction})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class FertilizerRecommendationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FertilizerRecommendationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            prediction = fertilizer_service.predict(serializer.validated_data)
            return Response({"recommended_fertilizer": prediction})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

class IrrigationPredictionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = IrrigationPredictionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            prediction = irrigation_service.predict(serializer.validated_data)
            return Response({"irrigation_need": prediction})
        except Exception as e:
            return Response({"error": str(e)}, status=500)
