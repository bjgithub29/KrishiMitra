# KrishiMitra — Full Code Audit & TODO

> Last audited: July 14, 2026. All non-ML features are complete and live.

---

## ✅ Phase 1: Core Data Pages — COMPLETE

| Page | Status | Notes |
|---|---|---|
| `_app.farms.jsx` | ✅ Done | Add Farm → POST /api/farms. "Set active" and "Edit details" buttons wired. |
| `_app.soil.jsx` | ✅ Done | Fetch from /api/soil-reports. Manual entry dialog saves. Share uses Web Share API. Download PDF triggers print. |
| `_app.equipment.jsx` | ✅ Done | Fetch from /api/equipment. Add equipment saves. "Mark serviced / Log usage" now PATCHes equipment status in DB. |

---

## ✅ Phase 2: Operations Pages — COMPLETE

| Page | Status | Notes |
|---|---|---|
| `_app.schedule.jsx` | ✅ Done | Fetch from /api/schedule. Done/Delay/Skip buttons PATCH task status. Add Task dialog saves. Progress bar is live. |
| `_app.expenses.jsx` | ✅ Done | Fetch from /api/expenses. Quick-add form saves. Pie chart computed from live data. |
| `_app.crop-plan.jsx` | ✅ Done | Fetch from /api/crop-plans. Falls back to demo stages. New Plan dialog saves. |

---

## ✅ Phase 3: Dashboard & Utility Pages — COMPLETE

| Page | Status | Notes |
|---|---|---|
| `_app.dashboard.jsx` | ✅ Done | Real crop plan progress % computed from DB. AI highlights use mocked UI arrays. |
| `_app.alerts.jsx` | ✅ Done | Dismiss and Mark all reviewed buttons work. Restore alerts button works. |
| `_app.notifications.jsx` | ✅ Done | Mark all read, filter tabs, and per-item read-marking are all interactive. |
| `_app.profile.jsx` | ✅ Done | Edit name → PATCHes /api/auth/me → instantly reflects globally. Plan adherence % computed from real schedule tasks. |
| `_app.settings.jsx` | ✅ Done | Save changes wired to backend. Reads real userProfile context. Location uses dropdown search. Toast confirmations match UI. |
| `_app.recommendations.jsx` | ✅ Done | Fetches from /api/recommendations. Re-run analysis reloads. |
| `_app.weather.jsx` | ✅ Done | Fetches live weather from Open-Meteo API. 7-day forecast clickable. Location search dropdown. Smart advisories computed from live rain/wind/UV data. |
| `_app.market.jsx` | ✅ Done | Fetches from MongoDB (synced from Data.gov.in API). State/District/Market dropdowns. Crop history chart on click. |
| `_app.ai-saathi.jsx` | ✅ Done | Fully interactive chat. Send, suggestion cards, edit, copy, thumbs up/down, clear chat all wired. Calls /api/chat. |

---

## ✅ Phase 4: System & Infrastructure — COMPLETE

| Feature | Status | Notes |
|---|---|---|
| Dark mode FOUC fix | ✅ Done | Blocking inline script in `<head>` prevents white flash on load. |
| Profile sync across app | ✅ Done | Saving profile on any page calls `fetchDashboardData()` to update global context instantly. |
| Market data daily sync | ✅ Done | `node-cron` job runs at 2:00 AM daily to fetch new prices from Data.gov.in into MongoDB. |
| Weather location search | ✅ Done | Users can search any city; weather data updates for that location. |

---

## 🔮 Future: AI & Machine Learning Features

> These require ML/LLM models and are NOT needed for a fully working app.
> The app is 100% functional without them.

- [ ] Conversational RAG Chatbot — Connect AI Mitra chat to real farm context (crop plan, soil, weather, expenses) using vector embeddings
- [ ] Soil Fertilizer ML Model — Replace static soil AI preview with Random Forest / XGBoost model trained on soil NPK data
- [ ] Crop Health Vision Model — Allow leaf photo upload with CNN disease detection (ResNet / YOLOv8)
- [ ] Yield Prediction Model — Predict yield from farm size, weather, soil, and growth stage using regression model

---

> Tip: Use useAppData() from src/lib/AppDataContext.jsx — it provides fetchScoped('/path') and postScoped('/path', body) that auto-attach your auth token and active farm filter.
