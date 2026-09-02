import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, User, Copy, Check, Trash2, Leaf, Square,
  Microscope, Sparkles, BrainCircuit, ImagePlus,
  ClipboardPaste, Loader2, AlertTriangle,
  ChevronRight, Upload, X, Plus, RefreshCw,
  ThumbsUp, ThumbsDown, RotateCcw, MoreHorizontal,
  Globe, Zap, Paperclip,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAppData } from "@/lib/AppDataContext";
import { emitAiSyncRefresh } from "@/lib/aiSyncEvents";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ai-saathi")({
  head: () => ({
    meta: [
      { title: "AI Mitra — KrishiMitra" },
      { name: "description", content: "Your personal AI farming assistant with crop disease detection." },
    ],
  }),
  component: AiSaathiPage,
});

const CHART_COLORS = [
  "#d97757", "#c8a96e", "#5b8dee", "#e87c45", "#e05050", "#a97dd9",
];

const chartTooltip = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-foreground)",
};

const SUGGESTION_PROMPTS = [
  { icon: "🌾", title: "Kharif Crop Plan", desc: "Give me a full Kharif season soybean crop plan with a weekly schedule table." },
  { icon: "💰", title: "Farm Budget", desc: "Show my monthly farm budget breakdown as a pie chart." },
  { icon: "📈", title: "Yield Trends", desc: "Show crop yield trend over 6 months as a line chart." },
  { icon: "🐛", title: "Pest Diagnosis", desc: "My tomato leaves have yellow spots. Identify and give a treatment plan." },
  { icon: "🧪", title: "Soil Correction", desc: "My soil pH is 5.2. Give me a correction plan in a table." },
  { icon: "🌦️", title: "Weather Impact", desc: "Compare how wheat, rice and cotton handle heavy rain — bar chart." },
];

// ── Chart helpers ─────────────────────────────────────────────────────────────
function parseChart(raw) {
  return raw.trim().split("\n").map(l => {
    const m = l.match(/^(.+?):\s*(\d+\.?\d*)/);
    return m ? { name: m[1].trim(), value: parseFloat(m[2]) } : null;
  }).filter(Boolean);
}

function BarBlock({ raw }) {
  const data = parseChart(raw);
  if (!data.length) return null;
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-surface-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bar Chart</span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={chartTooltip} cursor={{ fill: "var(--color-primary)", opacity: 0.04 }} />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LineBlock({ raw }) {
  const data = parseChart(raw);
  if (!data.length) return null;
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-surface-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trend</span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={chartTooltip} />
            <Line type="monotone" dataKey="value" stroke="#d97757" strokeWidth={2.5} dot={{ fill: "#d97757", r: 3, strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PieBlock({ raw }) {
  const data = parseChart(raw);
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-surface-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distribution</span>
      </div>
      <div className="p-4 flex flex-col items-center gap-6 sm:flex-row">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={chartTooltip} formatter={v => [`${((v / total) * 100).toFixed(1)}%`, ""]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-sm text-foreground">{d.name}</span>
              <span className="ml-auto pl-6 text-sm font-semibold text-muted-foreground">{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sync Plan Block ────────────────────────────────────────────────────────────
function SyncPlanBlock({ raw }) {
  const { token, activeFarm, farms } = useAppData();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  let syncData;
  try { syncData = JSON.parse(raw); } catch (e) {
    return <div className="text-error text-xs p-2">Invalid plan data</div>;
  }

  const handleSave = async () => {
    if (!farms || farms.length === 0) { setError("No farm selected. Please add a farm first."); return; }
    const farmId = activeFarm?._id || farms[0]._id;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/chat/sync-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ syncData, farmId }),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        const errMsg = data.message || `Server error (${res.status})`;
        console.error("[SyncPlan] Save failed:", errMsg, data);
        throw new Error(errMsg);
      }
      setSaved(true);
      toast.success(isScheduleOnly ? "Daily schedule saved!" : `Crop plan saved! ${data.tasksGenerated || 0} tasks added.`);
      emitAiSyncRefresh("cropPlan");
      emitAiSyncRefresh("schedule");
    } catch (err) {
      const msg = err.message || "Failed to save plan";
      setError(msg);
      toast.error(`Save failed: ${msg}`);
    } finally { setSaving(false); }
  };

  const isScheduleOnly = !syncData.cropPlan && Array.isArray(syncData.tasks) && syncData.tasks.length > 0;
  const hasGeneratedTasks = Array.isArray(syncData.tasks) && syncData.tasks.length > 0;
  const saveLabel = isScheduleOnly ? "Save Daily Schedule" : hasGeneratedTasks ? "Save Crop Plan & Schedule" : "Save Crop Plan";
  if (!syncData.cropPlan && !isScheduleOnly) return null;

  return (
    <div className="my-4 rounded-2xl border border-primary/25 bg-primary/5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary/15 bg-primary/8">
        <div className="flex items-center gap-2.5 text-primary font-semibold text-sm">
          <Leaf className="h-4 w-4" />
          {isScheduleOnly ? "Proposed Schedule" : "Proposed Crop Plan"}
        </div>
        {saved ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Check className="h-3.5 w-3.5" /> Saved!
          </span>
        ) : (
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardPaste className="h-3 w-3" />}
            {saveLabel}
          </button>
        )}
      </div>
      <div className="p-4">
        {isScheduleOnly ? (
          <div className="space-y-2 text-sm">
            {syncData.tasks.slice(0, 4).map((task, index) => (
              <div key={`${task.title || "task"}-${index}`} className="rounded-xl bg-surface p-3 border border-border">
                <p className="font-medium text-foreground">{task.title || "Farm Task"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{task.date || "Today"} · {task.category || "monitoring"} · {task.priority || "medium"}</p>
              </div>
            ))}
            {syncData.tasks.length > 4 && <p className="text-xs text-muted-foreground">+{syncData.tasks.length - 4} more tasks</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[["Crop", syncData.cropPlan.cropName], ["Season", syncData.cropPlan.season], ["Sowing Date", syncData.cropPlan.sowingDate], ["Area (Acres)", syncData.cropPlan.areaAcres]].map(([label, val]) => (
              <div key={label} className="rounded-xl bg-surface p-3 border border-border">
                <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-1">{label}</p>
                <p className="font-medium text-foreground">{val}</p>
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-xs text-error">{error}</p>}
      </div>
    </div>
  );
}

// ── Code block — Claude style ──────────────────────────────────────────────────
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border bg-[#1e1e1e] dark:bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-white/8 bg-white/4 px-4 py-2.5">
        <span className="font-mono text-[11px] text-white/50">{lang || "code"}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-white/40 transition-colors hover:text-white/80 hover:bg-white/8">
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-white/90 font-mono"><code>{code}</code></pre>
    </div>
  );
}

// ── Table — Claude style ────────────────────────────────────────────────────────
function MdTable({ rows }) {
  if (rows.length < 2) return null;
  const headers = rows[0].split("|").map(c => c.trim()).filter(Boolean);
  const body = rows.slice(2).map(r => r.split("|").map(c => c.trim()).filter(Boolean));
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2 border-b border-border">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className={`border-b border-border/50 last:border-0 hover:bg-surface-2/60 transition-colors ${i % 2 ? "bg-surface/30" : ""}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-sm text-foreground/90 whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Inline formatter ──────────────────────────────────────────────────────────
function fmt(t) {
  return t
    .replace(/\*\*(.*?)\*\*/g, `<strong class="font-semibold text-foreground">$1</strong>`)
    .replace(/\*(.*?)\*/g, `<em class="italic text-foreground/80">$1</em>`)
    .replace(/`([^`]+)`/g, `<code class="rounded-md bg-surface-2 border border-border px-1.5 py-0.5 font-mono text-[0.85em] text-foreground/90">$1</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" class="text-[#d97757] underline underline-offset-2 hover:opacity-80 transition-opacity" target="_blank" rel="noopener">$1</a>`);
}

// ── Claude-style callout blocks ───────────────────────────────────────────────
function Callout({ type, children }) {
  const styles = {
    note:    { bg: "bg-blue-500/8 border-blue-500/25",    icon: "💡", text: "text-blue-400" },
    tip:     { bg: "bg-emerald-500/8 border-emerald-500/25", icon: "✅", text: "text-emerald-400" },
    warning: { bg: "bg-amber-500/8 border-amber-500/25",  icon: "⚠️", text: "text-amber-400" },
    danger:  { bg: "bg-red-500/8 border-red-500/25",      icon: "🚨", text: "text-red-400" },
  };
  const s = styles[type] || styles.note;
  return (
    <div className={`my-3 flex items-start gap-3 rounded-xl border p-4 ${s.bg}`}>
      <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
      <div className={`text-sm leading-relaxed ${s.text} flex-1`}>{children}</div>
    </div>
  );
}

// ── Full markdown renderer — Claude-style ────────────────────────────────────
function Markdown({ text }) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const block = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { block.push(lines[i]); i++; }
      const raw = block.join("\n");
      if (lang === "chart:bar") out.push(<BarBlock key={i} raw={raw} />);
      else if (lang === "chart:line") out.push(<LineBlock key={i} raw={raw} />);
      else if (lang === "chart:pie") out.push(<PieBlock key={i} raw={raw} />);
      else if (lang === "json:database-sync" || (lang === "json" && raw.includes('"cropPlan"'))) out.push(<SyncPlanBlock key={i} raw={raw} />);
      else out.push(<CodeBlock key={i} code={raw} lang={lang} />);
      i++; continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^[\s|:-]+$/)) {
      const rows = [line, lines[i + 1]]; i += 2;
      while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i]); i++; }
      out.push(<MdTable key={i} rows={rows} />); continue;
    }

    // Callouts > [!NOTE], > [!TIP], etc.
    if (line.match(/^> \[!(NOTE|TIP|WARNING|DANGER)\]/i)) {
      const type = line.match(/\[!(\w+)\]/)[1].toLowerCase();
      const content = [];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        content.push(<span key={i} className="block" dangerouslySetInnerHTML={{ __html: fmt(lines[i].slice(2)) }} />);
        i++;
      }
      out.push(<Callout key={`callout${i}`} type={type}>{content}</Callout>);
      continue;
    }

    // Blockquote (generic)
    if (line.startsWith("> ")) {
      out.push(
        <blockquote key={i} className="my-3 border-l-[3px] border-foreground/20 pl-4 py-1">
          <span className="text-sm italic text-foreground/60" dangerouslySetInnerHTML={{ __html: fmt(line.slice(2)) }} />
        </blockquote>
      );
      i++; continue;
    }

    // HR
    if (line.match(/^---+$/)) {
      out.push(<hr key={i} className="my-5 border-border" />);
      i++; continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      out.push(
        <h3 key={i} className="mt-6 mb-2 text-sm font-semibold text-foreground">
          <span dangerouslySetInnerHTML={{ __html: fmt(line.slice(4)) }} />
        </h3>
      );
      i++; continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={i} className="mt-7 mb-2.5 text-base font-bold text-foreground border-b border-border pb-2">
          <span dangerouslySetInnerHTML={{ __html: fmt(line.slice(3)) }} />
        </h2>
      );
      i++; continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        <h1 key={i} className="mt-7 mb-3 text-lg font-bold text-foreground">
          <span dangerouslySetInnerHTML={{ __html: fmt(line.slice(2)) }} />
        </h1>
      );
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[\s]*[-*+] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[\s]*[-*+] /)) {
        items.push({ depth: Math.floor((lines[i].match(/^\s*/)[0].length) / 2), content: lines[i].replace(/^\s*[-*+] /, "") });
        i++;
      }
      out.push(
        <ul key={`ul${i}`} className="my-2.5 space-y-1.5">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-2.5" style={{ paddingLeft: it.depth * 16 }}>
              <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-foreground/40" />
              <span className="text-sm leading-7 text-foreground/90" dangerouslySetInnerHTML={{ __html: fmt(it.content) }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
      out.push(
        <ol key={`ol${i}`} className="my-2.5 space-y-2 list-none">
          {items.map((it, j) => (
            <li key={j} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/8 text-[11px] font-semibold text-foreground/60 mt-[3px]">{j + 1}</span>
              <span className="text-sm leading-7 text-foreground/90" dangerouslySetInnerHTML={{ __html: fmt(it) }} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      out.push(<div key={i} className="h-3" />);
      i++; continue;
    }

    // Paragraph
    out.push(
      <p key={i} className="text-sm leading-7 text-foreground/90"
        dangerouslySetInnerHTML={{ __html: fmt(line) }} />
    );
    i++;
  }

  return <div className="space-y-0">{out}</div>;
}

// ── Thinking indicator ────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="h-2 w-2 rounded-full bg-foreground/30"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

// ── Message ───────────────────────────────────────────────────────────────────
function Message({ msg, onEdit, onRetry }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [elapsed, setElapsed] = useState(0);
  const time = new Date(parseInt(msg.id) || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    let t;
    if (msg.isLoading) { const s = Date.now(); t = setInterval(() => setElapsed(((Date.now() - s) / 1000).toFixed(1)), 100); }
    return () => clearInterval(t);
  }, [msg.isLoading]);

  // User message — right-aligned pill
  if (msg.role === "user") {
    return (
      <div className="group flex justify-end mb-6">
        <div className="max-w-[80%]">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="w-full rounded-2xl border border-primary/40 bg-surface px-4 py-3 text-sm text-foreground outline-none resize-none focus:ring-1 focus:ring-primary/50"
                value={editText} onChange={e => setEditText(e.target.value)} rows={3} autoFocus />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-xl border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-surface-2 transition-colors">Cancel</button>
                <button onClick={() => { onEdit?.(msg.id, editText); setEditing(false); }} className="rounded-xl bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:opacity-90 transition-opacity">Send</button>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-3xl bg-surface border border-border px-5 py-3.5 text-sm leading-7 text-foreground whitespace-pre-wrap">
                {msg.text}
              </div>
              <div className="mt-1.5 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditing(true)}
                  className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
                  Edit
                </button>
                <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // AI message — left-aligned, no bubble
  return (
    <div className="group mb-8">
      {/* AI label */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="relative grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
          <Leaf className="h-3.5 w-3.5 text-primary" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">AI Mitra</span>
        <span className="text-xs text-muted-foreground">{time}</span>
      </div>

      {/* Content */}
      <div className="pl-10">
        {msg.isLoading ? (
          msg.text ? (
            <>
              <Markdown text={msg.text} />
              <ThinkingDots />
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <ThinkingDots />
              {parseFloat(elapsed) > 3 && (
                <span className="font-mono text-xs text-muted-foreground/50">{elapsed}s</span>
              )}
            </div>
          )
        ) : (
          <Markdown text={msg.text} />
        )}

        {/* Action buttons — like Claude */}
        {!msg.isLoading && msg.role === "assistant" && (
          <div className="mt-4 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => { navigator.clipboard.writeText(msg.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={() => onRetry?.(msg.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </button>
            <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Disease Scanner ───────────────────────────────────────────────────────────
function DiseaseScanner({ token }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const zoneRef = useRef(null);

  const load = useCallback(f => {
    if (!f?.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    setFile(f); setResult(null); setError(null);
    const r = new FileReader();
    r.onload = e => setPreview(e.target.result);
    r.readAsDataURL(f);
  }, []);

  const onPaste = useCallback(e => {
    for (const item of e.clipboardData?.items || []) {
      if (item.type.startsWith("image/")) { load(item.getAsFile()); return; }
    }
  }, [load]);

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    el.addEventListener("paste", onPaste);
    return () => el.removeEventListener("paste", onPaste);
  }, [onPaste]);

  const analyze = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/disease/predict`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Analysis failed");
      setResult(data?.data ?? data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); };

  const isFallback = Boolean(
    result?.fallback ||
    !result?.disease ||
    result?.disease === "Unknown" ||
    (result?.disease === "Unknown" && result?.confidence === 0)
  );
  const severity = result && !isFallback ? (
    result.disease?.toLowerCase().includes("healthy") ? "healthy" :
    result.confidence > 0.85 ? "high" : result.confidence > 0.6 ? "medium" : "low"
  ) : null;

  const severityStyle = {
    healthy: "border-emerald-500/30 bg-emerald-500/8 text-emerald-400",
    high: "border-red-500/30 bg-red-500/8 text-red-400",
    medium: "border-amber-500/30 bg-amber-500/8 text-amber-400",
    low: "border-yellow-500/30 bg-yellow-500/8 text-yellow-400",
  };

  return (
    <div ref={zoneRef} tabIndex={0} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); load(e.dataTransfer.files[0]); }}
      className="flex h-full flex-col gap-6 overflow-y-auto p-6 outline-none max-w-2xl mx-auto w-full">

      <div>
        <h2 className="font-bold text-foreground text-lg">Crop Disease Scanner</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload a leaf photo to detect diseases using computer vision.</p>
      </div>

      <div onClick={() => !file && fileRef.current?.click()}
        className={`relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${dragging ? "border-[#d97757] bg-[#d97757]/5 scale-[1.01]" : file ? "border-border bg-surface cursor-default" : "border-border hover:border-foreground/30 hover:bg-surface"}`}>
        {preview ? (
          <div className="relative w-full">
            <img src={preview} alt="leaf" className="mx-auto max-h-[280px] rounded-xl object-contain p-3" />
            <button onClick={e => { e.stopPropagation(); reset(); }}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-12 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2 transition-all ${dragging ? "border-[#d97757] bg-[#d97757]/10 scale-110" : ""}`}>
              <ImagePlus className={`h-7 w-7 transition-colors ${dragging ? "text-[#d97757]" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Drag & drop a leaf photo</p>
              <p className="mt-1 text-sm text-muted-foreground">or click to browse · paste with <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs">⌘V</kbd></p>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => load(e.target.files[0])} />
      </div>

      {file && !result && (
        <button onClick={analyze} disabled={loading}
          className="flex items-center justify-center gap-2.5 rounded-2xl bg-foreground px-5 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-50">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</> : <><Microscope className="h-4 w-4" /> Analyze Disease</>}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/8 p-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {isFallback ? (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-400">Gemini API unavailable</p>
                  <p className="mt-1 text-sm text-foreground/70">{result?.error || "Could not connect to Gemini Vision API. Please check your API key or try again."}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl border p-5 ${severityStyle[severity]}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest opacity-60 mb-1">Detected</p>
                  <p className="text-xl font-bold">{result.disease}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest opacity-60 mb-1">Confidence</p>
                  <p className="text-3xl font-bold">{(result.confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-current/15">
                <div className="h-full rounded-full bg-current/60 transition-all" style={{ width: `${result.confidence * 100}%` }} />
              </div>
            </div>
          )}
          
          {result.treatment && !isFallback && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Treatment & Maintenance</p>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{result.treatment}</p>
            </div>
          )}

          {result.top3 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Predictions</p>
              <div className="space-y-3">
                {result.top3.map((p, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <span className="w-4 text-right text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <div className="mb-1.5 flex justify-between">
                        <span className="text-sm text-foreground">{p.label}</span>
                        <span className="font-mono text-sm text-muted-foreground">{(p.prob * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${p.prob * 100}%`, background: CHART_COLORS[i] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="w-full rounded-2xl border border-border py-3 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
            Scan Another Image
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function AiSaathiPage() {
  const { token, activeFarm, weatherSnapshot } = useAppData();
  const [tab, setTab] = useState("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const textRef = useRef(null);
  const sessionId = useRef("main-chat-session");
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [attachedImage, setAttachedImage] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setAttachedImage(event.target.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);


  const loadHistory = async (sid) => {
    if (!token || !sid) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/chat/${encodeURIComponent(sid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const history = await res.json();
      const normalized = (Array.isArray(history) ? history : []).map(m => ({
        id: String(m.id || m._id || `${Date.now()}-${Math.random()}`),
        role: m.role, text: m.text || m.content || "", isLoading: false,
      }));
      setMessages(normalized);
      sessionId.current = sid;
      setTab("chat");
    } catch (err) { console.error("Failed to load chat history", err); }
  };

  useEffect(() => {
    loadHistory("main-chat-session");
    const params = new URLSearchParams(window.location.search);
    const initialPrompt = params.get("prompt");
    if (initialPrompt) { send(initialPrompt); window.history.replaceState({}, document.title, window.location.pathname); }
  }, [token]);

  const send = async (text) => {
    const userMsg = { id: `${Date.now()}`, role: "user", text, imageBase64: attachedImage };
    const aiMsg = { id: `${Date.now() + 1}`, role: "assistant", text: "", isLoading: true };
    setMessages(p => [...p, userMsg, aiMsg]);
    setLoading(true);
    const payloadImage = attachedImage;
    setAttachedImage(null);
    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, sessionId: sessionId.current, farmId: activeFarm?._id || null, weatherSnapshot: weatherSnapshot || null, imageBase64: payloadImage }),
        signal: abortControllerRef.current.signal,
      });
      if (!res.ok) throw new Error("Failed to connect to AI assistant");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              setMessages(p => p.map(m => m.id === aiMsg.id ? { ...m, isLoading: false } : m));
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) { fullText = parsed.error; setMessages(p => p.map(m => m.id === aiMsg.id ? { ...m, text: fullText, isLoading: false } : m)); }
              else if (parsed.chunk) { fullText += parsed.chunk; setMessages(p => p.map(m => m.id === aiMsg.id ? { ...m, text: fullText } : m)); }
            } catch (e) {}
          }
        }
      }
      setMessages(p => p.map(m => m.id === aiMsg.id ? { ...m, isLoading: false } : m));
      emitAiSyncRefresh("chat");
    } catch (err) {
      if (err.name === "AbortError") {
        setMessages(p => p.map(m => m.id === aiMsg.id ? { ...m, isLoading: false } : m));
      } else {
        setMessages(p => p.map(m => m.id === aiMsg.id ? { ...m, text: err.message || "Connection error.", isLoading: false } : m));
      }
    } finally { setLoading(false); }
  };

  const handleInterrupt = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };
  const handleSend = () => {
    if (!input.trim() || loading) return;
    if (textRef.current) textRef.current.style.height = "24px";
    send(input); setInput("");
  };
  const handleEdit = (id, newText) => {
    const idx = messages.findIndex(m => m.id === id);
    setMessages(p => p.slice(0, idx));
    send(newText);
  };
  const handleRetry = (id) => {
    const idx = messages.findIndex(m => m.id === id);
    const prevUser = [...messages].slice(0, idx).reverse().find(m => m.role === "user");
    if (!prevUser) return;
    setMessages(p => p.slice(0, idx));
    send(prevUser.text);
  };
  const clear = () => { setMessages([]); };

  const isEmpty = messages.length === 0;

  return (
    <div
      className="flex overflow-hidden bg-background"
      style={{ height: "calc(100vh - 57px)", marginLeft: "-28px", marginRight: "-28px", marginTop: "-24px", marginBottom: "-24px" }}>
      
      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* ── Top bar ── */}
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-5 py-3">
          <div className="flex items-center gap-3">
            {/* Brand - Green logo as requested */}
            <div className="flex items-center gap-2.5">
              <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Leaf className="h-4 w-4 text-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
              <div className="leading-none hidden sm:block">
                <p className="text-sm font-semibold text-foreground">AI Mitra</p>
                <p className="text-[10px] text-muted-foreground">Llama 3.2 · KrishiMitra</p>
              </div>
            </div>

            {/* Tab switcher */}
            <div className="sm:ml-2 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
              <button onClick={() => setTab("chat")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${tab === "chat" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Sparkles className="h-3 w-3" /> Chat
              </button>
              <button onClick={() => setTab("disease")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${tab === "disease" ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Microscope className="h-3 w-3" /> Scan Leaf
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 md:hidden">
            <button onClick={clear}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        {tab === "disease" ? (
          <div className="flex-1 overflow-hidden">
            <DiseaseScanner token={token} />
          </div>
        ) : (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
              {isEmpty ? (
                /* ── Welcome / suggestions ── */
                <div className="flex h-full flex-col items-center justify-center px-4">
                  <div className="w-full max-w-2xl">
                    {/* Hero */}
                    <div className="mb-10 text-center">
                      <div className="mx-auto mb-5 relative grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30 shadow-sm">
                      <Leaf className="h-8 w-8 text-primary" />
                      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary pulse-dot" />
                    </div>
                      <h1 className="text-2xl font-bold text-foreground">How can I help your farm?</h1>
                      <p className="mt-2 text-sm text-muted-foreground">Ask anything about crops, soil, pests, budgets, weather, or schedules.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Message list ── */
                <div className="mx-auto w-full max-w-3xl px-4 py-8">
                  {messages.map(m => (
                    <Message key={m.id} msg={m} onEdit={handleEdit} onRetry={handleRetry} />
                  ))}
                  <div ref={endRef} className="h-4" />
                </div>
              )}
            </div>

            {/* ── Input bar — Claude-style ── */}
            <div className="shrink-0 px-4 pb-5 pt-3 bg-background">
              <div className="mx-auto max-w-3xl">
                <div className={`relative flex flex-col rounded-3xl border bg-surface transition-all ${loading ? "border-foreground/20" : "border-border focus-within:border-foreground/30 focus-within:shadow-sm"}`}>
                  <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                  {attachedImage && (
                    <div className="px-5 pt-5 pb-2">
                      <div className="relative inline-block">
                        <img src={attachedImage} alt="Attached" className="h-28 w-28 object-cover rounded-xl border-2 border-primary shadow-md" />
                        <button onClick={() => setAttachedImage(null)} className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center bg-foreground text-background rounded-full shadow-md hover:scale-105 transition-transform">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <textarea
                    ref={textRef}
                    value={input}
                    onChange={e => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                    }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Message AI Mitra..."
                    disabled={loading}
                    rows={1}
                    className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-sm text-foreground placeholder:text-muted-foreground outline-none leading-7 max-h-52 disabled:opacity-60"
                    style={{ height: "44px" }}
                  />

                  {/* Bottom bar */}
                  <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <div className="flex items-center gap-0.5">
                      {/* File upload hidden for now as per user request */}
                    </div>

                    <button
                      onClick={loading ? handleInterrupt : handleSend}
                      disabled={(!input.trim() && !attachedImage) && !loading}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                        loading
                          ? "bg-foreground text-background hover:opacity-85"
                          : (input.trim() || attachedImage)
                          ? "bg-foreground text-background hover:opacity-85"
                          : "bg-foreground/15 text-muted-foreground cursor-not-allowed"
                      }`}>
                      {loading ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <p className="mt-2.5 text-center text-[11px] text-muted-foreground/50">
                  AI Mitra may make mistakes. Verify important farming decisions with local experts.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
