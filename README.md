# KrishiMitra — AI Smart Farming Platform

**KrishiMitra** is a full-stack digital agriculture platform for Indian farmers.
It provides localized market-price trends, weather monitoring, adaptive crop
planning, AI-driven recommendations, and image-based crop-disease detection. The
stack is a React (Vite / TanStack Start) frontend talking to a single Python
**Django + Django REST Framework** backend backed by SQLite.

---

## 🏗️ Architecture Overview

```text
        [ Frontend UI — React / Vite / TanStack Start ]      :3000
                          │  HTTP (JSON, JWT)
                          ▼
        [ Django + DRF API — krishimitra_ml ]                :5001
                          │
        ┌─────────────────┼──────────────────────────┐
        ▼                 ▼                           ▼
  [ SQLite ]      [ ML / RAG / AI services ]    [ External APIs ]
  users, farms,   crop-yield / fertilizer /     Open-Meteo (weather),
  expenses,       irrigation predictors,        data.gov.in (mandi prices),
  crop plans,     ChromaDB RAG retriever,       Google Gemini (disease/AI),
  scheduler jobs  Ollama LLM summary            Ollama (optional, local)
```

Everything runs in **one** Django process on port **5001**. There is no separate
Node server and no separate ML microservice — the ML, RAG, and AI endpoints are
plain DRF views inside the `krishi_core` app. (The Django project package is named
`krishimitra_ml` for historical reasons only.)

### Adaptive Rule Engine

The daily task generator adjusts crop schedules to real-world constraints:

1. **Weather interruptions:** an `Irrigation` task with forecast rain > 15 mm is
   marked `Skipped`.
2. **Day-offset drift:** an `Irrigation`/`Fertilizer` task completed late (or left
   pending > 3 days) shifts all downstream tasks by the overdue gap, tracked via
   `driftDays`.
3. **Pest escalations:** in the `Flowering/Reproductive` stage with humidity > 80%
   and rain, `Pest Scouting` is escalated to `Critical`.

When a rule adjusts a task, the RAG layer generates a farmer-friendly explanation
that is cached on the task record (this requires the ChromaDB knowledge base to be
initialized — see below).

---

## 🚀 Setup & Run (Windows)

**Prerequisites:** Node.js 18+ and Python 3.10+ (verified on 3.12).

The repo ships two launcher scripts at the project root. On first run each one
creates its environment and installs dependencies; later runs just start the
server.

1. **Backend** (Django API on `http://localhost:5001`):

   ```bat
   start-backend.bat
   ```

   First run: creates a virtual environment at a short path **outside** the
   project — `C:\venvs\krishi` by default — then installs `requirements.txt`,
   applies Django migrations, and starts the server. (The external location
   avoids Windows `WinError 206: The filename or extension is too long`, which
   occurs when the deep dependency trees from `chromadb`/`sentence-transformers`
   are installed into a venv nested inside the project path.) The first install
   pulls heavy ML/RAG packages and takes several minutes. To use a different
   location, set `KRISHI_VENV` first, e.g. `set KRISHI_VENV=D:\venvs\krishi`.

2. **Frontend** (Vite dev server on `http://localhost:3000`):

   ```bat
   start-frontend.bat
   ```

   First run: `npm install`, then `npm run dev`.

3. Open `http://localhost:3000` in your browser.

> If a health check with `curl http://localhost:5001/api/health` fails while the
> server is clearly running, try `curl http://127.0.0.1:5001/api/health` — on
> Windows `localhost` can resolve to IPv6 `::1` while the dev server listens on
> IPv4 `0.0.0.0`.

### Manual steps (any OS)

```bash
# Backend
# Create the venv first:
#   Windows:      py -3.12 -m venv C:\venvs\krishi   then   C:\venvs\krishi\Scripts\activate
#                 (keep it OUTSIDE the project on a short path to avoid WinError 206
#                  "The filename or extension is too long")
#   macOS/Linux:  python3 -m venv venv               then   source venv/bin/activate
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:5001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### ⚙️ Environment Configuration

KrishiMitra can boot and serve local features without a `backend/.env` file because safe development defaults are built into `settings.py`. However, **credential-dependent integrations remain unavailable until their respective API keys and credentials are configured.**

To enable full external integrations, copy the public template to `backend/.env`:

```bash
cd backend
cp .env.example .env     # Windows cmd: copy .env.example .env
```

> **Security Note:** `backend/.env` is local, strictly Git-ignored, and must **never** be committed.

#### Feature & Credential Dependency Matrix:

| Feature / Service | Required Environment Variable | Behavior if Unset / Unconfigured |
|---|---|---|
| **Core Platform & Local ML** | *None* (Built-in defaults) | ✅ Server boots on `:5001`; Crop Recommendation (`best_model.joblib`), Crop Yield (`crop_yield_model.pkl`), RAG, and Weather work immediately. |
| **Plant Leaf Disease Vision Scanner** | `GEMINI_API_KEY` | ⚠️ Returns user-friendly error: *"Gemini API key is not configured in backend/.env"*. |
| **AI Mitra Cloud LLM Fallback** | `GEMINI_API_KEY` | ℹ️ Automatically cascades to Tier-3 verified ChromaDB knowledge retrieval. |
| **Password Reset OTP Email** | `EMAIL_HOST_USER` + `EMAIL_HOST_PASSWORD` | ℹ️ OTP codes are logged to the server console instead of sending real SMTP emails. |
| **Live Mandi Price Sync** | `DATAGOV_API_KEY` | ℹ️ Live API sync skipped; platform serves 3,937 pre-seeded APMC market prices from SQLite. |
| **Local LLM Chat Streaming** | `OLLAMA_BASE_URL` + `OLLAMA_MODEL` | ℹ️ Defaults to `http://127.0.0.1:11434` (`llama3.2:1b`); cascades gracefully if Ollama is offline. |

---

## ✅ System Capabilities — Core vs. External Integrations

- **Core Capabilities (Work immediately with local assets):** Auth/JWT, Farms/Expenses/Crop-Plans CRUD, Risk Radar, Weather (Open-Meteo), Crop Recommendation ML, Crop Yield ML, Fertilizer & Irrigation plans, and ChromaDB RAG retrieval.
- **External Integrations (Require credentials in `backend/.env`):** Leaf pathology vision scanning (Google Gemini Vision API), live government market price synchronization (Data.gov.in API), and SMTP email delivery (Gmail SMTP).

### ML Models & Artifacts

The machine learning engine uses binary artifacts stored in `backend/krishi_core/ml_models/artifacts/`.
These models are excluded from Git history and distributed via [**GitHub Release v1.0.0**](https://github.com/bjgithub29/KrishiMitra/releases/tag/v1.0.0):

| Artifact | Size | MD5 Checksum | Download Link | Description |
|---|---|---|---|---|
| **`best_model.joblib`** | 35.56 MB | `ffd5def7a346704d44790a3b6067cf19` | [Download](https://github.com/bjgithub29/KrishiMitra/releases/download/v1.0.0/best_model.joblib) | 25-class Random Forest Crop Recommendation pipeline (`engine="model"`) |
| **`crop_yield_model.pkl`** | 1.41 MB | `7c47105d8f39cfd87acc73f3ea9b3edc` | [Download](https://github.com/bjgithub29/KrishiMitra/releases/download/v1.0.0/crop_yield_model.pkl) | HistGradientBoosting Crop Yield Regressor (`R²=0.9557, MAE=12.5050`) |

- **Automatic Fallback:** If `best_model.joblib` is absent, `/api/soil_recommend` seamlessly serves rule-based agronomic recommendations (`engine="heuristic"`).
- **Training Yield Model:** Run `python scripts/train_yield.py --csv <path_to_crop_yield.csv>` inside `backend/` to regenerate `crop_yield_model.pkl`.
- **Environment Requirement:** Must use `scikit-learn==1.6.1` to maintain pipeline binary compatibility.

### Knowledge Base / RAG

The RAG retriever uses a persistent ChromaDB store at `backend/knowledge-base/chroma_db`
(override with `CHROMA_DB_PATH`). The collections are generated deterministically
from the JSON sources in `backend/knowledge-base/data/` using:

```bash
cd backend
python knowledge-base/scripts/init_disease_chroma.py    # -> disease_treatments_kb (26 items)
python knowledge-base/scripts/init_timeline_chroma.py   # -> timeline_kb (150 items)
python knowledge-base/scripts/init_website_chroma.py    # -> website_kb (5 items)
```

---

## 📁 Folder Structure

```text
KrishiMitra_Demo/
├── frontend/                     React 19 (Vite / TanStack Router) single-page app
├── backend/                      Django + DRF project (runs on :5001)
│   ├── manage.py
│   ├── krishimitra_ml/           Django project (settings, urls, wsgi)
│   ├── krishi_core/              Main app: models, DRF views, serializers, services
│   │   ├── services/             Weather, market sync, AI engine, ML predictors
│   │   └── ml_models/artifacts/  ML pipelines (best_model.joblib, crop_yield_model.pkl)
│   ├── knowledge-base/           ChromaDB vector store + init scripts + JSON data
│   ├── scripts/                  Model training scripts (train_yield.py)
│   ├── requirements.txt
│   └── .env.example
├── start-backend.bat             Auto-detects environment + starts Django (:5001)
└── start-frontend.bat            Starts Vite dev server (:3000)
```

---

## 🚧 Known Limitations

- **Academic/demo build:** no production hardening (rate limiting, HTTPS,
  tightened `ALLOWED_HOSTS`/CORS). `DEBUG` defaults to on.
- **Disease leaf scanner** requires `GEMINI_API_KEY` in `backend/.env`.
- **AI Mitra** uses local Ollama `llama3.2:1b` if running, or falls back to
  Gemini / ChromaDB knowledge base automatically.
