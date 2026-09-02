import React from 'react';
import { CheckCircle2, AlertTriangle, Droplets, FlaskConical, Target, ShieldAlert } from 'lucide-react';

export function VerticalTimeline({ cropStages, stageTips, stageTipsLoading, stageProgress, getStageActivities }) {
  if (!cropStages || cropStages.length === 0) return null;

  return (
    <div className="relative space-y-6 pl-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
      {cropStages.map((s, i) => {
        const isActive = s.status === "active";
        const isDone = s.status === "done";
        const isUpcoming = s.status === "upcoming";

        return (
          <div key={s._id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            {/* Timeline dot */}
            <div className={`absolute left-0 -ml-[19px] md:left-1/2 md:-ml-[11px] grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold z-10 shadow-sm transition-transform duration-300 ${
              isDone ? "bg-primary text-primary-foreground scale-110" : 
              isActive ? "bg-primary/20 text-primary ring-4 ring-primary/20 pulse-dot scale-125" : 
              "bg-secondary ring-2 ring-border text-muted-foreground scale-100"
            }`}>
              {isDone ? "✓" : isActive ? "●" : "○"}
            </div>

            {/* Content card */}
            <div className="w-[calc(100%-1rem)] md:w-[calc(50%-2rem)]">
              <div className={`glass rounded-2xl p-5 shadow-sm transition-all duration-300 ${
                isActive ? "border-primary/50 glow-emerald scale-[1.02]" :
                isUpcoming ? "opacity-70 hover:opacity-100" :
                "opacity-80"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className={`font-display text-base font-bold ${isActive ? "text-primary" : "text-foreground"}`}>
                    {s.stage}
                  </h3>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-secondary/80 px-2 py-0.5 rounded-full border border-border/50">
                    {s.window}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3" /> {s.durationDays || "—"} days</span>
                  {isActive && <span className="font-bold text-primary flex items-center gap-1">● {stageProgress}% through</span>}
                  {isDone && <span className="font-bold text-emerald-400">Completed ✓</span>}
                </div>

                {/* Major activities / Objectives */}
                <div className="space-y-2 mb-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Objectives</p>
                  <div className="flex flex-wrap gap-1.5">
                    {getStageActivities(s.stage, s.majorTasks).map((act) => (
                      <span key={`${s._id}-${act}`} className="rounded-lg bg-secondary/60 border border-border/50 px-2 py-1 text-[11px] text-foreground">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Detailed Tasks / Tips (Show only for active stage) */}
                {isActive && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                    {stageTipsLoading && (
                      <div className="text-xs text-muted-foreground animate-pulse">Analyzing optimal conditions…</div>
                    )}
                    
                    {!stageTipsLoading && stageTips && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {stageTips.irrigation && (
                          <div className="flex items-start gap-2 bg-cyan-400/5 rounded-xl p-3 border border-cyan-400/20">
                            <Droplets className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[9px] uppercase font-bold tracking-widest text-cyan-400/70 mb-0.5">Irrigation Tasks</p>
                              <p className="text-[11px] text-foreground leading-snug">{stageTips.irrigation}</p>
                            </div>
                          </div>
                        )}
                        {stageTips.fertilizer && (
                          <div className="flex items-start gap-2 bg-warning/5 rounded-xl p-3 border border-warning/20">
                            <FlaskConical className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[9px] uppercase font-bold tracking-widest text-warning/70 mb-0.5">Fertilizer Tasks</p>
                              <p className="text-[11px] text-foreground leading-snug">{stageTips.fertilizer}</p>
                            </div>
                          </div>
                        )}
                        {stageTips.watch_for && (
                          <div className="col-span-full flex items-start gap-2 bg-destructive/5 rounded-xl p-3 border border-destructive/20">
                            <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[9px] uppercase font-bold tracking-widest text-destructive/70 mb-0.5">Pest & Disease Monitoring</p>
                              <p className="text-[11px] text-foreground leading-snug">{stageTips.watch_for}</p>
                            </div>
                          </div>
                        )}
                        {stageTips.critical && (
                          <div className="col-span-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-destructive bg-destructive/10 px-3 py-1.5 rounded-lg w-fit">
                            <AlertTriangle className="w-3 h-3" /> Critical stage — do not skip
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
