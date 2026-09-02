import { Link, createFileRoute } from "@tanstack/react-router";
import { BrandMark, ThemeToggle } from "@/components/app/AppShell";
import { Sprout, LineChart, Shield, ChevronRight, Settings2, CloudRain } from "lucide-react";
import { 
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KrishiMitra — Intelligence that grows with you." },
    ],
  }),
  component: Landing,
});

const growthData = [
  { name: 'Jan', value: 30 },
  { name: 'Feb', value: 45 },
  { name: 'Mar', value: 35 },
  { name: 'Apr', value: 65 },
  { name: 'May', value: 55 },
  { name: 'Jun', value: 85 },
  { name: 'Jul', value: 75 },
];

const allocationData = [
  { name: 'W', value: 400 },
  { name: 'S', value: 300 },
  { name: 'F', value: 550 },
  { name: 'C', value: 200 },
  { name: 'L', value: 650 },
  { name: 'T', value: 450 },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      
      {/* Navbar */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-5xl rounded-full glass border border-foreground/10 px-6 py-3 flex items-center justify-between shadow-2xl">
        <BrandMark />
        {/* Removed broken nav links to keep header clean and functional */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/auth" className="text-sm font-medium text-foreground hover:text-primary transition-colors">Log in</Link>
          <Link to="/auth" className="rounded-full bg-primary/20 text-primary border border-primary/50 px-5 py-2 text-sm font-bold transition-all hover:bg-primary hover:text-background hover:glow-emerald">
            Get Started <ChevronRight className="inline h-4 w-4 ml-1" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex flex-col items-center pt-48 pb-32 overflow-hidden px-6">
        {/* Background */}
        <div className="absolute inset-0 z-0">
           <img 
             src="https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=2000&q=80" 
             alt="Lush moss background" 
             className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
           />
           <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        </div>

        <div className="relative z-10 w-full max-w-5xl flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-8 glow-emerald">
             <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
             Welcome to KrishiMitra: Your Smart Farming Assistant <ChevronRight className="h-3 w-3" />
          </div>

          <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
            Intelligence that <br />
            <span className="text-primary italic pr-2">grows</span> with you.
          </h1>

          <p className="text-muted-foreground text-lg sm:text-xl max-w-2xl mb-10">
            The all-in-one platform for agricultural teams who want clarity, precision, and sustainable growth from soil to harvest.
          </p>

          <Link to="/auth" className="rounded-full bg-primary text-background px-8 py-4 text-base font-bold transition-all hover:scale-105 glow-emerald flex items-center gap-2 mb-6">
            Start Free Trial <ChevronRight className="h-5 w-5" />
          </Link>

          {/* Removed trial badges per user request */}
        </div>

        {/* Floating Cards */}
        <div className="relative z-10 w-full max-w-6xl mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="glass-strong rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-500">
             <div className="h-12 w-12 rounded-xl border border-foreground/20 flex items-center justify-center mb-6">
                <Sprout className="text-primary h-6 w-6" />
             </div>
             <h3 className="text-xl font-bold text-foreground mb-3">Unify your farm data</h3>
             <p className="text-muted-foreground text-sm leading-relaxed mb-8">
               Connect all your sensors and weather data into a single source of truth.
             </p>
             {/* Abstract UI element */}
             <div className="h-32 rounded-xl border border-foreground/10 bg-background/40 flex items-center justify-center overflow-hidden relative">
                 <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                    <div className="h-6 w-8 rounded bg-foreground/10" />
                    <div className="h-6 w-8 rounded bg-foreground/10" />
                    <div className="h-6 w-8 rounded bg-foreground/10" />
                 </div>
                 <svg className="absolute left-14 right-14 h-full w-[calc(100%-7rem)] opacity-30" preserveAspectRatio="none">
                    <path d="M0 20 C 50 20, 50 60, 100 60 M0 50 C 50 50, 50 60, 100 60 M0 80 C 50 80, 50 60, 100 60" stroke="var(--color-primary)" fill="none" strokeWidth="2" strokeDasharray="4 4"/>
                 </svg>
                 <div className="absolute right-4 h-12 w-12 rounded-xl border border-primary/50 bg-primary/20 flex items-center justify-center glow-emerald">
                    <Sprout className="text-primary h-6 w-6" />
                 </div>
             </div>
          </div>

          {/* Card 2 */}
          <div className="glass-strong rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-500">
             <div className="h-12 w-12 rounded-xl border border-foreground/20 flex items-center justify-center mb-6">
                <LineChart className="text-primary h-6 w-6" />
             </div>
             <h3 className="text-xl font-bold text-foreground mb-3">Surface what matters</h3>
             <p className="text-muted-foreground text-sm leading-relaxed mb-8">
               AI that cuts through noise and highlights the insights that drive crop yield.
             </p>
             {/* Chart UI element */}
             <div className="h-32 rounded-xl border border-foreground/10 bg-background/40 pt-4 relative">
                <div className="absolute right-4 top-2 text-xs font-bold text-primary flex items-center gap-1">↑ 32%</div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={growthData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Card 3 */}
          <div className="glass-strong rounded-3xl p-8 hover:-translate-y-2 transition-transform duration-500">
             <div className="h-12 w-12 rounded-xl border border-foreground/20 flex items-center justify-center mb-6">
                <Shield className="text-primary h-6 w-6" />
             </div>
             <h3 className="text-xl font-bold text-foreground mb-3">Act with confidence</h3>
             <p className="text-muted-foreground text-sm leading-relaxed mb-8">
               Built-in risk assessment and weather prediction so your farm can adapt fast, without risk.
             </p>
             {/* Radar UI element */}
             <div className="h-32 rounded-xl border border-foreground/10 bg-background/40 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-32 w-32 rounded-full border border-primary/20" />
                  <div className="absolute h-20 w-20 rounded-full border border-primary/40" />
                  <div className="absolute h-8 w-8 rounded-full border border-primary text-primary flex items-center justify-center bg-primary/10 glow-emerald">
                     <Shield className="h-3 w-3" />
                  </div>
                </div>
                {/* Radar sweep */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-transparent animate-[spin_4s_linear_infinite]" style={{ transformOrigin: 'center' }} />
             </div>
          </div>

        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="relative py-32 px-6 flex justify-center overflow-hidden">
         {/* Background */}
        <div className="absolute inset-0 z-0">
           <img 
             src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=2000&q=80" 
             alt="Dark soil background" 
             className="w-full h-full object-cover opacity-20 mix-blend-luminosity"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />
        </div>

        {/* Glass Dashboard Panel */}
        <div className="relative z-10 w-full max-w-5xl glass-strong rounded-[2.5rem] border border-foreground/20 p-8 sm:p-12 shadow-2xl overflow-hidden">
           
           <div className="flex justify-between items-start mb-10">
              <div>
                 <div className="text-muted-foreground text-sm font-semibold uppercase tracking-wider mb-2">AI for Success Toolkit</div>
                 <h2 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">SUSTAINABLE <br/>GROWTH</h2>
              </div>
              <div className="flex items-center justify-center h-20 w-20 rounded-2xl border border-foreground/10 bg-background/30">
                 <div className="relative flex items-center justify-center">
                    <svg className="w-16 h-16 transform -rotate-90">
                       <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-foreground/10" />
                       <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="175" strokeDashoffset="45" className="text-primary drop-glow-emerald" />
                    </svg>
                    <span className="absolute text-sm font-bold text-foreground">46%</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Growth Projections */}
              <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md">
                 <h4 className="text-foreground font-medium mb-6">Growth Projections</h4>
                 <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={growthData}>
                        <XAxis dataKey="name" hide />
                        <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={0} />
                        <Area type="monotone" dataKey="value" stroke="var(--color-foreground)" strokeWidth={1} fillOpacity={0} className="opacity-30" style={{ transform: 'translateY(10px)' }}/>
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Resource Allocation (3D-like Bars) */}
              <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md">
                 <h4 className="text-foreground font-medium mb-6">Resource Allocation</h4>
                 <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allocationData} barSize={20}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }} />
                        <Tooltip cursor={{ fill: 'var(--color-accent)' }} contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }} />
                        <Bar dataKey="value" radius={[4,4,0,0]}>
                           {allocationData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--color-primary)' : 'var(--color-primary-hover)'} />
                           ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Efficiency Score */}
              <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-6 backdrop-blur-md md:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-8">
                 <div className="flex-1">
                   <h4 className="text-foreground font-medium mb-2">Efficiency Score</h4>
                   <div className="text-4xl font-bold text-foreground mb-2">22,91 <span className="text-primary text-lg">↑</span></div>
                   <div className="flex items-end gap-1 h-12 mt-6">
                      {[30, 40, 20, 50, 60, 40, 70, 80, 60, 90, 70, 100, 80, 60, 40, 50].map((h, i) => (
                         <div key={i} className="w-2 rounded-t-sm bg-primary/80 transition-all hover:bg-primary" style={{ height: `${h}%` }} />
                      ))}
                   </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-center">
                       <div className="relative flex items-center justify-center h-24 w-24">
                          <svg className="w-full h-full transform -rotate-90">
                             <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-foreground/10" />
                             <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset="120" className="text-primary" />
                          </svg>
                          <div className="absolute text-center">
                             <div className="text-xl font-bold text-foreground">46%</div>
                             <div className="text-[10px] text-muted-foreground uppercase">Canopy</div>
                          </div>
                       </div>
                    </div>
                    <div className="text-center">
                       <div className="relative flex items-center justify-center h-24 w-24">
                          <svg className="w-full h-full transform -rotate-90">
                             <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-foreground/10" />
                             <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset="200" className="text-primary/50" />
                          </svg>
                          <div className="absolute text-center">
                             <div className="text-xl font-bold text-foreground">9.96</div>
                             <div className="text-[10px] text-muted-foreground uppercase">Yield</div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

           </div>
        </div>
      </section>

    </div>
  );
}
