"use client";

import { useEffect, useState } from "react";
import SetupWizard from "../components/SetupWizard";
import { safeResponseJson } from "../lib/api";
import { clearClientSession, setClientSession } from "../lib/client-auth";
import { IconArrowRight, IconLock, IconSparkles } from "../components/ui/icons";

const roles = [
  { id: "ADMIN", label: "Admin", description: "Governance, hiring and payroll", color: "indigo" },
  { id: "HR", label: "HR Manager", description: "People operations and attendance", color: "purple" },
  { id: "EMPLOYEE", label: "Employee", description: "Attendance, leaves and payslips", color: "emerald" },
];

function getPortalPath(role) {
  if (role === "EMPLOYEE") return "/employee";
  if (role === "HR") return "/hr";
  return "/dashboard";
}

function getInitialRole() {
  if (typeof window === "undefined") return "EMPLOYEE";
  const redirectTarget = new URLSearchParams(window.location.search).get("redirect");
  if (redirectTarget === "/hr") return "HR";
  if (redirectTarget === "/dashboard") return "ADMIN";
  return "EMPLOYEE";
}

export default function Home() {
  const [configured, setConfigured] = useState(null);
  const [role, setRole] = useState(getInitialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    fetch("/api/setup", { cache: "no-store" })
      .then((response) => safeResponseJson(response, { configured: true }))
      .then((result) => setConfigured(result.configured))
      .catch(() => setConfigured(false));
  }, []);

  function selectRole(nextRole) {
    setRole(nextRole);
    setError("");
    setInfo("");
  }

  async function submitLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, role }),
      });
      const result = await safeResponseJson(response, {});

      if (result.code === "MUST_CHANGE_PASSWORD" || result.mustChangePassword) {
        if (String(result.user?.role || "").toUpperCase() !== role) {
          setError(`These credentials are not authorized for the ${roles.find((item) => item.id === role)?.label} role.`);
          return;
        }
        setMustChange(true);
        setVerifiedEmail(email.trim().toLowerCase());
        setInfo("Temporary password verified. Create your permanent password to continue.");
        return;
      }

      if (!response.ok) {
        setError(result.error || "Invalid email or password.");
        return;
      }

      if (String(result.user?.role || "").toUpperCase() !== role) {
        setError(`These credentials are not authorized for the ${roles.find((item) => item.id === role)?.label} role.`);
        return;
      }

      setClientSession(result.token, result.user);
      window.location.assign(getPortalPath(result.user.role));
    } catch {
      setError("Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: verifiedEmail, currentPassword: password, newPassword }),
      });
      const result = await safeResponseJson(response, {});
      if (!response.ok) {
        setError(result.error || "Unable to update password.");
        return;
      }
      setClientSession(result.token, result.user);
      window.location.assign(getPortalPath(result.user.role));
    } catch {
      setError("Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  }

  if (configured === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-300">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
      </main>
    );
  }

  if (!configured) {
    return <SetupWizard onComplete={(redirectTo) => window.location.replace(redirectTo)} />;
  }

  const selectedRole = roles.find((item) => item.id === role);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 font-sans text-slate-100 sm:px-6 sm:py-12">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/25 blur-[128px]" />
      <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-purple-600/20 blur-[128px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
            <IconSparkles className="h-3.5 w-3.5" />
            AI-Powered Human Capital Management
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Welcome to <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">HCM Lite</span>
          </h1>
          <p className="mt-3 text-sm text-slate-400">Select your role and sign in to your dedicated workspace.</p>
        </div>

        <section className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/90 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
          <div className="mb-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-950/80 p-1.5">
            {roles.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectRole(item.id)}
                className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                  role === item.id
                    ? item.id === "ADMIN" ? "bg-indigo-600 text-white" : item.id === "HR" ? "bg-purple-600 text-white" : "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">{mustChange ? "Create your password" : `${selectedRole.label} sign in`}</h2>
            <p className="mt-1 text-xs text-slate-400">{mustChange ? "Set a permanent password for future logins." : selectedRole.description}</p>
          </div>

          {info && <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">{info}</div>}
          {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</div>}

          {!mustChange ? (
            <form onSubmit={submitLogin} className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">
                Email address
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
              </label>
              <label className="block text-xs font-semibold text-slate-300">
                Password
                <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
              </label>
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50">
                {loading ? "Verifying credentials..." : `Sign in as ${selectedRole.label}`}
                <IconArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={changePassword} className="space-y-4">
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 text-xs text-slate-300">{verifiedEmail}</div>
              <input required minLength={8} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (min 8 characters)" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              <input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-bold text-white disabled:opacity-50">
                {loading ? "Saving password..." : "Set password and enter"}
                <IconArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setMustChange(false); setInfo(""); setError(""); }} className="w-full text-xs text-slate-400 hover:text-white">Back to sign in</button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><IconLock className="h-3 w-3" /> Secure role-based access</span>
            <span className="text-emerald-400">System active</span>
          </div>
        </section>

        <button type="button" onClick={() => { clearClientSession(); window.location.reload(); }} className="mt-5 text-xs text-slate-500 hover:text-white">
          Sign out current session
        </button>
      </div>
    </main>
  );
}
