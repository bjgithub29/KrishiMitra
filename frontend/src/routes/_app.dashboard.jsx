import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CloudSun,
  Droplets,
  Sparkles,
  Sun,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAppData } from "@/lib/AppDataContext";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — KrishiMitra" },
      {
        name: "description",
        content:
          "Your farm at a glance: weather, tasks, crop plan progress, risk alerts and expenses.",
      },
    ],
  }),
  component: Dashboard,
});

const severityStyles = {
  critical: "border-destructive/40 bg-destructive/8 text-destructive",
  warning: "border-warning/40 bg-warning/8 text-warning",
  info: "border-cyan/30 bg-cyan/8 text-cyan",
};


function Dashboard() {
  const { token, userProfile, farms, activeFarm, weatherSnapshot, setWeatherSnapshot, fetchScoped, alerts = [] } = useAppData();

  const [cropPlan, setCropPlan] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const plans = await fetchScoped("/crop-plans");
        if (Array.isArray(plans) && plans.length > 0) setCropPlan(plans[0]);
      } catch (e) { /* silently fail */ }
    }
    loadData();
  }, [activeFarm]);

  // Pre-load weather from the backend DB cache on mount so the weather widget
  // shows real data even without the user ever visiting the Weather page.
  useEffect(() => {
    if (!token || weatherSnapshot || !activeFarm?.location?.address) return;
    const API_URL = import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
    const locationKey = activeFarm.location.address
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const fetchLiveWeather = async () => {
      try {
        const { lat, lon, address } = activeFarm.location;
        if (lat == null || lon == null) return;
        const res = await fetch(`${API_URL}/weather?latitude=${lat}&longitude=${lon}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const current = {
          temp: Math.round(data.current?.temperature ?? 28),
          humidity: data.current?.humidity ?? 65,
          wind: Math.round(data.current?.wind_speed ?? 12),
          uv: data.daily_forecast?.[0]?.uv_index_max ?? 5,
          rainChance: data.daily_forecast?.[0]?.precipitation_probability_max ?? 10,
          todayRainMm: data.current?.precipitation ?? 0,
          condition: address,
          cityName: address,
          alerts: data.alerts || []
        };
        setWeatherSnapshot(current);

        // Persist to cache
        await fetch(`${API_URL}/weather/cache`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ locationKey, cityName: address, lat, lon, data }),
        });
      } catch (e) { console.error("Dashboard live weather fetch failed", e); }
    };

    fetch(`${API_URL}/weather/cache/${locationKey}?query=${encodeURIComponent(activeFarm.location.address)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(cached => {
        if (cached?.data?.current) {
          setWeatherSnapshot({
            temp: cached.data.current.temp,
            humidity: cached.data.current.humidity,
            wind: cached.data.current.wind,
            uv: cached.data.current.uv,
            rainChance: cached.data.current.rainChance,
            todayRainMm: cached.data.current.precipitation,
            condition: cached.cityName,
            cityName: cached.cityName,
            alerts: cached.data.alerts || [],
          });
        } else {
          // If cache miss, fetch live
          fetchLiveWeather();
        }
      })
      .catch(() => { fetchLiveWeather(); });
  }, [token, activeFarm, weatherSnapshot]);

  const totalArea = farms.reduce((s, f) => s + (f.areaAcres || 0), 0);
  const activeFarms = farms.filter((f) => f.isActive).length;
  const firstName = userProfile?.name?.split(" ")[0] || "Farmer";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Compute real crop plan progress based on dates
  const stages = cropPlan?.milestones || [];
  const doneStages = stages.filter(s => s.status === "done").length;
  let cropProgress = 0;
  let cropProgressHint = "No active crop plan";
  
  if (cropPlan?.sowingDate && cropPlan?.expectedHarvestDate) {
    const todayDate = new Date();
    const sowing = new Date(cropPlan.sowingDate);
    const harvest = new Date(cropPlan.expectedHarvestDate);
    
    const durationDays = Math.max(1, Math.round((harvest - sowing) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.round((todayDate - sowing) / (1000 * 60 * 60 * 24)));
    
    cropProgress = Math.min(100, Math.round((elapsedDays / durationDays) * 100));
    
    const activeStage = stages.find(s => s.status === "in-progress" || s.status === "pending");
    cropProgressHint = activeStage ? `${activeStage.stage} · Day ${elapsedDays} of ${durationDays}` : `Day ${elapsedDays} of ${durationDays}`;
  } else if (stages.length > 0) {
    cropProgress = Math.round((doneStages / stages.length) * 100);
    const activeStage = stages.find(s => s.status === "in-progress" || s.status === "pending");
    cropProgressHint = activeStage ? `${activeStage.stage} · Stage ${doneStages + 1} of ${stages.length}` : `${doneStages} of ${stages.length} stages done`;
  }


  const rainChance = weatherSnapshot?.rainChance || 0;
  const humidity = weatherSnapshot?.humidity || 0;

  // Fallback to static rules if the backend didn't generate any AI alerts
  const staticAdvisories = [
    rainChance > 60
      ? { title: "Rain alert: delay spraying", body: `Rain probability is ${rainChance}%. Avoid spraying operations until dry weather returns to ensure full crop absorption.`, tone: "text-warning" }
      : { title: "Good spraying window ahead", body: `Rain chance is only ${rainChance}%. This is a good window for micronutrient or pesticide spraying operations.`, tone: "text-primary" },
    humidity > 80
      ? { title: "High humidity risk", body: `Humidity at ${humidity}% — ideal conditions for fungal disease. Inspect leaves and consider preventive fungicide application.`, tone: "text-warning" }
      : { title: "Irrigation efficiency tip", body: activeFarm ? `Your ${activeFarm.name} farm: schedule irrigation in early morning to reduce evaporation losses by up to 30%.` : "Schedule irrigation in early morning to reduce evaporation losses by up to 30%.", tone: "text-cyan" },
    { title: "Market timing signal", body: "Check the Market Prices page for today's Mandi rates and compare with your expected harvest value to plan selling strategy.", tone: "text-primary" },
  ];

  const dynamicAlerts = weatherSnapshot?.alerts?.map(alert => ({
    title: alert.type === "critical" ? "Critical Weather Alert" : "Weather Advisory",
    body: alert.message,
    tone: alert.type === "critical" ? "text-destructive" : (alert.type === "warning" ? "text-warning" : "text-cyan")
  })) || [];

  const aiAdvisories = dynamicAlerts.length > 0 ? dynamicAlerts : staticAdvisories;

  return (
    <div className="space-y-5">
      {/* Welcome band */}
      <section className="glass-strong hero-ambient relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="grid-pattern pointer-events-none absolute inset-0" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              {today}
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {firstName}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              {activeFarm
                ? <>Your <span className="font-semibold text-foreground">{activeFarm.name}</span> farm has {activeFarm.currentCrop ? `${activeFarm.currentCrop} growing` : "no active crop"}. Stay on top of today's tasks to keep the season on track.</>
                : "Welcome back! Add your first farm to get started with your personalized dashboard."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/recommendations"
                className="glass flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors hover:border-primary/30"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" /> AI recommendations
              </Link>
            </div>
          </div>

          {/* Weather widget */}
          <div className="glass w-full rounded-2xl p-5 lg:w-72">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {activeFarm?.location?.address || "Your Farm"} · Now
                </div>
                <div className="mt-1 flex items-end gap-1">
                  <span className="font-display text-4xl font-bold">{weatherSnapshot?.temp ?? "--"}°</span>
                  <span className="mb-1.5 text-xs text-muted-foreground">
                    {weatherSnapshot?.condition || "--"}
                  </span>
                </div>
              </div>
              <CloudSun className="h-10 w-10 text-warning float-slow" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                [Droplets, `${weatherSnapshot?.humidity ?? "--"}%`, "Humidity"],
                [Wind, `${weatherSnapshot?.wind ?? "--"} km/h`, "Wind"],
                [Sun, `UV ${weatherSnapshot?.uv ?? "--"}`, "UV Index"],
              ].map(([Icon, v, l]) => (
                <div key={l} className="rounded-xl bg-secondary/50 py-2">
                  <Icon className="mx-auto h-3.5 w-3.5 text-cyan" />
                  <div className="mt-1 text-xs font-semibold">{v}</div>
                  <div className="text-[10px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
            <Link
              to="/weather"
              className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-cyan hover:underline"
            >
              7-day forecast <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total farms" value={String(farms.length)} hint={`${totalArea.toFixed(1)} acres · ${activeFarms} active`} tone="primary" bar={farms.length > 0 ? 100 : 0} />
        <StatCard label="Crop plan progress" value={`${cropProgress}%`} hint={cropProgressHint} tone="cyan" bar={cropProgress} />
        <StatCard label="Active risk alerts" value={String(alerts.length)} hint={alerts.length > 0 ? `${alerts.filter(a => a.severity === "critical").length} critical` : "No alerts"} tone="warning" />
        <StatCard label="Active farm" value={activeFarm?.name?.split("—")[0]?.trim() || "None"} hint={activeFarm ? `${activeFarm.areaAcres} acres · ${activeFarm.soilType}` : "Select or add a farm"} tone="foreground" />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Quick links */}
        <section className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Quick actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: "/expenses", label: "💰 Expense Tracker", sub: "Log farm expenses" },
              { to: "/market", label: "📈 Market Prices", sub: "Check today's mandi rates" },
              { to: "/farms", label: "🏡 Farm Details", sub: "Manage your farm plots" },
              { to: "/weather", label: "🌤️ Weather", sub: "Check weekly forecast" },
            ].map(({ to, label, sub }) => (
              <Link
                key={to}
                to={to}
                className="ring-glow flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-[11px] text-muted-foreground">{sub}</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>

        {/* Alerts */}
        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Risk alerts</h2>
            <Link to="/alerts" className="text-xs font-medium text-primary hover:underline">
              All alerts
            </Link>
          </div>
          <div className="space-y-2.5">
            {alerts.slice(0, 3).map((a) => (
              <div
                key={a._id || a.id}
                className={`rounded-xl border px-3.5 py-3 ${severityStyles[a.severity] || severityStyles.info}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{a.title}</span>
                  <span className="shrink-0 text-[10px] opacity-70">
                    {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground/70">
                  {a.detail || a.message}
                </p>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="rounded-xl border border-dashed px-3.5 py-3 text-center text-xs text-muted-foreground">
                No active alerts
              </div>
            )}
          </div>
        </section>
      </div>

      {/* AI advisory + crop progress */}
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="glass relative overflow-hidden rounded-2xl p-5 lg:col-span-2">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold">AI recommendation highlights</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {aiAdvisories.map((r) => (
              <div key={r.title} className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className={`text-xs font-semibold ${r.tone}`}>{r.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-4 font-display text-sm font-semibold">Crop plan progress</h2>
          <div className="space-y-3">
            {stages.slice(0, 5).map((s) => (
              <div key={s._id || s.stage} className="flex items-center gap-3">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                    s.status === "done"
                      ? "bg-primary text-primary-foreground"
                      : s.status === "in-progress"
                        ? "bg-primary/15 text-primary ring-1 ring-primary pulse-dot"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {s.status === "done" ? "✓" : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-xs ${s.status === "in-progress" ? "font-semibold text-primary" : s.status === "done" ? "text-muted-foreground" : ""}`}
                  >
                    {s.stage}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {s.plannedDate ? new Date(s.plannedDate).toLocaleDateString() : ""}
                  </div>
                </div>
              </div>
            ))}
            {stages.length === 0 && (
              <div className="text-xs text-muted-foreground">No active crop plan</div>
            )}
          </div>
          <Link
            to="/crop-plan"
            className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
          >
            Full crop roadmap <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, tone, bar }) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "cyan"
        ? "text-cyan"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <div className="glass hover-lift rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <ThermometerSun className="hidden" />
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
      {bar !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-cyan"
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
