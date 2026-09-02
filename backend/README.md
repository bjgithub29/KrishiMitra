# KrishiMitra Backend — Django + DRF

A single **Django + Django REST Framework** service (Django project package
`krishimitra_ml`, main app `krishi_core`) that backs the KrishiMitra React
frontend. It runs on **port 5001** and serves everything: authentication, the
farm/expense/crop-plan APIs, the scheduler, and the ML / RAG / AI endpoints. There
is no separate Node server or ML microservice.

> The project package is named `krishimitra_ml` for historical reasons; it is the
> whole backend, not an "ML service".

## Setup

```bash
# Recommended: dedicated Python 3.12 environment (Conda krishi_train or venv)
#   Conda:        conda create -n krishi_train python=3.12 -y && conda activate krishi_train
#   Windows venv: py -3.12 -m venv C:\venvs\krishi && C:\venvs\krishi\Scripts\activate
#   macOS/Linux:  python3 -m venv venv && source venv/bin/activate
cd backend
pip install -r requirements.txt
python manage.py migrate         # creates/updates db.sqlite3
python manage.py runserver 0.0.0.0:5001
```

On Windows you can instead run `start-backend.bat` from the project root, which
auto-detects active Conda environments (`krishi_train`), installs requirements,
migrates, and runs the server on port 5001.

Copy `.env.example` to `.env` and fill in what you need. Every variable is optional
for the server to boot — a missing value only disables the feature that needs it.

## Endpoints

The root URL conf mounts everything under `/api/` (`krishimitra_ml/urls.py` →
`path("api/", include("krishi_core.urls"))`).

### Data / app APIs (`krishi_core/views.py`)

DRF router resources (each supports the standard list/detail verbs):
`users`, `farms`, `crop-plans`, `recommendations`, `alerts`, `expenses`,
`notifications`, `chat/messages`, `market/prices`.

Function endpoints:

| Path | Purpose |
|------|---------|
| `auth/register`, `auth/login`, `auth/me`, `auth/profile` | Registration, JWT login, current-user, profile update |
| `auth/check-exists`, `auth/change-password` | Account helpers |
| `auth/forgot-password`, `auth/reset-password` | Password reset (OTP email via SMTP) |
| `auth/otp/request`, `auth/otp/verify` | OTP login |
| `soil-reports` | Soil report storage/retrieval |
| `weather/cache`, `weather/cache/<key>` | Weather response cache |
| `chat/sessions`, `chat`, `chat/<sid>`, `chat/sync-plan` | AI Mitra chat sessions, SSE stream, and plan synchronization |
| `market/locations` | APMC mandi market location lookup |

### ML / RAG / AI Endpoints

| Path | View (module) | Notes |
|------|---------------|-------|
| `soil_recommend` | `views_ml.SoilRecommendView` | Crop recommendation — production model (`best_model.joblib`) when farm coordinates exist (`engine: "model"`), else heuristic rule fallback (`engine: "heuristic"`). |
| `predict_yield` | `views_predictions.CropYieldPredictionView` | Crop yield regression powered by `crop_yield_model.pkl` (`R²=0.9557, MAE=12.5050`). |
| `retrieve` | `views_ml.RetrieveView` | RAG semantic search across ChromaDB collections via `rag_retriever`. |
| `crop_stage_tips` | `views_ml.CropStageTipsView` | Stage-specific agronomic notes and tasks from `timeline_kb`. |
| `disease/predict` | `views_ml.PredictDiseaseView` | Plant leaf disease pathology scanner using Google Gemini 2.5 Flash Vision. |
| `ai_recommendation` | `views_ml.DecisionEngineView` | Decision-engine orchestrator synthesizing ML predictions and RAG context. |
| `health` | `views_ml.HealthView` | Backend health check. |
| `weather` | `views_ml.WeatherView` | Open-Meteo 7-day live weather and alerts (no key needed). |
| `recommend_fertilizer` | `views_predictions.FertilizerRecommendationView` | Advanced prediction endpoint; crop plans use verified schedules in `06_crop_fertilizer_plan.csv`. |
| `predict_irrigation` | `views_predictions.IrrigationPredictionView` | Advanced prediction endpoint; crop plans use verified calendars in `02_crop_task_calendar.csv`. |

## ML Models & Artifacts

The ML predictors load scikit-learn artifacts with `joblib` from
`backend/krishi_core/ml_models/artifacts/`.

### 1. Crop Recommendation (`best_model.joblib`)
- **Artifact:** `backend/krishi_core/ml_models/artifacts/best_model.joblib`
- **Size:** `35,561,866 bytes` (~35.56 MB)
- **MD5:** `ffd5def7a346704d44790a3b6067cf19`
- **Download:** [Download `best_model.joblib` from v1.0.0 Release](https://github.com/bjgithub29/KrishiMitra/releases/download/v1.0.0/best_model.joblib)
- **Architecture:** Complete scikit-learn Pipeline with `ColumnTransformer` (numeric passthrough on `N, P, K, temperature_C, humidity_pct, ph, rainfall_mm` + `OneHotEncoder` on `season, state`) feeding a `RandomForestClassifier` (25 crop classes).
- **Environment:** Requires `scikit-learn==1.6.1`.
- **Distribution:** Distributed as a GitHub Release asset. When absent, `soil_recommend` automatically falls back to `engine: "heuristic"`.

### 2. Crop Yield Regression (`crop_yield_model.pkl`)
- **Artifact:** `backend/krishi_core/ml_models/artifacts/crop_yield_model.pkl`
- **Size:** `1,475,337 bytes` (~1.41 MB)
- **MD5:** `7c47105d8f39cfd87acc73f3ea9b3edc`
- **Download:** [Download `crop_yield_model.pkl` from v1.0.0 Release](https://github.com/bjgithub29/KrishiMitra/releases/download/v1.0.0/crop_yield_model.pkl)
- **Metrics:** `R² = 0.9557`, `MAE = 12.5050`, `RMSE = 179.8106` (evaluated on temporal holdout dataset).
- **Architecture:** `TransformedTargetRegressor(func=np.log1p, inverse_func=np.expm1)` wrapping `HistGradientBoostingRegressor(random_state=42)`.
- **Training Pipeline:** Run `python scripts/train_yield.py --csv <path_to_crop_yield.csv>` to regenerate the artifact. Expects 10 columns: `Crop, Crop_Year, Season, State, Area, Production, Annual_Rainfall, Fertilizer, Pesticide, Yield`. (Note: `Production` is excluded during training to prevent target leakage).

## Knowledge Base / RAG (ChromaDB)

RAG uses a persistent ChromaDB store at `backend/knowledge-base/chroma_db` (override with
`CHROMA_DB_PATH`) using the `sentence-transformers/all-MiniLM-L6-v2` embedding model.
Rebuild the 181 vector embeddings from the JSON sources in `knowledge-base/data/` using:

```bash
cd backend
python knowledge-base/scripts/init_disease_chroma.py    # -> disease_treatments_kb (26 items)
python knowledge-base/scripts/init_timeline_chroma.py   # -> timeline_kb (150 items)
python knowledge-base/scripts/init_website_chroma.py    # -> website_kb (5 items)
```

## AI Providers & Hybrid Fallback

- **AI Mitra Chat (`/api/chat`):** Implements a resilient 4-tier hybrid streaming architecture:
  1. **Tier 1 (Primary):** Local Ollama (`settings.OLLAMA_MODEL`, default `llama3.2:1b`, 1.5s fast connect timeout).
  2. **Tier 2 (Cloud):** Google Gemini 2.5 Flash Cloud REST API (`GEMINI_API_KEY`).
  3. **Tier 3 (Offline Knowledge):** Direct ChromaDB verified knowledge base response with verified attribution.
  4. **Tier 4 (Guidance):** Clean insufficient information notice if no matching records exist.
- **Disease Pathology Scanner (`/api/disease/predict`):** Google Gemini 2.5 Flash Multimodal Vision API.

## Notes & Database

- **Database:** SQLite (`db.sqlite3`) pre-seeded with demo accounts, farms, crop plans, and 3,937 verified APMC mandi market commodity prices.
- **Background Tasks:** `django-apscheduler` runs automated daily mandi price sync (02:00 AM) and farm risk radar computation (07:00 AM).
