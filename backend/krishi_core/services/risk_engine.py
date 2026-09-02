import json
import requests
from django.utils import timezone
from krishi_core.models import Farm, Alert, WeatherCache
from django.conf import settings

def calculate_farm_risk_radar(farm):
    """
    Calculates the 4 categories for the Risk Radar based on live conditions:
    1. Weather Risk (0-100)
    2. Schedule Delay Risk (0-100)
    3. Crop Health Risk (0-100)
    4. Equipment Risk (0-100)
    """
    now = timezone.now()
    risk_data = {
        "Weather risk": {"level": "Low", "pct": 0, "tone": "primary"},
        "Schedule delay risk": {"level": "Low", "pct": 0, "tone": "primary"},
        "Crop health risk": {"level": "Low", "pct": 0, "tone": "primary"},
        "Equipment risk": {"level": "Low", "pct": 10, "tone": "primary"}, # Default baseline
    }

    # --- 1. Weather Risk ---
    weather_score = 0
    # Try to find weather in cache based on farm location
    location_str = farm.location.get("address", "") if isinstance(farm.location, dict) else str(farm.location)
    location_key = location_str.lower().replace(" ", "-").strip() if location_str else None
    
    if location_key:
        try:
            cache = WeatherCache.objects.filter(locationKey__icontains=location_key).first()
            if cache and cache.data:
                current_weather = cache.data.get("current", {})
                rain_chance = current_weather.get("rainChance", 0)
                wind = current_weather.get("wind", 0)
                temp = current_weather.get("temp", 25)
                humidity = current_weather.get("humidity", 50)
                
                if rain_chance > 80: weather_score += 40
                elif rain_chance > 50: weather_score += 20
                
                if wind > 35: weather_score += 30
                
                if temp > 40: weather_score += 30
                elif temp < 5: weather_score += 20
                
                if humidity > 85 and 20 < temp < 32:
                    weather_score += 20 # fungal risk weather pattern
                    
        except Exception as e:
            pass
            
    # Check for active weather alerts for this farm to boost score
    active_weather_alerts = Alert.objects.filter(farm=farm, category="weather", status="active").count()
    weather_score += active_weather_alerts * 15
    weather_score = min(100, weather_score)
    risk_data["Weather risk"]["pct"] = weather_score
    risk_data["Weather risk"]["level"] = "Elevated" if weather_score > 60 else "Moderate" if weather_score > 30 else "Low"
    risk_data["Weather risk"]["tone"] = "warning" if weather_score > 60 else "cyan" if weather_score > 30 else "primary"


    # --- 2. Schedule Delay Risk ---
    schedule_score = 0
    active_plans = farm.crop_plans.filter(status="active")
    if active_plans.exists():
        plan = active_plans.first()
        milestones = plan.milestones if isinstance(plan.milestones, list) else []
        overdue_count = 0
        for m in milestones:
            if m.get("status") != "done" and m.get("plannedDate"):
                try:
                    # Simple date check
                    planned = timezone.datetime.fromisoformat(m["plannedDate"].replace("Z", "+00:00"))
                    if planned < now:
                        overdue_count += 1
                except:
                    pass
        schedule_score = min(100, overdue_count * 25)
    
    risk_data["Schedule delay risk"]["pct"] = schedule_score
    risk_data["Schedule delay risk"]["level"] = "Elevated" if schedule_score > 60 else "Moderate" if schedule_score > 30 else "Low"
    risk_data["Schedule delay risk"]["tone"] = "warning" if schedule_score > 60 else "cyan" if schedule_score > 30 else "primary"


    # --- 3. Crop Health Risk ---
    health_score = 0
    # Base on crop health index if it exists, or active pest alerts
    if hasattr(farm, 'cropHealthIndex') and farm.cropHealthIndex > 0:
        # Assuming cropHealthIndex is 0-100 where 100 is healthy
        health_score = 100 - farm.cropHealthIndex
        
    active_health_alerts = Alert.objects.filter(farm=farm, category="crop", status="active").count()
    health_score += active_health_alerts * 30
    health_score = min(100, health_score)
    
    risk_data["Crop health risk"]["pct"] = health_score
    risk_data["Crop health risk"]["level"] = "Elevated" if health_score > 60 else "Moderate" if health_score > 30 else "Low"
    risk_data["Crop health risk"]["tone"] = "warning" if health_score > 60 else "cyan" if health_score > 30 else "primary"
    

    # --- 4. Equipment Risk ---
    # Baseline equipment risk as 10-20% default since we don't have heavy machinery telematics
    equip_score = 15
    active_equip_alerts = Alert.objects.filter(farm=farm, category="equipment", status="active").count()
    equip_score += active_equip_alerts * 40
    equip_score = min(100, equip_score)
    
    risk_data["Equipment risk"]["pct"] = equip_score
    risk_data["Equipment risk"]["level"] = "Elevated" if equip_score > 60 else "Moderate" if equip_score > 30 else "Low"
    risk_data["Equipment risk"]["tone"] = "warning" if equip_score > 60 else "cyan" if equip_score > 30 else "primary"

    return risk_data

def run_daily_risk_calculation():
    """
    Runs daily to calculate and store the Risk Radar values for all active farms.
    """
    print("[RiskEngine] Starting daily risk calculation...")
    farms = Farm.objects.filter(isActive=True)
    count = 0
    for farm in farms:
        try:
            radar_data = calculate_farm_risk_radar(farm)
            farm.riskRadarData = radar_data
            farm.save()
            count += 1
        except Exception as e:
            print(f"[RiskEngine] Error calculating risk for farm {farm.id}: {str(e)}")
            
    print(f"[RiskEngine] Completed daily risk calculation for {count} farms.")
