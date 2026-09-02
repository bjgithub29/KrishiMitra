import React from 'react';
import { Cloud, Droplets, Wind, Thermometer, AlertCircle, CheckCircle2 } from 'lucide-react';

export function WeatherCard() {
  return (
    <div className="glass rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Cloud className="w-4 h-4 text-cyan-400" /> Today's Weather
        </h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Simulated</span>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="text-4xl font-display font-light">32°</div>
        <div className="flex-1 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5" /> Feels 34°</div>
          <div className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> 65% Hum</div>
          <div className="flex items-center gap-1.5"><Cloud className="w-3.5 h-3.5" /> 10% Rain</div>
          <div className="flex items-center gap-1.5"><Wind className="w-3.5 h-3.5" /> 12 km/h</div>
        </div>
      </div>

      <div className="mt-auto bg-secondary/50 rounded-xl p-3 border border-border/50">
        <h4 className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-2">Weather Impact</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Should irrigate?</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold"><CheckCircle2 className="w-3 h-3" /> Yes</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Can spray pesticides?</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold"><CheckCircle2 className="w-3 h-3" /> Ideal</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Disease Risk</span>
            <span className="flex items-center gap-1 text-warning font-semibold"><AlertCircle className="w-3 h-3" /> Moderate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
