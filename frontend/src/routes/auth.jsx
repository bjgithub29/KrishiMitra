import { Link, createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, 
  ArrowLeft,
  Lock, 
  Mail, 
  Phone, 
  UserRound, 
  ShieldCheck, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Loader2,
  KeyRound
} from "lucide-react";

import { BrandMark, ThemeToggle } from "@/components/app/AppShell";
import { useAppData } from "@/lib/AppDataContext";

export const Route = createFileRoute("/auth")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("krishimitra_token");
      if (token) {
        throw redirect({ to: "/dashboard" });
      }
    }
  },
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

const getApiUrl = () =>
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined"
    ? `http://${window.location.hostname}:5001/api`
    : "http://localhost:5001/api");

function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAppData();

  // State machine: 'email' -> 'otp' -> ('profile' | dashboard)
  // Secondary flows: 'password', 'forgot-password'
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isExisting, setIsExisting] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  // Profile fields (for new users)
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Secondary legacy password fields
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password fields
  const [forgotStep, setForgotStep] = useState("email");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputRef = useRef(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Focus OTP input when step becomes 'otp'
  useEffect(() => {
    if (step === "otp" && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const clearError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setApiError("");
  };

  const triggerOtpRequest = async (targetEmail, purpose) => {
    const API_URL = getApiUrl();
    const res = await fetch(`${API_URL}/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail, purpose }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) {
        const remaining = data.retryAfter || 60;
        setResendTimer(remaining);
        throw new Error(data.message || `Please wait ${remaining}s before requesting a new OTP.`);
      }
      throw new Error(data.message || "Failed to send verification code. Please check your email and try again.");
    }
    setResendTimer(60);
    return data;
  };

  // 1. Email step
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setFieldErrors({});

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFieldErrors({ email: "Email is required" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFieldErrors({ email: "Enter a valid email address" });
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const checkRes = await fetch(`${API_URL}/auth/check-exists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const checkData = await checkRes.json().catch(() => ({}));
      const userExists = Boolean(checkData.exists);
      setIsExisting(userExists);

      const purpose = userExists ? "login" : "register";
      await triggerOtpRequest(cleanEmail, purpose);

      setOtp("");
      setStep("otp");
    } catch (err) {
      setApiError(err.message || "Unable to reach the server. Please check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. OTP step
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setFieldErrors({});

    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setFieldErrors({ otp: "Please enter the 6-digit OTP" });
      return;
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      setFieldErrors({ otp: "OTP must be exactly 6 digits" });
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const purpose = isExisting ? "login" : "register";
      const res = await fetch(`${API_URL}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: cleanOtp,
          purpose,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Invalid or expired OTP. Please try again.");
      }

      if (data.token) {
        login(data.token);
        navigate({ to: "/dashboard" });
        return;
      }

      if (data.requiresRegistration || data.verificationToken) {
        setVerificationToken(data.verificationToken || "");
        setStep("profile");
        return;
      }

      throw new Error("Unexpected response from verification server.");
    } catch (err) {
      setApiError(err.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || isLoading) return;
    setApiError("");
    setIsLoading(true);
    try {
      const purpose = isExisting ? "login" : "register";
      await triggerOtpRequest(email.trim().toLowerCase(), purpose);
    } catch (err) {
      setApiError(err.message || "Failed to resend code.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Profile step
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setFieldErrors({});

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFieldErrors({ fullName: "Your name is required" });
      return;
    }
    if (trimmedName.length < 2) {
      setFieldErrors({ fullName: "Name must be at least 2 characters" });
      return;
    }

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      setFieldErrors({ phone: "Enter a valid 10-digit phone number or leave blank" });
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const nameParts = trimmedName.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      const payload = {
        email: email.trim().toLowerCase(),
        verificationToken,
        firstName,
        lastName,
        name: trimmedName,
        phone: trimmedPhone || undefined,
        role: "farmer",
      };

      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Account creation failed. Please try again.");
      }

      if (data.token) {
        login(data.token);
        navigate({ to: "/dashboard" });
      } else {
        throw new Error("Missing authentication token in registration response.");
      }
    } catch (err) {
      setApiError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Secondary password login
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setApiError("");
    setFieldErrors({});

    if (!password) {
      setFieldErrors({ password: "Password is required" });
      return;
    }

    setIsLoading(true);
    const API_URL = getApiUrl();

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid password. You can also sign in instantly using an OTP code.");
        }
        throw new Error(data.message || "Sign in failed.");
      }

      if (data.token) {
        login(data.token);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setApiError(err.message || "Sign in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Forgot password handlers
  const handleForgotRequestOtp = async (e) => {
    e.preventDefault();
    setApiError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFieldErrors({ email: "Email is required" });
      return;
    }
    setIsLoading(true);
    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to send reset code.");
      setForgotStep("otp");
    } catch (err) {
      setApiError(err.message || "Failed to send reset code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    setApiError("");
    if (!forgotOtp.trim() || !forgotNewPassword) {
      setApiError("Please enter both the reset OTP and your new password.");
      return;
    }
    if (forgotNewPassword.length < 8) {
      setApiError("New password must be at least 8 characters.");
      return;
    }
    setIsLoading(true);
    const API_URL = getApiUrl();
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");
      setForgotStep("success");
    } catch (err) {
      setApiError(err.message || "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  const getHeaderInfo = () => {
    if (step === "profile") {
      return {
        title: "Welcome to KrishiMitra",
        subtitle: "Let's complete your profile to personalize your experience.",
      };
    }
    if (step === "otp") {
      return isExisting
        ? {
            title: "Welcome back",
            subtitle: `We've sent a 6-digit OTP code to ${email}.`,
          }
        : {
            title: "Welcome to KrishiMitra",
            subtitle: `Let's create your account. We've sent a 6-digit OTP code to ${email}.`,
          };
    }
    if (step === "password") {
      return {
        title: "Welcome back",
        subtitle: "Enter your password to sign in to your dashboard.",
      };
    }
    if (step === "forgot-password") {
      return {
        title: "Reset password",
        subtitle: "Enter the code sent to your email and set a new password.",
      };
    }
    return {
      title: "Welcome back",
      subtitle: "Enter your email to continue to your smart farming dashboard.",
    };
  };

  const header = getHeaderInfo();

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2 overflow-x-hidden">
      {/* Left: Interactive Auth Form Column */}
      <div className="hero-ambient relative flex flex-col px-5 py-6 sm:px-10 min-h-screen overflow-y-auto">
        <div className="flex items-center justify-between w-full">
          <Link to="/" className="w-fit">
            <BrandMark />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            {step !== "email" && step !== "profile" && (
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setApiError("");
                  setFieldErrors({});
                }}
                className="mb-4 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to email
              </button>
            )}

            <div className="glass-strong rounded-3xl p-6 sm:p-8 shadow-xl border border-border/60">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {header.title}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground break-words">
                {header.subtitle}
              </p>

              {apiError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p className="leading-snug text-xs sm:text-sm">{apiError}</p>
                </div>
              )}

              {/* STEP: EMAIL ENTRY */}
              {step === "email" && (
                <form className="mt-6 space-y-4" onSubmit={handleEmailSubmit}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Email address
                    </label>
                    <div
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
                        fieldErrors.email
                          ? "border-destructive focus-within:border-destructive"
                          : "border-input focus-within:border-primary/50 focus-within:bg-background"
                      }`}
                    >
                      <Mail className={`h-4 w-4 shrink-0 ${fieldErrors.email ? "text-destructive" : "text-muted-foreground"}`} />
                      <input
                        type="email"
                        name="email"
                        autoFocus
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          clearError("email");
                        }}
                        placeholder="you@example.com"
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 mt-6 text-sm font-bold text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Checking account...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP: OTP VERIFICATION */}
              {step === "otp" && (
                <form className="mt-6 space-y-4" onSubmit={handleOtpSubmit}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Enter 6-Digit Code
                    </label>
                    <input
                      ref={otpInputRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setOtp(val);
                        clearError("otp");
                      }}
                      placeholder="••••••"
                      className={`w-full rounded-xl border bg-background/50 px-3.5 py-3.5 text-center font-mono text-xl font-bold tracking-[0.4em] text-foreground outline-none transition-all focus:ring-2 focus:ring-primary/20 ${
                        fieldErrors.otp
                          ? "border-destructive focus:border-destructive"
                          : "border-input focus:border-primary/50 focus:bg-background"
                      }`}
                    />
                    {fieldErrors.otp && (
                      <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {fieldErrors.otp}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      disabled={resendTimer > 0 || isLoading}
                      onClick={handleResendOtp}
                      className={`font-medium transition-colors ${
                        resendTimer > 0
                          ? "text-muted-foreground cursor-not-allowed"
                          : "text-primary hover:underline cursor-pointer"
                      }`}
                    >
                      {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setOtp("");
                        setApiError("");
                      }}
                      className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                    >
                      Change email
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otp.length !== 6}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 mt-6 text-sm font-bold text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                      </>
                    ) : (
                      <>
                        Verify OTP
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>

                  {isExisting && (
                    <div className="pt-3 text-center border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("password");
                          setPassword("");
                          setApiError("");
                          setFieldErrors({});
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Sign in with password instead
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* STEP: MINIMAL PROFILE SETUP (New Users) */}
              {step === "profile" && (
                <form className="mt-6 space-y-4" onSubmit={handleProfileSubmit}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Full Name <span className="text-primary">*</span>
                    </label>
                    <div
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
                        fieldErrors.fullName
                          ? "border-destructive focus-within:border-destructive"
                          : "border-input focus-within:border-primary/50 focus-within:bg-background"
                      }`}
                    >
                      <UserRound className={`h-4 w-4 shrink-0 ${fieldErrors.fullName ? "text-destructive" : "text-muted-foreground"}`} />
                      <input
                        type="text"
                        name="fullName"
                        autoFocus
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          clearError("fullName");
                        }}
                        placeholder="e.g. Ramesh Patil"
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {fieldErrors.fullName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Mobile Number <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <div
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
                        fieldErrors.phone
                          ? "border-destructive focus-within:border-destructive"
                          : "border-input focus-within:border-primary/50 focus-within:bg-background"
                      }`}
                    >
                      <Phone className={`h-4 w-4 shrink-0 ${fieldErrors.phone ? "text-destructive" : "text-muted-foreground"}`} />
                      <input
                        type="tel"
                        name="phone"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/\D/g, "");
                          setPhone(clean);
                          clearError("phone");
                        }}
                        placeholder="e.g. 9876543210"
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                    {fieldErrors.phone && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {fieldErrors.phone}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 mt-6 text-sm font-bold text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP: SECONDARY PASSWORD LOGIN */}
              {step === "password" && (
                <form className="mt-6 space-y-4" onSubmit={handlePasswordSubmit}>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                      Password
                    </label>
                    <div
                      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all bg-background/50 focus-within:ring-2 focus-within:ring-primary/20 ${
                        fieldErrors.password
                          ? "border-destructive focus-within:border-destructive"
                          : "border-input focus-within:border-primary/50 focus-within:bg-background"
                      }`}
                    >
                      <Lock className={`h-4 w-4 shrink-0 ${fieldErrors.password ? "text-destructive" : "text-muted-foreground"}`} />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoFocus
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearError("password");
                        }}
                        placeholder="••••••••"
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("otp");
                        setApiError("");
                      }}
                      className="text-primary hover:underline cursor-pointer"
                    >
                      Sign in with OTP code instead
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("forgot-password");
                        setForgotStep("email");
                        setApiError("");
                      }}
                      className="text-muted-foreground hover:text-primary hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 mt-6 text-sm font-bold text-primary-foreground shadow-[0_0_28px_-8px_var(--color-primary)] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP: FORGOT PASSWORD */}
              {step === "forgot-password" && (
                <div className="mt-6 space-y-4">
                  {forgotStep === "success" ? (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 text-primary font-semibold mb-1">
                        <CheckCircle2 className="h-4 w-4" /> Password reset successful
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Your password has been updated. You can now sign in.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("email");
                          setForgotStep("email");
                        }}
                        className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 cursor-pointer"
                      >
                        Return to Login
                      </button>
                    </div>
                  ) : forgotStep === "otp" ? (
                    <form onSubmit={handleForgotResetPassword} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-foreground">
                          6-Digit Reset Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          autoFocus
                          value={forgotOtp}
                          onChange={(e) => setForgotOtp(e.target.value)}
                          placeholder="123456"
                          className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-foreground">
                          New Password (min 8 chars)
                        </label>
                        <input
                          type="password"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 cursor-pointer disabled:opacity-60"
                      >
                        {isLoading ? "Updating..." : "Reset Password"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleForgotRequestOtp} className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-foreground">
                          Email address for recovery
                        </label>
                        <input
                          type="email"
                          autoFocus
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-xl border border-input bg-background/50 px-3.5 py-3 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setStep("email")}
                          className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary/20 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-60"
                        >
                          {isLoading ? "Sending..." : "Send Reset Code"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Visual Brand Hero Column */}
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
