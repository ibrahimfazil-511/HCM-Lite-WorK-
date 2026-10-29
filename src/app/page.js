"use client";

import { useEffect, useState } from "react";
import SetupWizard from "../components/SetupWizard";
import { getSetupStatus } from "../lib/api";
import { clearClientSession, getClientIdentity } from "../lib/client-auth";
import {
  IconShieldCheck,
  IconUsers,
  IconClock,
  IconCalendar,
  IconDollarSign,
  IconCheckCircle,
  IconAlertCircle,
  IconArrowRight,
  IconSparkles,
  IconLock,
  IconLogOut,
  IconUserCheck,
} from "../components/ui/icons";

export default function Home() {
  const [configured, setConfigured] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Auth Guard Modal State
  const [modalState, setModalState] = useState({
    open: false,
    type: "AUTH_REQUIRED", // "AUTH_REQUIRED" | "ROLE_RESTRICTED"
    title: "",
    message: "",
    targetPath: "",
    suggestedPath: "",
  });

  useEffect(() => {
    setMounted(true);
    getSetupStatus()
      .then((result) => setConfigured(result.configured))
      .catch(() => setConfigured(false));

    const id = getClientIdentity();
    if (id) {
      setIdentity(id);
    }
  }, []);

  function handleCardClick(targetPath, requiredRoles, cardName) {
    const currentIdentity = getClientIdentity();

    // 1. Unauthenticated Check: MUST authenticate before proceeding!
    if (!currentIdentity || !currentIdentity.role) {
      setModalState({
        open: true,
        type: "AUTH_REQUIRED",
        title: "Authentication Required",
        message: `Aapko pehle sign in karna hoga taake aap ${cardName} ko secure tareeqe se access kar sakein. Kisi bhi unauthorized user ko agle page par jane ki ijazat nahi hai.`,
        targetPath,
        suggestedPath: `/login?redirect=${targetPath}`,
      });
      return;
    }

    // 2. Role Restriction Check
    const userRole = String(currentIdentity.role).toUpperCase();
    if (!requiredRoles.includes(userRole)) {
      let suggestedPath = "/employee";
      if (userRole === "ADMIN") suggestedPath = "/dashboard";
      if (userRole === "HR") suggestedPath = "/hr";

      setModalState({
        open: true,
        type: "ROLE_RESTRICTED",
        title: "Access Restricted by Role",
        message: `Aapka current account role '${userRole}' hai. Yeh ${cardName} sirf ${requiredRoles.join(" ya ")} ke liye makhsoos hai. Aap apna authorized portal visit kar sakte hain.`,
        targetPath,
        suggestedPath,
      });
      return;
    }

    // 3. Authorized -> Navigate
    window.location.assign(targetPath);
  }

  function handleSignOut() {
    clearClientSession();
    setIdentity(null);
    window.location.reload();
  }

  if (configured === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-900 text-slate-300 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" />
          <span className="text-xs font-medium text-slate-400">Initializing HCM Lite Suite...</span>
        </div>
      </main>
    );
  }

  if (!configured) {
    return <SetupWizard onComplete={(redirectTo) => window.location.replace(redirectTo)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-600/20 blur-[128px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 -z-10 h-96 w-96 rounded-full bg-purple-600/20 blur-[128px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 -z-10 h-80 w-80 rounded-full bg-blue-600/15 blur-[128px] pointer-events-none" />

      {/* Top Floating Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 lg:px-12 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-xl font-black text-white shadow-lg shadow-indigo-500/25">
              H
            </span>
            <div>
              <div className="flex items-center gap-2">
                <strong className="text-base font-extrabold tracking-tight text-white">HCM Lite</strong>
                <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">AI-Powered Human Capital Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Supabase Status Pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium text-[11px]">Supabase Cloud Connected</span>
            </div>

            {/* Current Auth Pill */}
            {identity ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-1.5 pr-3 shadow-md">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-[11px] font-black text-white">
                  {identity.role.slice(0, 2)}
                </span>
                <div className="text-left leading-none">
                  <span className="block text-[11px] font-bold text-white truncate max-w-[120px]">
                    {identity.name || identity.role}
                  </span>
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
                    {identity.role}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="ml-1 p-1 text-slate-400 hover:text-rose-400 transition"
                >
                  <IconLogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-purple-500 transition active:scale-95"
              >
                Sign In to Portal
                <IconArrowRight className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-semibold text-indigo-300 shadow-inner">
            <IconSparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Strict Role-Based Multi-Portal Architecture</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Select Your Role to Access <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              HCM Lite Workspaces
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Har role ka apna dedicated workspace aur data scope hai. Admin HR team hire karta hai, HR team employees ko hire karti hai, aur har employee sirf apna confidential data dekh sakta hai.
          </p>
        </div>

        {/* ---------------------------------------------------- */}
        {/* THREE PORTAL CARDS (ADMIN, HR, EMPLOYEE)             */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* CARD 1: ADMIN PORTAL */}
          <div className="group relative rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 lg:p-7 shadow-xl shadow-black/40 flex flex-col justify-between transition-all duration-300 hover:border-indigo-500/50 hover:shadow-indigo-500/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 group-hover:bg-indigo-500 group-hover:text-white transition duration-300">
                  <IconShieldCheck className="w-6 h-6" />
                </span>
                <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-1 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                  Role: ADMIN
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white group-hover:text-indigo-300 transition">
                  Executive Admin Portal
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Complete organization governance, office geofence rules, HR team hiring, and monthly payroll finalization.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Hire HR Team:</strong> Onboard HR Managers directly into Supabase.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Office Geofence:</strong> Enforce 150m radius & 09:00 AM work hours.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Lock Payroll:</strong> Finalize & lock monthly company salary runs.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Audit Logs:</strong> Real-time security events & compliance logs.</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80">
              <button
                onClick={() => handleCardClick("/dashboard", ["ADMIN"], "Executive Admin Portal")}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-800 group-hover:bg-indigo-600 px-4 py-3 text-xs font-bold text-white transition-all duration-200 active:scale-98 shadow-md"
              >
                <span>Access Admin Portal</span>
                <IconArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="text-center mt-2.5 text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <IconLock className="w-3 h-3 text-indigo-400" />
                <span>Protected · Requires Admin Login</span>
              </div>
            </div>
          </div>

          {/* CARD 2: HR PORTAL */}
          <div className="group relative rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 lg:p-7 shadow-xl shadow-black/40 flex flex-col justify-between transition-all duration-300 hover:border-purple-500/50 hover:shadow-purple-500/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 group-hover:bg-purple-500 group-hover:text-white transition duration-300">
                  <IconUsers className="w-6 h-6" />
                </span>
                <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                  Role: HR MANAGER
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white group-hover:text-purple-300 transition">
                  HR Operations Portal
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  People operations center to hire employees, monitor daily attendance, review leaves, and draft payroll.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>Hire Employees:</strong> Register staff & auto-generate Supabase logins.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>Attendance Board:</strong> 8.0h duty hours & 1.5x overtime monitoring.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>Leave Inbox:</strong> 1-click Approve / Decline with HR comments.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 font-bold mt-0.5">✓</span>
                  <span><strong>Payroll Drafts:</strong> Calculate overtime & deductions for review.</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80">
              <button
                onClick={() => handleCardClick("/hr", ["HR", "ADMIN"], "HR Operations Portal")}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-800 group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-indigo-600 px-4 py-3 text-xs font-bold text-white transition-all duration-200 active:scale-98 shadow-md"
              >
                <span>Access HR Portal</span>
                <IconArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="text-center mt-2.5 text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <IconLock className="w-3 h-3 text-purple-400" />
                <span>Protected · Requires HR Login</span>
              </div>
            </div>
          </div>

          {/* CARD 3: EMPLOYEE PORTAL */}
          <div className="group relative rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 lg:p-7 shadow-xl shadow-black/40 flex flex-col justify-between transition-all duration-300 hover:border-emerald-500/50 hover:shadow-emerald-500/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500 group-hover:text-white transition duration-300">
                  <IconClock className="w-6 h-6" />
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Role: EMPLOYEE
                </span>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white group-hover:text-emerald-300 transition">
                  Employee Self-Service Desk
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Personal employee portal for geofenced attendance stamping, leave applications, and confidential payslips.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>100% Data Isolation:</strong> You only see your own personal records.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>GPS Check-in:</strong> 1-Click arrival & departure within 150m radius.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Smart Leaves:</strong> Apply for Casual, Sick & Annual leaves with balance.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Confidential Payslips:</strong> View base, 1.5x overtime, and net pay.</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-800/80">
              <button
                onClick={() => handleCardClick("/employee", ["EMPLOYEE", "ADMIN", "HR"], "Employee Self-Service Desk")}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-800 group-hover:bg-emerald-600 px-4 py-3 text-xs font-bold text-white transition-all duration-200 active:scale-98 shadow-md"
              >
                <span>Access Employee Desk</span>
                <IconArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="text-center mt-2.5 text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <IconLock className="w-3 h-3 text-emerald-400" />
                <span>Protected · Requires Employee Login</span>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* QUICK CREDENTIALS TEST CHEAT SHEET                   */}
        {/* ---------------------------------------------------- */}
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                Live Testing Credentials
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">Role-Based Access Quick Guide</h3>
              <p className="text-xs text-slate-400">
                Test each portal with these credentials stored live in Supabase PostgreSQL:
              </p>
            </div>
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
            >
              Open Login Page →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-xs font-bold text-indigo-300">Admin Login</strong>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">ADMIN</span>
              </div>
              <div className="text-xs font-mono text-slate-300">Email: <span className="text-white font-bold">admin@example.com</span></div>
              <div className="text-xs font-mono text-slate-300">Password: <span className="text-indigo-400 font-bold">Admin123!</span></div>
              <p className="text-[11px] text-slate-400 pt-1">Hires HR team, configures office rules, and finalizes payroll.</p>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-xs font-bold text-purple-300">HR Manager Login</strong>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">HR</span>
              </div>
              <div className="text-xs font-mono text-slate-300">Email: <span className="text-white font-bold">hr@example.com</span></div>
              <div className="text-xs font-mono text-slate-300">Password: <span className="text-purple-400 font-bold">Admin123!</span></div>
              <p className="text-[11px] text-slate-400 pt-1">Hires employees, manages daily attendance, and approves leaves.</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <strong className="text-xs font-bold text-emerald-300">Employee Login</strong>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">EMPLOYEE</span>
              </div>
              <div className="text-xs font-mono text-slate-300">Email: <span className="text-white font-bold">ali.khan@example.com</span></div>
              <div className="text-xs font-mono text-slate-300">Password: <span className="text-emerald-400 font-bold">Employee123!</span></div>
              <p className="text-[11px] text-slate-400 pt-1">100% isolated confidential data, attendance stamping & payslips.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-8 border-t border-slate-900 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>© 2026 Saylani Tech HCM Lite. Real-time dynamic Human Capital Management.</span>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Supabase Cloud PostgreSQL Live</span>
          </div>
        </footer>
      </main>

      {/* ---------------------------------------------------- */}
      {/* AUTHENTICATION & ROLE ENFORCEMENT MODAL              */}
      {/* ---------------------------------------------------- */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 sm:p-7 shadow-2xl text-white space-y-4 animate-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className={`grid h-10 w-10 place-items-center rounded-2xl ${modalState.type === "AUTH_REQUIRED" ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"}`}>
                  <IconLock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">{modalState.title}</h3>
                  <span className="text-[11px] text-slate-400">Security Gatekeeper</span>
                </div>
              </div>
              <button
                onClick={() => setModalState({ ...modalState, open: false })}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {modalState.message}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                onClick={() => setModalState({ ...modalState, open: false })}
                className="w-full sm:w-auto flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.location.assign(modalState.suggestedPath || "/login");
                }}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/30 hover:from-indigo-500 hover:to-purple-500 transition active:scale-95"
              >
                <span>{modalState.type === "AUTH_REQUIRED" ? "Sign In Now" : "Go to My Portal"}</span>
                <IconArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
