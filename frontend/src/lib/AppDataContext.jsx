import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";

const AppDataContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api") : "http://localhost:5001/api");

export function AppDataProvider({ children }) {
  const router = useRouter();
  const [token, setToken] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("krishimitra_token");
    return null;
  });
  
  const [userProfile, setUserProfile] = useState({ name: "Guest User", role: "farmer" });

  // --- Saved user location: city, state, district, lat, lon ---
  // This is the single source of truth that Weather and Market pages auto-fill from.
  const [userLocation, setUserLocationState] = useState(() => {
    try {
      const saved = localStorage.getItem("user_location");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const setUserLocation = (loc) => {
    setUserLocationState(loc);
    if (loc) localStorage.setItem("user_location", JSON.stringify(loc));
    else localStorage.removeItem("user_location");
  };

  // --- Multi-farm state ---
  const [farms, setFarms] = useState([]); // full list of the user's farms from the backend
  const [activeFarmId, setActiveFarmId] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("active_farm_id");
    return null;
  });

  const [weatherSnapshot, setWeatherSnapshot] = useState(null); // set by _app.weather.jsx when it fetches live data
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const logout = () => {
    setToken(null);
    setUserProfile({ name: "Guest User", role: "farmer" });
    setFarms([]);
    setActiveFarmId(null);

    localStorage.removeItem("active_farm_id");
    router.navigate({ to: "/auth" });
  };
  // Derived: the farm object currently selected. Falls back to the first farm
  // if nothing is selected yet (e.g. right after login).
  // Support both Django integer `id` and MongoDB `_id`
  const activeFarm = farms.find((f) => String(f._id) === String(activeFarmId) || String(f.id) === String(activeFarmId)) || farms[0] || null;

  // Persist the selection so it survives a refresh
  useEffect(() => {
    if (activeFarmId) localStorage.setItem("active_farm_id", activeFarmId);
  }, [activeFarmId]);

  // If farms load and nothing is selected yet (or the selected id no longer exists), default to the first farm
  useEffect(() => {
    if (farms.length > 0 && !farms.find((f) => String(f._id) === String(activeFarmId) || String(f.id) === String(activeFarmId))) {
      setActiveFarmId(farms[0]._id || String(farms[0].id));
    }
  }, [farms]);

  useEffect(() => {
    if (token) {
      localStorage.setItem("krishimitra_token", token);
      fetchDashboardData();
    } else {
      localStorage.removeItem("krishimitra_token");
      setIsLoading(false);
    }
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Me
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (meRes.status === 401) {
        logout();
        return;
      }
      const meData = await meRes.json();
      if (meData.user) {
        setUserProfile({
          name: `${meData.user.firstName} ${meData.user.lastName || ""}`.trim(),
          role: meData.user.role,
        });
        if (meData.user.location && typeof meData.user.location === "string") {
          setUserLocation({ address: meData.user.location, source: "profile" });
        } else if (meData.user.location && meData.user.location.address) {
          setUserLocation(meData.user.location);
        }
      }

      // 2. Fetch ALL farms — no more grabbing just farms[0]
      const farmsRes = await fetch(`${API_URL}/farms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const farmsData = await farmsRes.json();
      // Normalize: Django uses `id`, frontend uses `_id`. Support both.
      const normalizedFarms = (Array.isArray(farmsData) ? farmsData : []).map(f => ({
        ...f,
        _id: f._id || String(f.id),
        id: f.id || f._id,
      }));
      setFarms(normalizedFarms);


      // 4. Fetch Alerts and Notifications
      const [alRes, noRes] = await Promise.all([
        fetch(`${API_URL}/alerts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const [alData, noData] = await Promise.all([alRes.json(), noRes.json()]);
      setAlerts(Array.isArray(alData) ? alData : []);
      setNotifications(Array.isArray(noData) ? noData : []);

      setLoadError(null);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
      setLoadError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for farm-scoped GET requests, e.g.:
  //   const soilReports = await fetchScoped("/soil-reports")
  // automatically appends ?farm=<activeFarmId>
  const fetchScoped = useCallback(async (path) => {
    if (!activeFarmId) return [];
    const res = await fetch(`${API_URL}${path}?farm=${activeFarmId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      return [];
    }
    return res.json();
  }, [activeFarmId, token]);

  // Helper for farm-scoped POST requests — auto-injects `farm: activeFarmId`
  // so new records (crop plans, expenses) are always tagged
  // to whichever farm is currently selected.
  const postScoped = useCallback(async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...body, farm: activeFarmId }),
    });
    if (res.status === 401) {
      return { error: "Unauthorized" };
    }
    return res.json();
  }, [activeFarmId, token]);

  // Generic PATCH helper (not farm-scoped — used for updating a specific
  // record by id, e.g. marking a notification/alert read).
  const patchRecord = useCallback(async (path, body) => {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      return { error: "Unauthorized" };
    }
    return res.json();
  }, [token]);

  const login = (newToken) => {
    setToken(newToken);
  };

  return (
    <AppDataContext.Provider
      value={{
        userProfile,
        userLocation,
        setUserLocation,
        farms,
        activeFarm,
        activeFarmId,
        setActiveFarmId,

        weatherSnapshot,
        setWeatherSnapshot,
        alerts,
        setAlerts,
        notifications,
        setNotifications,
        token,
        login,
        logout,
        isLoading,
        loadError,
        fetchDashboardData,
        fetchScoped,
        postScoped,
        patchRecord,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
