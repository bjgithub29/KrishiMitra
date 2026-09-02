import json
import requests
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_ROOT = os.path.dirname(BASE_DIR)          # knowledge-base/
PROJECT_ROOT = os.path.dirname(KB_ROOT)       # repo root

# Load backend env to get OLLAMA url
load_dotenv(os.path.join(PROJECT_ROOT, 'backend', '.env'))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

with open(os.path.join(KB_ROOT, 'data', 'class_names.json'), 'r') as f:
    classes = json.load(f)

kb = []
for c in classes:
    if 'healthy' in c.lower():
        continue
    
    pretty_name = c.replace("___", " - ").replace("_", " ")
    print(f"Generating for: {pretty_name}")
    
    prompt = f"You are an expert plant pathologist. Write a short, single paragraph describing the symptoms, causes, and best organic/chemical treatments for the plant disease: {pretty_name}. Do not use conversational filler, just provide the facts."
    
    try:
        res = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=120
        )
        if res.status_code == 200:
            text = res.json().get('response', '').strip()
            kb.append({
                "id": c,
                "metadata": {"disease": pretty_name},
                "document": text
            })
            print("Success")
        else:
            print("Failed:", res.text)
    except Exception as e:
        print("Error:", e)

with open(os.path.join(KB_ROOT, 'data', 'disease_kb.json'), 'w') as f:
    json.dump(kb, f, indent=2)

print("Generated disease_kb.json with", len(kb), "entries.")
