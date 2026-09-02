import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Lock, Mail, Phone, UserRound, ShieldCheck, BarChart3, MapPin, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

import { BrandMark, ThemeToggle } from "@/components/app/AppShell";
import { useAppData } from "@/lib/AppDataContext";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — KrishiMitra" },
      {
        name: "description",
        content: "Sign in or create your KrishiMitra account to start AI-powered farm planning.",
      },
    ],
  }),
  component: AuthPage,
});

// --- Validators ---
const validators = {
  firstName: (v) => (!v.trim() ? "First name is required" : v.trim().length < 2 ? "Must be at least 2 characters" : ""),
  lastName: (v) => (!v.trim() ? "Last name is required" : ""),
  email: (v) => (!v.trim() ? "Email is required" : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Enter a valid email address" : ""),
  phone: (v) => (!v || !/^\d{10}$/.test(v) ? "Enter a valid 10-digit phone number" : ""),
  password: (v) => {
    if (!v) return "Password is required";
    if (v.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(v)) return "Include at least one uppercase letter";
    if (!/[0-9]/.test(v)) return "Include at least one number";
    return "";
  },
  location: (v) => (!v.trim() ? "Please enter or detect your farm location" : ""),
};

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors = ["", "bg-destructive", "bg-warning", "bg-warning", "bg-primary", "bg-primary"];
  return { score, label: labels[score] || "", color: colors[score] || "" };
}

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const { login } = useAppData();

  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordStep, setForgotPasswordStep] = useState("email"); // email -> otp -> success
  const [forgotPasswordOTP, setForgotPasswordOTP] = useState("");
  const [forgotPasswordNew, setForgotPasswordNew] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [registerOtp, setRegisterOtp] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const [otpLoginStep, setOtpLoginStep] = useState("email");
  const [otpLoginEmail, setOtpLoginEmail] = useState("");
  const [otpLoginCode, setOtpLoginCode] = useState("");

  const [isLocating, setIsLocating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    role: "farmer",
    email: "",
    password: "",
    location: "",
    waterResources: [],
  });

  const clearFieldError = (name) =>
    setErrors((prev) => {
      const n = { ...prev };
      delete n[name];
      return n;
    });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) clearFieldError(name);
    setApiError("");
  };

  const validateStep1 = () => {
    const newErrors = {};
    ["firstName", "lastName", "email", "password"].forEach((f) => {
      const msg = validators[f]?.(formData[f]);
      if (msg) newErrors[f] = msg;
    });
    if (formData.phone) {
      const pMsg = validators.phone(formData.phone);
      if (pMsg) newErrors.phone = pMsg;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const msg = validators.location(formData.location);
    if (msg) {
      setErrors((prev) => ({ ...prev, location: msg }));
      return false;
    }
    clearFieldError("location");
    return true;
  };

  const validateLogin = () => {
    const newErrors = {};
    const emailMsg = validators.email(formData.email);
    if (emailMsg) newErrors.email = emailMsg;
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrors((prev) => ({ ...prev, location: "Geolocation is not supported by your browser" }));
      return;
    }
    setIsLocating(true);
    clearFieldError("location");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || "";
            const state = data.address.state || "";
            setFormData((prev) => ({ ...prev, location: [city, state].filter(Boolean).join(", ") }));
            clearFieldError("location");
          }
        } catch {
          setErrors((prev) => ({ ...prev, location: "Failed to fetch location. Please enter manually." }));
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        setErrors((prev) => ({ ...prev, location: "Location access denied. Please enter manually." }));
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    const API_URL =
      import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined"
        ? `http://${window.location.hostname}:5001/api`
        : "http://localhost:5001/api");

    if (mode === "login") {
      if (!validateLogin()) return;
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, password: formData.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Login failed");
        login(data.token);
        navigate({ to: "/dashboard" });
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }

    if (step === 1) {
      if (!validateStep1()) return;
      try {
        const res = await fetch(`${API_URL}/auth/check-exists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email, phone: formData.phone }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.field) {
            setErrors(prev => ({ ...prev, [data.field]: data.message }));
          } else {
            setApiError(data.message || "An account with this email/phone already exists.");
          }
          return;
        }
        // If email doesn't exist, request OTP immediately
        const otpRes = await fetch(`${API_URL}/auth/otp/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formData.email }),
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) throw new Error(otpData.message || "Failed to send OTP");
        
        setStep(2);
      } catch (err) {
        console.error("Auth check failed:", err);
        setApiError("Error: " + err.message);
      }
      return;
    }

    // Step 2 -> Verify OTP & Register User
    if (step === 2) {
      if (!registerOtp) {
        setApiError("Please enter the 6-digit OTP.");
        return;
      }
      try {
        const payload = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || Math.random().toString().slice(2, 12),
          email: formData.email,
          password: formData.password,
          role: formData.role,
          // Default location for now, will be updated in Step 3
          location: "Not set",
          waterResources: ["Borewell"],
          otp: registerOtp,
        };

        const res = await fetch(`${API_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Registration failed");

        // Log the user in
        login(data.token);
        
        // Move to location setup
        setStep(3);
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }

    // Step 3 -> Location & Profile Setup
    if (step === 3) {
      if (!validateStep2()) return;
      try {
        const res = await fetch(`${API_URL}/auth/profile`, {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("krishimitra_token")}` 
          },
          body: JSON.stringify({
            location: formData.location || "Not set",
            // Assuming water resources are managed via Farm object later, 
            // but we can pass it if backend accepts it or handle it separately.
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to update profile");
        
        navigate({ to: "/dashboard" });
      } catch (err) {
        setApiError(err.message);
      }
      return;
    }
  };

  const handleOtpLoginRequest = async () => {
    setApiError("");
    if (!otpLoginEmail) {
      setApiError("Email is required");
      return;
    }
    const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
    try {
      const res = await fetch(`${API_URL}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpLoginEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP");
      setOtpLoginStep("verify");
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleOtpLoginVerify = async () => {
    setApiError("");
    if (!otpLoginCode) {
      setApiError("OTP is required");
      return;
    }
    const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
    try {
      const res = await fetch(`${API_URL}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpLoginEmail, otp: otpLoginCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP");
      login(data.token);
      navigate({ to: "/farms" });
    } catch (err) {
      setApiError(err.message);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotPasswordEmail.trim()) { setForgotError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotPasswordEmail)) { setForgotError("Enter a valid email address"); return; }
    const API_URL =
      import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined"
        ? `http://${window.location.hostname}:5001/api`
        : "http://localhost:5001/api");
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForgotPasswordStep("otp");
    } catch (err) {
      setForgotError(err.message);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotPasswordOTP.trim() || !forgotPasswordNew.trim()) { setForgotError("Please fill all fields"); return; }
    
    const API_URL =
      import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined"
        ? `http://${window.location.hostname}:5001/api`
        : "http://localhost:5001/api");
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail, otp: forgotPasswordOTP, newPassword: forgotPasswordNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setForgotPasswordStep("success");
    } catch (err) {
      setForgotError(err.message);
    }
  };

  const pwStrength = getPasswordStrength(formData.password);

  const renderStep = () => {
    if (mode === "forgot-password") {
      return (
        <>
          <div className="mb-4">
            <h2 className="text-xl font-bold">Reset Password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
          {forgotPasswordStep === "success" ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
              <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                <CheckCircle2 className="h-4 w-4" /> Password Reset Successful
              </div>
              <p className="text-xs text-muted-foreground">You can now login with your new password.</p>
              <button
                type="button"
                onClick={() => { setMode("login"); setForgotPasswordStep("email"); }}
                className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
              >
                Return to Login
              </button>
            </div>
          ) : forgotPasswordStep === "otp" ? (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              {forgotError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p>{forgotError}</p>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={forgotPasswordOTP}
                  onChange={(e) => { setForgotPasswordOTP(e.target.value); setForgotError(""); }}
                  placeholder="123456"
                  className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">New Password</label>
                <input
                  type="password"
                  value={forgotPasswordNew}
                  onChange={(e) => { setForgotPasswordNew(e.target.value); setForgotError(""); }}
                  placeholder="Enter new password"
                  className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
              >
                Reset Password
              </button>
            </form>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Email address</label>
                <div
                  className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
                    forgotError ? "border-destructive" : "border-input focus-within:border-primary/50"
                  }`}
                >
                  <Mail className={`h-4 w-4 shrink-0 ${forgotError ? "text-destructive" : "text-muted-foreground"}`} />
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => { setForgotPasswordEmail(e.target.value); setForgotError(""); }}
                    placeholder="you@example.com"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                {forgotError && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {forgotError}
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => setMode("login")} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary/20">Back</button>
                <button type="button" onClick={handleForgotPasswordSubmit} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">Send OTP</button>
              </div>
            </>
          )}
        </>
      );
    }

    if (mode === "otp-login") {
      return (
        <div className="space-y-4">
          {otpLoginStep === "email" ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Email address</label>
                <input
                  type="email"
                  value={otpLoginEmail}
                  onChange={(e) => { setOtpLoginEmail(e.target.value); setApiError(""); }}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => setMode("login")} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary/20">Back</button>
                <button type="button" onClick={handleOtpLoginRequest} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">Send OTP</button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpLoginCode}
                  onChange={(e) => { setOtpLoginCode(e.target.value); setApiError(""); }}
                  placeholder="123456"
                  className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none tracking-widest focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => setOtpLoginStep("email")} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary/20">Back</button>
                <button type="button" onClick={handleOtpLoginVerify} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">Verify & Sign In</button>
              </div>
            </>
          )}
        </div>
      );
    }

    if (mode === "login") {
      return (
        <>
          <Field icon={Mail} label="Email address" name="email" placeholder="you@example.com" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} />
          <PasswordField label="Password" name="password" value={formData.password} onChange={handleInputChange} error={errors.password} show={showPassword} onToggleShow={() => setShowPassword((p) => !p)} />
          <div className="text-right">
            <button type="button" onClick={() => setMode("forgot-password")} className="text-xs font-medium text-primary hover:underline">
              Forgot your password?
            </button>
          </div>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field icon={UserRound} label="First name" name="firstName" placeholder="Ramesh" type="text" value={formData.firstName} onChange={handleInputChange} error={errors.firstName} />
            <Field icon={UserRound} label="Last name" name="lastName" placeholder="Patil" type="text" value={formData.lastName} onChange={handleInputChange} error={errors.lastName} />
          </div>
          <Field icon={Phone} label="Mobile number (optional)" name="phone" placeholder="+91 98765 43210" type="tel" value={formData.phone} onChange={handleInputChange} error={errors.phone} />
          <Field icon={Mail} label="Email address" name="email" placeholder="you@example.com" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} />
          <PasswordField label="Password" name="password" value={formData.password} onChange={handleInputChange} error={errors.password} show={showPassword} onToggleShow={() => setShowPassword((p) => !p)} />
          {formData.password && !errors.password && (
            <div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all ${i <= pwStrength.score ? pwStrength.color : "bg-secondary"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Password strength: {pwStrength.label}</p>
            </div>
          )}
        </>
      );
    }

    if (step === 2) {
      return (
        <div className="animate-fade-up space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <Mail className="h-4 w-4" /> Verify your email
            </div>
            <p className="text-xs text-muted-foreground">
              We've sent a 6-digit code to <strong>{formData.email}</strong>.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Enter OTP</label>
            <input
              type="text"
              maxLength={6}
              value={registerOtp}
              onChange={(e) => { setRegisterOtp(e.target.value); setApiError(""); }}
              placeholder="123456"
              className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none tracking-widest text-center focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="text-center mt-2">
            <button
              type="button"
              onClick={async () => {
                if (resendTimer > 0) return;
                try {
                  const API_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" ? `http://${window.location.hostname}:5001/api` : "http://localhost:5001/api");
                  const res = await fetch(`${API_URL}/auth/otp/request`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: formData.email }),
                  });
                  if (res.ok) {
                    setResendTimer(60);
                    const timer = setInterval(() => {
                      setResendTimer((prev) => {
                        if (prev <= 1) { clearInterval(timer); return 0; }
                        return prev - 1;
                      });
                    }, 1000);
                  }
                } catch (e) {}
              }}
              className={`text-xs font-medium ${resendTimer > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline"}`}
            >
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
            </button>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="animate-fade-up space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4">
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <MapPin className="h-4 w-4" /> Farm Location
            </div>
            <p className="text-xs text-muted-foreground">
              Providing your location allows KrishiMitra to fetch hyper-local weather predictions and precise soil data for your farm.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              {isLocating ? "Locating..." : "Use my current location"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">Or enter manually</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">City or Region</label>
              <div
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
                  errors.location ? "border-destructive focus-within:border-destructive" : "border-input focus-within:border-primary/50 focus-within:bg-background"
                }`}
              >
                <MapPin className={`h-4 w-4 shrink-0 ${errors.location ? "text-destructive" : "text-muted-foreground"}`} />
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g. Pune, Maharashtra"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
                {formData.location && !errors.location && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                {errors.location && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
              </div>
              {errors.location && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3" /> {errors.location}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  return (
      <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Left: form */}
      <div className="hero-ambient relative flex flex-col px-5 py-6 sm:px-10 h-[100dvh] overflow-y-auto">
        <div className="flex items-center justify-between w-full">
          <Link to="/" className="w-fit">
            <BrandMark />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            {mode === "register" && step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="mb-4 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                &larr; Back
              </button>
            )}

            <div className="glass-strong rounded-3xl p-7 sm:p-8">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {mode === "login" ? "Welcome back" : step === 1 ? "Create your account" : "Set Farm Location"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {mode === "login"
                  ? "Sign in to your farm intelligence dashboard."
                  : step === 1
                  ? "Start smart planning for your farm in minutes."
                  : "Where is your farm located?"}
              </p>

              {/* Mode switch */}
              {mode === "login" || step === 1 ? (
                <div className="mt-6 grid grid-cols-2 rounded-xl border border-border bg-secondary/40 p-1 text-sm font-medium">
                  {["login", "register"].map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setStep(1); setErrors({}); setApiError(""); }}
                      className={`rounded-lg py-2 transition-all ${
                        mode === m
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "login" ? "Sign in" : "Register"}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex items-center gap-2 mb-2">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`h-1.5 rounded-full flex-1 transition-all ${step >= s ? "bg-primary" : "bg-primary/20"}`} />
                  ))}
                </div>
              )}

              {/* API error banner */}
              {apiError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {apiError}
                </div>
              )}

              {mode !== "forgot-password" && mode !== "otp-login" && (
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  {renderStep()}
                  <button
                    type="submit"
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 mt-6 text-sm font-bold text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)] transition-transform hover:scale-[1.02]"
                  >
                    {mode === "login" ? "Sign in to dashboard" : step === 1 ? "Continue" : step === 2 ? "Verify OTP" : "Complete Setup"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </form>
              )}
              {(mode === "forgot-password" || mode === "otp-login") && (
                <div className="mt-6 space-y-4">{renderStep()}</div>
              )}

              {(mode === "login" || step === 1) && (
                <>
                  <div className="relative mt-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => { setMode("otp-login"); setOtpLoginStep("email"); setErrors({}); setApiError(""); }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                    >
                      <Mail className="h-4 w-4" />
                      Continue with OTP
                    </button>
                  </div>
                </>
              )}

              {mode === "login" && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Don't have an account?{" "}
                  <button className="font-semibold text-primary hover:underline" onClick={() => { setMode("register"); setErrors({}); setApiError(""); }}>
                    Create one free
                  </button>
                </p>
              )}
              {mode === "register" && step === 1 && (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button className="font-semibold text-primary hover:underline" onClick={() => { setMode("login"); setErrors({}); setApiError(""); }}>
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: visual */}
      <div className="relative hidden overflow-hidden border-l border-border lg:block bg-muted">
        <img
          src="/auth-farm.png"
          alt="Aerial view of precision agriculture fields with data overlays"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        <div className="absolute top-12 right-12 hidden xl:block">
          <div className="glass float-slow w-fit rounded-2xl px-5 py-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Projected Yield</div>
                <div className="mt-0.5 text-lg font-bold text-foreground">
                  14,250 <span className="text-sm font-normal text-muted-foreground">kg/ha</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 left-12 right-12 flex flex-col items-start gap-10">
          <div className="glass-strong float-slow-delayed w-fit rounded-2xl px-5 py-4 shadow-xl border-t border-primary/20">
            <div className="flex items-center gap-2.5 mb-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div className="text-[10px] uppercase tracking-widest text-primary font-bold">Smart Advisory Active</div>
            </div>
            <div className="text-sm font-semibold text-foreground">Optimal irrigation window</div>
            <div className="text-xs text-muted-foreground mt-0.5">6:00 AM - 9:00 AM Tomorrow</div>
          </div>

          <div>
            <h2 className="max-w-xl font-display text-4xl font-bold leading-tight tracking-tight text-foreground">
              Your farm's data, <br /> working <span className="text-primary italic pr-2">for you.</span>
            </h2>
            <p className="mt-3 max-w-md text-base text-muted-foreground">
              Soil, weather, equipment, and market intelligence — beautifully unified into one proactive plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable text/email/tel field with error state
function Field({ icon: Icon, label, name, value, onChange, placeholder, type, error }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
          error
            ? "border-destructive focus-within:border-destructive"
            : "border-input focus-within:border-primary/50 focus-within:bg-background"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${error ? "text-destructive" : "text-muted-foreground"}`} />
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {error && <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />}
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

// Password field with show/hide toggle
function PasswordField({ label, name, value, onChange, error, show, onToggleShow }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label>
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
          error
            ? "border-destructive focus-within:border-destructive"
            : "border-input focus-within:border-primary/50 focus-within:bg-background"
        }`}
      >
        <Lock className={`h-4 w-4 shrink-0 ${error ? "text-destructive" : "text-muted-foreground"}`} />
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder="••••••••"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button type="button" onClick={onToggleShow} className="shrink-0 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
