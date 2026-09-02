import React from 'react';
import { Sparkles, Brain, CloudRain, Droplet, Activity } from 'lucide-react';

export function AiFarmAdvisor({ cropName }) {
  // Simulated AI insights for now
  const insights = [
    { icon: <Activity className="w-3.5 h-3.5 text-emerald-500" />, text: "Crop growth is healthy and on track." },
    { icon: <CloudRain className="w-3.5 h-3.5 text-cyan-400" />, text: "Rain expected tomorrow." },
    { icon: <Droplet className="w-3.5 h-3.5 text-warning" />, text: "Delay next irrigation due to rain." },
    { icon: <Brain className="w-3.5 h-3.5 text-primary" />, text: `Monitor for early signs of pests specific to ${cropName || "your crop"}.` },
  ];

  return (
    <div className="glass rounded-2xl p-5 border border-primary/20 shadow-sm relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex justify-between items-center mb-4 relative z-10">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> AI Farm Advisor
        </h3>
        <span className="text-[10px] uppercase font-bold tracking-widest text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
          Live Insights
        </span>
      </div>
      
      <div className="space-y-3 relative z-10">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <div className="mt-0.5 p-1 bg-secondary/80 rounded-md shrink-0 border border-border/50">
              {insight.icon}
            </div>
            <p className="text-xs text-muted-foreground leading-snug">{insight.text}</p>
          </div>
        ))}
        
        <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-medium">Crop Health Score</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[92%]" />
            </div>
            <span className="text-sm font-bold text-emerald-400">92%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
