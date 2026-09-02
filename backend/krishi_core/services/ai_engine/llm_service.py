import json
import logging
import requests
import re
from django.conf import settings

logger = logging.getLogger(__name__)

class LLMService:
    def generate_response(self, prompt: str, force_json: bool = True) -> dict | str:
        ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        ollama_model = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:1b')
        
        payload = {
            "model": ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2
            }
        }
        
        if force_json:
            payload["format"] = "json"
        
        # 1. Try local Ollama
        try:
            logger.info(f"Sending prompt to Ollama ({ollama_model})...")
            res = requests.post(ollama_url, json=payload, timeout=(2.0, 30.0))
            
            if res.status_code == 200:
                text_resp = res.json().get("response", "").strip()
                if not force_json:
                    return text_resp
                
                cleaned_content = re.sub(r'^```(?:json)?\n', '', text_resp.strip(), flags=re.IGNORECASE)
                cleaned_content = re.sub(r'\n```$', '', cleaned_content.strip())
                return json.loads(cleaned_content)
            else:
                logger.warning("Ollama returned non-200 (%s): %s", res.status_code, res.text)
        except Exception as e:
            logger.info("Local Ollama unavailable (%s), trying Gemini fallback...", e)

        # 2. Try Gemini Cloud Fallback
        gemini_key = getattr(settings, "GEMINI_API_KEY", "")
        if gemini_key:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
                gemini_payload = {
                    "contents": [{"parts": [{"text": prompt}]}]
                }
                res = requests.post(gemini_url, json=gemini_payload, headers={"Content-Type": "application/json"}, timeout=(3.0, 20.0))
                if res.status_code == 200:
                    candidates = res.json().get("candidates", [])
                    if candidates:
                        text_resp = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if not force_json:
                            return text_resp
                        cleaned_content = re.sub(r'^```(?:json)?\n', '', text_resp.strip(), flags=re.IGNORECASE)
                        cleaned_content = re.sub(r'\n```$', '', cleaned_content.strip())
                        return json.loads(cleaned_content)
            except Exception as e:
                logger.info("Gemini fallback failed (%s)", e)

        # 3. Graceful fallback when no provider is available
        if force_json:
            return {"error": "AI service unavailable", "fallback": True}
        return "AI service is currently offline. Please configure Ollama or GEMINI_API_KEY."

llm_service = LLMService()
