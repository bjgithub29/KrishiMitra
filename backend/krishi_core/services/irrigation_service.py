import os
import logging
import joblib
import pandas as pd
from django.conf import settings

logger = logging.getLogger("core.services.irrigation")

# Correct absolute paths to the model artifacts
MODEL_DIR = os.path.join(settings.BASE_DIR, "krishi_core", "ml_models", "artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "irrigation_model.pkl")
PREPROCESSOR_PATH = os.path.join(MODEL_DIR, "irrigation_feature_preprocessor.pkl")
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, "irrigation_label_encoder.pkl")


class IrrigationPredictionService:

    def __init__(self):
        self.model = None
        self.encoder = None
        # Internal state flag: True only when the model artifacts loaded OK.
        self._loaded = False
        self._load_models()

    def _load_models(self):
        """Load the model + label encoder if the artifacts exist.

        Missing or unreadable artifacts are logged and leave the service in an
        'unavailable' state, rather than raising during import (which would
        crash Django startup). When valid artifacts are later supplied, loading
        succeeds and behavior is identical to before.
        """
        try:
            self.model = joblib.load(MODEL_PATH)
            self.encoder = joblib.load(LABEL_ENCODER_PATH)
            self._loaded = True
            logger.info("Irrigation model loaded successfully.")
        except Exception as e:
            logger.error(
                f"Irrigation model unavailable (could not load from {MODEL_DIR}): {e}"
            )

    def predict(self, data):
        if not self._loaded or self.model is None:
            return "N/A (Model unavailable)"

        try:
            features = pd.DataFrame([{
                "Soil_Type": data.get("Soil_Type", "Black"),
                "Soil_pH": float(data.get("Soil_pH", 6.5)),
                "Soil_Moisture": float(data.get("Soil_Moisture", 40.0)),
                "Organic_Carbon": float(data.get("Organic_Carbon", 0.5)),
                "Electrical_Conductivity": float(data.get("Electrical_Conductivity", 0.4)),
                "Temperature_C": float(data.get("Temperature_C", data.get("Temperature", 25.0))),
                "Humidity": float(data.get("Humidity", 60.0)),
                "Rainfall_mm": float(data.get("Rainfall_mm", data.get("Rainfall", 100.0))),
                "Sunlight_Hours": float(data.get("Sunlight_Hours", 7.0)),
                "Wind_Speed_kmh": float(data.get("Wind_Speed_kmh", 10.0)),
                "Crop_Type": data.get("Crop_Type", "Wheat"),
                "Crop_Growth_Stage": data.get("Crop_Growth_Stage", "Pre-emergence"),
                "Season": data.get("Season", "Kharif"),
                "Irrigation_Type": data.get("Irrigation_Type", "Drip"),
                "Water_Source": data.get("Water_Source", "Borewell"),
                "Field_Area_hectare": float(data.get("Field_Area_hectare", 1.0)),
                "Mulching_Used": data.get("Mulching_Used", "No"),
                "Previous_Irrigation_mm": float(data.get("Previous_Irrigation_mm", 20.0)),
                "Forecast_Rainfall_7Days_mm": float(data.get("Forecast_Rainfall_7Days_mm", 15.0)),
                "Forecast_Temp_7Days_Avg": float(data.get("Forecast_Temp_7Days_Avg", 26.0)),
                "Region": data.get("Region", "Maharashtra"),
            }])

            prediction = self.model.predict(features)[0]
            irrigation = self.encoder.inverse_transform([prediction])[0]
            return irrigation
        except Exception as e:
            logger.error("Irrigation prediction failed: %s", e)
            return "N/A (Model unavailable)"


irrigation_service = IrrigationPredictionService()
