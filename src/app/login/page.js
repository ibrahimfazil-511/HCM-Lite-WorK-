"use client";

import { useEffect, useState } from "react";
import { IconArrowRight } from "../../components/ui/icons.js";
import { safeResponseJson } from "../../lib/api.js";
import { setClientSession } from "../../lib/client-auth.js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [redirectTarget, setRedirectTarget] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const target = searchParams.get("redirect");
        if (target) setRedirectTarget(target);
      } catch {}
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const targetRole = redirectTarget === "/hr" ? "HR" : redirectTarget === "/dashboard" ? "ADMIN" : undefined;
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          portal: redirectTarget,
          role: targetRole,
        }),
      });
      const result = await safeResponseJson(response, {});
      if (!response.ok) {
        if (result.code === "MUST_CHANGE_PASSWORD") {
          setMustChange(true);
          setError("This is a temporary password. Please create your personal password to continue.");
        } else {
          setError(result.error || "Invalid email or password.");
        }
        return;
      }

      setClientSession(result.token, result.user);

      // Honor redirect target if role is authorized
      if (redirectTarget) {
        if (redirectTarget === "/hr" && result.user.role === "HR") {
          window.location.assign("/hr");
          return;
        }
        if (redirectTarget === "/employee" && result.user.role === "EMPLOYEE") {
          window.location.assign("/employee");
          return;
        }
        if (redirectTarget === "/dashboard" && result.user.role === "ADMIN") {
          window.location.assign("/dashboard");
          return;
        }
      }

      // Seamless redirection based on role
      if (result.user.role === "EMPLOYEE") {
        window.location.assign("/employee");
      } else if (result.user.role === "HR") {
        window.location.assign("/hr");
      } else {
        window.location.assign("/dashboard");
      }
    } catch {
      setError("Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), currentPassword: password, newPassword }),
      });
      const result = await safeResponseJson(response, {});
      if (!response.ok) throw new Error(result.error || "Unable to update password.");

      setClientSession(result.token, result.user);
      if (result.user.role === "EMPLOYEE") {
        window.location.assign("/employee");
      } else if (result.user.role === "HR") {
        window.location.assign("/hr");
      } else {
        window.location.assign("/dashboard");
      }
    } catch (changeError) {
      setError(changeError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-3 sm:p-6 bg-slate-900 overflow-hidden font-sans">
      {/* Background Radiant Mesh Glows */}
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-600/30 blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-2xl p-5 sm:p-8 md:p-9 shadow-2xl shadow-black/50 text-white animate-in fade-in zoom-in-95 my-auto">
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          <span className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-lg sm:text-xl font-black text-white shadow-lg shadow-indigo-500/30 shrink-0">
            h
          </span>
          <div>
            <strong className="text-sm sm:text-base font-extrabold tracking-tight text-white block">HCM Lite</strong>
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Human Capital Management</span>
          </div>
        </div>

        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {mustChange ? "Set New Password" : "Sign In to Workspace"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {mustChange
              ? "Create a permanent password for your employee account."
              : "Enter your credentials to open Admin, HR, or Employee portal."}
          </p>
        </div>

        {redirectTarget && (
          <div className="mb-4 sm:mb-5 rounded-xl sm:rounded-2xl border border-indigo-500/40 bg-indigo-500/15 p-3 sm:p-3.5 text-xs text-indigo-200 flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-indigo-500/25 text-indigo-300 font-bold text-xs shrink-0">🔒</span>
            <div>
              <strong className="block text-white">Authentication Required</strong>
              <span className="text-[11px] text-indigo-300">
                Please sign in with authorized credentials to access {redirectTarget === "/hr" ? "HR Operations Portal" : redirectTarget === "/employee" ? "Employee Portal" : "Admin Console"}.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 sm:mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 sm:p-3.5 text-xs font-medium text-rose-300 animate-in fade-in">
            {error}
          </div>
        )}

        <div className="mb-4 space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Quick Test Accounts (Click to Auto-Fill):
          </span>
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => { setEmail("admin@example.com"); setPassword("Admin123!"); setRedirectTarget("/dashboard"); }}
              className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/25 py-2 px-2 text-[11px] font-bold text-indigo-300 text-center transition active:scale-95"
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => { setEmail("admin@example.com"); setPassword("Admin123!"); setRedirectTarget("/hr"); }}
              className="rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/25 py-2 px-2 text-[11px] font-bold text-purple-300 text-center transition active:scale-95"
            >
              👥 HR Manager
            </button>
            <button
              type="button"
              onClick={() => { setEmail("ali.khan@example.com"); setPassword("Employee123!"); setRedirectTarget("/employee"); }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/25 py-2 px-2 text-[11px] font-bold text-emerald-300 text-center transition active:scale-95"
            >
              📱 Employee
            </button>
          </div>
        </div>

        <form onSubmit={mustChange ? changePassword : submit} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {mustChange ? "Temporary Password" : "Password"}
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {mustChange && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password (min 8 chars)</label>
              <input
                required
                minLength={8}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-98 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : mustChange ? "Update Password & Enter" : "Sign In to Portal"}
            <IconArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <a href="/" className="hover:text-indigo-400 transition flex items-center gap-1 font-medium">
            ← Home Portals
          </a>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Supabase Active
          </span>
        </div>
      </div>
    </main>
  );
}
