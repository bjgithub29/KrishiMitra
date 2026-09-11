import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CloudSun, Crown, FlaskConical, Sparkles, Droplets,
  Loader2, RotateCcw, Leaf, Sprout,
} from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { useAppData } from "@/lib/AppDataContext";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { subscribeAiSyncRefresh } from "@/lib/aiSyncEvents";

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");

export const Route = createFileRoute("/_app/recommendations")({
  head: () => ({
    meta: [
      { title: "Crop Recommendations — KrishiMitra" },
      {
        name: "description",
        content:
          "Enter your soil data and get AI-powered crop recommendations ranked by suitability score.",
      },
    ],
  }),
  component: RecommendationsView,
});

const SOIL_TYPES = ["Black (Heavy)", "Red (Laterite)", "Sandy Loam", "Alluvial", "Clay", "Loamy", "Other"];
const SEASONS    = [{ value: "kharif", label: "Kharif (Jun–Oct)" }, { value: "rabi", label: "Rabi (Oct–Mar)" }];
const WATER_OPT  = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];

const DEFAULT_FORM = {
  ph: "", nitrogen: "", phosphorus: "", potassium: "",
  organicCarbon: "", ec: "",
  startPreparationDate: new Date().toISOString().split("T")[0],
};

// Farm.soilType is stored as a lowercase slug ("black", "alluvial", ...);
// the recommendations form uses the display label instead. Maps one to the
// other so the farm's saved soil type prefills correctly.
const FARM_SOIL_TYPE_TO_LABEL = {
  black: "Black (Heavy)",
  red: "Red (Laterite)",
  laterite: "Red (Laterite)",
  sandy: "Sandy Loam",
  alluvial: "Alluvial",
  clay: "Clay",
  loamy: "Loamy",
  other: "Other",
};

function SoilInput({ label, id, value, placeholder, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="rounded-xl border border-input bg-secondary/20 px-3 py-2.5 text-sm text-foreground/80">
        {value || <span className="text-muted-foreground/50">{placeholder}</span>}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function ScoreBar({ value, color = "bg-primary" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function RecommendationsView() {
  const { activeFarmId, activeFarm, postScoped, fetchScoped, token } = useAppData();
  const [results, setResults]     = useState(null);
  const [llmSummary, setLlmSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const loadSavedRecommendations = useCallback(async () => {
    if (!activeFarmId || !token) {
      setResults(null);
      return;
    }

    try {
      const data = await fetchScoped("/recommendations");
      const latest = Array.isArray(data) ? data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] : null;
      if (latest?.cropOptions?.length) {
        setResults(latest.cropOptions);
        setLlmSummary(latest.llmSummary || null);
      } else {
        setResults(null);
        setLlmSummary(null);
      }
    } catch (err) {
      console.error("Failed to load saved recommendations", err);
    }
  }, [activeFarmId, token, fetchScoped]);

  useEffect(() => {
    loadSavedRecommendations();
  }, [loadSavedRecommendations]);



  useEffect(() => {
    const unsubscribe = subscribeAiSyncRefresh(() => {
      loadSavedRecommendations();
    });
    return unsubscribe;
  }, [loadSavedRecommendations]);



  const primary = results?.find((r) => r.isTopPick) || results?.[0];
  const others  = results?.filter((r) => !r.isTopPick) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crop Recommendations"
        subtitle={`Below are the latest AI-generated crop recommendations saved for your active farm.`}
      />

      <div className="flex justify-between items-center px-2">
        <h2 className="font-display text-lg font-semibold text-primary">Farm Suitability Analysis</h2>
      </div>

      {/* Results */}
      {results && !isLoading && primary && (
        <>
          {/* Top pick hero */}
          {llmSummary && (
            <div className="glass rounded-3xl p-6 sm:p-8 bg-primary/5 border border-primary/20 mb-6">
              <div className="flex items-center gap-2 mb-3 text-primary">
                <Sparkles className="h-5 w-5" />
                <h3 className="font-semibold">AI Agronomist Summary</h3>
              </div>
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {llmSummary}
              </div>
            </div>
          )}
          <section className="glass-strong hero-ambient relative overflow-hidden rounded-3xl p-6 sm:p-8">
            <div className="grid-pattern pointer-events-none absolute inset-0" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
              <div>
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
                  <Crown className="h-3.5 w-3.5" /> Top Recommendation
                </div>
                <h2 className="mb-2 text-3xl font-bold tracking-tight">{primary.cropName}</h2>
                <p className="mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">{primary.reason}</p>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Overall Match</div>
                    <div className="text-3xl font-bold text-primary">
                      {primary.suitabilityScore}<span className="text-lg font-medium text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-border/50 hidden sm:block" />
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Expected Yield</div>
                    <div className="text-lg font-bold">{primary.expectedYieldKg.toLocaleString("en-IN")} kg</div>
                    <div className="text-[10px] text-muted-foreground">{activeFarm?.areaAcres || 1} acre(s)</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Est. Profit</div>
                    <div className="text-lg font-bold text-primary">₹{primary.expectedMarginRs.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Duration</div>
                    <div className="text-lg font-bold">{primary.durationDays} days</div>
                  </div>
                </div>

                {/* Machine Learning Insights (Fertilizer and Irrigation) */}
                {(primary.suggestedFertilizer || primary.irrigationPrediction) && (
                  <div className="mt-6 flex flex-wrap gap-4 pt-4 border-t border-border/40">
                    {primary.suggestedFertilizer && (
                      <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Sprout className="h-3 w-3"/> Suggested Fertilizer</div>
                        <div className={`text-sm font-semibold ${primary.suggestedFertilizer.includes('unavailable') || primary.suggestedFertilizer.startsWith('N/A') ? 'text-muted-foreground italic' : ''}`}>
                          {primary.suggestedFertilizer.includes('unavailable') || primary.suggestedFertilizer.startsWith('N/A') ? 'Unavailable' : primary.suggestedFertilizer}
                        </div>
                      </div>
                    )}
                    {primary.irrigationPrediction && (
                      <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1"><Droplets className="h-3 w-3"/> AI Irrigation Pattern</div>
                        <div className={`text-sm font-semibold ${primary.irrigationPrediction.includes('unavailable') || primary.irrigationPrediction.startsWith('N/A') ? 'text-muted-foreground italic' : ''}`}>
                          {primary.irrigationPrediction.includes('unavailable') || primary.irrigationPrediction.startsWith('N/A') ? 'Unavailable' : primary.irrigationPrediction}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Score bars */}
              <div className="glass flex flex-col gap-4 rounded-2xl bg-background/40 p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Factor Analysis</div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><FlaskConical className="h-3.5 w-3.5" />Soil Match</span>
                      <span className="font-semibold">{primary.soilMatchPct}%</span>
                    </div>
                    <ScoreBar value={primary.soilMatchPct} />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Droplets className="h-3.5 w-3.5" />Water / Climate</span>
                      <span className="font-semibold">{primary.weatherMatchPct}%</span>
                    </div>
                    <ScoreBar value={primary.weatherMatchPct} color="bg-cyan" />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-3.5 w-3.5" />Overall Match</span>
                      <span className="font-semibold">{primary.suitabilityScore}%</span>
                    </div>
                    <ScoreBar value={primary.suitabilityScore} color="bg-gradient-to-r from-primary to-cyan" />
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-border/50">
                  <Link 
                    to="/crop-plan" 
                    search={{ crop: primary.cropName }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20"
                  >
                    <Sprout className="h-4 w-4" />
                    Create Crop Plan for {primary.cropName}
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* Alternatives */}
          {others.length > 0 && (
            <>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Strong Alternatives</div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {others.map((crop) => (
                  <div key={crop.cropName} className="glass group relative overflow-hidden rounded-2xl p-5 transition-all hover:bg-card/60 hover:shadow-md">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <h3 className="font-bold">{crop.cropName}</h3>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          Confidence: <span className="font-semibold text-foreground">{crop.suitabilityScore}%</span>
                        </div>
                      </div>
                      <span className="rounded-lg bg-secondary/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {crop.durationDays}d
                      </span>
                    </div>

                    <div className="mb-3 space-y-2">
                      <div>
                        <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                          <span>Soil</span><span>{crop.soilMatchPct}%</span>
                        </div>
                        <ScoreBar value={crop.soilMatchPct} />
                      </div>
                      <div>
                        <div className="mb-0.5 flex justify-between text-[10px] text-muted-foreground">
                          <span>Water</span><span>{crop.weatherMatchPct}%</span>
                        </div>
                        <ScoreBar value={crop.weatherMatchPct} color="bg-cyan" />
                      </div>
                    </div>

                    <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">{crop.reason}</p>

                    {(crop.suggestedFertilizer || crop.irrigationPrediction) && (
                      <div className="mb-3 space-y-2 border-t border-border/50 pt-3">
                        {crop.suggestedFertilizer && (
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1 font-semibold"><Sprout className="h-3 w-3"/> Fertilizer</span>
                            <span className={`font-semibold truncate pl-2 max-w-[120px] text-right ${crop.suggestedFertilizer.includes('unavailable') || crop.suggestedFertilizer.startsWith('N/A') ? 'text-muted-foreground italic' : 'text-foreground'}`} title={crop.suggestedFertilizer}>
                              {crop.suggestedFertilizer.includes('unavailable') || crop.suggestedFertilizer.startsWith('N/A') ? 'Unavailable' : crop.suggestedFertilizer}
                            </span>
                          </div>
                        )}
                        {crop.irrigationPrediction && (
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1 font-semibold"><Droplets className="h-3 w-3"/> Irrigation</span>
                            <span className={`font-semibold truncate pl-2 max-w-[120px] text-right ${crop.irrigationPrediction.includes('unavailable') || crop.irrigationPrediction.startsWith('N/A') ? 'text-muted-foreground italic' : 'text-foreground'}`} title={crop.irrigationPrediction}>
                              {crop.irrigationPrediction.includes('unavailable') || crop.irrigationPrediction.startsWith('N/A') ? 'Unavailable' : crop.irrigationPrediction}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border/50 pb-3 pt-3 text-xs font-semibold">
                      <div>{crop.expectedYieldKg.toLocaleString("en-IN")} kg</div>
                      <div className="text-primary">₹{crop.expectedMarginRs.toLocaleString("en-IN")}</div>
                    </div>
                    
                    <div className="border-t border-border/50 pt-3">
                      <Link 
                        to="/crop-plan" 
                        search={{ crop: crop.cropName }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                      >
                        <Sprout className="h-3.5 w-3.5" />
                        Create Crop Plan
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {results && results.length === 0 && (
        <div className="glass rounded-3xl py-16 text-center text-sm text-muted-foreground">
          No suitable crops found for the given inputs. Try adjusting the season or soil values.
        </div>
      )}
    </div>
  );
}
