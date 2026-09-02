import React from 'react';
import { FlaskConical } from 'lucide-react';

export function SoilHealthCard() {
  const nutrients = [
    { name: "Nitrogen (N)", level: "Low", value: "110 kg/ha", color: "text-warning", bg: "bg-warning/10" },
    { name: "Phosphorus (P)", level: "Ideal", value: "35 kg/ha", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { name: "Potassium (K)", level: "Ideal", value: "180 kg/ha", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { name: "pH Level", level: "High", value: "7.8", color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="glass rounded-2xl p-5 shadow-sm h-full flex flex-col cursor-pointer hover:bg-secondary/20 transition-colors group">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-warning" /> Soil Health
        </h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">Future Integration</span>
      </div>

      <div className="space-y-3 flex-1 flex flex-col justify-center">
        {nutrients.map((n, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{n.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-foreground">{n.value}</span>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${n.color} ${n.bg}`}>
                {n.level}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-border/50 text-center">
        <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">Click to view detailed analysis (Coming soon)</span>
      </div>
    </div>
  );
}
