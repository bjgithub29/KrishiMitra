import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Wind, Droplets, Eye, Gauge, Thermometer, Sun, CloudRain, Cloud, CloudSun, Navigation, Plus, X, Sparkles, Clock, Calendar } from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { PageHeader } from "@/components/app/AppShell";

export const Route = createFileRoute("/_app/weather")({
  head: () => ({
    meta: [
      { title: "Weather & Advisory — KrishiMitra" },
      { name: "description", content: "Hyperlocal weather forecast with irrigation and spraying advisories for your farm." },
    ],
  }),
  component: WeatherPage,
});

// --- Helper: Get dynamic sky gradient based on conditions ---
function getSkyStyle(rainChance, temp, windSpeed, hour) {
  const isNight = hour < 6 || hour >= 19;
  if (isNight) {
    return {
      bg: "linear-gradient(160deg, #0f0c29 0%, #1a1a4e 40%, #24243e 100%)",
      overlay: "rgba(15,12,41,0.3)",
      label: "Night",
    };
  }
  if (rainChance > 70) {
    return {
      bg: "linear-gradient(160deg, #2c3e50 0%, #3d5a73 40%, #4a7fa0 100%)",
      overlay: "rgba(44,62,80,0.2)",
      label: "Stormy",
    };
  }
  if (rainChance > 40) {
    return {
      bg: "linear-gradient(160deg, #616e7c 0%, #7d9ab5 40%, #a0bfd4 100%)",
      overlay: "rgba(97,110,124,0.2)",
      label: "Cloudy",
    };
  }
  if (temp > 35) {
    return {
      bg: "linear-gradient(160deg, #c94b4b 0%, #e87a3a 40%, #f5c26b 100%)",
      overlay: "rgba(200,75,75,0.15)",
      label: "Hot & Sunny",
    };
  }
  // Clear / partly cloudy default
  return {
    bg: "linear-gradient(160deg, #1e6fa8 0%, #2e9cd4 40%, #78c8ed 100%)",
    overlay: "rgba(30,111,168,0.15)",
    label: "Partly Cloudy",
  };
}

// Builds today's plain-language irrigation/spraying advisory for the active
// farm, combining live conditions with the farm's saved water availability
// (low/medium/high) instead of asking the farmer to re-enter it here.
function buildAdvisory(current, waterLevel) {
  if (!current) return [];
  const items = [];

  if (current.rainChance >= 60) {
    items.push({ tone: "warning", title: "Hold off on spraying", detail: `${current.rainChance}% chance of rain — spray will likely wash off. Wait for a drier window.` });
  } else if (current.wind >= 25) {
    items.push({ tone: "warning", title: "Skip spraying today", detail: `Wind around ${current.wind} km/h risks drift. Spray early morning once wind drops below 15 km/h.` });
  } else {
    items.push({ tone: "good", title: "Good spraying window", detail: "Low rain chance and calm wind — safe to spray pesticide/fertilizer today." });
  }

  const lowWater = waterLevel === "low";
  if (current.rainChance >= 60) {
    items.push({ tone: "good", title: "Irrigation can wait", detail: "Rain expected today — skip scheduled irrigation and check drainage instead." });
  } else if (lowWater && current.humidity < 50) {
    items.push({ tone: "warning", title: "Prioritise irrigation", detail: "This farm is marked low water availability and humidity is low — irrigate early morning to reduce evaporation loss." });
  } else if (current.humidity < 40) {
    items.push({ tone: "warning", title: "Irrigate today", detail: "Low humidity is drying the root zone faster than usual — check soil moisture and irrigate if dry." });
  } else {
    items.push({ tone: "neutral", title: "Irrigation on schedule", detail: "Conditions are normal — follow the regular irrigation interval for this crop." });
  }

  if (current.uv >= 8) {
    items.push({ tone: "warning", title: "High UV", detail: "Avoid midday fieldwork; schedule labour for early morning or evening." });
  }

  return items;
}

// --- Weather Icon Component ---
function WeatherIcon({ rainChance, size = 5, className = "" }) {  const cls = `h-${size} w-${size} ${className}`;
  if (rainChance > 60) return <CloudRain className={cls} />;
  if (rainChance > 25) return <CloudSun className={cls} />;
  return <Sun className={cls} />;
}

// --- Fetch weather for a given location string ---
async function fetchWeatherForLocation(locationQuery, inputLat, inputLon) {
  let lat = inputLat;
  let lon = inputLon;
  let cityName = locationQuery;

  if (lat == null || lon == null) {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationQuery)}&limit=1`
    );
    const geoData = await geoRes.json();
    if (geoData && geoData.length > 0) {
      lat = parseFloat(geoData[0].lat);
      lon = parseFloat(geoData[0].lon);
      const addr = geoData[0].address || {};
      cityName = addr.city || addr.town || addr.village || addr.county || locationQuery;
    } else {
      throw new Error(`Could not find coordinates for ${locationQuery}`);
    }
  }

  const baseUrl = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
  const weatherRes = await fetch(`${baseUrl}/weather?latitude=${lat}&longitude=${lon}`);
  
  if (!weatherRes.ok) {
    throw new Error("Failed to fetch weather from ML backend");
  }
  
  const data = await weatherRes.json();

  const current = {
    temp: Math.round(data.current?.temperature ?? 28),
    feelsLike: Math.round(data.current?.feels_like ?? 28),
    humidity: data.current?.humidity ?? 65,
    wind: Math.round(data.current?.wind_speed ?? 12),
    windDir: data.current?.wind_direction ?? 225,
    rainChance: data.daily_forecast?.[0]?.precipitation_probability_max ?? 10,
    precipitation: data.current?.precipitation ?? 0,
    uv: data.daily_forecast?.[0]?.uv_index_max ?? 5,
    visibility: 15,
    pressure: data.current?.pressure ?? 1007,
    sunrise: data.daily_forecast?.[0]?.sunrise?.split("T")[1]?.slice(0,5) ?? "06:05",
    sunset: data.daily_forecast?.[0]?.sunset?.split("T")[1]?.slice(0,5) ?? "19:23",
  };

  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const daily = (data.daily_forecast || []).slice(0, 10).map((d, i) => ({
    day: i === 0 ? "Today" : days[new Date(d.date).getDay()],
    hi: Math.round(d.temp_max),
    lo: Math.round(d.temp_min),
    rain: d.precipitation_probability_max ?? 0,
  }));

  // Next 12 hours from current time
  const nowHour = new Date().getHours();
  // We need to find the correct starting index in hourly_forecast that matches nowHour, 
  // since the backend slice might start at 00:00.
  const hourlyStartIdx = (data.hourly_forecast || []).findIndex(h => new Date(h.time).getHours() === nowHour) || 0;
  
  const hourly = (data.hourly_forecast || [])
    .slice(hourlyStartIdx, hourlyStartIdx + 13)
    .map((h, i) => {
      const date = new Date(h.time);
      const hr = date.getHours();
      return {
        label: i === 0 ? "Now" : `${hr}${hr < 12 ? "AM" : "PM"}`,
        temp: Math.round(h.temperature),
        rain: h.precipitation_probability ?? 0,
      };
    });

  const alerts = data.alerts || [];

  return { cityName, current, daily, hourly, lat, lon, alerts };
}

// --- Location chip, styled to match the rest of the app (glass cards, theme tokens) ---
function LocationCard({ name, temp, condition, rain, active, onClick, onRemove }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick?.()}
      className={`hover-lift group relative flex shrink-0 cursor-pointer flex-col items-start gap-1 overflow-hidden rounded-2xl px-4 py-3 text-left transition-all ${
        active
          ? "glass ring-2 ring-primary/50"
          : "glass ring-1 ring-border hover:ring-primary/25"
      }`}
    >
      <div className="flex w-full items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{condition}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-bold text-primary">{temp}°</div>
          {rain > 30 && <div className="text-[10px] text-cyan">{rain}% rain</div>}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-destructive group-hover:flex"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function WeatherPage() {
  const navigate = useNavigate();
  const { token, activeFarm, userLocation, setWeatherSnapshot, postScoped, alerts, fetchDashboardData } = useAppData();

  const [locations, setLocations] = useState([]);
  const [locationData, setLocationData] = useState({});
  const [locationMeta, setLocationMeta] = useState({}); // { [id]: { source, ageMinutes, cachedAt } }
  const [activeId, setActiveId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");

  /** Convert a location query to a stable cache key (mirrors backend logic) */
  const toLocationKey = (q) =>
    q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  /** Save freshly-fetched live data to the backend DB cache */
  const persistToCache = async (locationKey, cityName, lat, lon, data) => {
    try {
      await fetch(`${API_URL}/weather/cache`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationKey, cityName, lat, lon, data }),
      });
    } catch (e) { /* non-critical */ }
  };

  /**
   * SWR loader for a single location:
   * 1. Check backend DB cache → render immediately if found
   * 2. Fire live fetch in parallel (or if cache empty)
   * 3. When live data arrives → update UI + persist to cache
   */
  const loadLocationSWR = async (loc) => {
    const key = toLocationKey(loc.query);

    // --- Phase 1: Try cache first (instant) ---
    try {
      const cacheRes = await fetch(
        `${API_URL}/weather/cache/${key}?query=${encodeURIComponent(loc.query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (cacheRes.ok) {
        const cached = await cacheRes.json();
        if (cached.data) {
          setLocationData(prev => ({
            ...prev,
            [loc.id]: { cityName: cached.cityName, ...cached.data, lat: cached.lat, lon: cached.lon },
          }));
          setLocationMeta(prev => ({
            ...prev,
            [loc.id]: { source: cached.source, ageMinutes: cached.ageMinutes, cachedAt: cached.cachedAt },
          }));
          // If fresh enough, skip live fetch
          if (cached.source === "cache") return;
        }
      }
    } catch (e) { /* proceed to live fetch */ }

    // --- Phase 2: Live fetch (background if cache was shown, foreground if empty) ---
    try {
      const liveData = await fetchWeatherForLocation(loc.query, loc.lat, loc.lon);
      setLocationData(prev => ({ ...prev, [loc.id]: liveData }));
      setLocationMeta(prev => ({ ...prev, [loc.id]: { source: "live", ageMinutes: 0, cachedAt: new Date().toISOString() } }));
      // Persist to backend cache for next visit
      persistToCache(key, liveData.cityName, liveData.lat, liveData.lon, {
        current: liveData.current,
        daily: liveData.daily,
        hourly: liveData.hourly,
        alerts: liveData.alerts,
      });
    } catch (e) { console.error("Live weather fetch failed for", loc.query, e); }
  };

  // Load data for all locations using SWR
  useEffect(() => {
    for (const loc of locations) {
      if (!locationData[loc.id]) {
        loadLocationSWR(loc);
      }
    }
  }, [locations, token]);

  // Auto-add the user's saved location as first entry on mount
  useEffect(() => {
    if (userLocation?.query) {
      const id = "user-home";
      setLocations(prev => {
        if (prev.find(l => l.id === id)) return prev;
        return [{ id, query: userLocation.query, lat: userLocation.lat, lon: userLocation.lon }, ...prev];
      });
      setActiveId(id);
    } else if (activeFarm?.location?.address) {
      // fallback: use active farm location
      const farmQuery = activeFarm.location.address;
      const id = "farm-main";
      setLocations(prev => {
        if (prev.find(l => l.id === id)) return prev;
        return [{ id, query: farmQuery, lat: activeFarm.location.lat, lon: activeFarm.location.lon }, ...prev];
      });
      setActiveId(id);
    }
  }, [userLocation, activeFarm]);

  // Search handler
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (searchQuery.length < 3) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await res.json();
        setSearchResults(data);
      } finally { setIsSearching(false); }
    }, 500);
  }, [searchQuery]);

  const addLocation = async (item) => {
    const addr = item.address || {};
    const name = addr.city || addr.town || addr.village || addr.county || item.display_name.split(",")[0];
    const state = addr.state || "";
    const query = state ? `${name}, ${state}` : name;
    const id = Date.now();
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    
    setLocations(prev => [...prev, { id, query, lat, lon }]);
    setActiveId(id);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
    loadLocationSWR({ id, query, lat, lon });
  };

  const removeLocation = (id) => {
    setLocations(prev => prev.filter(l => l.id !== id));
    setLocationData(prev => { const c = { ...prev }; delete c[id]; return c; });
    if (activeId === id) setActiveId(locations[0]?.id);
  };

  const active = locationData[activeId];
  const hour = new Date().getHours();

  // Push the currently viewed conditions into shared app state so the
  // dashboard weather widget and the AI Saathi chatbot both see live data
  // instead of staying stuck on "--" / falling back to a separate server call.
  useEffect(() => {
    if (!active?.current) return;
    setWeatherSnapshot({
      temp: active.current.temp,
      humidity: active.current.humidity,
      wind: active.current.wind,
      uv: active.current.uv,
      rainChance: active.current.rainChance,
      todayRainMm: active.current.precipitation,
      condition: getSkyStyle(active.current.rainChance, active.current.temp, active.current.wind, new Date().getHours()).label,
      cityName: active.cityName,
    });
  }, [active]);

  // Raise a Risk Alert automatically for the farm's own location when
  // conditions are severe, so weather risk shows up in Alerts too — not
  // just on this page. Guarded so it only fires once per day per condition.
  useEffect(() => {
    if (!active?.current || !activeFarm) return;
    const isFarmLocation = locations[0]?.id === activeId || active.cityName === activeFarm.location?.address;
    if (!isFarmLocation) return;

    const { rainChance, wind, temp } = active.current;
    let severity = null, title = "", message = "";
    if (rainChance >= 80) {
      severity = "warning";
      title = "Heavy rain expected";
      message = `${rainChance}% chance of rain today near ${active.cityName}. Consider delaying spraying/irrigation and check drainage.`;
    } else if (wind >= 35) {
      severity = "warning";
      title = "High wind advisory";
      message = `Winds around ${wind} km/h expected near ${active.cityName}. Avoid spraying and secure loose structures/equipment.`;
    } else if (temp >= 42) {
      severity = "critical";
      title = "Extreme heat warning";
      message = `Temperature near ${temp}°C expected at ${active.cityName}. Increase irrigation frequency and protect young/sensitive crops.`;
    }
    if (!severity) return;

    const alreadyRaised = alerts?.some(
      (a) => a.category === "weather" && a.status === "active" && a.title === title &&
        new Date(a.createdAt).toDateString() === new Date().toDateString()
    );
    if (alreadyRaised) return;

    postScoped("/alerts", {
      category: "weather",
      severity,
      riskScorePct: severity === "critical" ? 85 : 60,
      title,
      message,
    }).then(() => fetchDashboardData?.());
  }, [active, activeFarm]);
  const sky = active ? getSkyStyle(active.current.rainChance, active.current.temp, active.current.wind, hour) : getSkyStyle(20, 28, 10, hour);
  const activeMeta = locationMeta[activeId];

  const windDirLabel = (deg) => {
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    return dirs[Math.round(deg / 45) % 8];
  };

  const uvLabel = (uv) => {
    if (uv <= 2) return "Low";
    if (uv <= 5) return "Moderate";
    if (uv <= 7) return "High";
    if (uv <= 10) return "Very High";
    return "Extreme";
  };

  return (
    <div>
      <PageHeader
        title="Weather & Advisory"
        subtitle={active ? `${active.cityName} · ${sky.label}` : "Loading conditions..."}
        action={
          <div className="flex items-center gap-2">
            {activeMeta && (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                activeMeta.source === "live"
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeMeta.source === "live" ? "bg-primary" : "bg-muted-foreground/50"}`} />
                {activeMeta.source === "live" ? "Live" : `${activeMeta.ageMinutes ?? "?"} min ago`}
              </span>
            )}
            <button
              onClick={() => navigate({ to: "/ai-saathi?prompt=%40weather" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask AI Mitra
            </button>
          </div>
        }
      />

      {/* Search + saved locations, in a normal glass card like every other page */}
      <section className="glass relative mb-5 rounded-2xl p-4">
        <div className="relative flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 ring-1 ring-border focus-within:ring-primary/40">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search city to add..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {showSearch && searchResults.length > 0 && (
            <div className="glass absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl shadow-2xl">
              {searchResults.map(item => {
                const addr = item.address || {};
                const name = addr.city || addr.town || addr.village || addr.county || item.display_name.split(",")[0];
                const state = addr.state || addr.country || "";
                return (
                  <button
                    key={item.place_id}
                    onClick={() => addLocation(item)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-secondary/60 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{name}</div>
                      {state && <div className="text-[11px] text-muted-foreground">{state}</div>}
                    </div>
                    <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
          {locations.map(loc => {
            const d = locationData[loc.id];
            const rainChance = d?.current?.rainChance ?? 0;
            const condition = d ? getSkyStyle(rainChance, d.current.temp, d.current.wind, hour).label : "Loading...";
            return (
              <LocationCard
                key={loc.id}
                name={d?.cityName || loc.query.split(",")[0]}
                temp={d?.current?.temp ?? "—"}
                condition={condition}
                rain={rainChance}
                active={activeId === loc.id}
                onClick={() => setActiveId(loc.id)}
                onRemove={locations.length > 1 ? () => removeLocation(loc.id) : null}
              />
            );
          })}
        </div>
      </section>

      {!active ? (
        <div className="space-y-4">
          {/* Skeleton hero */}
          <div className="glass h-44 animate-pulse rounded-2xl" />
          <div className="glass h-24 animate-pulse rounded-2xl" />
          <div className="glass h-28 animate-pulse rounded-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left Column (Hero, Advisories, Hourly, Details) */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {/* Hero */}
            <section
              className="relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-lg ring-1 ring-border transition-all duration-1000"
              style={{ background: sky.bg }}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-16 -top-10 h-56 w-[420px] rounded-full opacity-25 blur-3xl" style={{ background: "rgba(255,255,255,0.5)" }} />
                <div className="absolute bottom-0 left-0 right-0 h-32 opacity-10 blur-3xl" style={{ background: "rgba(0,0,0,0.6)" }} />
              </div>
              
              {/* Top row of Hero */}
              <div className="relative flex items-start justify-between">
                <div className="text-white">
                  <div className="flex items-center gap-1.5 text-lg font-semibold">
                    <MapPin className="h-5 w-5" />
                    {active.cityName}
                  </div>
                  <div className="mt-1.5 text-sm text-white/80">
                    {sky.label} • Feels like {active.current.feelsLike}°
                  </div>
                </div>
                <div className="text-right text-white">
                  <div className="font-display text-6xl font-bold leading-none">{active.current.temp}°</div>
                  <div className="mt-2 text-sm text-white/80">
                    H:{active.daily[0]?.hi}° • L:{active.daily[0]?.lo}°
                  </div>
                </div>
              </div>

              {/* Bottom row of Hero (Inset card) */}
              <div className="relative mt-auto">
                <div className="inline-flex max-w-sm items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3.5 text-white backdrop-blur-md">
                  <WeatherIcon rainChance={active.current.rainChance} size={8} className="text-white" />
                  <div>
                    <div className="font-semibold">{sky.label}</div>
                    <div className="mt-0.5 text-xs text-white/80">
                      {active.current.rainChance > 30 ? "Expect showers or rain soon." : "Clear conditions expected."}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Advisories - side by side */}
            <div className="grid gap-5 sm:grid-cols-2">
              {buildAdvisory(active.current, activeFarm?.waterLevel).slice(0, 2).map((item, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 ${
                    item.tone === "warning"
                      ? "border-warning/20 bg-warning/10 text-warning"
                      : item.tone === "good"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-foreground"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <Droplets className="h-4 w-4" /> 
                    {item.title}
                  </div>
                  <div className={`text-xs leading-relaxed ${item.tone === "warning" ? "text-warning/80" : item.tone === "good" ? "text-primary/80" : "text-muted-foreground"}`}>
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>

            {/* Hourly forecast */}
            <div className="glass rounded-2xl p-5">
              <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> TODAY'S FARM ADVISORY & HOURLY
              </div>
              <div className="flex gap-5 overflow-x-auto pb-2">
                {active.hourly.map((h, i) => (
                  <div key={i} className="flex min-w-[50px] shrink-0 flex-col items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">{h.label}</span>
                    <WeatherIcon rainChance={h.rain} size={5} className={h.rain > 50 ? "text-cyan" : "text-warning"} />
                    <span className="text-sm font-bold">{h.temp}°</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail Cards Grid */}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {/* UV Index */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Sun className="h-3 w-3" /> UV Index
                </div>
                <div className="font-display text-3xl font-bold">{active.current.uv}</div>
                <div className="mt-1 text-sm font-medium text-foreground/80">{uvLabel(active.current.uv)}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full"
                  style={{ background: "linear-gradient(to right, #22c55e, #eab308, #ef4444, #7c3aed)" }}>
                  <div className="h-full w-2 rounded-full bg-white shadow"
                    style={{ marginLeft: `${Math.min((active.current.uv / 11) * 100, 95)}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {active.current.uv <= 2 ? "No protection needed" : `Use sun protection ${active.current.sunrise}–${active.current.sunset}`}
                </div>
              </div>

              {/* Sunset */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Sun className="h-3 w-3" /> Sunset
                </div>
                <div className="text-2xl font-bold">{active.current.sunset}</div>
                <div className="mt-1 text-sm text-muted-foreground">Sunrise: {active.current.sunrise}</div>
                <div className="relative mt-4 h-12 overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
                  <svg viewBox="0 0 100 40" className="absolute bottom-0 w-full" fill="none">
                    <path d="M5 38 Q25 8, 50 8 Q75 8, 95 38" stroke="var(--color-cyan)" strokeOpacity="0.4" strokeWidth="1.5" />
                    <circle cx="50" cy="8" r="3" fill="var(--color-warning, #f59e0b)" />
                  </svg>
                </div>
              </div>

              {/* Wind */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Wind className="h-3 w-3" /> Wind
                </div>
                <div className="flex items-end gap-2">
                  <div className="font-display text-3xl font-bold">{active.current.wind}</div>
                  <div className="mb-1 text-sm text-muted-foreground">km/h</div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 flex items-center justify-center rounded-full border border-border">
                      {["N","E","S","W"].map((d, i) => (
                        <span key={d} className="absolute text-[9px] text-muted-foreground"
                          style={{ top: i===0?"2px":i===2?"auto":"50%", bottom: i===2?"2px":"auto",
                            left: i===3?"2px":i===1?"auto":"50%", right: i===1?"2px":"auto",
                            transform: i===0||i===2?"translateX(-50%)":"translateY(-50%)" }}>
                          {d}
                        </span>
                      ))}
                      <Navigation className="h-5 w-5 text-cyan"
                        style={{ transform: `rotate(${active.current.windDir}deg)` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{windDirLabel(active.current.windDir)}</div>
                    <div className="text-[11px] text-muted-foreground">Direction</div>
                  </div>
                </div>
              </div>

              {/* Precipitation */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <CloudRain className="h-3 w-3" /> Precipitation
                </div>
                <div className="flex items-end gap-2">
                  <div className="font-display text-3xl font-bold">{active.current.precipitation}</div>
                  <div className="mb-1 text-sm text-muted-foreground">mm</div>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">Today</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {active.current.rainChance}% chance of rain
                </div>
              </div>

              {/* Feels Like */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Thermometer className="h-3 w-3" /> Feels Like
                </div>
                <div className="font-display text-3xl font-bold">{active.current.feelsLike}°</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {Math.abs(active.current.feelsLike - active.current.temp) < 2
                    ? "Similar to the actual temperature."
                    : active.current.feelsLike < active.current.temp
                      ? `Feels cooler due to wind (${active.current.wind} km/h).`
                      : `Feels warmer due to humidity (${active.current.humidity}%).`}
                </div>
              </div>

              {/* Humidity */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Droplets className="h-3 w-3" /> Humidity
                </div>
                <div className="font-display text-3xl font-bold">{active.current.humidity}%</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/60">
                  <div className="h-full rounded-full bg-cyan" style={{ width: `${active.current.humidity}%` }} />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {active.current.humidity > 80
                    ? "High — fungal risk for crops."
                    : active.current.humidity > 60
                      ? "The dew point is comfortable."
                      : "Low — consider irrigation."}
                </div>
              </div>

              {/* Visibility */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Eye className="h-3 w-3" /> Visibility
                </div>
                <div className="flex items-end gap-2">
                  <div className="font-display text-3xl font-bold">{active.current.visibility}</div>
                  <div className="mb-1 text-sm text-muted-foreground">km</div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {active.current.visibility >= 10 ? "Perfectly clear view." : "Reduced visibility."}
                </div>
              </div>

              {/* Pressure */}
              <div className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Gauge className="h-3 w-3" /> Pressure
                </div>
                <div className="flex items-end gap-2">
                  <div className="font-display text-3xl font-bold">{active.current.pressure}</div>
                  <div className="mb-1 text-sm text-muted-foreground">hPa</div>
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>Low</span><span>High</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                  <div className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(((active.current.pressure - 980) / 50) * 100, 100)}%` }} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Weather for {active.cityName} · Open-Meteo ·{" "}
              {activeMeta?.source === "live"
                ? "Live ✓"
                : activeMeta?.ageMinutes != null
                ? `Cached ${activeMeta.ageMinutes} min ago`
                : "Open-Meteo"}
            </div>
          </div>

          {/* Right Column (10-Day Forecast) */}
          <div className="flex flex-col gap-5 lg:col-span-1">
            <div className="glass flex h-full flex-col rounded-2xl p-6">
              <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> 10-DAY FORECAST
              </div>
              <div className="flex flex-1 flex-col justify-between space-y-4">
                {active.daily.map((d, i) => {
                  const allHi = active.daily.map(x => x.hi);
                  const allLo = active.daily.map(x => x.lo);
                  const minAll = Math.min(...allLo);
                  const maxAll = Math.max(...allHi);
                  const range = maxAll - minAll || 1;
                  const barStart = ((d.lo - minAll) / range) * 100;
                  const barWidth = ((d.hi - d.lo) / range) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-10 text-sm font-medium">{d.day}</span>
                      <WeatherIcon rainChance={d.rain} size={4} className={d.rain > 50 ? "text-cyan" : "text-warning"} />
                      {d.rain > 20 && (
                        <span className="w-8 text-[11px] text-cyan">{d.rain}%</span>
                      )}
                      {d.rain <= 20 && <span className="w-8" />}
                      <span className="w-8 text-right text-sm text-muted-foreground">{d.lo}°</span>
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-warning to-destructive"
                          style={{ marginLeft: `${barStart}%`, width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="w-8 text-sm font-semibold">{d.hi}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
