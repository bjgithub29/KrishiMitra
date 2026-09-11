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
        const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
        const res = await fetch(`${API_URL}/geocode?q=${encodeURIComponent(query)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data.results) ? data.results : []);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("Location search failed", err);
        setResults([]);
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
    const displayName = item.address || item.display_name || item.query;
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
            {results.map((item, idx) => {
              const display = item.address || item.display_name || item.query;
              return (
                <li
                  key={item.place_id || idx}
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
