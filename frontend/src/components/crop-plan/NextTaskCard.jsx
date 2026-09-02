import React from 'react';
import { CalendarClock, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from "@tanstack/react-router";

export function NextTaskCard({ planTasks }) {
  const navigate = useNavigate();
  
  if (!planTasks || planTasks.length === 0) return null;

  // Find the next upcoming/incomplete task
  const upcomingTasks = planTasks
    .filter(t => t.status !== "done")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const nextTask = upcomingTasks[0];

  if (!nextTask) return null;

  const isHighPriority = nextTask.priority === "high";

  const dateObj = new Date(nextTask.date);
  const isValidDate = !isNaN(dateObj);

  return (
    <div className="glass rounded-2xl p-5 border-t border-t-primary/30 shadow-[0_4px_24px_-12px_rgba(var(--color-primary),0.3)] relative overflow-hidden group cursor-pointer" onClick={() => navigate({ to: "/schedule" })}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" /> Up Next
        </h3>
        <span className="text-[10px] font-bold tracking-wider uppercase bg-secondary px-2 py-1 rounded-md text-foreground flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-primary" />
          {isValidDate ? dateObj.toLocaleDateString("en-IN", { weekday: 'short', month: 'short', day: 'numeric' }) : 'Pending'}
        </span>
      </div>

      <div className="space-y-1 mb-4 relative z-10">
        <h4 className="text-base font-bold text-foreground leading-tight">{nextTask.title}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2">{nextTask.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground border-t border-border/50 pt-3 relative z-10">
        {isHighPriority && (
          <span className="flex items-center gap-1 text-destructive font-bold">
            <AlertCircle className="w-3.5 h-3.5" /> High Priority
          </span>
        )}
        <span className="uppercase tracking-widest bg-secondary/80 px-2 py-0.5 rounded-md text-foreground">
          {nextTask.category || "General"}
        </span>
      </div>
    </div>
  );
}
