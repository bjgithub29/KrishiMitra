import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  LayoutDashboard,
  User,
  Sprout,
  Route as RouteIcon,
  CalendarCheck,
  CloudSun,
  ShieldAlert,
  Wallet,
  Bell,
  Settings,
  Menu,
  X,
  Sparkles,
  Leaf,
  Moon,
  Sun,
  MessageSquareText,
  LineChart,
  MapPinned,
} from "lucide-react";
import { useTheme } from "../theme-provider";
import { useAppData } from "@/lib/AppDataContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="relative rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
}

const nav = [
  { label: "AI Mitra", to: "/ai-saathi", icon: MessageSquareText, badge: null, highlight: true },
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Farms", to: "/farms", icon: MapPinned },
  { label: "Crop Plan", to: "/crop-plan", icon: CalendarCheck },
  { label: "Weather & Advisory", to: "/weather", icon: CloudSun },
  { label: "Market Prices", to: "/market", icon: LineChart },
  { label: "Risk Alerts", to: "/alerts", icon: ShieldAlert, dynamicBadge: "alerts" },
  { label: "Expenses", to: "/expenses", icon: Wallet },
];

const secondaryNav = [
  { label: "Settings & Profile", to: "/profile", icon: User },
];

export function BrandMark({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
        <Leaf className="h-4.5 w-4.5 text-primary" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary pulse-dot" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="font-display text-lg font-bold tracking-tight text-foreground">
            Krishi<span className="text-primary">Mitra</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Agri Intelligence
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { farms, activeFarmId, setActiveFarmId, alerts = [], notifications = [] } = useAppData();

  const renderItem = (item) => {
    const active = pathname === item.to || pathname.startsWith(item.to + "/");
    if (item.highlight) {
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all mb-1 ${
            active
              ? "bg-primary text-primary-foreground shadow-[0_0_20px_var(--color-primary)/40]"
              : "bg-primary/12 text-primary hover:bg-primary/20 border border-primary/25"
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </Link>
      );
    }
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
          active
            ? "bg-primary/12 text-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)]" />
        )}
        <item.icon
          className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
        />

        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        
        {(() => {
          let badgeVal = null;
          if (item.dynamicBadge === "alerts" && alerts.length > 0) badgeVal = alerts.length;
          if (item.badge) badgeVal = item.badge; // fallback for static
          
          if (!badgeVal) return null;
          return (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary ring-1 ring-primary/25">
              {badgeVal}
            </span>
          );
        })()}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link to="/dashboard" onClick={onNavigate}>
          <BrandMark />
        </Link>
      </div>

      {farms.length > 1 && (
        <div className="mx-4 mb-3">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Active Farm
          </label>
          <select
            value={activeFarmId || ""}
            onChange={(e) => setActiveFarmId(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-[13px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {farms.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          Operations
        </div>
        {nav.map(renderItem)}
        <div className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          Account
        </div>
        {secondaryNav.map(renderItem)}
      </nav>
    </div>
  );
}

export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { userProfile, activeFarm, alerts = [] } = useAppData();
  const current =
    [...nav, ...secondaryNav].find((n) => pathname === n.to || pathname.startsWith(n.to + "/"))
      ?.label ?? "Dashboard";
  const unreadAlerts = alerts.filter((a) => a.severity !== "info").length;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      {desktopSidebarOpen && (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block transition-all">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="absolute left-0 top-0 h-full w-64 border-r border-sidebar-border bg-sidebar shadow-2xl animate-fade-up">
            <button
              className="absolute right-3 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between lg:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                className="hidden rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground lg:block transition-colors"
                onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
                aria-label="Toggle sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <div className="truncate font-display text-sm font-semibold">{current}</div>
                <div className="hidden text-[11px] text-muted-foreground sm:block" suppressHydrationWarning>
                  Kharif 2026 · {activeFarm?.location?.address || "No farm selected"}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link to="/ai-saathi" className="hidden items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 md:flex">
                <Sparkles className="h-3.5 w-3.5" />
                AI Assistant
              </Link>
              <ThemeToggle />
              <Link
                to="/alerts"
                className="relative rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
                aria-label="Alerts"
              >
                <Bell className="h-4 w-4" />
                {unreadAlerts > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-warning text-[9px] font-bold text-warning-foreground">
                    {unreadAlerts}
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-xl border border-border py-1 pl-1 pr-1 transition-colors hover:border-primary/30 sm:pr-3"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/25">
                  {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
                </span>
                <span className="hidden text-xs font-medium sm:block">{userProfile.name}</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-7">{children}</main>
      </div>


    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
