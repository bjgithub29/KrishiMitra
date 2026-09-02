import React from 'react';
import { Sprout, Calendar, Timer } from 'lucide-react';

export function CurrentStageCard({ activeStage, currentDay, durationDays, stageProgress, harvestDate }) {
  if (!activeStage) return null;
  
  const daysRemaining = Math.max(0, durationDays - currentDay);

  return (
    <div className="glass rounded-2xl p-5 border-l-4 border-l-primary shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Sprout className="w-4 h-4 text-primary" /> Current Stage
          </h3>
          <p className="text-2xl font-display font-bold text-foreground mt-1">{activeStage.stage}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Day {currentDay} of {durationDays}</p>
          <p className="text-lg font-bold text-primary">{Math.round(stageProgress)}%</p>
        </div>
      </div>
      
      <div className="h-2 w-full bg-secondary/80 rounded-full overflow-hidden mb-5">
        <div 
          className="h-full bg-gradient-to-r from-primary to-cyan transition-all duration-1000 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, stageProgress))}%` }}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-secondary/50 rounded-lg text-cyan">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Days Remaining</p>
            <p className="font-semibold">{daysRemaining} Days</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-secondary/50 rounded-lg text-warning">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Harvest</p>
            <p className="font-semibold">{harvestDate || 'Not Available'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
