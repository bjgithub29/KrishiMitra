/**
 * FarmSwitcher — a compact dropdown that lets the user change the active farm
 * from any page (Crop Plan, Schedule, etc.) without going to the Farms page.
 *
 * Usage:
 *   import { FarmSwitcher } from "@/components/app/FarmSwitcher";
 *   <FarmSwitcher />
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown, MapPin, Check } from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";

export function FarmSwitcher({ className = "" }) {
  const { farms, activeFarm, activeFarmId, setActiveFarmId } = useAppData();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!farms || farms.length === 0) return null;

  // If only one farm, still show it (non-interactive)
  const single = farms.length === 1;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => !single && setOpen((v) => !v)}
        disabled={single}
        aria-label="Switch farm"
        className={`flex items-center gap-1.5 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2 text-xs font-semibold text-foreground backdrop-blur-sm transition-all
          ${single ? "cursor-default opacity-70" : "cursor-pointer hover:bg-secondary/80 hover:border-primary/40"}
          ${open ? "border-primary/50 bg-secondary/70" : ""}
        `}
      >
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="max-w-[120px] truncate">{activeFarm?.name || "Select Farm"}</span>
        {!single && (
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && !single && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden animate-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b border-border/40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Switch Farm</p>
          </div>
          <ul className="py-1 max-h-64 overflow-y-auto">
            {farms.map((farm) => {
              const isActive = farm._id === activeFarmId;
              return (
                <li key={farm._id}>
                  <button
                    onClick={() => {
                      setActiveFarmId(farm._id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors
                      ${isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-secondary/60"
                      }`}
                  >
                    <MapPin className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{farm.name}</div>
                      {farm.village && (
                        <div className="truncate text-[11px] text-muted-foreground">{farm.village}</div>
                      )}
                    </div>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
