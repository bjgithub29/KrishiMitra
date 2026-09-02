import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { PageHeader } from "@/components/app/AppShell";
import { LineChart as LucideLineChart, Search, MapPin, TrendingUp, RefreshCw, Store, Filter, ChevronDown, Sparkles } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/_app/market")({
  head: () => ({
    meta: [
      { title: "Market Prices — KrishiMitra" },
      { name: "description", content: "Live daily mandi prices from Data.gov.in Agmarknet." },
    ],
  }),
  component: MarketPage,
});

const DEFAULT_CROPS = ["Soybean", "Cotton", "Wheat", "Maize", "Rice", "Pigeonpea", "Gram", "Groundnut", "Onion", "Tomato"];

function MarketPage() {
  const navigate = useNavigate();
  const { token, activeFarm, userLocation } = useAppData();
  
  // Data states
  const [prices, setPrices] = useState([]); // Latest prices across markets
  const [rawHistory, setRawHistory] = useState([]); // Historical records for a specific market
  const [chartData, setChartData] = useState([]); // Grouped history for chart
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  // Filters — pre-seeded from userLocation stored in context
  const [commoditySearch, setCommoditySearch] = useState("");
  const [stateFilter, setStateFilter] = useState(() => userLocation?.state || "Maharashtra");
  const [districtFilter, setDistrictFilter] = useState(() => userLocation?.district || "");
  const [marketFilter, setMarketFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("dateDesc");
  const [locationLoaded, setLocationLoaded] = useState(Boolean(userLocation?.state));
  
  // Dependent dropdown data
  const [availableDistricts, setAvailableDistricts] = useState([]);
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [allCommodities, setAllCommodities] = useState(DEFAULT_CROPS);
  const [cropSearchQuery, setCropSearchQuery] = useState("");

  // Attempt to auto-detect user's state and district from activeFarm
  // Sync filters whenever userLocation in context changes (e.g. user just saved/updated a farm)
  useEffect(() => {
    if (userLocation?.state && !locationLoaded) {
      setStateFilter(userLocation.state);
      if (userLocation.district) setDistrictFilter(userLocation.district);
      setLocationLoaded(true);
    } else if (!locationLoaded && activeFarm?.location?.address) {
      // Fallback geocode only if userLocation isn't set yet
      (async () => {
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(activeFarm.location.address)}&addressdetails=1`);
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0 && geoData[0].address) {
            const { state, state_district, county } = geoData[0].address;
            if (state) setStateFilter(state);
            const district = state_district || county || "";
            if (district) setDistrictFilter(district.replace(/ District/i, ""));
          }
        } catch (err) {
          console.error("Geocoding failed", err);
        } finally {
          setLocationLoaded(true);
        }
      })();
    }
  }, [userLocation, activeFarm?.location?.address, locationLoaded]);

  // Fetch initial baseline data (States and Commodities)
  useEffect(() => {
    async function fetchBaseline() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/market/locations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.commodities && data.commodities.length > 0) {
            setAllCommodities(data.commodities);
          }
        }
      } catch (err) {}
    }
    fetchBaseline();
  }, [token]);

  // Fetch available districts and markets for the dropdowns based on current filters
  useEffect(() => {
    async function fetchLocations() {
      try {
        const params = new URLSearchParams();
        if (stateFilter) params.append("state", stateFilter);
        if (districtFilter) params.append("district", districtFilter);

        const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/market/locations?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.districts) setAvailableDistricts(data.districts);
          if (data.markets) setAvailableMarkets(data.markets);
        }
      } catch (err) {
        console.error("Failed to fetch locations", err);
      }
    }
    fetchLocations();
  }, [stateFilter, districtFilter, token]);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (stateFilter) params.append("state", stateFilter);
      if (districtFilter) params.append("district", districtFilter);
      if (commoditySearch) params.append("commodity", commoditySearch);

      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/market/prices?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrices(data.records || []);
        if (data.lastUpdated) setLastUpdated(new Date(data.lastUpdated));
        if (data.needsRefresh != null) setNeedsRefresh(data.needsRefresh);
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!commoditySearch) {
      setChartData([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ commodity: commoditySearch });
      if (stateFilter) params.append("state", stateFilter);
      if (districtFilter) params.append("district", districtFilter);
      if (marketFilter) params.append("market", marketFilter); // If user filtered to specific yard

      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/market/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRawHistory(data.records || []);

        // Group history by date (average modal price across markets for the chart)
        const grouped = (data.records || []).reduce((acc, curr) => {
          const date = curr.arrival_date; // DD/MM/YYYY
          if (!acc[date]) acc[date] = { date, sum: 0, count: 0, parsedObj: new Date(curr.parsedDate) };
          acc[date].sum += curr.modal_price;
          acc[date].count += 1;
          return acc;
        }, {});
        
        const chartArr = Object.values(grouped).map(g => ({
          date: g.date.substring(0, 5), // DD/MM
          price: Math.round(g.sum / g.count),
          parsedObj: g.parsedObj
        })).sort((a, b) => a.parsedObj - b.parsedObj); // Ensure chronological order
        
        setChartData(chartArr);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPrices();
      fetchHistory();
    }, 500);
    return () => clearTimeout(timer);
  }, [commoditySearch, stateFilter, districtFilter, marketFilter, token]);


  // Display Logic: If a market AND a crop are explicitly selected, show historical records in the table. 
  // Otherwise, show latest prices across markets.
  const isHistoryView = !!marketFilter && !!commoditySearch;
  let tableData = isHistoryView ? [...rawHistory] : [...prices];
  
  if (!isHistoryView && marketFilter) {
    // If market is selected but no crop, just filter the latest prices by market
    tableData = tableData.filter(p => p.market.toLowerCase() === marketFilter.toLowerCase());
  }

  // Sorting
  tableData.sort((a, b) => {
    if (sortOrder === "priceDesc") return b.modal_price - a.modal_price;
    if (sortOrder === "priceAsc") return a.modal_price - b.modal_price;
    // default dateDesc
    return new Date(b.parsedDate || 0) - new Date(a.parsedDate || 0);
  });

  const filteredCropsList = allCommodities.filter(c => c.toLowerCase().includes(cropSearchQuery.toLowerCase()));

  // Summary stats for the currently selected crop across visible rows —
  // gives an at-a-glance read before scanning the full table.
  const cropStats = (() => {
    if (!commoditySearch || tableData.length === 0) return null;
    const prices_ = tableData.map(p => p.modal_price).filter(n => typeof n === "number");
    if (prices_.length === 0) return null;
    const high = Math.max(...prices_);
    const low = Math.min(...prices_);
    const avg = Math.round(prices_.reduce((a, b) => a + b, 0) / prices_.length);
    const marketCount = new Set(tableData.map(p => p.market)).size;
    let change = null;
    if (chartData.length >= 2) {
      const first = chartData[0].price, last = chartData[chartData.length - 1].price;
      change = first ? Math.round(((last - first) / first) * 100) : null;
    }
    return { high, low, avg, marketCount, change };
  })();

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Market Prices & Trends"
        subtitle={
          lastUpdated
            ? `Data from ${lastUpdated.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}${needsRefresh ? " · Syncing latest..." : " · Up to date"}`
            : "Daily mandi prices via Data.gov.in · Agmarknet"
        }
        action={
          <div className="flex items-center gap-3">
            {needsRefresh && (
              <span className="flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-medium text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                Syncing in background
              </span>
            )}
            <button
              onClick={() => navigate({ to: "/ai-saathi?prompt=%40market" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] transition-transform hover:scale-[1.03]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Analyze with AI
            </button>
            <button onClick={() => { fetchPrices(); fetchHistory(); }} className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/30 px-4 py-2 text-xs font-semibold hover:bg-secondary transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        }
      />

      <div className="mt-5 flex flex-col lg:flex-row gap-6">
        
        {/* Left Sidebar: Filters (Amazon Style) */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-5">
          <div className="glass rounded-2xl p-5">
            <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </h3>

            {/* State */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">State</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={stateFilter}
                  onChange={(e) => { setStateFilter(e.target.value); setDistrictFilter(""); setMarketFilter(""); }}
                  className="w-full appearance-none rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="">All States</option>
                  {["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Odisha","Punjab","Rajasthan","Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* District */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">District</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={districtFilter}
                  onChange={(e) => { setDistrictFilter(e.target.value); setMarketFilter(""); }}
                  className="w-full appearance-none rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="">All Districts</option>
                  {availableDistricts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Market Yard */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Market Yard</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                  disabled={!districtFilter}
                >
                  <option value="">{districtFilter ? "All Yards" : "Select District First"}</option>
                  {availableMarkets.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

          </div>

          {/* Crop Sidebar List */}
          <div className="glass rounded-2xl flex flex-col overflow-hidden max-h-[400px]">
             <div className="p-4 border-b border-border/50 bg-background/50">
               <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Crop / Commodity</label>
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <input 
                    type="text" 
                    placeholder="Search 200+ crops..." 
                    value={cropSearchQuery}
                    onChange={e => setCropSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-1.5 text-sm outline-none focus:border-primary/50 transition-colors"
                 />
               </div>
             </div>
             <div className="overflow-y-auto p-2">
               {filteredCropsList.map(crop => (
                 <label 
                   key={crop} 
                   className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${commoditySearch === crop ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary/40'}`}
                 >
                   <input 
                      type="radio" 
                      name="cropSelection"
                      checked={commoditySearch === crop}
                      onChange={() => setCommoditySearch(crop)}
                      className="accent-primary"
                   />
                   <span className="text-sm">{crop}</span>
                 </label>
               ))}
               {filteredCropsList.length === 0 && (
                 <div className="p-4 text-center text-xs text-muted-foreground">No crops found.</div>
               )}
             </div>
          </div>
        </aside>

        {/* Right Main Content */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* Summary stats for the selected crop — quick read before the chart/table */}
          {commoditySearch && cropStats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="glass rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Modal Price</div>
                <div className="mt-1 font-display text-2xl font-bold text-primary">₹{cropStats.avg.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">/ Quintal</span></div>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Highest</div>
                <div className="mt-1 font-display text-2xl font-bold">₹{cropStats.high.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">/ Quintal</span></div>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Lowest</div>
                <div className="mt-1 font-display text-2xl font-bold">₹{cropStats.low.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">/ Quintal</span></div>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {cropStats.change !== null ? "Trend (period)" : "Markets Reporting"}
                </div>
                {cropStats.change !== null ? (
                  <div className={`mt-1 flex items-center gap-1 font-display text-2xl font-bold ${cropStats.change >= 0 ? "text-primary" : "text-destructive"}`}>
                    <TrendingUp className={`h-4 w-4 ${cropStats.change < 0 ? "rotate-180" : ""}`} />
                    {cropStats.change >= 0 ? "+" : ""}{cropStats.change}%
                  </div>
                ) : (
                  <div className="mt-1 font-display text-2xl font-bold">{cropStats.marketCount}</div>
                )}
              </div>
            </div>
          )}

          {/* Top: Trend Graph */}
          {commoditySearch && (
            <div className="glass rounded-2xl p-6 h-[300px] flex flex-col">
              <div className="flex justify-between items-start mb-4">
                 <div>
                   <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                     {commoditySearch ? `${commoditySearch} Price Trend` : "Price Trend"}
                     <TrendingUp className="h-5 w-5 text-primary" />
                   </h2>
                   <p className="text-xs text-muted-foreground">
                     {marketFilter ? `${marketFilter} Yard, ` : ''}{districtFilter ? `${districtFilter}, ` : ''}{stateFilter || "India"}
                   </p>
                 </div>
              </div>
              
              <div className="flex-1 w-full relative">
                {historyLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData.length < 2 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm text-center px-4">
                    <LucideLineChart className="h-8 w-8 mb-2 opacity-30" />
                    Not enough historical data saved for {commoditySearch} in this location yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}
                        itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                        formatter={(val) => [`₹${val}`, 'Avg Modal Price']}
                        labelStyle={{ color: 'hsl(var(--foreground))', marginBottom: '4px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Bottom: Table (Latest or Historical) */}
          <div className="glass rounded-2xl flex-1 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-display font-semibold">
                  {isHistoryView ? `Previous Prices: ${marketFilter}` : `Latest Prices: ${districtFilter || stateFilter}`}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isHistoryView ? `Historical log of ${commoditySearch || 'crops'} in ${marketFilter}` : `Current daily prices across different mandis`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Sort By:</label>
                <select 
                  value={sortOrder} 
                  onChange={e => setSortOrder(e.target.value)}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-primary/50"
                >
                  <option value="dateDesc">Date (Newest First)</option>
                  <option value="priceDesc">Price (High to Low)</option>
                  <option value="priceAsc">Price (Low to High)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto flex-1 p-5 pt-0">
              {loading && tableData.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin" /> Fetching data...
                  </div>
                </div>
              ) : tableData.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border mt-5 text-muted-foreground">
                  <Store className="mb-2 h-8 w-8 opacity-50" />
                  <p>No prices found for your filters.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm mt-5">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="pb-3 font-medium px-2">Commodity</th>
                      {!isHistoryView && <th className="pb-3 font-medium px-2">Market (Yard)</th>}
                      <th className="pb-3 font-medium px-2 text-right">Modal Price</th>
                      <th className="pb-3 font-medium px-2 text-right">Min-Max</th>
                      <th className="pb-3 font-medium px-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((p, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                        <td 
                          className="py-3 px-2 cursor-pointer group" 
                          onClick={() => {
                            setCommoditySearch(p.commodity);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                            {p.commodity}
                            <TrendingUp className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-muted-foreground">{p.variety}</div>
                        </td>
                        {!isHistoryView && (
                          <td className="py-3 px-2">
                            <div className="text-foreground">{p.market}</div>
                            <div className="text-[11px] text-muted-foreground">{p.district}</div>
                          </td>
                        )}
                        <td className="py-3 px-2 text-right font-display font-bold text-primary">
                          ₹{p.modal_price.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">/ Qtl</span>
                        </td>
                        <td className="py-3 px-2 text-right text-xs text-muted-foreground">
                          ₹{p.min_price} - ₹{p.max_price} <span className="text-[9px]">/ Qtl</span>
                        </td>
                        <td className="py-3 px-2 text-right text-[11px] text-muted-foreground">
                          {p.arrival_date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
