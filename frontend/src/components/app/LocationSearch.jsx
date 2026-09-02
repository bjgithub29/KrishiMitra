import { useState, useEffect, useRef } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";

export function LocationSearch({ value, onChange, placeholder = "Search location...", className = "" }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`);
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error("Location search failed", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(() => {
      if (query !== value && isOpen) {
        fetchLocations();
      }
    }, 600);

    return () => clearTimeout(debounce);
  }, [query, value, isOpen]);

  const handleSelect = (item) => {
    const { address } = item;
    const area = address?.neighbourhood || address?.suburb || address?.village || address?.town || address?.city || "";
    const district = address?.county || address?.state_district || "";
    const state = address?.state || "";
    const formatted = [area, district, state].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
    const displayName = formatted || item.display_name;

    onChange(displayName);
    setQuery(displayName);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div className="flex items-center gap-2.5 rounded-xl border border-input bg-background/50 px-3.5 py-2.5 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-background">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
      </div>
      
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in zoom-in-95">
          <ul className="max-h-60 overflow-auto p-1">
            {results.map((item) => {
               const { address } = item;
               const area = address?.neighbourhood || address?.suburb || address?.village || address?.town || address?.city || "";
               const district = address?.county || address?.state_district || "";
               const state = address?.state || "";
               const formatted = [area, district, state].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
               const display = formatted || item.display_name;
               
               return (
                <li
                  key={item.place_id}
                  onClick={() => handleSelect(item)}
                  className="relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{display}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
