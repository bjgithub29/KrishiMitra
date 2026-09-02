import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf, MapPin, Pencil, Save, Scale, Wind, Lock, LogOut, ShieldCheck, User } from "lucide-react";
import { useAppData } from "@/lib/AppDataContext";
import { PageHeader } from "@/components/app/AppShell";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Settings & Profile — KrishiMitra" },
      {
        name: "description",
        content: "Manage your personal details, security, and farming preferences.",
      },
    ],
  }),
  component: ProfileSettingsPage,
});

const modes = [
  {
    id: "organic",
    icon: Leaf,
    label: "Organic",
    desc: "Bio-inputs only. Plans avoid synthetic fertilizers and pesticides entirely.",
  },
  {
    id: "moderate",
    icon: Scale,
    label: "Moderate",
    desc: "Balanced approach. Organic-first with targeted synthetic inputs when needed.",
  },
  {
    id: "flexible",
    icon: Wind,
    label: "Flexible",
    desc: "Yield-optimized. AI freely recommends the most effective available inputs.",
  },
];

function ProfileSettingsPage() {
  const { userProfile, farms, token, fetchDashboardData, logout } = useAppData();
  
  // Profile Edit State
  const [mode, setMode] = useState(userProfile?.farmingMode || "moderate");
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: userProfile?.name?.split(" ")[0] || "",
    lastName: userProfile?.name?.split(" ").slice(1).join(" ") || "",
  });

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const initials = userProfile?.name
    ? userProfile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          farmingMode: mode,
        }),
      });
      if (res.ok) {
        setIsEditing(false);
        fetchDashboardData();
        toast.success("Profile updated successfully");
      } else {
        toast.error("Could not save profile changes.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while saving profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api")}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Password changed successfully!");
        setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        toast.error(data.message || "Failed to change password.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Settings & Profile"
        subtitle="Manage your identity, security, and farming preferences."
      />

      {/* Account Info Section */}
      <section className="glass rounded-3xl p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Account Information</h2>
        </div>
        
        <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:flex sm:gap-6">
          <div
            className="glow-emerald grid h-18 w-18 shrink-0 place-items-center rounded-2xl bg-primary/15 font-display text-2xl font-bold text-primary ring-1 ring-primary/30"
            style={{ height: "4.5rem", width: "4.5rem" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <form id="profile-form" onSubmit={handleSaveProfile} className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
                <input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  placeholder="First name"
                  className="rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  required
                />
                <input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  placeholder="Last name"
                  className="rounded-xl border border-input bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary/50"
                  required
                />
              </form>
            ) : (
              <h3 className="truncate font-display text-xl font-bold">{userProfile?.name || "Farmer"}</h3>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{userProfile?.email || "No email"}</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {farms[0]?.location?.address || "Location not set"}
              </span>
            </div>
            {!isEditing && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-primary/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary ring-1 ring-primary/25">
                  {mode} mode
                </span>
                <span className="rounded-full bg-cyan/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan ring-1 ring-cyan/25">
                  {farms.length} {farms.length === 1 ? "farm" : "farms"}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            {isEditing ? (
              <>
                <button type="button" onClick={() => setIsEditing(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/50">
                  Cancel
                </button>
                <button form="profile-form" type="submit" disabled={isSavingProfile} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  <Save className="h-4 w-4" /> {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/30 px-4 py-2 text-sm font-semibold transition-colors hover:border-primary/30 hover:bg-secondary/60"
              >
                <Pencil className="h-4 w-4" /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Farming Preference Mode */}
        {isEditing && (
          <div className="mt-8 pt-6 border-t border-border">
            <h4 className="mb-4 font-display text-sm font-semibold text-foreground">
              Select Farming Preference Mode
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {modes.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-2xl border p-5 text-left transition-all ${
                    mode === m.id
                      ? "border-primary/45 bg-primary/8 glow-emerald"
                      : "glass hover:border-primary/25"
                  }`}
                >
                  <m.icon
                    className={`h-5 w-5 ${mode === m.id ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div
                    className={`mt-3 font-display text-sm font-semibold ${mode === m.id ? "text-primary" : ""}`}
                  >
                    {m.label}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Security Section */}
        <section className="glass rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Security</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={passwordForm.oldPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-secondary/40 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-secondary/40 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-secondary/40 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/50"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              {isChangingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* Danger Zone Section */}
        <section className="glass rounded-3xl p-6 sm:p-8 border border-destructive/20 bg-destructive/5">
          <div className="mb-6 flex items-center gap-2">
            <LogOut className="h-5 w-5 text-destructive" />
            <h2 className="font-display text-lg font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="mb-6 text-sm text-muted-foreground">
            Sign out of your KrishiMitra account on this device. You will need to log back in to access your farm data.
          </p>
          <button
            onClick={logout}
            className="w-full rounded-xl border border-destructive bg-destructive/10 px-5 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
          >
            Log Out Securely
          </button>
        </section>
      </div>
    </div>
  );
}

