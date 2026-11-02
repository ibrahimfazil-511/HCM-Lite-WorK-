"use client";

import { useEffect, useMemo, useState } from "react";
import AIAssistantModal from "../../components/AIAssistantModal.js";
import { clearClientSession, getClientIdentity } from "../../lib/client-auth.js";
import { safeResponseJson } from "../../lib/api.js";
import {
  IconClock,
  IconCalendar,
  IconSparkles,
  IconCheckCircle,
  IconAlertCircle,
  IconArrowRight,
  IconFileText,
  IconLogOut,
  IconUserCheck,
} from "../../components/ui/icons.js";

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${day} ${monthName} ${year}`;
}

function formatTime(value) {
  return value ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
}

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "present" || s === "approved") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{s === "approved" ? "APPROVES" : s.toUpperCase()}</span>;
  }
  if (s === "late" || s === "pending") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/80"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />PENDING</span>;
  }
  if (s === "rejected" || s === "not_approved") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/80"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />NOT APPROVES</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/80"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />{s.replace("_", " ").toUpperCase()}</span>;
}

export default function EmployeePage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("attendance"); // "attendance", "leaves", "payslips", "profile"
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [profile, setProfile] = useState(null);
  const [employeeDashboard, setEmployeeDashboard] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [today, setToday] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [expandedMonthRecordEmpId, setExpandedMonthRecordEmpId] = useState(null);

  // Apply Leave Form State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [applyingLeave, setApplyingLeave] = useState(false);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({ phone: "", address: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // Payslip Modal
  const [activePayslip, setActivePayslip] = useState(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      if (!token) {
        window.location.assign("/login?redirect=/employee");
        return;
      }
      const identity = getClientIdentity();
      if (!identity) {
        window.location.assign("/login?redirect=/employee");
        return;
      }
      if (identity.role === "ADMIN") {
        window.location.assign("/dashboard");
        return;
      }
      if (identity.role === "HR") {
        window.location.assign("/hr");
        return;
      }
      if (identity.role !== "EMPLOYEE") {
        window.location.assign("/login?redirect=/employee");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      const [attRes, leaveRes, payRes, empRes, dashRes] = await Promise.all([
        fetch("/api/attendance", { headers, cache: "no-store" }),
        fetch("/api/leaves", { headers, cache: "no-store" }),
        fetch("/api/payroll", { headers, cache: "no-store" }),
        fetch("/api/employees", { headers, cache: "no-store" }),
        fetch("/api/analytics/dashboard", { headers, cache: "no-store" }),
      ]);

      if ([attRes, leaveRes, payRes, empRes, dashRes].some((response) => response && response.status === 401)) {
        clearClientSession();
        window.location.assign("/login?redirect=/employee");
        return;
      }

      const [attData, leaveData, payData, empData, dashData] = await Promise.all([
        safeResponseJson(attRes, { attendance: [] }),
        safeResponseJson(leaveRes, { leaves: [] }),
        safeResponseJson(payRes, { payrolls: [] }),
        safeResponseJson(empRes, { employees: [] }),
        safeResponseJson(dashRes, {}),
      ]);

      setAttendance(attData?.attendance || []);
      setLeaves(leaveData?.leaves || []);
      setPayrolls(payData?.payrolls || []);
      setEmployeeDashboard(dashData?.employee || null);

      if (empData?.employees && empData.employees.length > 0) {
        const myEmp = empData.employees[0];
        setProfile(myEmp);
        setProfileForm({ phone: myEmp.phone || "", address: myEmp.address || "" });
      }
    } catch (err) {
      setError(err.message || "Failed to load employee portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    setToday(todayStr);
    setLeaveForm((prev) => ({ ...prev, startDate: todayStr, endDate: todayStr }));
    setCurrentTime(Date.now());
    loadData();
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const todayRecord = attendance.find((record) => record.date === today);

  const approvedLeaveToday = useMemo(() => {
    if (!today || !leaves?.length) return null;
    return leaves.find((l) => {
      const s = String(l.status || "").toLowerCase();
      return s === "approved" && l.startDate <= today && today <= l.endDate;
    });
  }, [leaves, today]);

  const liveHours = (record) => {
    if (!record?.checkInAt) return 0;
    if (record.checkOutAt) return Number(record.totalWorkHours || 0);
    return Math.max(0, (currentTime - new Date(record.checkInAt).getTime()) / 3600000);
  };

  const todayHours = todayRecord ? liveHours(todayRecord) : 0;
  const todayOvertime = todayHours > 8 ? Number((todayHours - 8).toFixed(2)) : 0;
  const basicSalary = Number(profile?.salary || 0);
  const hourlyRate = basicSalary > 0 ? (basicSalary / 22) / 8 : 0;
  const overtimeRate = hourlyRate * 1.5;
  const todayOvertimePay = todayOvertime > 0 ? Math.round(todayOvertime * overtimeRate) : 0;
  const totalHours = useMemo(() => attendance.reduce((sum, record) => sum + liveHours(record), 0), [attendance, currentTime]);
  const todayLabel = today ? new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(`${today}T00:00:00`)) : "Today";

  // Location removed! Instant 1-click Check-In / Check-Out
  async function attendanceAction(action) {
    setActionLoading(action);
    setMessage("");
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      const response = await fetch(`/api/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const result = await safeResponseJson(response, {});
      if (!response.ok) throw new Error(result.error || "Attendance action failed.");
      setMessage(action === "check-in" ? "✓ Arrival time stamped successfully!" : "✓ Departure time stamped successfully!");
      await loadData();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setActionLoading("");
    }
  }

  async function handleApplyLeave(e) {
    e.preventDefault();
    setApplyingLeave(true);
    setError("");
    setMessage("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/leaves/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(leaveForm),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) {
        const errorMsg = data.errors ? data.errors.join(", ") : data.error;
        throw new Error(errorMsg || "Leave submission failed.");
      }
      setMessage("🎉 Leave application submitted successfully for Admin/HR review!");
      setShowApplyModal(false);
      setLeaveForm({ leaveType: "casual", startDate: today, endDate: today, reason: "" });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplyingLeave(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setError("");
    setMessage("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch(`/api/employees/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");
      setProfile(data.employee);
      setMessage("Contact details updated successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function viewPayslip(payrollId, employeeId) {
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch(`/api/payroll/${payrollId}/payslip?employeeId=${employeeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Payslip not available.");
      setActivePayslip(data.payslip);
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("hcm_token");
    window.location.assign("/login");
  }

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-indigo-600">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-xl shadow-indigo-500/30">
            h
          </span>
          <span className="text-xs text-slate-400 font-semibold tracking-wide">Loading HCM Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Frosted Glass Top Navigation Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-lg sm:text-xl font-black text-white shadow-md shadow-indigo-500/20 shrink-0">
            h
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <strong className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 block leading-tight">HCM Lite</strong>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 sm:inline-block hidden">Portal</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">Employee Desk</span>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95 shrink-0"
          >
            <IconSparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden xs:inline">Ask Humi AI</span>
            <span className="xs:hidden">AI</span>
          </button>

          <button
            onClick={logout}
            className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-colors shrink-0"
            title="Sign Out"
          >
            <IconLogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Responsive Horizontal Tab Bar (Always accessible, never squashed) */}
      <div className="sticky top-16 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2 shadow-xs">
        <div className="max-w-6xl mx-auto overflow-x-auto scrollbar-none">
          <nav className="flex items-center gap-1 sm:gap-1.5 min-w-max bg-slate-100/90 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setTab("attendance")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-150 ${
                tab === "attendance"
                  ? "bg-white text-indigo-600 shadow-xs font-bold"
                  : "hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <IconClock className="w-3.5 h-3.5" />
              <span>Attendance</span>
            </button>
            <button
              onClick={() => setTab("leaves")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-150 ${
                tab === "leaves"
                  ? "bg-white text-indigo-600 shadow-xs font-bold"
                  : "hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <IconCalendar className="w-3.5 h-3.5" />
              <span>Leaves</span>
            </button>
            <button
              onClick={() => setTab("payslips")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-150 ${
                tab === "payslips"
                  ? "bg-white text-indigo-600 shadow-xs font-bold"
                  : "hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <IconFileText className="w-3.5 h-3.5" />
              <span>My Payslips</span>
            </button>
            <button
              onClick={() => setTab("profile")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all duration-150 ${
                tab === "profile"
                  ? "bg-white text-indigo-600 shadow-xs font-bold"
                  : "hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <IconUserCheck className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">
        {/* Hero Welcome Card with Radiant Gradient */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-violet-950 p-5 sm:p-7 md:p-8 text-white shadow-xl shadow-indigo-950/10 border border-indigo-800/40">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="absolute right-48 -bottom-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-200 backdrop-blur-md border border-white/10 mb-2 sm:mb-3">
                <IconCalendar className="w-3.5 h-3.5 text-indigo-300" />
                <span>{todayLabel}</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome to Employee Portal
              </h1>
              <p className="mt-1 text-xs text-indigo-200/80 font-medium">
                {profile?.designation || "Staff Member"} · {profile?.department || "Department"}
              </p>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl sm:rounded-2xl bg-white/10 p-2.5 sm:p-3 backdrop-blur-md border border-white/10 text-xs self-start sm:self-auto">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-indigo-200">Database Status</span>
                <strong className="text-white font-semibold">Supabase Cloud Active</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Alerts */}
        {message && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in">
            <IconCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-semibold text-rose-800 shadow-xs animate-in fade-in">
            <IconAlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 1: ATTENDANCE & WEB CHECK-IN                         */}
        {/* -------------------------------------------------------- */}
        {tab === "attendance" && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Today Arrival</span>
                  <IconClock className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex items-baseline gap-2">
                  <strong className="text-xl sm:text-2xl font-black text-slate-900">
                    {todayRecord ? formatTime(todayRecord.checkInAt) : "—"}
                  </strong>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-medium">
                  {todayRecord ? (
                    <span className="text-emerald-600 font-semibold">Status: {todayRecord.status.toUpperCase()}</span>
                  ) : (
                    "Ready to check in"
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Duty Hours (8h)</span>
                  <IconUserCheck className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex items-baseline gap-2">
                  <strong className="text-xl sm:text-2xl font-black text-slate-900">
                    {todayHours.toFixed(2)} hrs
                  </strong>
                  <span className="text-xs text-slate-400">/ 8.0 hrs standard</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-medium">
                  {todayRecord?.checkOutAt ? `Departed at ${formatTime(todayRecord.checkOutAt)}` : todayRecord ? "Timer running" : "Not started"}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-4 sm:p-5 shadow-xs sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Overtime Earned</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="mt-2.5 sm:mt-3 flex items-baseline gap-2 flex-wrap">
                  <strong className={`text-xl sm:text-2xl font-black ${todayOvertime > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                    +{todayOvertime.toFixed(2)} hrs
                  </strong>
                  {todayOvertimePay > 0 && (
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                      +{todayOvertimePay.toLocaleString()} PKR
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-emerald-700 font-medium">
                  {todayOvertime > 0 ? `1.5× hourly rate (+${todayOvertimePay.toLocaleString()} PKR) added to salary` : "Duty hours: 09:00 AM – 05:00 PM (8h standard)"}
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Action Surface */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-slate-100">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Daily Attendance Stamping</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Office timing: 09:00 AM – 05:00 PM (8.0h duty). Overtime calculated past 5:00 PM.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {approvedLeaveToday ? (
                    <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 shadow-xs">
                      <IconCalendar className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>On Approved Leave ({approvedLeaveToday.leaveType?.toUpperCase()}) — Attendance Stamping Disabled</span>
                    </div>
                  ) : !todayRecord ? (
                    <button
                      onClick={() => attendanceAction("check-in")}
                      disabled={Boolean(actionLoading)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === "check-in" ? "Recording Arrival..." : "Check In Now"}
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : !todayRecord.checkOutAt ? (
                    <button
                      onClick={() => attendanceAction("check-out")}
                      disabled={Boolean(actionLoading)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/25 hover:from-rose-500 hover:to-red-500 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === "check-out" ? "Recording Departure..." : "Check Out Now"}
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
                      <IconCheckCircle className="w-4 h-4 text-emerald-600" />
                      Day Completed ({formatTime(todayRecord.checkInAt)} – {formatTime(todayRecord.checkOutAt)})
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl font-bold shrink-0 ${approvedLeaveToday ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"}`}>
                    {approvedLeaveToday ? <IconCalendar className="w-4 h-4 sm:w-5 sm:h-5" /> : <IconClock className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </span>
                  <div>
                    <strong className="block text-xs font-bold text-slate-800">
                      {approvedLeaveToday
                        ? `Official Approved Leave Active: ${approvedLeaveToday.leaveType?.toUpperCase()} LEAVE`
                        : todayRecord
                        ? `Arrival recorded at ${formatTime(todayRecord.checkInAt)}`
                        : "Awaiting check-in for today"}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {approvedLeaveToday
                        ? `Your ${approvedLeaveToday.leaveType} leave is officially approved from ${formatDate(approvedLeaveToday.startDate)} to ${formatDate(approvedLeaveToday.endDate)}. Check-in and check-out are locked for these approved days.`
                        : todayRecord
                        ? `Departure: ${formatTime(todayRecord.checkOutAt)} · Duty: ${todayHours.toFixed(2)}h ${todayOvertime > 0 ? `(+${todayOvertime.toFixed(2)}h Overtime = +${todayOvertimePay.toLocaleString()} PKR added to salary)` : ""}`
                        : "Official duty: 09:00 AM – 05:00 PM (8.0h standard). Overtime calculated after 8 hours."}
                    </span>
                  </div>
                </div>

                {!approvedLeaveToday && todayRecord && (
                  <strong className="text-base sm:text-lg font-extrabold text-indigo-600 font-mono self-end sm:self-auto">
                    {todayHours.toFixed(2)}h
                  </strong>
                )}
              </div>
            </div>

            {/* Attendance History (Date-Wise) */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Attendance History</h3>
                  <p className="text-xs text-slate-500">Sorted by date showing arrival, departure, duty, and overtime.</p>
                </div>
                <span className="text-xs font-semibold text-slate-400">Total: {attendance.length} entries</span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading attendance records...</div>
              ) : attendance.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No attendance records found yet.</div>
              ) : (
                <div className="mt-3">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left text-xs min-w-[580px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-3">Date</th>
                          <th className="py-3 px-3">Arrival (Check-In)</th>
                          <th className="py-3 px-3">Departure (Check-Out)</th>
                          <th className="py-3 px-3">Duty Hours</th>
                          <th className="py-3 px-3">Overtime Hours</th>
                          <th className="py-3 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {attendance.map((record) => {
                          const hours = Number(record.totalWorkHours || 0);
                          const ot = Number(record.overtimeHours || (hours > 8 ? hours - 8 : 0));
                          return (
                            <tr key={record.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="py-3.5 px-3 font-bold text-slate-800">{formatDate(record.date)}</td>
                              <td className="py-3.5 px-3 text-slate-600">{formatTime(record.checkInAt)}</td>
                              <td className="py-3.5 px-3 text-slate-600">{formatTime(record.checkOutAt)}</td>
                              <td className="py-3.5 px-3 font-semibold text-slate-800">{hours.toFixed(2)} hrs</td>
                              <td className="py-3.5 px-3 font-bold text-emerald-600">
                                {ot > 0 ? `+${ot.toFixed(2)} hrs OT` : "—"}
                              </td>
                              <td className="py-3.5 px-3">{statusBadge(record.status)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="sm:hidden text-center text-[10px] text-slate-400 pt-2.5">⇄ Swipe table horizontally to view all columns</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 2: LEAVES & SELF-SERVICE                             */}
        {/* -------------------------------------------------------- */}
        {tab === "leaves" && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
            {/* Quota Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-4 sm:p-5 shadow-xs">
                <small className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Casual Leaves</small>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-2xl sm:text-3xl font-black text-indigo-900">10</strong>
                  <span className="text-xs text-slate-400">/ 10 days quota</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Short personal off-days</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-4 sm:p-5 shadow-xs">
                <small className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Sick Leaves</small>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-2xl sm:text-3xl font-black text-emerald-900">8</strong>
                  <span className="text-xs text-slate-400">/ 8 days quota</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Medical emergencies</p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-4 sm:p-5 shadow-xs">
                <small className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Annual Leaves</small>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-2xl sm:text-3xl font-black text-violet-900">14</strong>
                  <span className="text-xs text-slate-400">/ 14 days quota</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Planned vacations</p>
              </div>
            </div>

            {/* Leave Applications History */}
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">My Leave Requests</h3>
                  <p className="text-xs text-slate-500">Applications are reviewed and approved directly by Admin &amp; HR.</p>
                </div>
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 sm:py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  + Apply for Leave
                </button>
              </div>

              {leaves.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No leave requests submitted yet. Click &quot;Apply for Leave&quot; above.
                </div>
              ) : (
                <div className="mt-4">
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-3 px-3">Type</th>
                          <th className="py-3 px-3">Duration</th>
                          <th className="py-3 px-3">Working Days</th>
                          <th className="py-3 px-3">Reason</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Admin Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {leaves.map((leave) => (
                          <tr key={leave.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-3.5 px-3 font-bold uppercase text-indigo-700">{leave.leaveType}</td>
                            <td className="py-3.5 px-3 text-slate-600">
                              {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                            </td>
                            <td className="py-3.5 px-3 font-bold text-slate-800">{leave.workingDays || 1} days</td>
                            <td className="py-3.5 px-3 text-slate-500 max-w-xs truncate">{leave.reason}</td>
                            <td className="py-3.5 px-3">{statusBadge(leave.status)}</td>
                            <td className="py-3.5 px-3 text-slate-500 italic">{leave.hrComment || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="sm:hidden text-center text-[10px] text-slate-400 pt-2.5">⇄ Swipe table horizontally to view full leave records</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 3: PAYSLIPS & SALARY BREAKDOWN                       */}
        {/* -------------------------------------------------------- */}
        {tab === "payslips" && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm">
              <div className="pb-3 sm:pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Monthly Salary &amp; Attendance Calculation</h3>
                  <p className="text-xs text-slate-500">
                    Standard 30-Day Working Month. Attendance, leaves, late arrivals, and overtime calculations based on your basic salary.
                  </p>
                </div>
              </div>

              {payrolls.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No payroll runs finalized yet. Once Admin/HR runs monthly payroll, your complete calculation table will appear here.
                </div>
              ) : (
                <div className="mt-4 space-y-6">
                  {payrolls.map((payroll) => {
                    const myLine = payroll.lines?.find((l) => l.employeeId === profile?.id);
                    if (!myLine) return null;

                    const dailyRate = Math.round(Number(myLine.basic || profile?.salary || 0) / 30);
                    const hourlyRate = Math.round(dailyRate / 8);
                    const latePenaltyRate = Number(myLine.lateRate || Math.round(dailyRate * 0.5));

                    return (
                      <div key={payroll.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                        {/* Month Header Banner */}
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b border-slate-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-sm font-bold text-slate-900">Month: {payroll.month}</strong>
                              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                                {payroll.status.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Base: 30 Working Days · Basic Salary: <strong>{Number(myLine.basic || profile?.salary || 0).toLocaleString()} PKR</strong>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono">
                              Daily Rate: <strong className="text-indigo-700">{dailyRate.toLocaleString()} PKR</strong>
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-mono">
                              Hourly: <strong className="text-indigo-700">{hourlyRate.toLocaleString()} PKR</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedMonthRecordEmpId(expandedMonthRecordEmpId === payroll.id ? null : payroll.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                                expandedMonthRecordEmpId === payroll.id
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                              }`}
                            >
                              <span>📅</span>
                              <span>{expandedMonthRecordEmpId === payroll.id ? "Hide 30-Day Table" : "Poore Month Ka 30-Day Table"}</span>
                            </button>
                            <button
                              onClick={() => viewPayslip(payroll.id, profile.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
                            >
                              Print Official Slip 🖨
                            </button>
                          </div>
                        </div>

                        {/* Individual Calculation Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs divide-y divide-slate-100">
                            <thead>
                              <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="py-2.5 px-4">Calculation Item</th>
                                <th className="py-2.5 px-4">Formula / Basis</th>
                                <th className="py-2.5 px-4">Units / Count</th>
                                <th className="py-2.5 px-4 text-right">Amount (PKR)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {/* Basic Salary */}
                              <tr className="hover:bg-slate-50/40">
                                <td className="py-2.5 px-4 font-bold text-slate-800">Basic Monthly Base</td>
                                <td className="py-2.5 px-4 text-slate-500">30 Working Days Base Month</td>
                                <td className="py-2.5 px-4 font-semibold text-slate-700 font-mono">30 Days</td>
                                <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                                  +{Number(myLine.basic || profile?.salary || 0).toLocaleString()} PKR
                                </td>
                              </tr>

                              {/* Attendance */}
                              <tr className="hover:bg-slate-50/40">
                                <td className="py-2.5 px-4 text-slate-700">Attendance (Present)</td>
                                <td className="py-2.5 px-4 text-slate-500">Full Daily Duty Logged</td>
                                <td className="py-2.5 px-4 text-emerald-700 font-semibold font-mono">
                                  {myLine.presentDays || 0} Days Present
                                </td>
                                <td className="py-2.5 px-4 text-right text-emerald-600 font-mono font-semibold">
                                  Included in Base
                                </td>
                              </tr>

                              {/* Approved Paid Leaves */}
                              <tr className="hover:bg-slate-50/40">
                                <td className="py-2.5 px-4 text-slate-700">Approved Paid Leaves</td>
                                <td className="py-2.5 px-4 text-slate-500">Casual / Sick / Annual (Salary Protected)</td>
                                <td className="py-2.5 px-4 text-indigo-700 font-semibold font-mono">
                                  {myLine.approvedPaidLeaves || 0} Days Approved
                                </td>
                                <td className="py-2.5 px-4 text-right text-indigo-600 font-mono font-semibold">
                                  100% Paid (0 PKR)
                                </td>
                              </tr>

                              {/* Overtime Pay */}
                              <tr className="hover:bg-slate-50/40 bg-emerald-50/20">
                                <td className="py-2.5 px-4 font-bold text-emerald-800">Overtime Addition (+)</td>
                                <td className="py-2.5 px-4 text-emerald-700 font-mono">
                                  1.5× Hourly Rate ({Math.round(hourlyRate * 1.5).toLocaleString()} PKR/hr)
                                </td>
                                <td className="py-2.5 px-4 text-emerald-800 font-semibold font-mono">
                                  {myLine.totalOvertimeHours || 0} Hours OT
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono">
                                  +{Number(myLine.overtimePay || 0).toLocaleString()} PKR
                                </td>
                              </tr>

                              {/* Absent Cut */}
                              <tr className="hover:bg-slate-50/40 bg-rose-50/20">
                                <td className="py-2.5 px-4 font-bold text-rose-800">Leaves / Absent Deduction (-)</td>
                                <td className="py-2.5 px-4 text-rose-700 font-mono">
                                  Daily Rate: Basic ÷ 30 ({dailyRate.toLocaleString()} PKR/day)
                                </td>
                                <td className="py-2.5 px-4 text-rose-800 font-semibold font-mono">
                                  {myLine.absentDays || 0} Days Absent
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-rose-700 font-mono">
                                  -{Number(myLine.absentDeduction || myLine.deductions || 0).toLocaleString()} PKR
                                </td>
                              </tr>

                              {/* Late Arrivals Cut (Exact Hourly Cut) */}
                              <tr className="hover:bg-slate-50/40 bg-rose-50/20">
                                <td className="py-2.5 px-4 font-bold text-rose-800">Late Arrival Cut (Exact Hourly Cut) (-)</td>
                                <td className="py-2.5 px-4 text-rose-700 font-mono">
                                  Hourly Rate: Basic ÷ 30 ÷ 8 ({hourlyRate.toLocaleString()} PKR/hr)
                                </td>
                                <td className="py-2.5 px-4 text-rose-800 font-semibold font-mono">
                                  {myLine.totalLateHours || 0} Hours Late ({myLine.lateDays || 0} late days)
                                </td>
                                <td className="py-2.5 px-4 text-right font-bold text-rose-700 font-mono">
                                  -{Number(myLine.lateDeduction || 0).toLocaleString()} PKR
                                </td>
                              </tr>
                            </tbody>

                            {/* Table Footer: Total Amount */}
                            <tfoot>
                              <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white font-bold">
                                <td colSpan={3} className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-indigo-200">
                                  TOTAL PAYABLE AMOUNT (NET SALARY TRANSFERRED)
                                </td>
                                <td className="py-3.5 px-4 text-right text-base sm:text-lg font-black text-emerald-400 font-mono">
                                  {Number(myLine.netPay || 0).toLocaleString()} PKR
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* POORE MONTH KA 30-DAY RECORD TABLE FOR EMPLOYEE */}
                        {expandedMonthRecordEmpId === payroll.id && (
                          <div className="p-4 sm:p-5 bg-slate-900 text-white border-t border-slate-800">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-3">
                              <div>
                                <strong className="text-sm font-bold text-white flex items-center gap-2">
                                  <span>📅</span> Poora 30-Day Monthly Attendance &amp; Salary Register ({payroll.month})
                                </strong>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Standard 30 Days Month · Day-by-Day Attendance, Check-In/Out, Late Hours Cut, Overtime Pay &amp; Daily Wages
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Daily: <strong className="text-indigo-300">{dailyRate.toLocaleString()} PKR</strong></span>
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Hourly: <strong className="text-emerald-300">{hourlyRate.toLocaleString()} PKR</strong></span>
                              </div>
                            </div>

                            <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70">
                              <table className="w-full text-left text-xs divide-y divide-slate-800">
                                <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  <tr>
                                    <th className="py-2.5 px-3">Day / Date</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Check-In</th>
                                    <th className="py-2.5 px-3">Check-Out</th>
                                    <th className="py-2.5 px-3">Duty Hours</th>
                                    <th className="py-2.5 px-3 text-rose-400">Late Hours Cut (-)</th>
                                    <th className="py-2.5 px-3 text-emerald-400">Overtime (+)</th>
                                    <th className="py-2.5 px-3 text-right">Day Net Earning</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-medium">
                                  {(myLine.monthlyRecords && myLine.monthlyRecords.length > 0 ? myLine.monthlyRecords : (() => {
                                    const days = [];
                                    const m = payroll.month || "2026-10";
                                    const todayStr = new Date().toISOString().slice(0, 10);
                                    for (let i = 1; i <= 30; i++) {
                                      const dStr = `${m}-${String(i).padStart(2, "0")}`;
                                      const dObj = new Date(`${dStr}T12:00:00Z`);
                                      const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dObj.getUTCDay()];
                                      const isFuture = dStr > todayStr;
                                      const isToday = dStr === todayStr;
                                      const rec = attendance.find((a) => a.date === dStr);
                                      const lv = leaves.find((l) => l.status === "approved" && dStr >= l.startDate && dStr <= l.endDate);
                                      let st = "absent";
                                      let stLbl = "Absent (Cut)";
                                      let dutyH = Number(rec?.totalWorkHours || 0);
                                      let otH = Number(rec?.overtimeHours || (dutyH > 8 ? dutyH - 8 : 0));
                                      let otPay = Math.round(otH * (hourlyRate * 1.5));
                                      let ltH = 0;
                                      let ltCut = 0;
                                      let abCut = 0;
                                      let dEarned = 0;
                                      if (rec) {
                                        if (dutyH >= 8.0) {
                                          if (rec.status === "late" || rec.isLate) {
                                            st = "late"; stLbl = "Present (Late)";
                                            ltH = Number(rec.lateHours || 1);
                                            ltCut = Math.round(ltH * hourlyRate);
                                            dEarned = Math.round(dailyRate - ltCut + otPay);
                                          } else {
                                            st = "present"; stLbl = "Full Duty (8h)"; dEarned = Math.round(dailyRate + otPay);
                                          }
                                        } else if (dutyH > 0) {
                                          const exactMinutes = Math.round(dutyH * 60);
                                          st = "partial";
                                          stLbl = exactMinutes < 60 ? `Duty: ${exactMinutes} mins` : `Duty: ${dutyH.toFixed(2)} hrs`;
                                          dEarned = Math.round(dutyH * hourlyRate);
                                          abCut = Math.max(0, Math.round((8 - dutyH) * hourlyRate));
                                        } else {
                                          st = "absent"; stLbl = "0 hrs duty"; abCut = dailyRate;
                                        }
                                      } else if (lv) {
                                        st = "approved_leave"; stLbl = `Approved ${lv.leaveType} Leave`; dEarned = dailyRate;
                                      } else if (isFuture) {
                                        st = "upcoming"; stLbl = "Upcoming Date"; abCut = 0; dEarned = 0;
                                      } else if (isToday) {
                                        st = "pending_today"; stLbl = "Pending Today"; abCut = 0; dEarned = 0;
                                      } else {
                                        abCut = dailyRate;
                                      }
                                      days.push({ day: i, date: dStr, dayOfWeek, status: st, statusLabel: stLbl, checkInAt: rec?.checkInAt, checkOutAt: rec?.checkOutAt, dutyHours: dutyH, lateHours: ltH, lateCut: ltCut, overtimeHours: otH, overtimePay: otPay, absentCut: abCut, dayEarned: dEarned, isUpcoming: isFuture });
                                    }
                                    return days;
                                  })()).map((day) => (
                                    <tr key={day.day} className="hover:bg-slate-800/40">
                                      <td className="py-2 px-3 font-mono font-bold text-slate-200">
                                        Day {day.day} · {day.dayOfWeek}, {day.date}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          day.isUpcoming || day.status === "upcoming" ? "bg-slate-800 text-slate-400 border border-slate-700" :
                                          day.status === "pending_today" ? "bg-indigo-950/80 text-indigo-300 border border-indigo-700/60" :
                                          day.status === "present" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                                          day.status === "late" ? "bg-amber-950 text-amber-300 border border-amber-800" :
                                          day.status === "partial" ? "bg-blue-950 text-blue-300 border border-blue-800" :
                                          day.status === "half_day" ? "bg-purple-950 text-purple-300 border border-purple-800" :
                                          day.status === "approved_leave" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" :
                                          "bg-rose-950 text-rose-300 border border-rose-800"
                                        }`}>
                                          {day.statusLabel || (day.isUpcoming || day.status === "upcoming" ? "Upcoming Date" : day.status)}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-300 font-mono">
                                        {day.isUpcoming || day.status === "upcoming" ? <span className="text-slate-600">—</span> : formatTime(day.checkInAt)}
                                      </td>
                                      <td className="py-2 px-3 text-slate-300 font-mono">
                                        {day.isUpcoming || day.status === "upcoming" ? <span className="text-slate-600">—</span> : formatTime(day.checkOutAt)}
                                      </td>
                                      <td className="py-2 px-3 font-mono text-slate-300">
                                        {day.isUpcoming || day.status === "upcoming" ? (
                                          <span className="text-slate-600">—</span>
                                        ) : day.dutyHours > 0 ? (
                                          day.dutyHours < 1 ? `${Math.round(day.dutyHours * 60)} mins` : `${day.dutyHours.toFixed(1)} hrs`
                                        ) : "—"}
                                      </td>
                                      <td className="py-2 px-3 font-mono font-bold text-rose-400">
                                        {!day.isUpcoming && day.lateHours > 0 ? `-${day.lateCut.toLocaleString()} PKR (${day.lateHours}h)` : <span className="text-slate-600 font-normal">—</span>}
                                      </td>
                                      <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                                        {!day.isUpcoming && day.overtimeHours > 0 ? `+${day.overtimePay.toLocaleString()} PKR (${day.overtimeHours}h)` : <span className="text-slate-600 font-normal">—</span>}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-100">
                                        {day.isUpcoming || day.status === "upcoming" ? (
                                          <span className="text-slate-500 font-normal text-[11px]">— (Upcoming)</span>
                                        ) : day.status === "pending_today" ? (
                                          <span className="text-indigo-400/80 font-normal text-[11px]">— (Pending)</span>
                                        ) : day.dayEarned > 0 ? (
                                          <span className="text-emerald-400">+{day.dayEarned.toLocaleString()} PKR</span>
                                        ) : (
                                          <span className="text-rose-400">0 PKR (Cut)</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="sticky bottom-0 bg-slate-900 border-t-2 border-indigo-500 font-bold">
                                  <tr>
                                    <td colSpan={5} className="py-3 px-3 text-slate-300 text-xs font-bold uppercase tracking-wider">
                                      Month Total ({payroll.month}): {myLine.presentDays || 0} Present · {myLine.approvedPaidLeaves || 0} Leaves · {myLine.absentDays || 0} Absents · {myLine.totalLateHours || 0}h Late · {myLine.totalOvertimeHours || 0}h OT
                                    </td>
                                    <td className="py-3 px-3 text-rose-400 font-mono text-xs">
                                      Late: -{Number(myLine.lateDeduction || 0).toLocaleString()} PKR
                                    </td>
                                    <td className="py-3 px-3 text-emerald-400 font-mono text-xs">
                                      OT: +{Number(myLine.overtimePay || 0).toLocaleString()} PKR
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-sm text-emerald-400 font-black">
                                      Total Net: {Number(myLine.netPay || 0).toLocaleString()} PKR
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 4: PROFILE                                           */}
        {/* -------------------------------------------------------- */}
        {tab === "profile" && (
          <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-150">
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-7 md:p-8 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-1">Employment Profile</h3>
              <p className="text-xs text-slate-500 mb-5 sm:mb-6">Your verified employee records stored in the company database.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3 bg-slate-50/80 p-5 rounded-2xl border border-slate-100 text-xs">
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Official Record</h4>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Full Name</span>
                    <strong className="text-slate-800">{profile?.name}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Work Email</span>
                    <strong className="text-slate-800">{profile?.email}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Department</span>
                    <strong className="text-indigo-700 font-bold">{profile?.department}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Designation</span>
                    <strong className="text-slate-800">{profile?.designation || "Staff"}</strong>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Base Salary</span>
                    <strong className="text-emerald-700 font-bold">{Number(profile?.salary || 0).toLocaleString()} PKR</strong>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Update Contact Info</h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="03XXXXXXXXX"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                    <textarea
                      rows={3}
                      placeholder="Street, City, Country"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {savingProfile ? "Saving..." : "Save Contact Info"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- */}
      {/* APPLY LEAVE MODAL                                        */}
      {/* -------------------------------------------------------- */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs animate-in fade-in" onClick={() => setShowApplyModal(false)} />
          <div className="relative z-50 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Apply for Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-700 p-1">✕</button>
            </div>

            <form onSubmit={handleApplyLeave} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type *</label>
                <select
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="casual">Casual Leave (10 days quota)</option>
                  <option value="sick">Sick Leave (8 days quota)</option>
                  <option value="annual">Annual Leave (14 days quota)</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    required
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
                  <input
                    required
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Attending family function..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyingLeave}
                  className="rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {applyingLeave ? "Submitting..." : "Submit Application →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* PAYSLIP MODAL (PRINTABLE / DOWNLOADABLE)                  */}
      {/* -------------------------------------------------------- */}
      {activePayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs animate-in fade-in" onClick={() => setActivePayslip(null)} />
          <div className="relative z-50 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 sm:pb-4 gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Official Payslip</span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">{activePayslip.employeeName}</h3>
                <small className="text-slate-500">{activePayslip.department} · {activePayslip.month}</small>
              </div>
              <button onClick={() => setActivePayslip(null)} className="text-slate-400 hover:text-slate-700 p-1">✕</button>
            </div>

            <div className="mt-4 sm:mt-5 space-y-4 text-xs">
              {/* Rates & 30-Day Base Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center font-mono">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Standard Base</span>
                  <strong className="text-xs font-bold text-slate-800">30 Working Days</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Daily Rate (Base÷30)</span>
                  <strong className="text-xs font-bold text-indigo-700">
                    {Number(activePayslip.perDayRate || Math.round((activePayslip.basic || 0) / 30)).toLocaleString()} PKR
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Hourly Rate (Daily÷8)</span>
                  <strong className="text-xs font-bold text-indigo-700">
                    {Number(activePayslip.hourlyRate || Math.round((activePayslip.basic || 0) / 240)).toLocaleString()} PKR
                  </strong>
                </div>
              </div>

              {/* Complete Itemized Calculation Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Component</th>
                      <th className="py-2.5 px-3">Formula / Basis</th>
                      <th className="py-2.5 px-3">Units</th>
                      <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {/* Basic Salary */}
                    <tr>
                      <td className="py-2 px-3 font-bold text-slate-800">Basic Monthly Base</td>
                      <td className="py-2 px-3 text-slate-500">30 Working Days Base</td>
                      <td className="py-2 px-3 font-mono">30 Days</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                        +{Number(activePayslip.basic || activePayslip.basicSalary || 0).toLocaleString()} PKR
                      </td>
                    </tr>

                    {/* Attendance Present */}
                    <tr>
                      <td className="py-2 px-3 text-slate-700">Attendance (Present)</td>
                      <td className="py-2 px-3 text-slate-500">Full Daily Work Duty</td>
                      <td className="py-2 px-3 text-emerald-700 font-mono font-semibold">{activePayslip.presentDays || 0} Days</td>
                      <td className="py-2 px-3 text-right text-emerald-600 font-mono">Included in Base</td>
                    </tr>

                    {/* Approved Paid Leaves */}
                    <tr>
                      <td className="py-2 px-3 text-slate-700">Approved Paid Leaves</td>
                      <td className="py-2 px-3 text-slate-500">Casual / Sick / Annual</td>
                      <td className="py-2 px-3 text-indigo-700 font-mono font-semibold">{activePayslip.approvedPaidLeaves || 0} Days</td>
                      <td className="py-2 px-3 text-right text-indigo-600 font-mono">100% Paid (0 PKR)</td>
                    </tr>

                    {/* Overtime Pay */}
                    <tr className="bg-emerald-50/25">
                      <td className="py-2 px-3 font-bold text-emerald-800">Overtime Addition (+)</td>
                      <td className="py-2 px-3 text-emerald-700 font-mono">1.5× Hourly Rate</td>
                      <td className="py-2 px-3 text-emerald-800 font-mono">{activePayslip.totalOvertimeHours || 0} hrs</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">
                        +{Number(activePayslip.overtimePay || 0).toLocaleString()} PKR
                      </td>
                    </tr>

                    {/* Absent Cut */}
                    <tr className="bg-rose-50/25">
                      <td className="py-2 px-3 font-bold text-rose-800">Absent / Unpaid Cut (-)</td>
                      <td className="py-2 px-3 text-rose-700 font-mono">Daily Rate (Basic ÷ 30)</td>
                      <td className="py-2 px-3 text-rose-800 font-mono">{activePayslip.absentDays || 0} days</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700 font-mono">
                        -{Number(activePayslip.absentDeduction || activePayslip.deductions || 0).toLocaleString()} PKR
                      </td>
                    </tr>

                    {/* Late Penalty Cut (Exact Hourly Cut) */}
                    <tr className="bg-rose-50/25">
                      <td className="py-2 px-3 font-bold text-rose-800">Late Arrival Cut (-)</td>
                      <td className="py-2 px-3 text-rose-700 font-mono">Hourly Cut: Basic ÷ 30 ÷ 8</td>
                      <td className="py-2 px-3 text-rose-800 font-mono">{activePayslip.totalLateHours || 0} hrs late ({activePayslip.lateDays || 0} days)</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-700 font-mono">
                        -{Number(activePayslip.lateDeduction || 0).toLocaleString()} PKR
                      </td>
                    </tr>
                  </tbody>

                  {/* Table Footer: Total Amount */}
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white font-bold">
                      <td colSpan={3} className="py-3 px-3 text-xs font-black uppercase tracking-wider text-indigo-200">
                        TOTAL PAYABLE AMOUNT (NET SALARY)
                      </td>
                      <td className="py-3 px-3 text-right text-base font-black text-emerald-400 font-mono">
                        {Number(activePayslip.netPay || 0).toLocaleString()} PKR
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => window.print()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs"
                >
                  Print Official Payslip 🖨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      <AIAssistantModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onLeaveSubmitted={loadData}
      />
    </main>
  );
}
