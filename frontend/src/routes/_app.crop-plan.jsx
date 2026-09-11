import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, CheckCircle2, Flag, Sparkles, Sprout, Droplets, FlaskConical, AlertTriangle, Eye } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { PageHeader } from "@/components/app/AppShell";
import { FarmSwitcher } from "@/components/app/FarmSwitcher";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { subscribeAiSyncRefresh } from "@/lib/aiSyncEvents";

import { CurrentStageCard } from "@/components/crop-plan/CurrentStageCard";
import { PlanSummaryCard } from "@/components/crop-plan/PlanSummaryCard";
import { VerticalTimeline } from "@/components/crop-plan/VerticalTimeline";


const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");

export const Route = createFileRoute("/_app/crop-plan")({
  validateSearch: (search) => ({
    crop: search.crop || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Crop Plan — KrishiMitra" },
      {
        name: "description",
        content: "Your soybean crop roadmap: growth stages, timeline, key tasks and milestones.",
      },
    ],
  }),
  component: CropPlanPage,
});

// No demo/placeholder data — new users start with a clean empty state.

// Stage-to-major-activities mapping for display
const STAGE_ACTIVITIES = {
  "Land Preparation":          ["Deep Ploughing", "FYM Application", "Levelling", "Soil Testing"],
  "Pit Preparation":           ["Pit Digging", "Compost Filling", "Drainage Layout"],
  "Sowing":                    ["Seed Treatment", "Sowing", "First Irrigation", "Gap Filling"],
  "Sett Planting":             ["Sett Preparation", "Furrow Planting", "First Irrigation"],
  "Rhizome Planting":          ["Rhizome Treatment", "Bed Planting", "Mulching"],
  "Nursery":                   ["Nursery Bed Prep", "Seed Sowing", "Damping-off Watch", "Irrigation"],
  "Germination":               ["Germination Count", "Gap Filling", "Light Irrigation", "Weed Removal"],
  "Planting":                  ["Transplanting", "First Irrigation", "Mulching", "Gap Filling"],
  "Transplanting":             ["Evening Transplanting", "First Irrigation", "Staking", "Gap Filling"],
  "Crop Establishment":        ["Gap Filling", "Irrigation", "Thrips Scouting", "Weed Control"],
  "Seedling Growth":           ["Thinning", "Weed Removal", "First Irrigation", "Growth Check"],
  "Seedling Stage":            ["Thinning", "Earthing-Up", "Weed Scout", "N Top-Dress"],
  "Seedling Establishment":    ["Gap Filling", "Thinning", "Weed Control", "First Irrigation"],
  "Vegetative Growth":         ["Irrigation", "N Top-Dressing", "Weed Control", "Pest Scouting"],
  "Active Vegetative Growth":  ["Desuckering", "Fertilizer Dose", "Disease Scout", "Irrigation"],
  "Early Vegetative Growth":   ["Desuckering", "Mulch Refresh", "Sigatoka Scouting", "Irrigation"],
  "Tillering":                 ["Irrigation (CRI)", "N Top-Dress", "Weed Control", "Tiller Count"],
  "Sprouting":                 ["Mulching", "Irrigation", "Earthing-Up", "Sprout Count"],
  "Branching":                 ["Irrigation", "Pod Borer Scout", "Weed Control", "Growth Check"],
  "Jointing":                  ["Irrigation", "Rust Monitoring", "N Application", "Lodging Check"],
  "Squaring":                  ["Square Count", "Bollworm Monitoring", "Fertilizer", "Whitefly Scout"],
  "Flowering":                 ["Flower Monitoring", "Irrigation", "Micronutrient Spray", "Pest Scout"],
  "Shooting / Flowering":      ["Shoot Monitoring", "Male Bud Removal", "Bunch Sleeving", "K Dose"],
  "Umbel Formation":           ["Irrigation", "Aphid Scout", "Weed Control", "Canopy Check"],
  "Tasseling / Silking":       ["Irrigation", "Fall Armyworm Scout", "Topdress", "Silking Watch"],
  "Button Stage (Bud)":        ["Irrigation", "Bud Count", "Bird Protection", "Fertilizer"],
  "Pod Filling":               ["Irrigation", "Pod Borer Scout", "K Dose", "Crop Check"],
  "Pod Development":           ["Pod Count", "Irrigation", "Pest Scout", "K Top-Dress"],
  "Pod (Siliqua) Development": ["Siliqua Count", "Aphid Scout", "Irrigation", "Crop Check"],
  "Bunch Development":         ["Bunch Fill Check", "Leaf Pruning", "K Dose", "Irrigation"],
  "Boll Development":          ["Boll Count", "K Spray", "Pink Bollworm Scout", "Irrigation"],
  "Boll Opening":              ["Boll Opening Count", "First Picking", "Contamination Check"],
  "Grain Filling":             ["Irrigation", "Bird Protection", "Pest Scout", "Grain Check"],
  "Primary Spike Initiation":  ["Raceme Count", "Capsule Borer Scout", "Semi-Looper Check"],
  "Primary Spike Flowering":   ["Spray", "Capsule Count", "Irrigation", "Pest Scout"],
  "Secondary Spike Development":["Irrigation", "Weeding", "Pest Scout", "Spray"],
  "Capsule Maturation":        ["Maturity Check", "Staggered Harvest", "Capsule Count"],
  "Rhizome Initiation":        ["Stop N", "K Application", "Rhizome Rot Check", "Reduce Irrigation"],
  "Rhizome Maturation":        ["Leaf Yellowing Check", "Stop Irrigation", "Harvest Prep"],
  "Bulb Initiation":           ["Stop N Fertilizer", "Reduce Irrigation", "Purple Blotch Scout"],
  "Bulb Development":          ["Neck Fall Check", "Drainage Inspection", "Final Irrigation"],
  "Maturity":                  ["Grain Hardness Test", "Stop Irrigation", "Harvest Prep"],
  "Maturation":                ["Pod Colour Check", "Stop Irrigation", "Yield Forecast"],
  "Maturation / Ripening":     ["Brix Reading", "Irrigation Cutoff", "Harvest Scheduling"],
  "Maturity / Drying":         ["Grain Moisture Check", "Harvest Timing", "Equipment Prep"],
  "Ripening":                  ["Brix Check", "Field Drainage", "Mill Booking"],
  "Grand Growth":              ["Irrigation", "Trash Mulching", "Red Rot Scout", "Propping"],
  "Seed Formation":            ["Irrigation", "Pest Scout", "Canopy Check"],
  "Seed Maturation":           ["Moisture Check", "Pre-Harvest Check", "Equipment Prep"],
  "Seed Development":          ["Bird Protection", "Irrigation", "Blight Scout"],
  "Fruiting":                  ["Fruit Borer Scout", "K Spray", "Irrigation", "Blight Check"],
  "Multiple Pickings":         ["Red-Green Picking", "K Spray", "Pest Scout"],
  "First Harvest":             ["Maturity Check", "Picking at 80% Colour", "Post-Harvest"],
  "Pegging":                   ["Gypsum Application", "Earthing-Up", "Leaf Spot Spray"],
  "Tuber Initiation":          ["Irrigation", "Blight Scout", "Earthing-Up"],
  "Tuber Bulking":             ["Irrigation", "K Dose", "Blight Control"],
  "Sprouting":                 ["Mulch Check", "Irrigation", "Earthing-Up"],
  "Panicle Initiation":        ["Blast Scout", "N Panicle Dose", "Irrigation"],
  "Heading":                   ["Aphid Scout", "Irrigation", "Ear Emergence Check"],
  "Heading / Ear Emergence":   ["Rust Scout", "Irrigation", "N Top-Dress"],
  "Heading / Flowering":       ["Blast Check", "BPH Scout", "Irrigation"],
  "Tillering":                 ["Irrigation", "N Top-Dress", "Tiller Count", "Weed Control"],
  "Harvest":                   ["Harvest Operation", "Threshing", "Drying", "Storage", "Yield Recording"],
  "Germination":               ["Germination Count", "Gap Filling", "Irrigation", "Weed Removal"],
  "Pit Preparation":           ["Pit Digging", "Compost Filling", "Drainage Layout"],
};

function getStageActivities(stageName, majorTasks) {
  // Use pre-defined activities map if available
  const mapped = STAGE_ACTIVITIES[stageName];
  if (mapped && mapped.length > 0) return mapped.slice(0, 4);
  // Fall back to actual task titles from DB (strip crop name suffix)
  if (majorTasks && majorTasks.length > 0) {
    return majorTasks.map(t => t.split(" — ")[0].replace(/ begins$/, "").trim()).filter(Boolean).slice(0, 4);
  }
  return ["Field Monitoring", "Irrigation", "Crop Check"];
}

function CropPlanPage() {
  const search = Route.useSearch();
  const { activeFarmId, activeFarm, token, fetchScoped } = useAppData();
  const [cropPlans, setCropPlans] = useState([]);
  const [planTasks, setPlanTasks] = useState([]);
  const navigate = useNavigate();
  const [stageTips, setStageTips] = useState(null);
  const [stageTipsLoading, setStageTipsLoading] = useState(false);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewPlan, setPreviewPlan] = useState(null);
  const [aiForm, setAiForm] = useState({ cropName: "", companionCrop: "" });
  const [supportedCrops, setSupportedCrops] = useState([]);
  const [companionSuggestions, setCompanionSuggestions] = useState([]);
  const [isMidwayModalOpen, setIsMidwayModalOpen] = useState(false);
  const [midwayPercent, setMidwayPercent] = useState(50);
  const [isStartingMidway, setIsStartingMidway] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const availableArea = useMemo(() => {
    if (!activeFarm) return 0;
    const activePlans = cropPlans.filter(p => p.status === "active");
    const usedArea = activePlans.reduce((sum, p) => sum + (p.areaAcres || 0), 0);
    return Math.max(0, activeFarm.areaAcres - usedArea);
  }, [activeFarm, cropPlans]);

  const [advancedPredictions, setAdvancedPredictions] = useState(null);

  const activePlan = cropPlans.find(p => p._id === selectedPlanId) || cropPlans[0] || null;

  useEffect(() => {
    const fetchPredictions = async () => {
      if (!activePlan || !token) return;
      try {
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
        const planSeason = activePlan.season
          ? (activePlan.season.charAt(0).toUpperCase() + activePlan.season.slice(1).toLowerCase())
          : "Kharif";
        const farmState = activeFarm?.location?.state || "Gujarat";

        const basePayload = { 
          Crop: activePlan.cropName || "Cotton", 
          Crop_Type: activePlan.cropName || "Cotton",
          Area: activePlan.areaAcres || 1.0,
          Field_Area_hectare: activePlan.areaAcres ? activePlan.areaAcres * 0.404 : 1.0,
          Season: planSeason,
          State: farmState,
        };

        const [yieldRes, fertRes, irrigRes] = await Promise.all([
          fetch(`${API_URL}/predict_yield`, { method: "POST", headers, body: JSON.stringify(basePayload) }),
          fetch(`${API_URL}/recommend_fertilizer`, { method: "POST", headers, body: JSON.stringify(basePayload) }),
          fetch(`${API_URL}/predict_irrigation`, { method: "POST", headers, body: JSON.stringify(basePayload) })
        ]);

        const [yieldData, fertData, irrigData] = await Promise.all([
          yieldRes.ok ? yieldRes.json() : {},
          fertRes.ok ? fertRes.json() : {},
          irrigRes.ok ? irrigRes.json() : {}
        ]);

        setAdvancedPredictions({
          yield: yieldData.predicted_yield,
          fertilizer: fertData.recommended_fertilizer,
          irrigation: irrigData.irrigation_need
        });
      } catch (err) {
        console.error("Failed to fetch advanced predictions", err);
      }
    };
    fetchPredictions();
  }, [activePlan, token]);

  useEffect(() => {
    if (search.crop) {
      setAiForm(prev => ({ ...prev, cropName: search.crop, areaAcres: availableArea }));
      setIsAiModalOpen(true);
    }
  }, [search.crop, availableArea]);

  useEffect(() => {
    fetch(`${API_URL}/crop-plans/supported-crops`)
      .then(r => r.json())
      .then(data => setSupportedCrops(Array.isArray(data) ? data : []))
      .catch(err => console.error("Failed to load supported crops:", err));
  }, []);

  useEffect(() => {
    if (aiForm.cropName) {
      fetch(`${API_URL}/crop-plans/companion-suggestions?crop=${encodeURIComponent(aiForm.cropName)}`)
        .then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(data => setCompanionSuggestions(Array.isArray(data) ? data : []))
        .catch(err => {
          console.error("Failed to load companion suggestions:", err);
          setCompanionSuggestions([]);
        });
    } else {
      setCompanionSuggestions([]);
    }
  }, [aiForm.cropName]);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (aiForm.areaAcres <= 0 || aiForm.areaAcres > availableArea) {
      toast.error(`Invalid area. You have ${availableArea} acres available.`);
      return;
    }

    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    let computedSeason = "Zaid";
    if (month >= 5 && month <= 9) computedSeason = "Kharif";
    else if (month >= 10 || month <= 2) computedSeason = "Rabi";
    computedSeason = `${computedSeason} ${year}`;
    
    const area = aiForm.areaAcres;
    const irrigation = activeFarm?.waterResources?.length > 0 ? activeFarm.waterResources.join(', ') : "Rainfed";
    
    let prompt = `@cropPlan Generate a crop plan. Crop: ${aiForm.cropName}`;
    if (aiForm.companionCrop) {
      prompt = `@cropPlan Generate an intercropping plan for Primary Crop: ${aiForm.cropName} and Companion Crop: ${aiForm.companionCrop}. Generate integrated milestones and tasks for both crops growing simultaneously.`;
    }
    prompt += `, Season: ${computedSeason}, Area: ${area} acres, Irrigation: ${irrigation}.`;
    
    setIsGenerating(true);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: prompt,
          sessionId: `s-${Date.now()}`,
          farmId: activeFarmId,
          forceJson: true
        }),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      
      const data = await res.json();
      if (data && data.result) {
        setPreviewPlan(data.result);
        setIsAiModalOpen(false);
      } else {
        toast.error("AI failed to output a valid plan format.");
      }
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePreview = async (replace = true) => {
    if (!activeFarmId) {
      toast.error("No farm selected. Please select a farm before saving.");
      return;
    }
    if (!previewPlan) {
      toast.error("No plan to save. Please generate a plan first.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/chat/sync-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ syncData: previewPlan, farmId: activeFarmId, replace })
      });
      
      if (!res.ok) {
        // Read the actual error body from the server to surface the real reason
        let errMsg = `Server error ${res.status}`;
        try {
          const errBody = await res.json();
          errMsg = errBody.message || errBody.error || errMsg;
        } catch (_) { /* ignore JSON parse failure */ }
        throw new Error(errMsg);
      }
      
      const data = await res.json();
      
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach(w => toast.warning(w));
      }
      
      toast.success("Crop Plan saved successfully!");
      
      setPreviewPlan(null);
      fetchCropPlans();
      subscribeAiSyncRefresh("cropPlan");
    } catch (err) {
      console.error("[CropPlan] Save failed:", err);
      toast.error(err.message || "Failed to save plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchCropPlans = useCallback(async () => {
    if (!activeFarmId || !token) return;
    try {
      const data = await fetchScoped("/crop-plans");
      const plans = Array.isArray(data) ? data : [];
      setCropPlans(plans);
      
      // If we don't have a selection, or our selection no longer exists (e.g. dropped), pick the first
      setSelectedPlanId(currentId => {
        if (!currentId || !plans.find(p => p._id === currentId)) {
          return plans.length > 0 ? plans[0]._id : null;
        }
        return currentId;
      });
    } catch (err) {
      console.error(err);
    }
  }, [activeFarmId, token, fetchScoped]);

  useEffect(() => {
    fetchCropPlans();
  }, [fetchCropPlans]);

  const handleStartMidway = async () => {
    if (!activePlan?._id || !token) return;
    setIsStartingMidway(true);
    try {
      const res = await fetch(`${API_URL}/crop-plans/${activePlan._id}/start-daily-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ startPercent: midwayPercent }),
      });
      if (!res.ok) throw new Error("Failed to start daily schedule");
      const data = await res.json();
      toast.success(`Daily tasks now start at day ${data.startDay} of ${data.durationDays} — ${data.tasksGenerated} tasks generated.`);
      setIsMidwayModalOpen(false);
      fetchCropPlans();
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsStartingMidway(false);
    }
  };

  // Drop the current crop plan (and its daily tasks) so the farmer can start
  // growing something new without the old plan's tasks lingering in the
  // Schedule page alongside the new ones.
  const handleDropPlan = async () => {
    if (!activePlan?._id || !token) return;
    const confirmed = window.confirm(
      `Drop the current ${activePlan.cropName} plan and all its daily tasks? This can't be undone. You can then generate a plan for a new crop.`
    );
    if (!confirmed) return;
    setIsDropping(true);
    try {
      const res = await fetch(`${API_URL}/crop-plans/${activePlan._id}/drop`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to drop plan");
      const data = await res.json();
      toast.success(`Dropped ${activePlan.cropName} plan${data.tasksRemoved ? ` and ${data.tasksRemoved} tasks` : ""}.`);
      await fetchCropPlans();
      setIsAiModalOpen(true);
    } catch (err) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsDropping(false);
    }
  };

  useEffect(() => {
    if (activePlan?.tasks) {
      setPlanTasks(Array.isArray(activePlan.tasks) ? activePlan.tasks : []);
    } else {
      setPlanTasks([]);
    }
  }, [activePlan]);

  useEffect(() => {
    const unsubscribe = subscribeAiSyncRefresh(() => {
      fetchCropPlans();
    });
    return unsubscribe;
  }, [fetchCropPlans]);

  const cropStages = useMemo(() => {
    if (!activePlan?.milestones?.length) return [];

    const sortedMilestones = [...activePlan.milestones].sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate));
    const harvestDate = activePlan.expectedHarvestDate ? new Date(activePlan.expectedHarvestDate) : null;
    const oneDay = 24 * 60 * 60 * 1000;
    // FIX: truncate to midnight so a stage's *last calendar day* still counts
    // as "active" instead of tipping into "done"/"upcoming" depending on what
    // time of day it is right now (comparing a date-only boundary against a
    // full timestamp was why "current stage" sometimes failed to show at all).
    const toDayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const today = toDayStart(new Date());
    const fmt = (date) => !isNaN(date) ? date.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—";
    const dayDiff = (a, b) => Math.max(0, Math.round((toDayStart(b) - toDayStart(a)) / oneDay)) || 0;

    return sortedMilestones.map((m, i) => {
      const start = toDayStart(m.plannedDate);
      const nextStart = sortedMilestones[i + 1]?.plannedDate ? toDayStart(sortedMilestones[i + 1].plannedDate) : null;
      const end = nextStart ? new Date(nextStart.getTime() - oneDay) : (harvestDate ? toDayStart(harvestDate) : start);
      const stageTasks = planTasks.filter((task) => {
        const taskDate = toDayStart(task.date);
        return taskDate >= start && taskDate <= end;
      });
      const stageTasksDone = stageTasks.filter((task) => task.status === "done").length;
      const majorTasks = stageTasks
        .filter((task) => task.priority === "high" || task.priority === "medium" || task.category !== "monitoring")
        .slice(0, 3)
        .map((task) => task.title);
      const fallbackMajorTasks = stageTasks.slice(0, 2).map((task) => task.title);
      // Stage status is date-driven (agronomic stages happen on a calendar,
      // not "whenever the farmer finishes ticking boxes"), but a milestone
      // explicitly marked "done" by the backend (e.g. past stages when a
      // plan is started mid-growth) always wins.
      const dateStatus = end < today ? "done" : start <= today && today <= end ? "active" : "upcoming";
      const status = m.status === "done" ? "done" : dateStatus;

      return {
        _id: m._id || `m${i}`,
        stage: m.stage,
        window: `${fmt(start)} - ${fmt(end)}`,
        gapDays: i === 0 ? 0 : dayDiff(sortedMilestones[i - 1].plannedDate, m.plannedDate),
        durationDays: Math.max(1, dayDiff(start, end) + 1),
        status,
        tasks: stageTasks.length,
        tasksDone: stageTasksDone,
        majorTasks: majorTasks.length ? majorTasks : fallbackMajorTasks,
      };
    });
  }, [activePlan, planTasks]);
  const cropName = activePlan ? `${activePlan.cropName}${activePlan.variety ? ` (${activePlan.variety})` : ""}` : "No active plan";
  const sowingDateObj = activePlan?.sowingDate ? new Date(activePlan.sowingDate) : null;
  const harvestDateObj = activePlan?.expectedHarvestDate ? new Date(activePlan.expectedHarvestDate) : null;
  const sowingDate = sowingDateObj && !isNaN(sowingDateObj) ? sowingDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const harvestDate = harvestDateObj && !isNaN(harvestDateObj) ? harvestDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const durationDays = sowingDateObj && harvestDateObj && !isNaN(sowingDateObj) && !isNaN(harvestDateObj)
    ? Math.max(1, Math.round((new Date(activePlan.expectedHarvestDate) - new Date(activePlan.sowingDate)) / (24 * 60 * 60 * 1000)))
    : 0;

  // Fetch RAG tips whenever the active stage changes
  const _activeCropName = activePlan?.cropName || "Soybean";
  const _activeStageForRag = cropStages?.find?.((s) => s.status === "active")?.stage || null;

  useEffect(() => {
    if (!_activeStageForRag) return;
    setStageTips(null);
    setStageTipsLoading(true);
    fetch(`${API_URL}/crop_stage_tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop: _activeCropName, stage: _activeStageForRag }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.found && d.tips) setStageTips(d.tips); })
      .catch(() => {})
      .finally(() => setStageTipsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_activeCropName, _activeStageForRag]);


  // ─── Progress calculation (CORRECT: elapsed days based) ──────────────────
  // Season progress = elapsed days / total crop duration
  const seasonProgress = useMemo(() => {
    if (!activePlan?.sowingDate || !durationDays) return 0;
    const today = new Date();
    const sowing = new Date(activePlan.sowingDate);
    const elapsed = Math.max(0, Math.round((today - sowing) / (1000 * 60 * 60 * 24)));
    return Math.min(100, Math.round((elapsed / durationDays) * 100));
  }, [activePlan?.sowingDate, durationDays]);

  // Stage progress = elapsed days within active stage / stage duration
  const stageProgress = useMemo(() => {
    if (!activePlan?.sowingDate || !activePlan?.milestones?.length) return 0;
    const today = new Date();
    const sowing = new Date(activePlan.sowingDate);
    const elapsed = Math.max(0, Math.round((today - sowing) / (1000 * 60 * 60 * 24)));
    const sortedMs = [...activePlan.milestones].sort((a, b) => new Date(a.plannedDate) - new Date(b.plannedDate));
    let activeMsIdx = 0;
    for (let i = 0; i < sortedMs.length; i++) {
      const msDay = Math.round((new Date(sortedMs[i].plannedDate) - sowing) / (1000 * 60 * 60 * 24));
      if (msDay <= elapsed) activeMsIdx = i;
      else break;
    }
    const nextMs = sortedMs[activeMsIdx + 1];
    const thisMs = sortedMs[activeMsIdx];
    const stageStartDay = Math.round((new Date(thisMs.plannedDate) - sowing) / (1000 * 60 * 60 * 24));
    const stageEndDay = nextMs ? Math.round((new Date(nextMs.plannedDate) - sowing) / (1000 * 60 * 60 * 24)) : durationDays;
    const stageDuration = Math.max(1, stageEndDay - stageStartDay);
    const daysIntoStage = Math.max(0, elapsed - stageStartDay);
    return Math.min(100, Math.round((daysIntoStage / stageDuration) * 100));
  }, [activePlan?.sowingDate, activePlan?.milestones, durationDays]);

  const done = cropStages.filter((s) => s.status === "done").length;
  const activeStage = cropStages.find((s) => s.status === "active");
  const currentDay = activePlan?.sowingDate
    ? Math.max(0, Math.round((new Date() - new Date(activePlan.sowingDate)) / (24 * 60 * 60 * 1000)))
    : 0;
  const planMilestones = cropStages.slice(0, 4).map((s, i) => ({
    label: s.stage,
    date: s.window.split(" - ")[0],
    tone: i === 0 ? "primary" : i === 1 ? "cyan" : "warning",
  }));

  // Guard: if no farm exists, show a prompt to create one first
  const { farms } = useAppData();
  if (!farms || farms.length === 0) {
    return (
      <div>
        <PageHeader title="Crop Plan" subtitle="Generate AI-powered crop schedules for your farm" />
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-5">
          <div className="rounded-full bg-primary/10 p-5">
            <Sprout className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Add a Farm First</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              A crop plan is tied to a specific farm. Please create your farm before generating a crop plan.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/farms" })}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] transition-transform hover:scale-[1.03]"
          >
            <Sprout className="h-4 w-4" /> Go to Farms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Crop Plan${activePlan ? ` — ${cropName}` : ""}`}
        subtitle={activePlan ? `Sown ${sowingDate} · Day ${currentDay} of ${durationDays}` : "Generate an AI-powered crop schedule for your farm"}
        action={
          <div className="flex items-center gap-2">
            <FarmSwitcher />

            {activePlan && (
              <button
                onClick={handleDropPlan}
                disabled={isDropping}
                className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                title="Drop this crop plan and its daily tasks, then grow a new crop instead."
              >
                {isDropping ? "Dropping..." : "Drop Plan & Grow New Crop"}
              </button>
            )}
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Generate Plan with AI
            </button>
          </div>
        }
      />

      {/* Plan Switcher Tabs - only show if there are multiple plans */}
      {cropPlans.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {cropPlans.map((plan) => {
            const isSelected = selectedPlanId === plan._id || (!selectedPlanId && activePlan?._id === plan._id);
            return (
              <button
                key={plan._id}
                onClick={() => setSelectedPlanId(plan._id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-secondary/60 text-foreground hover:bg-secondary"
                }`}
              >
                {plan.cropName} {plan.variety ? `(${plan.variety})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {isMidwayModalOpen && activePlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-foreground">
              <Flag className="h-5 w-5 text-primary" /> Start Daily Tasks From Here
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              If <span className="font-medium text-foreground">{activePlan.cropName}</span> is already partway through its growth, jump daily tasks to that point instead of starting from the sowing date. Past milestones are marked done automatically.
            </p>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Crop growth reached: <span className="font-semibold text-foreground">{midwayPercent}%</span>
            </label>
            <input
              type="range"
              min={5}
              max={95}
              step={5}
              value={midwayPercent}
              onChange={(e) => setMidwayPercent(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Just sown</span>
              <span>Half grown</span>
              <span>Near harvest</span>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setIsMidwayModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary/50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartMidway}
                disabled={isStartingMidway}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] disabled:opacity-60"
              >
                {isStartingMidway ? "Starting..." : "Start Daily Tasks"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Generate Crop Plan</h2>
            <form onSubmit={handleAiSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Crop Name</label>
                <select required value={aiForm.cropName} onChange={e => setAiForm({...aiForm, cropName: e.target.value, companionCrop: ""})} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="">Select a crop...</option>
                  {supportedCrops.map(crop => <option key={crop} value={crop}>{crop}</option>)}
                </select>
              </div>
              
              {aiForm.cropName && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Companion Crop / Intercropping (Optional)</label>
                  <select value={aiForm.companionCrop || ""} onChange={e => setAiForm({...aiForm, companionCrop: e.target.value})} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none">
                    <option value="">None (Single Crop)</option>
                    {companionSuggestions.map(crop => <option key={crop} value={crop}>{crop} (Recommended)</option>)}
                  </select>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Selecting a companion crop will generate a unified intercropping plan with mixed tasks.
                  </p>
                </div>
              )}
              <div className="rounded-lg bg-secondary/30 p-3 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2 mb-2">
                  <span className="text-muted-foreground">Farm Total Area</span>
                  <span className="font-medium">{activeFarm?.areaAcres || 1} acres</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2 mb-2">
                  <span className="text-muted-foreground">Available Area</span>
                  <span className="font-medium text-primary">{availableArea} acres</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Water Source</span>
                  <span className="font-medium">
                    {activeFarm?.waterResources?.length > 0 ? activeFarm.waterResources.join(", ") : "Rainfed"}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Area for this Crop (Acres)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  max={availableArea} 
                  required 
                  value={aiForm.areaAcres || ""} 
                  onChange={e => setAiForm({...aiForm, areaAcres: parseFloat(e.target.value)})} 
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" 
                />
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAiModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary" disabled={isGenerating}>Cancel</button>
                <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50" disabled={isGenerating}>
                  {isGenerating ? "Generating..." : "Generate Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-4">Preview AI Plan</h2>
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/30 p-3 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2 mb-2">
                  <span className="text-muted-foreground">Crop</span>
                  <span className="font-medium">{previewPlan.crop || previewPlan.cropPlan?.cropName || previewPlan.cropName}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2 mb-2">
                  <span className="text-muted-foreground">Season</span>
                  <span className="font-medium">{previewPlan.season || previewPlan.cropPlan?.season || previewPlan.season}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Generated Tasks</span>
                  <span className="font-medium">
                    {previewPlan.growth_stage_roadmap 
                      ? previewPlan.growth_stage_roadmap.reduce((acc, stage) => acc + (stage.daily_tasks?.length || stage.daily_tasks_count || 0), 0)
                      : (previewPlan.schedules?.length || previewPlan.tasks?.length || 0)}
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Sowing Date</label>
                <input 
                  type="date" 
                  min={new Date().toISOString().split("T")[0]}
                  value={(previewPlan.sowing_date || previewPlan.cropPlan?.sowingDate || previewPlan.sowingDate || "").split("T")[0]} 
                  onChange={e => {
                    const newSowingDateStr = e.target.value;
                    const oldSowingDateStr = (previewPlan.sowing_date || previewPlan.cropPlan?.sowingDate || previewPlan.sowingDate || "").split("T")[0];
                    if (!newSowingDateStr || !oldSowingDateStr) return;

                    const diffMs = new Date(newSowingDateStr) - new Date(oldSowingDateStr);
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                    
                    const shiftDate = (dateStr) => {
                      if (!dateStr) return dateStr;
                      const d = new Date(dateStr);
                      d.setDate(d.getDate() + diffDays);
                      return d.toISOString().split('T')[0];
                    };

                    let updatedPlan = JSON.parse(JSON.stringify(previewPlan));
                    
                    const shiftPlanContent = (planObj) => {
                      if (planObj.milestones) {
                        planObj.milestones.forEach(m => { m.plannedDate = shiftDate(m.plannedDate); });
                      }
                      if (planObj.expectedHarvestDate) {
                         planObj.expectedHarvestDate = shiftDate(planObj.expectedHarvestDate);
                      }
                      // Note: We don't have tasks directly in the plan object in preview, but if we did we'd shift them here
                    };

                    if (updatedPlan.sowing_date !== undefined) {
                      updatedPlan.sowing_date = newSowingDateStr;
                    } else if (updatedPlan.cropPlan) {
                      updatedPlan.cropPlan.sowingDate = newSowingDateStr;
                      shiftPlanContent(updatedPlan.cropPlan);
                    } else {
                      updatedPlan.sowingDate = newSowingDateStr;
                      shiftPlanContent(updatedPlan);
                    }

                    setPreviewPlan(updatedPlan);
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none" 
                />
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <button onClick={() => handleSavePreview(true)} disabled={isSaving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-60">
                  {isSaving ? "Saving..." : "Replace Current Plan"}
                </button>
                <button onClick={() => handleSavePreview(false)} disabled={isSaving} className="w-full rounded-lg border border-primary text-primary px-4 py-2.5 text-sm font-semibold hover:bg-primary/10 disabled:opacity-60">
                  {isSaving ? "Saving..." : "Keep Existing Plan (Add New)"}
                </button>
                <button type="button" onClick={() => setPreviewPlan(null)} disabled={isSaving} className="w-full rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-60">
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when farm exists but no crop plan yet */}
      {!activePlan && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-5">
          <div className="rounded-full bg-primary/10 p-5">
            <Sprout className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">No Crop Plan Yet</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Generate an AI-powered crop plan for <span className="font-semibold text-foreground">{activeFarm?.name || "your farm"}</span>. It will include a full growth-stage roadmap and daily task schedule.
            </p>
          </div>
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] transition-transform hover:scale-[1.03]"
          >
            <Sparkles className="h-4 w-4" /> Generate Plan with AI
          </button>
        </div>
      )}

      {/* Smart Dashboard Layout */}
      {activePlan && (
        <div className="space-y-6 mb-6">
          


          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <CurrentStageCard 
                activeStage={activeStage} 
                currentDay={currentDay} 
                durationDays={durationDays} 
                stageProgress={stageProgress} 
                harvestDate={harvestDate} 
              />
              <div className="glass mt-6 rounded-2xl p-6 shadow-sm">
                <h2 className="mb-6 font-display text-lg font-bold text-foreground">
                  Growth Stage Roadmap
                </h2>
                <VerticalTimeline 
                  cropStages={cropStages} 
                  stageTips={stageTips} 
                  stageTipsLoading={stageTipsLoading} 
                  stageProgress={stageProgress} 
                  getStageActivities={getStageActivities} 
                />
              </div>
            </div>
            
            <div className="xl:col-span-1 flex flex-col gap-6">
              <PlanSummaryCard
                activePlan={activePlan}
                durationDays={durationDays}
                harvestDate={harvestDate}
                farmName={activeFarm?.name}
                advancedPredictions={advancedPredictions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
