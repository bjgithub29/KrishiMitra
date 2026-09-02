"""
Django REST Framework views — one-to-one replacement for the old Flask routes:

    Flask route                    -> DRF view (same URL, same JSON contract)
    ---------------------------------------------------------------------
    POST /api/retrieve             -> RetrieveView
    POST /api/soil_recommend       -> SoilRecommendView
    POST /api/crop_stage_tips      -> CropStageTipsView
    POST /api/predict_disease      -> PredictDiseaseView
    GET  /api/health                -> HealthView
    GET  /api/weather                -> WeatherView

Every response shape is unchanged, so the Node backend (which calls this
service) needs zero changes.
"""
import io
import json
import logging
import traceback

import numpy as np
import pandas as pd
import requests
from PIL import Image

from django.conf import settings
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from . import ml_loader
from .utils import CROPS, WATER_COMPAT, get_crop_meta, check_image_quality, extract_section
from .serializers import (
    RetrieveRequestSerializer,
    SoilRecommendRequestSerializer,
    CropStageTipsRequestSerializer,
)
from .services.fertilizer_service import fertilizer_service
from .services.irrigation_service import irrigation_service
from .services.crop_recommendation_service import (
    crop_recommendation_service,
    canonical_season,
    normalize_state_token,
)

logger = logging.getLogger("core.views")


class RetrieveView(APIView):
    """RAG semantic search over the ChromaDB knowledge base using the advanced RAGRetriever."""
    parser_classes = [JSONParser]

    def post(self, request):
        from krishi_core.services.ai_engine.rag_retriever import rag_retriever
        
        serializer = RetrieveRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["query"]
        n_results = serializer.validated_data.get("n_results", 5)
        # We can pass an optional target_crop if the frontend provides it in the future
        target_crop = request.data.get("target_crop", "")

        try:
            context = rag_retriever.search(query=query, k=n_results, target_crop=target_crop)
            
            # The previous frontend expected raw_results and distances, but we now format a cohesive context.
            # We return empty raw arrays to not break existing frontend expectations if any.
            return Response({
                "context": context,
                "distances": [], 
                "raw_results": {"documents": [], "distances": []} 
            })
            
        except Exception as e:
            logger.error("Error during advanced retrieval: %s", traceback.format_exc())
            return Response({"error": str(e)}, status=500)


class SoilRecommendView(APIView):
    """
    Soil-powered crop recommendation engine (Unit 4/5: regression + classification
    features feed a RandomForest classifier; falls back to a rule-based heuristic
    scorer if the model isn't loaded).
    """
    parser_classes = [JSONParser]

    def post(self, request):
        serializer = SoilRecommendRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        ph = d["ph"]
        nitrogen = d["nitrogen"]
        phosphorus = d["phosphorus"]
        potassium = d["potassium"]
        org_carbon = d["organicCarbon"]
        season_in = d["season"].lower()
        area_acres = d["areaAcres"]
        water_avail = d["waterAvailability"].lower()

        collection = ml_loader.state.get("collection")

        # Canonical path: the trained crop-recommendation model. Used ONLY when
        # it is loaded AND all nine real features can be sourced — soil NPK + pH
        # and season come from the form; state and season-aligned climatological
        # temperature / humidity / rainfall come from the farm's real location.
        # If ANY real input is missing, we fall back to the heuristic rather
        # than fabricating temperature / humidity / rainfall / state.
        results = self._model_recommend(
            request, ph, nitrogen, phosphorus, potassium,
            org_carbon, season_in, area_acres, collection,
        )
        used_model = bool(results)

        if not results:
            # Rule-based heuristic fallback (best true match on soil/water data).
            results = self._heuristic_fallback(ph, org_carbon, season_in, area_acres, water_avail, collection)

        # Sort primarily by suitabilityScore (best match)
        results.sort(key=lambda x: x["suitabilityScore"], reverse=True)
        
        # Keep top 5
        results = results[:5]
        if results:
            results[0]["isTopPick"] = True
            
            # Predict Fertilizer and Irrigation for top picks
            for r in results:
                ml_data = {
                    "Soil_Type": d.get("soilType", "Black"),
                    "Crop_Type": r["cropName"].capitalize(),
                    "Crop_Growth_Stage": "Pre-emergence",
                    "Season": season_in.capitalize(),
                    "Irrigation_Type": d.get("irrigationType", "Drip"),
                    "Region": d.get("state", "Maharashtra"),
                    "Soil_pH": ph,
                    "Soil_Moisture": 40.0,
                    "Organic_Carbon": org_carbon,
                    "Electrical_Conductivity": d.get("ec", 0.4),
                    "Nitrogen_Level": nitrogen,
                    "Phosphorus_Level": phosphorus,
                    "Potassium_Level": potassium,
                    "Temperature_C": d.get("temperature", 25.0),
                    "Temperature": d.get("temperature", 25.0),
                    "Humidity": d.get("humidity", 60.0),
                    "Rainfall_mm": d.get("rainfall", 100.0),
                    "Rainfall": d.get("rainfall", 100.0),
                    "Field_Area_hectare": area_acres * 0.404686,  # convert acres to hectares
                }
                r["suggestedFertilizer"] = fertilizer_service.predict(ml_data)
                r["irrigationPrediction"] = irrigation_service.predict(ml_data)
            
        llm_summary = ""
        try:
            from krishi_core.services.ai_engine.llm_service import llm_service
            prompt = f"""
You are an agricultural expert. A farmer is asking for crop recommendations for their land.
Their soil data is: pH {ph}, Nitrogen {nitrogen}, Phosphorus {phosphorus}, Potassium {potassium}, EC {d.get('ec', 0)}, Organic Carbon {org_carbon}.
The top crops recommended by our engine are:
{', '.join([r['cropName'] for r in results])}

Write a short, engaging 2-paragraph summary directly to the farmer. Explain why the top pick ({results[0]['cropName']}) is the best choice based on their soil, and briefly mention the alternatives.
Keep it conversational, encouraging, and formatted in plain text (no markdown formatting needed).
"""
            llm_summary_resp = llm_service.generate_response(prompt, force_json=False)
            if isinstance(llm_summary_resp, dict) and 'error' not in llm_summary_resp:
                llm_summary = llm_summary_resp.get('answer', llm_summary_resp.get('text', str(llm_summary_resp)))
            elif isinstance(llm_summary_resp, str):
                llm_summary = llm_summary_resp
        except Exception as e:
            logger.error(f"Error generating LLM summary: {e}")

        return Response({
            "recommendations": results,
            "llm_summary": llm_summary,
            "engine": "model" if used_model else "heuristic",  # additive, non-breaking
        })

    @staticmethod
    def _rag_reason(collection, crop_name, ph):
        reason = f"{crop_name} suits your soil's pH {ph} and current nutrient profile."
        if collection:
            try:
                query = f"{crop_name} soil requirements pH nitrogen phosphorus recommendation"
                rag = collection.query(query_texts=[query], n_results=1, where={"source": "timeline_kb"})
                docs = rag.get("documents", [[]])[0]
                if docs:
                    why = extract_section(docs[0] + "\n", "Why it matters") or None
                    if why:
                        reason = why
            except Exception:
                pass
        return reason

    def _heuristic_fallback(self, ph, org_carbon, season_in, area_acres, water_avail, collection):
        results = []
        for crop in CROPS:
            ph_lo, ph_hi = crop["phRange"]
            
            soil_match = 100 if ph_lo <= ph <= ph_hi else max(0, 100 - abs(ph - (ph_lo + ph_hi) / 2) * 20)
            soil_match = round(min(100, soil_match * (1 + (org_carbon - 0.5) * 0.3)))

            water_mult = WATER_COMPAT.get(water_avail, {}).get(crop["water"], 0.5)
            weather_pct = round(60 + water_mult * 35)
            
            # Suitability score is average of soil and weather match
            suit = (soil_match + weather_pct) / 2
            
            if crop["season"] != season_in:
                suit = max(0, suit - 20)
            suit = round(min(100, max(0, suit)))

            yield_kg = round(crop["yieldKgPerAcre"] * area_acres)
            cost = round(crop["costPerAcre"] * area_acres)
            revenue = round(crop["yieldKgPerAcre"] * area_acres * crop["pricePerKg"])
            margin = revenue - cost

            results.append({
                "cropName": crop["name"], "suitabilityScore": suit,
                "soilMatchPct": soil_match, "weatherMatchPct": weather_pct,
                "expectedYieldKg": yield_kg, "expectedMarginRs": margin,
                "durationDays": crop["durationDays"],
                "reason": self._rag_reason(collection, crop["name"], ph),
                "isTopPick": False,
            })
        return results

    def _model_recommend(self, request, ph, nitrogen, phosphorus, potassium,
                         org_carbon, season_in, area_acres, collection):
        """Rank crops with the trained model when — and only when — it is
        loaded AND all nine real features are available.

        Returns a schema-compatible results list, or None to signal the caller
        to use the heuristic. Temperature / humidity / rainfall / state are
        sourced from the farm's real location (weather Archive + geocoded
        state); none of them are ever fabricated. If the frontend did not send
        a real location, or the Archive lookup fails, this returns None.
        """
        if not crop_recommendation_service.is_available():
            return None

        # Real geo + state from the farm (sent by the frontend). No defaults.
        try:
            lat = float(request.data.get("latitude"))
            lon = float(request.data.get("longitude"))
        except (TypeError, ValueError):
            lat = lon = None
        state_token = normalize_state_token(request.data.get("state"))
        season_token = canonical_season(season_in)

        temperature = humidity = rainfall = None
        if lat is not None and lon is not None:
            from krishi_core.services.openmeteo_service import OpenMeteoService
            svc = OpenMeteoService()
            # Rainfall + temperature: season-aligned climatology (Archive API).
            clim = svc.get_seasonal_climatology(lat, lon, season_token)
            if clim:
                rainfall = clim.get("rainfall_mm")
                temperature = clim.get("temperature_C")
            # Humidity: current real value (Archive has no daily RH mean).
            wx = svc.get_forecast(lat, lon)
            if wx:
                cur = wx.get("current", {}) or {}
                humidity = cur.get("humidity")
                if temperature is None:            # fallback: current temp if climatology missing
                    temperature = cur.get("temperature")

        # Every one of the nine features must be genuinely present.
        have_all_9 = (
            None not in (nitrogen, phosphorus, potassium, ph,
                         temperature, humidity, rainfall)
            and bool(season_token) and bool(state_token)
        )
        if not have_all_9:
            logger.info(
                "Crop model skipped (real inputs incomplete): "
                "lat=%s lon=%s temp=%s humid=%s rain=%s season=%s state=%s",
                lat, lon, temperature, humidity, rainfall, season_token, state_token,
            )
            return None

        ranked = crop_recommendation_service.recommend({
            "N": nitrogen, "P": phosphorus, "K": potassium,
            "temperature_C": temperature, "humidity_pct": humidity, "ph": ph,
            "rainfall_mm": rainfall, "season": season_token, "state": state_token,
        }, top_n=5)
        if not ranked:
            return None

        results = []
        for item in ranked:
            crop = item["crop"]
            conf = item.get("confidence")
            score = round((conf or 0.0) * 100)
            meta = get_crop_meta(crop)                    # never None (generic default fallback)

            # Real soil-pH match (same formula as the heuristic) so the UI's
            # soil bar reflects the farm, not just model confidence.
            ph_lo, ph_hi = meta["phRange"]
            soil_match = 100 if ph_lo <= ph <= ph_hi else max(0, 100 - abs(ph - (ph_lo + ph_hi) / 2) * 20)
            soil_match = round(min(100, soil_match * (1 + (org_carbon - 0.5) * 0.3)))

            yield_kg = round(meta["yieldKgPerAcre"] * area_acres)
            cost = round(meta["costPerAcre"] * area_acres)
            revenue = round(meta["yieldKgPerAcre"] * area_acres * meta["pricePerKg"])

            results.append({
                "cropName": crop,
                "suitabilityScore": score,       # canonical: model confidence
                "soilMatchPct": soil_match,      # real pH-based signal
                "weatherMatchPct": score,        # model/climate-driven
                "expectedYieldKg": yield_kg,
                "expectedMarginRs": revenue - cost,
                "durationDays": meta["durationDays"],
                "reason": self._rag_reason(collection, crop, ph),
                "isTopPick": False,
                "modelConfidence": conf,         # additive, non-breaking
            })

        logger.info(
            "Crop model ranked %d crops (top=%s, conf=%s).",
            len(results), results[0]["cropName"], results[0]["modelConfidence"],
        )
        return results


class CropStageTipsView(APIView):
    """RAG-powered field tips for a crop + growth stage (Crop Plan timeline)."""
    parser_classes = [JSONParser]

    def post(self, request):
        collection = ml_loader.state["collection"]
        if not collection:
            return Response({"error": "ChromaDB collection not initialized."}, status=500)

        serializer = CropStageTipsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        crop = serializer.validated_data["crop"]
        stage = serializer.validated_data["stage"]

        try:
            query_text = f"{crop} {stage} field notes tasks irrigation fertilizer watch for"
            results = collection.query(query_texts=[query_text], n_results=3, where={"source": "timeline_kb"})
            documents = results.get("documents", [[]])[0]

            if not documents:
                results = collection.query(query_texts=[query_text], n_results=2)
                documents = results.get("documents", [[]])[0]

            if not documents:
                return Response({"found": False, "crop": crop, "stage": stage, "tips": {}})

            raw_text = documents[0]
            import re
            tasks_block = re.search(r"Key tasks:\n((?:- .+\n?)+)", raw_text)
            key_tasks = []
            if tasks_block:
                key_tasks = [l.strip("- ").strip() for l in tasks_block.group(1).strip().split("\n") if l.strip()]

            irrigation = extract_section(raw_text, "Irrigation")
            fertilizer = extract_section(raw_text, "Fertilizer")
            watch_for = extract_section(raw_text, "Watch for")
            treatment = extract_section(raw_text, "Treatment if needed")
            why_matters = extract_section(raw_text, "Why it matters")
            critical_raw = extract_section(raw_text, "Critical")
            is_critical = critical_raw.upper().startswith("YES")

            return Response({
                "found": True, "crop": crop, "stage": stage, "raw_text": raw_text,
                "tips": {
                    "key_tasks": key_tasks, "irrigation": irrigation, "fertilizer": fertilizer,
                    "watch_for": watch_for, "treatment": treatment, "why_it_matters": why_matters,
                    "critical": is_critical,
                },
            })
        except Exception as e:
            logger.error("Error in crop_stage_tips: %s", traceback.format_exc())
            return Response({"error": str(e)}, status=500)


class PredictDiseaseView(APIView):
    """
    Multimodal disease classification (Unit 6): Uses Gemini 1.5 Flash to analyze
    the uploaded image directly, avoiding heavy local CNN/YOLO models.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        gemini_key = settings.GEMINI_API_KEY
        fallback_payload = {
            "error": "Gemini API key is not configured. Disease inference is unavailable.",
            "fallback": True, "disease": "Unknown", "confidence": 0.0, "top3": [],
            "quality_passed": True, "quality_issues": [],
            "treatment": "Please configure GEMINI_API_KEY in the backend .env file.",
        }

        if not gemini_key:
            return Response(fallback_payload, status=200)

        image_file = request.FILES.get("image")
        if not image_file:
            return Response({**fallback_payload, "error": "No image uploaded in form-data field 'image'."}, status=200)

        try:
            import base64
            # Read image and encode to base64
            image_data = image_file.read()
            mime_type = image_file.content_type or "image/jpeg"
            b64_image = base64.b64encode(image_data).decode('utf-8')

            # Optional: We can still check image quality locally if needed,
            # but for now we rely on Gemini to understand the image.
            quality_passed = True
            quality_issues = []

            # Ask Gemini to diagnose and provide treatment
            prompt = (
                "You are an expert plant pathologist. Analyze this image of a crop leaf. "
                "Identify if there is any disease. If healthy, state 'Healthy'. "
                "Provide your response EXACTLY as a JSON object with the following keys: "
                "'disease' (string, the name of the disease or 'Healthy'), "
                "'confidence' (number between 0 and 1 representing your confidence), "
                "'treatment' (string, a concise 3-sentence treatment plan if diseased, or a maintenance tip if healthy)."
            )

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_image
                            }
                        }
                    ]
                }]
            }

            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
            if res.status_code != 200:
                logger.error("Gemini API error: %s", res.text)
                return Response({**fallback_payload, "error": "Failed to get response from Gemini API."}, status=200)
            
            text_resp = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            # Gemini might wrap JSON in markdown block
            if text_resp.startswith("```json"):
                text_resp = text_resp[7:]
            if text_resp.endswith("```"):
                text_resp = text_resp[:-3]
            text_resp = text_resp.strip()
            
            try:
                parsed = json.loads(text_resp)
                pretty_class = parsed.get("disease", "Unknown")
                confidence = parsed.get("confidence", 0.0)
                treatment = parsed.get("treatment", "No treatment recommendation available.")
            except json.JSONDecodeError:
                # Fallback if Gemini didn't return perfect JSON
                pretty_class = "Unknown (Parsing Error)"
                confidence = 0.5
                treatment = text_resp

            top3 = [
                {"label": pretty_class, "prob": confidence}
            ]

            return Response({
                "disease": pretty_class, "confidence": confidence, "raw_class": pretty_class,
                "top3": top3, "quality_passed": quality_passed, "quality_issues": quality_issues,
                "treatment": treatment,
            })
        except Exception as e:
            logger.error("Error during disease prediction with Gemini: %s", traceback.format_exc())
            return Response({**fallback_payload, "error": f"Prediction failed: {str(e)}"}, status=200)


class HealthView(APIView):
    def get(self, request):
        return Response({
            "status": "ok",
            "db_connected": ml_loader.state.get("collection") is not None,
            "ml_ready": True,
        })


class WeatherView(APIView):
    def get(self, request):
        lat_str = request.query_params.get("latitude")
        lon_str = request.query_params.get("longitude")
        if not lat_str or not lon_str:
            return Response({"error": "Missing latitude or longitude parameters"}, status=400)
        try:
            lat, lon = float(lat_str), float(lon_str)
        except ValueError:
            return Response({"error": "Latitude and longitude must be valid numbers"}, status=400)

        from krishi_core.services.openmeteo_service import OpenMeteoService
        from krishi_core.services.alert_engine import alert_engine

        forecast = OpenMeteoService().get_forecast(latitude=lat, longitude=lon)
        if forecast is None:
            return Response({"error": "Failed to fetch weather data from upstream service"}, status=502)
        
        # Generate dynamic weather alerts based on current conditions
        forecast["alerts"] = alert_engine.generate_alerts(forecast.get("current", {}))

        return Response(forecast)

class DecisionEngineView(APIView):
    """
    Advanced AI orchestration endpoint ported from Farmsense.
    Expects { "user_query": "...", "ml_predictions": {...}, "weather": {...}, "history": {...} }
    """
    parser_classes = [JSONParser]
    
    def post(self, request):
        from krishi_core.services.ai_engine.decision_engine import decision_engine
        
        user_query = request.data.get("user_query", "")
        ml_predictions = request.data.get("ml_predictions", {})
        weather = request.data.get("weather", {})
        history = request.data.get("history", {})
        
        try:
            response = decision_engine.generate_recommendation(
                user_query=user_query,
                ml_predictions=ml_predictions,
                weather=weather,
                history=history
            )
            return Response(response)
        except Exception as e:
            logger.error("DecisionEngine Error: %s", traceback.format_exc())
            return Response({"error": str(e)}, status=500)
