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
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{s.toUpperCase()}</span>;
  }
  if (s === "late" || s === "pending") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/80"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{s.toUpperCase()}</span>;
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
        clearClientSession();
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
        clearClientSession();
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

      if ([attRes, leaveRes, payRes, empRes, dashRes].some((response) => response && (response.status === 401 || response.status === 403))) {
        clearClientSession();
        window.location.assign("/login");
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

  const liveHours = (record) => {
    if (!record?.checkInAt) return 0;
    if (record.checkOutAt) return Number(record.totalWorkHours || 0);
    return Math.max(0, (currentTime - new Date(record.checkInAt).getTime()) / 3600000);
  };

  const todayHours = todayRecord ? liveHours(todayRecord) : 0;
  const todayOvertime = todayHours > 8 ? Number((todayHours - 8).toFixed(2)) : 0;
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
      {/* Frosted Glass Top Navigation */}
      <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-8 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-lg font-black text-white shadow-md shadow-indigo-500/20">
            h
          </span>
          <div>
            <strong className="text-sm font-extrabold tracking-tight text-slate-900 block leading-tight">HCM Lite</strong>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Employee Portal</span>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setTab("attendance")}
              className={`rounded-lg px-3 py-1.5 transition-all duration-150 ${tab === "attendance" ? "bg-white text-indigo-600 shadow-xs font-bold" : "hover:text-slate-900"}`}
            >
              Attendance
            </button>
            <button
              onClick={() => setTab("leaves")}
              className={`rounded-lg px-3 py-1.5 transition-all duration-150 ${tab === "leaves" ? "bg-white text-indigo-600 shadow-xs font-bold" : "hover:text-slate-900"}`}
            >
              Leaves
            </button>
            <button
              onClick={() => setTab("payslips")}
              className={`rounded-lg px-3 py-1.5 transition-all duration-150 ${tab === "payslips" ? "bg-white text-indigo-600 shadow-xs font-bold" : "hover:text-slate-900"}`}
            >
              My Payslips
            </button>
            <button
              onClick={() => setTab("profile")}
              className={`rounded-lg px-3 py-1.5 transition-all duration-150 ${tab === "profile" ? "bg-white text-indigo-600 shadow-xs font-bold" : "hover:text-slate-900"}`}
            >
              Profile
            </button>
          </nav>

          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95"
          >
            <IconSparkles className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Ask Humi AI</span>
          </button>

          <button onClick={logout} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors" title="Sign Out">
            <IconLogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero Welcome Card with Radiant Gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-violet-950 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/10 border border-indigo-800/40">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
          <div className="absolute right-48 -bottom-16 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-200 backdrop-blur-md border border-white/10 mb-3">
                <IconCalendar className="w-3.5 h-3.5 text-indigo-300" />
                <span>{todayLabel}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {profile?.name || "Team Member"}!
              </h1>
              <p className="mt-1 text-xs text-indigo-200/80 font-medium">
                {profile?.designation || "Staff"} · {profile?.department || "General Department"}
              </p>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 p-3 backdrop-blur-md border border-white/10 text-xs">
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
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Today Arrival</span>
                  <IconClock className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <strong className="text-2xl font-black text-slate-900">
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

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Duty Hours (8h)</span>
                  <IconUserCheck className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <strong className="text-2xl font-black text-slate-900">
                    {todayHours.toFixed(2)} hrs
                  </strong>
                  <span className="text-xs text-slate-400">/ 8.0 hrs standard</span>
                </div>
                <div className="mt-1 text-xs text-slate-500 font-medium">
                  {todayRecord?.checkOutAt ? `Departed at ${formatTime(todayRecord.checkOutAt)}` : todayRecord ? "Timer running" : "Not started"}
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Overtime Earned</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <strong className={`text-2xl font-black ${todayOvertime > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                    +{todayOvertime.toFixed(2)} hrs
                  </strong>
                </div>
                <div className="mt-1 text-xs text-emerald-700 font-medium">
                  {todayOvertime > 0 ? "1.5× rate added to salary" : "Overtime starts after 8 hours"}
                </div>
              </div>
            </div>

            {/* Check-In / Check-Out Action Surface */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Daily Attendance Stamping</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1-Click web check-in. Office duty standard is 8.0 hours.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {!todayRecord && (
                    <button
                      onClick={() => attendanceAction("check-in")}
                      disabled={Boolean(actionLoading)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:from-indigo-500 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === "check-in" ? "Recording Arrival..." : "Check In Now"}
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {todayRecord && !todayRecord.checkOutAt && (
                    <button
                      onClick={() => attendanceAction("check-out")}
                      disabled={Boolean(actionLoading)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/25 hover:from-rose-500 hover:to-red-500 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === "check-out" ? "Recording Departure..." : "Check Out Now"}
                      <IconArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {todayRecord && todayRecord.checkOutAt && (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
                      <IconCheckCircle className="w-4 h-4 text-emerald-600" />
                      Day Completed ({formatTime(todayRecord.checkInAt)} – {formatTime(todayRecord.checkOutAt)})
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 font-bold">
                    <IconClock className="w-5 h-5" />
                  </span>
                  <div>
                    <strong className="block text-xs font-bold text-slate-800">
                      {todayRecord ? `Arrival recorded at ${formatTime(todayRecord.checkInAt)}` : "Awaiting check-in for today"}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      {todayRecord
                        ? `Departure: ${formatTime(todayRecord.checkOutAt)} · Duty: ${todayHours.toFixed(2)}h ${todayOvertime > 0 ? `(+${todayOvertime.toFixed(2)}h Overtime)` : ""}`
                        : "Click 'Check In Now' to stamp your official arrival time."}
                    </span>
                  </div>
                </div>

                {todayRecord && (
                  <strong className="text-base font-extrabold text-indigo-600 font-mono">
                    {todayHours.toFixed(2)}h
                  </strong>
                )}
              </div>
            </div>

            {/* Attendance History (Date-Wise) */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Attendance History</h3>
                  <p className="text-xs text-slate-500">Sorted by date showing arrival, departure, duty, and overtime.</p>
                </div>
                <span className="text-xs font-semibold text-slate-400">Total: {attendance.length} entries</span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading attendance records...</div>
              ) : attendance.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No attendance records found yet.</div>
              ) : (
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-left text-xs">
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
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 2: LEAVES & SELF-SERVICE                             */}
        {/* -------------------------------------------------------- */}
        {tab === "leaves" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Quota Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-xs">
                <small className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Casual Leaves</small>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-3xl font-black text-indigo-900">10</strong>
                  <span className="text-xs text-slate-400">/ 10 days quota</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Short personal off-days</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-xs">
                <small className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Sick Leaves</small>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-3xl font-black text-emerald-900">8</strong>
                  <span className="text-xs text-slate-400">/ 8 days quota</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Medical emergencies</p>
              </div>

              <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-xs">
                <small className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Annual Leaves</small>
                <div className="mt-2 flex items-baseline gap-2">
                  <strong className="text-3xl font-black text-violet-900">14</strong>
                  <span className="text-xs text-slate-400">/ 14 days quota</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Planned vacations</p>
              </div>
            </div>

            {/* Leave Applications History */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">My Leave Requests</h3>
                  <p className="text-xs text-slate-500">Applications are reviewed and approved directly by Admin &amp; HR.</p>
                </div>
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                >
                  + Apply for Leave
                </button>
              </div>

              {leaves.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No leave requests submitted yet. Click &quot;Apply for Leave&quot; above.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
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
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 3: PAYSLIPS & SALARY BREAKDOWN                       */}
        {/* -------------------------------------------------------- */}
        {tab === "payslips" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Monthly Payslip Archive</h3>
                <p className="text-xs text-slate-500">Live breakdown of basic salary, overtime additions, and deductions.</p>
              </div>

              {payrolls.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No payroll runs finalized yet. Once Admin runs monthly payroll, payslips will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3">Month</th>
                        <th className="py-3 px-3">Base Salary</th>
                        <th className="py-3 px-3">Overtime (+)</th>
                        <th className="py-3 px-3">Late Cuts (-)</th>
                        <th className="py-3 px-3">Absent Cuts (-)</th>
                        <th className="py-3 px-3">Net Payable</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {payrolls.map((payroll) => {
                        const myLine = payroll.lines?.find((l) => l.employeeId === profile?.id);
                        if (!myLine) return null;
                        return (
                          <tr key={payroll.id} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-3.5 px-3 font-bold text-slate-900">{payroll.month}</td>
                            <td className="py-3.5 px-3 text-slate-700">
                              {Number(myLine.basic || profile?.salary || 0).toLocaleString()} PKR
                            </td>
                            <td className="py-3.5 px-3 font-bold text-emerald-600">
                              +{Number(myLine.overtimePay || 0).toLocaleString()} PKR ({myLine.totalOvertimeHours || 0}h)
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-rose-600">
                              -{Number(myLine.lateDeduction || 0).toLocaleString()} PKR
                            </td>
                            <td className="py-3.5 px-3 font-semibold text-rose-600">
                              -{Number(myLine.absentDeduction || myLine.deductions || 0).toLocaleString()} PKR
                            </td>
                            <td className="py-3.5 px-3 font-black text-indigo-700 text-sm">
                              {Number(myLine.netPay || 0).toLocaleString()} PKR
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                onClick={() => viewPayslip(payroll.id, profile.id)}
                                className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                              >
                                View Payslip 📄
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* TAB 4: PROFILE                                           */}
        {/* -------------------------------------------------------- */}
        {tab === "profile" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-1">Employment Profile</h3>
              <p className="text-xs text-slate-500 mb-6">Your verified employee records stored in the company database.</p>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in" onClick={() => setShowApplyModal(false)} />
          <div className="relative z-50 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Apply for Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
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

              <div className="grid grid-cols-2 gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in" onClick={() => setActivePayslip(null)} />
          <div className="relative z-50 w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Official Payslip</span>
                <h3 className="text-xl font-bold text-slate-900">{activePayslip.employeeName}</h3>
                <small className="text-slate-500">{activePayslip.department} · {activePayslip.month}</small>
              </div>
              <button onClick={() => setActivePayslip(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">Working Days in Month</span>
                  <strong className="text-sm font-bold text-slate-800">{activePayslip.workingDays} days</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">Per-Day Rate</span>
                  <strong className="text-sm font-bold text-slate-800">{Math.round(activePayslip.perDayRate || 0).toLocaleString()} PKR</strong>
                </div>
              </div>

              <div>
                <span className="block font-bold text-slate-700 mb-1.5 uppercase text-[10px]">Earnings</span>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <div className="flex justify-between p-2.5">
                    <span className="text-slate-600">Basic Salary</span>
                    <b className="text-slate-800">{Number(activePayslip.basic || activePayslip.basicSalary || 0).toLocaleString()} PKR</b>
                  </div>
                  <div className="flex justify-between p-2.5 text-emerald-700">
                    <span>Overtime ({activePayslip.totalOvertimeHours || 0} hrs @ 1.5× rate)</span>
                    <b className="font-extrabold">+{Number(activePayslip.overtimePay || 0).toLocaleString()} PKR</b>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-50 font-bold">
                    <span>Total Gross Earnings</span>
                    <span className="text-indigo-700">{Number(activePayslip.gross || 0).toLocaleString()} PKR</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="block font-bold text-slate-700 mb-1.5 uppercase text-[10px]">Deductions &amp; Tax</span>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <div className="flex justify-between p-2.5 text-rose-600">
                    <span>Late Arrival Deductions ({activePayslip.lateDays || 0} times)</span>
                    <b className="font-semibold">-{Number(activePayslip.lateDeduction || 0).toLocaleString()} PKR</b>
                  </div>
                  <div className="flex justify-between p-2.5 text-rose-600">
                    <span>Absent &amp; Unpaid Leave ({activePayslip.absentDays || 0} days)</span>
                    <b className="font-semibold">-{Number(activePayslip.absentDeduction || activePayslip.deductions || 0).toLocaleString()} PKR</b>
                  </div>
                  <div className="flex justify-between p-2.5 text-rose-600">
                    <span>Income Tax</span>
                    <b className="font-semibold">-{Number(activePayslip.tax || 0).toLocaleString()} PKR</b>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white shadow-md shadow-indigo-500/25">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider opacity-80">Net Payable Salary</span>
                  <strong className="text-2xl font-black">{Number(activePayslip.netPay || 0).toLocaleString()} PKR</strong>
                </div>
                <button onClick={() => window.print()} className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-slate-50">
                  Print Payslip 🖨
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
