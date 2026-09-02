# FILE SUMMARY

## Architecture

KrishiMitra is a farm-management and precision-agriculture platform.

- **Frontend** — React app (Vite / TanStack Start) on port `3000`: dashboards,
  scheduling, crop planning, weather, market prices, and the AI Saathi chat.
- **Backend** — a single **Django + Django REST Framework** service on port
  `5001` (project package `krishimitra_ml`, main app `krishi_core`). It owns the
  API, the SQLite database, JWT auth, the scheduler, and all ML / RAG / AI
  endpoints as DRF views. There is no separate Node server or ML microservice.

The Django process natively loads ML/RAG helpers and serves predictions and RAG
context through its own views. Trained model artifacts and the ChromaDB
collections are external inputs (see the backend README) — when absent, the
affected endpoints degrade gracefully and the server still starts.

## Key files & purpose

### Backend root (`backend/`)

- `manage.py` — Django entry point.
- `requirements.txt` — Python dependencies.
- `.env.example` — documented environment template (copy to `.env`).
- `db.sqlite3` — SQLite database (app data + APScheduler job store).
- `seed_market.py` — helper script to seed market-price data.

### Django project (`backend/krishimitra_ml/`)

- `settings.py` — DRF, JWT, CORS, SQLite, ML/RAG env config, email/OTP settings.
- `urls.py` — root URL conf; mounts `krishi_core.urls` under `/api/`.
- `wsgi.py` — WSGI application.

### Main app (`backend/krishi_core/`)

- `models.py` — ORM models (User, Farm, CropPlan, Expense, Recommendation, Alert,
  Notification, ChatMessage, MarketPrice, OTP records, etc.).
- `serializers.py` — DRF serializers for the models above.
- `urls.py` — router + function/class endpoints (see backend README for the map).
- `views.py` — auth, data-resource viewsets, chat, weather cache, market, soil
  reports.
- `views_ml.py` — RAG retrieve, soil recommend, crop-stage tips, disease predict,
  decision-engine orchestrator, health, weather.
- `views_predictions.py` — crop-yield, fertilizer, irrigation prediction views.
- `apps.py` — `AppConfig`; startup wiring.
- `jobs.py` — scheduled jobs (APScheduler).
- `ml_loader.py` — model-loading helper.
- `utils.py` — shared helpers.
- `admin.py`, `tests.py` — Django admin registrations and test stub.
- `migrations/` — schema migrations (0001–0008).
- `crop_database.json`, `crop_task_templates.json`, `crop_configs/`, `data/` —
  static crop reference data and task templates used by the planner.
- `ml_models/artifacts/` — location for ML model pipelines (`best_model.joblib`,
  `crop_yield_model.pkl`, `crop_yield_metrics.json`).

### Services (`backend/krishi_core/services/`)

- `crop_recommendation_service.py` — production Random Forest crop classifier pipeline
  (`best_model.joblib`, 25 crops) with Open-Meteo seasonal climatology integration.
- `yield_service.py` — HistGradientBoosting crop yield regression service (`crop_yield_model.pkl`).
- `fertilizer_service.py`, `irrigation_service.py` — deterministic agronomic schedule services.
- `openmeteo_service.py` — Open-Meteo weather integration (no API key required).
- `market_sync.py` — market-price sync (data.gov.in).
- `alert_engine.py`, `risk_engine.py` — alert generation and risk scoring used by
  the crop-plan / rule-engine flow.

### AI Engine (`backend/krishi_core/services/ai_engine/`)

- `rag_retriever.py` — live RAG retriever over ChromaDB
  (`sentence-transformers/all-MiniLM-L6-v2`); backs `/api/retrieve` and `/api/crop_stage_tips`.
- `llm_service.py` — hybrid LLM integration (Ollama `llama3.2:1b` with automatic Gemini 2.5 Flash fallback).
- `decision_engine.py` — decision-engine orchestrator behind `/api/ai_recommendation`.
- `prompt_builder.py` — grounded prompt assembly incorporating RAG and ML context.

### Knowledge Base (`backend/knowledge-base/`)

- `data/` — JSON sources: `class_names.json`, `disease_kb.json`, `timeline_kb.json`,
  `website_kb.json`.
- `scripts/` — deterministic ChromaDB initializers and helpers:
  `init_disease_chroma.py` (→ `disease_treatments_kb`), `init_timeline_chroma.py`
  (→ `timeline_kb`), `init_website_chroma.py` (→ `website_kb`),
  `generate_disease_kb.py`, `list_collections.py`.
- `chroma_db/` — generated persistent vector store indexing 181 vector embeddings.

### Frontend (`frontend/src/`)

- `routes/` — page routes (`_app.ai-saathi.jsx` [AI Mitra], `_app.crop-plan.jsx`,
  `_app.recommendations.jsx`, `_app.weather.jsx`, `_app.market.jsx`, etc.).
- `components/` — reusable UI and AppShell.
- `lib/` — context and utilities (`AppDataContext.jsx` manages API calls/state).
