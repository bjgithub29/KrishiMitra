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

        features = pd.DataFrame([{
            "Soil_Type": data["Soil_Type"],
            "Soil_pH": data["Soil_pH"],
            "Soil_Moisture": data["Soil_Moisture"],
            "Organic_Carbon": data["Organic_Carbon"],
            "Electrical_Conductivity": data["Electrical_Conductivity"],
            "Temperature_C": data["Temperature_C"],
            "Humidity": data["Humidity"],
            "Rainfall_mm": data["Rainfall_mm"],
            "Sunlight_Hours": data["Sunlight_Hours"],
            "Wind_Speed_kmh": data["Wind_Speed_kmh"],
            "Crop_Type": data["Crop_Type"],
            "Crop_Growth_Stage": data["Crop_Growth_Stage"],
            "Season": data["Season"],
            "Irrigation_Type": data["Irrigation_Type"],
            "Water_Source": data["Water_Source"],
            "Field_Area_hectare": data["Field_Area_hectare"],
            "Mulching_Used": data["Mulching_Used"],
            "Previous_Irrigation_mm": data["Previous_Irrigation_mm"],
            "Forecast_Rainfall_7Days_mm": data["Forecast_Rainfall_7Days_mm"],
            "Forecast_Temp_7Days_Avg": data["Forecast_Temp_7Days_Avg"],
            "Region": data["Region"],
        }])

        prediction = self.model.predict(features)[0]

        irrigation = self.encoder.inverse_transform([prediction])[0]

        return irrigation


irrigation_service = IrrigationPredictionService()
