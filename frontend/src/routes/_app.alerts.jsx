import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, BellRing, CheckCheck, CloudRain, Info, ShieldAlert, Sprout, Timer } from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { PageHeader } from "@/components/app/AppShell";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({
    meta: [
      { title: "Risk Alerts — KrishiMitra" },
      {
        name: "description",
        content:
          "Severity-ranked farm risk alerts: weather warnings, delay risks and crop health signals.",
      },
    ],
  }),
  component: AlertsPage,
});

const config = {
  critical: {
    icon: ShieldAlert,
    ring: "border-destructive/40",
    glow: "shadow-[0_0_36px_-12px_var(--color-destructive)]",
    chip: "bg-destructive/12 text-destructive ring-1 ring-destructive/30",
    icoBg: "bg-destructive/10 text-destructive ring-1 ring-destructive/25",
  },
  warning: {
    icon: AlertTriangle,
    ring: "border-warning/35",
    glow: "",
    chip: "bg-warning/12 text-warning ring-1 ring-warning/30",
    icoBg: "bg-warning/10 text-warning ring-1 ring-warning/25",
  },
  info: {
    icon: Info,
    ring: "border-cyan/25",
    glow: "",
    chip: "bg-cyan/12 text-cyan ring-1 ring-cyan/25",
    icoBg: "bg-cyan/10 text-cyan ring-1 ring-cyan/25",
  },
};

const DEFAULT_RADAR = {
  "Weather risk": { level: "Low", pct: 0, tone: "primary" },
  "Schedule delay risk": { level: "Low", pct: 0, tone: "primary" },
  "Crop health risk": { level: "Low", pct: 0, tone: "primary" },
  "Equipment risk": { level: "Low", pct: 0, tone: "primary" },
};



function AlertsPage() {
  const { activeFarm, alerts = [], setAlerts, patchRecord } = useAppData();
  const [dismissed, setDismissed] = useState([]);

  const visibleAlerts = alerts.filter((a) => !dismissed.includes(a._id) && a.status !== "dismissed");
  const criticalCount = visibleAlerts.filter((a) => a.severity === "critical").length;
  const warningCount = visibleAlerts.filter((a) => a.severity === "warning").length;

  const radarData = activeFarm?.riskRadarData && Object.keys(activeFarm.riskRadarData).length > 0 
    ? activeFarm.riskRadarData 
    : DEFAULT_RADAR;

  const riskCategories = [
    { icon: CloudRain, label: "Weather risk", ...radarData["Weather risk"] },
    { icon: Timer, label: "Schedule delay risk", ...radarData["Schedule delay risk"] },
    { icon: Sprout, label: "Crop health risk", ...radarData["Crop health risk"] },
    { icon: BellRing, label: "Equipment risk", ...radarData["Equipment risk"] },
  ];

  // Persist dismissal as status: "dismissed" so it survives a refresh instead
  // of quietly reappearing once local state resets.
  const handleDismiss = (id) => {
    setDismissed((prev) => [...prev, id]);
    setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, status: "dismissed" } : a)));
    patchRecord(`/alerts/${id}`, { status: "dismissed" }).catch(() => {
      toast.error("Couldn't save — this alert may reappear after refresh.");
    });
  };

  const handleMarkAllReviewed = () => {
    const ids = visibleAlerts.map((a) => a._id);
    if (ids.length === 0) return;
    setDismissed((prev) => [...prev, ...ids]);
    setAlerts((prev) => prev.map((a) => (ids.includes(a._id) ? { ...a, status: "dismissed" } : a)));
    Promise.all(ids.map((id) => patchRecord(`/alerts/${id}`, { status: "dismissed" }))).catch(() => {
      toast.error("Some alerts failed to save as reviewed.");
    });
  };

  return (
    <div>
      <PageHeader
        title="Risk Alerts"
        subtitle={`${criticalCount} critical · ${warningCount} warnings · monitored for ${activeFarm?.name || "your farm"}`}
        action={
          <button
            onClick={handleMarkAllReviewed}
            className="glass flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors hover:border-primary/30"
          >
            <CheckCheck className="h-3.5 w-3.5 text-primary" /> Mark all reviewed
          </button>
        }
      />

      {/* Risk radar */}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {riskCategories.map((r) => (
          <div key={r.label} className="glass hover-lift rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <r.icon
                className={`h-5 w-5 ${r.tone === "warning" ? "text-warning" : r.tone === "cyan" ? "text-cyan" : "text-primary"}`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  r.tone === "warning" ? "text-warning" : r.tone === "cyan" ? "text-cyan" : "text-primary"
                }`}
              >
                {r.level}
              </span>
            </div>
            <div className="mt-3 text-xs font-medium">{r.label}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${
                  r.tone === "warning"
                    ? "bg-gradient-to-r from-warning to-destructive/70"
                    : r.tone === "cyan"
                      ? "bg-gradient-to-r from-cyan to-cyan/40"
                      : "bg-gradient-to-r from-primary to-primary/50"
                }`}
                style={{ width: `${r.pct}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Alert cards */}
      {visibleAlerts.length === 0 ? (
        <div className="glass grid place-items-center rounded-2xl p-10 text-center">
          <CheckCheck className="h-6 w-6 text-primary" />
          <div className="mt-2 text-sm font-medium">All clear — no active alerts</div>
          <p className="mt-1 text-xs text-muted-foreground">All alerts have been reviewed. New alerts will appear here automatically.</p>
          <button onClick={() => setDismissed([])} className="mt-4 rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:border-primary/30 hover:text-primary">
            Restore alerts
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {visibleAlerts.map((a) => {
            const c = config[a.severity] || config.info;
            return (
              <div key={a._id} className={`glass rounded-2xl border p-5 ${c.ring} ${c.glow}`}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${c.icoBg}`}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm font-semibold">{a.title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${c.chip}`}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                      {a.detail || a.message}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{a.source || "System"}</span>
                      <span>·</span>
                      <span>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button className="rounded-lg bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition-transform hover:scale-[1.03]">
                      Take action
                    </button>
                    <button
                      onClick={() => handleDismiss(a._id)}
                      className="rounded-lg border border-border px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
