import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, TrendingUp, Wallet, AlertCircle } from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { PageHeader } from "@/components/app/AppShell";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/expenses")({
  head: () => ({
    meta: [
      { title: "Expense Tracker — KrishiMitra" },
      {
        name: "description",
        content: "Track farm expenses by category with cost summaries and break-even insights.",
      },
    ],
  }),
  component: ExpensesPage,
});

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function ExpensesPage() {
  const { activeFarmId, token, fetchScoped, postScoped } = useAppData();
  const [expenses, setExpenses] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseErrors, setExpenseErrors] = useState({});
  const [formData, setFormData] = useState({
    label: "",
    category: "seeds",
    amountRs: "",
  });

  const fetchExpenses = useCallback(async () => {
    if (!token) return;
    try {
      const url = activeFarmId ? `/expenses?farm=${activeFarmId}` : `/expenses`;
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}${url}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeFarmId, token]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Inline validation
    const newErrors = {};
    if (!formData.label.trim()) newErrors.label = "Description is required";
    if (!formData.amountRs) newErrors.amountRs = "Amount is required";
    else if (Number(formData.amountRs) <= 0) newErrors.amountRs = "Amount must be greater than 0";
    if (Object.keys(newErrors).length > 0) { setExpenseErrors(newErrors); return; }
    setExpenseErrors({});
    setIsSubmitting(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
      const res = await fetch(`${API_URL}/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          label: formData.label,
          category: formData.category,
          amountRs: Number(formData.amountRs),
          ...(activeFarmId ? { farm: activeFarmId } : {})
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data && (data._id || data.id)) {
          setFormData({ label: "", category: "seeds", amountRs: "" });
          fetchExpenses();
          toast.success("Expense recorded");
        } else {
          toast.error("Failed to add expense");
        }
      } else {
        toast.error("Failed to add expense");
      }
    } catch (err) {
      toast.error("Error adding expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  const expenseByCategory = useMemo(() => {
    const cats = {};
    expenses.forEach((x) => {
      const cat = x.category || "other";
      cats[cat] = (cats[cat] || 0) + (x.amountRs || x.amount || 0);
    });
    return Object.entries(cats).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [expenses]);

  const total = expenseByCategory.reduce((s, c) => s + c.value, 0);
  const breakEven = 42300;
  const expectedRevenue = 74800;

  return (
    <div>
      <PageHeader
        title="Expense Tracker"
        subtitle={`Kharif 2026 · ${activeFarmId ? "Active Farm" : "All Farms"} · ₹${total.toLocaleString("en-IN")} spent so far`}
      />

      {/* Insight cards */}
      <section className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="glass hover-lift rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-primary" /> Season spend
          </div>
          <div className="mt-2 font-display text-2xl font-bold">
            ₹{total.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {breakEven > 0 ? Math.round((total / breakEven) * 100) : 0}% of planned budget
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-cyan"
              style={{ width: `${Math.min((total / breakEven) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div className="glass hover-lift flex flex-col justify-center rounded-2xl p-5 lg:col-span-2">
          <form onSubmit={handleSubmit}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Quick add expense
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_120px_auto]">
              <div>
                <input
                  value={formData.label}
                  onChange={(e) => { setFormData({ ...formData, label: e.target.value }); if (expenseErrors.label) setExpenseErrors(p => ({...p, label: ""})); }}
                  placeholder="What did you spend on?"
                  className={`w-full rounded-lg border bg-secondary/40 px-3 py-2 text-xs outline-none focus:border-primary/50 ${expenseErrors.label ? "border-destructive" : "border-input"}`}
                />
                {expenseErrors.label && <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" />{expenseErrors.label}</p>}
              </div>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="rounded-lg border border-input bg-secondary/40 px-3 py-2 text-xs outline-none focus:border-primary/50"
              >
                <option value="seeds">Seeds</option>
                <option value="fertilizer">Fertilizer</option>
                <option value="pesticide">Pesticide</option>
                <option value="labor">Labor</option>
                <option value="irrigation">Irrigation</option>
                <option value="equipment">Equipment</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </select>
              <div>
                <input
                  type="number"
                  value={formData.amountRs}
                  onChange={(e) => { setFormData({ ...formData, amountRs: e.target.value }); if (expenseErrors.amountRs) setExpenseErrors(p => ({...p, amountRs: ""})); }}
                  placeholder="₹ Amount"
                  className={`w-full rounded-lg border bg-secondary/40 px-3 py-2 text-xs outline-none focus:border-primary/50 ${expenseErrors.amountRs ? "border-destructive" : "border-input"}`}
                />
                {expenseErrors.amountRs && <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive"><AlertCircle className="h-3 w-3" />{expenseErrors.amountRs}</p>}
              </div>
              <button
                disabled={isSubmitting}
                type="submit"
                className="flex items-center justify-center gap-1 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                <Plus className="h-4 w-4" /> {isSubmitting ? "..." : "Add"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Category breakdown */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-display text-sm font-semibold">Category breakdown</h2>
          {expenseByCategory.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">No data yet</div>
          ) : (
            <div className="mx-auto h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={75}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--color-popover-foreground)",
                    }}
                    itemStyle={{ color: "var(--color-popover-foreground)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-2">
            {expenseByCategory.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2.5 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.name}</span>
                <span className="font-semibold">₹{c.value.toLocaleString("en-IN")}</span>
                <span className="w-10 text-right text-[10px] text-muted-foreground">
                  {total > 0 ? Math.round((c.value / total) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Expense log + quick add */}
        <section className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Recent expenses</h2>
            <span className="text-[11px] text-muted-foreground">{expenses.length} records</span>
          </div>
          <div className="space-y-2">
            {expenses.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-border py-8 text-xs text-muted-foreground">
                No expenses recorded yet. Use the quick-add form below!
              </div>
            ) : (
              expenses.map((x) => {
                const d = new Date(x.date || x.createdAt || Date.now());
                return (
                  <div
                    key={x._id || x.id}
                    className="ring-glow grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 sm:flex"
                  >
                    <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-center text-[10px] font-bold text-muted-foreground">
                        {d.getDate()}<br />{d.toLocaleString("default", { month: "short" })}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{x.label}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {d.toLocaleDateString()} · {x.category}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-display text-sm font-bold">
                        ₹{(x.amountRs || x.amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>


        </section>
      </div>
    </div>
  );
}
