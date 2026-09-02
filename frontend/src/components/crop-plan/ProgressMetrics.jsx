import React from 'react';
import { Target, ListTodo, ListChecks, CalendarClock } from 'lucide-react';

export function ProgressMetrics({ tasksDone, todayTasks, upcomingTasks, seasonProgress }) {
  const metrics = [
    { label: "Tasks Completed", value: tasksDone || 0, icon: <ListChecks className="w-4 h-4 text-emerald-400" /> },
    { label: "Today's Tasks", value: todayTasks || 0, icon: <Target className="w-4 h-4 text-primary" /> },
    { label: "Upcoming", value: upcomingTasks || 0, icon: <ListTodo className="w-4 h-4 text-cyan-400" /> },
    { label: "Crop Progress", value: `${seasonProgress || 0}%`, icon: <CalendarClock className="w-4 h-4 text-warning" /> }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {metrics.map((m, i) => (
        <div key={i} className="glass rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-sm">
          <div className="bg-secondary/60 p-2.5 rounded-full mb-2 border border-border/50">
            {m.icon}
          </div>
          <p className="text-xl font-display font-bold text-foreground">{m.value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{m.label}</p>
        </div>
      ))}
    </div>
  );
}
