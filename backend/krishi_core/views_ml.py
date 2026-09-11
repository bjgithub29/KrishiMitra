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
import re
import time
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
                    "Previous_Crop": d.get("previousCrop", "Fallow"),
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
                    "Sunlight_Hours": 7.0,
                    "Wind_Speed_kmh": 10.0,
                    "Water_Source": d.get("waterSource", "Borewell"),
                    "Field_Area_hectare": area_acres * 0.404686,  # convert acres to hectares
                    "Mulching_Used": d.get("mulchingUsed", "No"),
                    "Previous_Irrigation_mm": 20.0,
                    "Forecast_Rainfall_7Days_mm": 15.0,
                    "Forecast_Temp_7Days_Avg": d.get("temperature", 25.0),
                    "Fertilizer_Used_Last_Season": d.get("fertilizerUsedLastSeason", "Urea"),
                    "Yield_Last_Season": 2.5,
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
            # Strict short timeout (1.0s connect, 2.5s read) to ensure fast endpoint response
            llm_summary_resp = llm_service.generate_response(prompt, force_json=False, timeout=(1.0, 2.5))
            if isinstance(llm_summary_resp, dict) and 'error' not in llm_summary_resp:
                llm_summary = llm_summary_resp.get('answer', llm_summary_resp.get('text', str(llm_summary_resp)))
            elif isinstance(llm_summary_resp, str) and llm_summary_resp.strip() and "AI service is currently unavailable" not in llm_summary_resp:
                llm_summary = llm_summary_resp.strip()
        except Exception as e:
            logger.warning(f"Fast LLM summary unavailable: {e}")

        # Deterministic agronomic explanation if LLM is offline, timed out, or unavailable
        if not llm_summary and results:
            top_crop = results[0]["cropName"]
            top_score = results[0].get("suitabilityScore", 85)
            alt_crops = ", ".join([r["cropName"] for r in results[1:4]]) if len(results) > 1 else "other seasonal crops"
            llm_summary = (
                f"Based on your soil analysis (pH {ph}, Nitrogen {nitrogen} kg/ha, Phosphorus {phosphorus} kg/ha, Potassium {potassium} kg/ha), "
                f"{top_crop} is your optimal crop recommendation with an estimated suitability score of {top_score}%. "
                f"Your soil's nutrient balance and moisture profile provide favorable growing conditions for {top_crop}. "
                f"Viable alternatives for this season include {alt_crops}."
            )

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


TASK_CALENDAR_TO_KB_STAGE_MAP = {
    "land preparation": "Land Preparation",
    "sowing": "Germination & Early Growth",
    "germination & establishment": "Germination & Early Growth",
    "planting/establishment": "Germination & Early Growth",
    "germination & early growth": "Germination & Early Growth",
    "vegetative growth": "Vegetative Growth",
    "flowering / reproductive": "Flowering / Reproductive Phase",
    "flowering/fruiting": "Flowering / Reproductive Phase",
    "flowering / reproductive phase": "Flowering / Reproductive Phase",
    "maturity & pre-harvest": "Fruit / Grain Development",
    "fruit / grain development": "Fruit / Grain Development",
    "harvest & post-harvest": "Harvesting",
    "harvesting": "Harvesting",
    "maturity & harvest": "Harvesting",
}


class CropStageTipsView(APIView):
    """RAG-powered field tips for a crop + growth stage (Crop Plan timeline)."""
    parser_classes = [JSONParser]

    def post(self, request):
        collection = ml_loader.state["collection"]
        if not collection:
            return Response({"error": "ChromaDB collection not initialized."}, status=500)

        serializer = CropStageTipsRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        crop = serializer.validated_data["crop"].strip()
        stage = serializer.validated_data["stage"].strip()

        mapped_stage = TASK_CALENDAR_TO_KB_STAGE_MAP.get(stage.lower())
        if not mapped_stage:
            return Response({"found": False, "crop": crop, "stage": stage, "tips": {}})

        try:
            crop_name = crop.capitalize()
            where_filter = {
                "$and": [
                    {"source": {"$eq": "timeline_kb"}},
                    {"crop": {"$eq": crop_name}},
                    {"stage": {"$eq": mapped_stage}}
                ]
            }
            results = collection.get(where=where_filter)
            documents = results.get("documents", [])

            if not documents:
                for alt_crop in [crop.title(), crop]:
                    if alt_crop != crop_name:
                        alt_filter = {
                            "$and": [
                                {"source": {"$eq": "timeline_kb"}},
                                {"crop": {"$eq": alt_crop}},
                                {"stage": {"$eq": mapped_stage}}
                            ]
                        }
                        alt_res = collection.get(where=alt_filter)
                        if alt_res.get("documents"):
                            documents = alt_res.get("documents")
                            break

            if not documents:
                return Response({"found": False, "crop": crop, "stage": stage, "tips": {}})

            raw_text = documents[0]
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
    Multimodal disease classification (Unit 6): Uses Google Gemini Vision to analyze
    the uploaded image directly, avoiding heavy local CNN/YOLO models.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        gemini_key = settings.GEMINI_API_KEY
        if not gemini_key:
            return Response({
                "error": "Disease inference is not configured on this server.",
                "fallback": True,
                "disease": "Unknown",
                "confidence": 0.0,
                "top3": [],
                "quality_passed": True,
                "quality_issues": [],
                "treatment": "Please configure GEMINI_API_KEY in the backend .env file to enable disease diagnosis.",
            }, status=200)

        image_file = request.FILES.get("image")
        if not image_file:
            return Response({
                "error": "No image uploaded in form-data field 'image'.",
                "fallback": True,
                "disease": "Unknown",
                "confidence": 0.0,
                "top3": [],
                "quality_passed": False,
                "quality_issues": ["No image file provided"],
                "treatment": "Please upload a clear photograph of the affected crop leaf to perform disease diagnosis.",
            }, status=200)

        try:
            import base64
            # Read image and encode to base64
            image_data = image_file.read()
            mime_type = image_file.content_type or "image/jpeg"
            b64_image = base64.b64encode(image_data).decode('utf-8')

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

            gemini_model = getattr(settings, "GEMINI_MODEL", "gemini-flash-latest")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
            
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
                }],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }

            try:
                res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=(5.0, 60.0))
            except requests.Timeout:
                logger.error("Gemini API request timed out for model %s", gemini_model)
                return Response({
                    "error": "Upstream Gemini API request timed out. Please check your internet connection and try again.",
                    "fallback": True,
                    "disease": "Unknown",
                    "confidence": 0.0,
                    "top3": [],
                    "quality_passed": True,
                    "quality_issues": [],
                    "treatment": "The request to the vision model timed out. Please ensure network connectivity and retry.",
                }, status=200)
            except requests.RequestException as req_err:
                logger.error("Gemini API network error: %s", req_err)
                return Response({
                    "error": "Upstream Gemini API network error. Please try again later.",
                    "fallback": True,
                    "disease": "Unknown",
                    "confidence": 0.0,
                    "top3": [],
                    "quality_passed": True,
                    "quality_issues": [],
                    "treatment": "The vision service could not be reached over the network. Please retry in a few moments.",
                }, status=200)

            if res.status_code != 200:
                logger.error("Gemini API error (%s): %s", res.status_code, res.text)
                if res.status_code == 429:
                    err_msg = "Gemini API quota or rate limit exceeded. This is temporary — please retry your scan in a few minutes."
                    treatment_msg = "The AI vision service is currently experiencing high demand. Please wait a few minutes and try scanning your crop leaf again."
                elif res.status_code == 503:
                    err_msg = "The Gemini Vision model is currently experiencing high demand. This is temporary — please try again in a moment."
                    treatment_msg = "The AI vision service is temporarily busy. Please wait a few seconds and try scanning your crop leaf again."
                elif res.status_code in (401, 403):
                    err_msg = "Gemini API credentials were rejected by the provider. Please verify your GEMINI_API_KEY."
                    treatment_msg = "The configured Gemini API key is invalid or unauthorized. Please verify the credentials in the backend environment."
                elif res.status_code == 404:
                    err_msg = f"The configured Gemini model '{gemini_model}' is unavailable or not found."
                    treatment_msg = "Please check the model configuration in the backend settings."
                else:
                    err_msg = f"Upstream Gemini API service unavailable (HTTP {res.status_code}). Please try again later."
                    treatment_msg = "The AI diagnosis service is temporarily unreachable. Please try again in a few moments."

                return Response({
                    "error": err_msg,
                    "fallback": True,
                    "disease": "Unknown",
                    "confidence": 0.0,
                    "top3": [],
                    "quality_passed": True,
                    "quality_issues": [],
                    "treatment": treatment_msg,
                }, status=200)
            
            candidates = res.json().get("candidates", [])
            if not candidates or not candidates[0].get("content", {}).get("parts"):
                logger.error("Gemini API returned empty candidate parts: %s", res.text)
                return Response({
                    "error": "Gemini API returned an empty response.",
                    "fallback": True,
                    "disease": "Unknown",
                    "confidence": 0.0,
                    "top3": [],
                    "quality_passed": True,
                    "quality_issues": [],
                    "treatment": "Could not extract diagnosis from image. Please try scanning a different photo.",
                }, status=200)

            text_resp = candidates[0]["content"]["parts"][0].get("text", "").strip()
            
            # Robust markdown code fence stripping
            clean_text = text_resp
            if clean_text.startswith("```"):
                clean_text = re.sub(r"^```(?:json|JSON)?\s*\n?", "", clean_text, flags=re.IGNORECASE)
            if clean_text.endswith("```"):
                clean_text = re.sub(r"\n?```\s*$", "", clean_text)
            clean_text = clean_text.strip()

            # Locate substring from first '{' to last '}' if present
            first_brace = clean_text.find("{")
            last_brace = clean_text.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                json_str = clean_text[first_brace:last_brace + 1]
            elif first_brace != -1:
                json_str = clean_text[first_brace:]
            else:
                json_str = clean_text

            pretty_class = "Unknown"
            confidence = 0.0
            treatment = ""

            try:
                parsed = json.loads(json_str)
                pretty_class = str(parsed.get("disease", "Unknown")).strip()
                confidence = float(parsed.get("confidence", 0.85))
                treatment = str(parsed.get("treatment", "")).strip()
            except (json.JSONDecodeError, ValueError, TypeError) as parse_err:
                logger.warning("JSON decode failed for Gemini response (%s); attempting regex salvage: %s", parse_err, text_resp)
                # Attempt regex salvage of disease, confidence, and treatment from truncated/malformed JSON
                disease_match = re.search(r'"disease"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_text)
                conf_match = re.search(r'"confidence"\s*:\s*([0-9]*\.?[0-9]+)', clean_text)
                treatment_match = re.search(r'"treatment"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?', clean_text)

                if disease_match and disease_match.group(1).strip():
                    pretty_class = disease_match.group(1).strip()
                    if conf_match:
                        try:
                            confidence = float(conf_match.group(1))
                        except ValueError:
                            confidence = 0.85
                    else:
                        confidence = 0.85

                    if treatment_match and len(treatment_match.group(1).strip()) > 10:
                        treatment = treatment_match.group(1).strip()
                    else:
                        treatment = (
                            f"Inspect affected foliage for symptoms of {pretty_class}. "
                            "Isolate or remove infected plant parts, ensure good aeration and dry foliage, "
                            "and consult local agronomic guidelines for targeted treatment."
                        )
                else:
                    logger.error("Failed to salvage disease diagnosis from Gemini output: %s", text_resp)
                    return Response({
                        "error": "The AI model response could not be parsed into a structured diagnosis.",
                        "fallback": True,
                        "disease": "Unknown",
                        "confidence": 0.0,
                        "top3": [],
                        "quality_passed": True,
                        "quality_issues": [],
                        "treatment": "Could not complete diagnosis. Please ensure the leaf is clearly visible and try scanning again.",
                    }, status=200)

            if not treatment:
                treatment = (
                    f"Maintain regular monitoring for {pretty_class}. "
                    "Ensure adequate soil drainage, appropriate nutrient supply, and avoid water stagnation on foliage."
                )

            top3 = [
                {"label": pretty_class, "prob": confidence}
            ]

            return Response({
                "disease": pretty_class,
                "confidence": confidence,
                "raw_class": pretty_class,
                "top3": top3,
                "quality_passed": quality_passed,
                "quality_issues": quality_issues,
                "treatment": treatment,
            })
        except Exception as e:
            logger.error("Error during disease prediction with Gemini: %s", traceback.format_exc())
            return Response({
                "error": f"Disease diagnosis failed due to an unexpected error: {str(e)}",
                "fallback": True,
                "disease": "Unknown",
                "confidence": 0.0,
                "top3": [],
                "quality_passed": True,
                "quality_issues": [],
                "treatment": "An unexpected error occurred during diagnosis. Please try again.",
            }, status=200)


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

        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
            return Response({"error": "Latitude must be between -90 and 90, and longitude between -180 and 180."}, status=400)

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
