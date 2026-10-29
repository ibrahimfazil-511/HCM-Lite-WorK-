"use client";

import { useEffect, useMemo, useState } from "react";
import AIAssistantModal from "./AIAssistantModal.js";
import { getAISummary, safeResponseJson } from "../lib/api.js";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, Label, Textarea, Select } from "./ui/input";
import {
  IconSparkles,
  IconClock,
  IconCalendar,
  IconUsers,
  IconDollarSign,
  IconCheckCircle,
  IconAlertCircle,
  IconArrowRight,
  IconSearch,
  IconFileText,
  IconDownload,
  IconUpload,
  IconPlus,
  IconRefreshCw,
  IconShieldCheck,
  IconLogOut,
  IconLayers,
  IconLock,
  IconTrendingUp,
  IconSend,
} from "./ui/icons";

const HR_NAV_ITEMS = [
  { id: "Overview", label: "HR Dashboard", icon: IconLayers },
  { id: "Employees", label: "Employees 360", icon: IconUsers },
  { id: "Attendance", label: "Attendance Board", icon: IconClock },
  { id: "Leave approvals", label: "Leave Inbox", icon: IconCalendar },
  { id: "Payroll", label: "Payroll Drafts", icon: IconDollarSign },
  { id: "Announcements", label: "Announcements", icon: IconSend },
];

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
];

const DEPARTMENTS = ["Engineering", "Design", "People & Culture", "Operations", "Finance", "Sales"];

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatTime(value) {
  return value ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function HRDashboard() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionId, setActionId] = useState("");
  const [now, setNow] = useState(null);
  const [userRole, setUserRole] = useState("HR");

  // Modals
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [activePayslip, setActivePayslip] = useState(null);
  const [createdLoginInfo, setCreatedLoginInfo] = useState(null);

  // Add Employee Form State
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    email: "",
    department: "Engineering",
    designation: "",
    salary: "",
    phone: "",
    address: "",
  });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [submittingEmployee, setSubmittingEmployee] = useState(false);

  // CSV Import State
  const [csvText, setCsvText] = useState("");
  const [csvDryRunResult, setCsvDryRunResult] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);

  // Payroll draft form
  const [payrollMonth, setPayrollMonth] = useState("2026-10");
  const [runningPayroll, setRunningPayroll] = useState(false);

  // Announcement Form State
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    audience: "ALL",
    priority: "normal",
  });
  const [submittingAnnouncement, setSubmittingAnnouncement] = useState(false);

  // Analytics & Attendance Filter State
  const [dateRange, setDateRange] = useState("this_month");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [attendanceFilterDate, setAttendanceFilterDate] = useState("");
  const [attendanceEmployeeFilter, setAttendanceEmployeeFilter] = useState("all");
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // AI Modal & Summary State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const departmentOptions = useMemo(() => {
    return ["All", ...new Set([...DEPARTMENTS, ...employees.map((e) => e.department).filter(Boolean)])];
  }, [employees]);

  async function loadAnalytics(range = dateRange, dept = selectedDepartment) {
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem("hcm_token");
      const headers = { Authorization: `Bearer ${token}` };
      const queryParams = new URLSearchParams({
        dateRange: range,
        department: dept === "All" ? "" : dept,
      });
      const response = await fetch(`/api/analytics/dashboard?${queryParams.toString()}`, { headers, cache: "no-store" });
      const data = await safeResponseJson(response, null);
      if (response && response.ok && data) {
        setAnalytics(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function loadHRData() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      if (!token) {
        window.location.assign("/login");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [employeeResponse, attendanceResponse, leaveResponse, payrollResponse, announcementsResponse] = await Promise.all([
        fetch("/api/employees?page=1&pageSize=100", { headers, cache: "no-store" }),
        fetch("/api/attendance", { headers, cache: "no-store" }),
        fetch("/api/leaves", { headers, cache: "no-store" }),
        fetch("/api/payroll", { headers, cache: "no-store" }),
        fetch("/api/announcements", { headers, cache: "no-store" }),
      ]);

      if ([employeeResponse, attendanceResponse, leaveResponse].some((r) => r && (r.status === 401 || r.status === 403))) {
        localStorage.removeItem("hcm_token");
        window.location.assign("/login");
        return;
      }

      const [employeeData, attendanceData, leaveData, payrollData, annData] = await Promise.all([
        safeResponseJson(employeeResponse, { employees: [] }),
        safeResponseJson(attendanceResponse, { attendance: [] }),
        safeResponseJson(leaveResponse, { leaves: [] }),
        safeResponseJson(payrollResponse, { payrolls: [] }),
        safeResponseJson(announcementsResponse, { announcements: [] }),
      ]);

      const failed = [employeeResponse, attendanceResponse, leaveResponse].find((response) => response && !response.ok);
      if (failed) throw new Error(employeeData?.error || attendanceData?.error || leaveData?.error || "Unable to load HR data.");

      setEmployees(employeeData?.employees || []);
      setAttendance(attendanceData?.attendance || []);
      setLeaves(leaveData?.leaves || []);
      setPayrolls(payrollData?.payrolls || []);
      setAnnouncements(annData?.announcements || []);
      loadAnalytics(dateRange, selectedDepartment);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    const todayStr = dateKey(new Date());
    setNow(new Date());
    setAttendanceFilterDate(todayStr);
    setPayrollMonth(todayStr.slice(0, 7));
    try {
      const token = localStorage.getItem("hcm_token");
      if (token) {
        const payload = JSON.parse(window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload?.role) setUserRole(payload.role);
      }
    } catch {}
    loadHRData();
  }, []);

  const today = now ? dateKey(now) : "";
  const todayAttendance = attendance.filter((record) => record.date === (attendanceFilterDate || today));
  const pendingLeaves = leaves.filter((leave) => leave.status === "pending");
  const onLeaveToday = leaves.filter((leave) => leave.status === "approved" && leave.startDate <= today && leave.endDate >= today);
  const attendanceRate = analytics?.hr?.kpis?.attendanceRate ?? (employees.length ? Math.round((todayAttendance.length / employees.length) * 100) : 0);

  const filteredEmployees = useMemo(
    () => employees.filter((employee) => `${employee.name} ${employee.email} ${employee.department} ${employee.designation}`.toLowerCase().includes(query.toLowerCase())),
    [employees, query]
  );
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  async function handleCreateEmployee(e) {
    e.preventDefault();
    setSubmittingEmployee(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...employeeForm,
          salary: Number(employeeForm.salary),
        }),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) {
        const errorDetails = data.errors ? data.errors.map((err) => `${err.field}: ${err.reason}`).join(", ") : data.error;
        throw new Error(errorDetails || "Could not register employee.");
      }

      setCreatedLoginInfo({
        name: data.employee.name,
        email: data.employee.email,
        temporaryPassword: data.temporaryPassword,
        department: data.employee.department,
      });

      setEmployeeForm({
        name: "",
        email: "",
        department: "Engineering",
        designation: "",
        salary: "",
        phone: "",
        address: "",
      });
      setShowAddEmployeeModal(false);
      setSuccessMsg(`Employee ${data.employee.name} registered successfully with login created in Supabase!`);
      await loadHRData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingEmployee(false);
    }
  }

  async function handleUpdateEmployee(e) {
    e.preventDefault();
    if (!editingEmployee) return;
    setSubmittingEmployee(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editingEmployee.name,
          department: editingEmployee.department,
          designation: editingEmployee.designation,
          salary: Number(editingEmployee.salary),
          phone: editingEmployee.phone,
          address: editingEmployee.address,
        }),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Failed to update employee details.");

      setShowEditEmployeeModal(false);
      setEditingEmployee(null);
      setSuccessMsg(`Employee ${data.employee.name} updated successfully in Supabase!`);
      await loadHRData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingEmployee(false);
    }
  }

  async function handleCsvImport(dryRun = true) {
    setCsvLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/employees/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ csvText, dryRun }),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) {
        throw new Error(data.error || "CSV parsing error.");
      }

      if (dryRun) {
        setCsvDryRunResult(data);
      } else {
        setSuccessMsg(`Successfully imported ${data.importedCount} employees with temporary logins created in Supabase!`);
        setShowCsvModal(false);
        setCsvText("");
        setCsvDryRunResult(null);
        await loadHRData();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCsvLoading(false);
    }
  }

  function handleCsvExport() {
    const token = localStorage.getItem("hcm_token");
    window.open(`/api/employees/csv?token=${token}`, "_blank");
  }

  async function updateLeave(leave, status) {
    setActionId(leave.id);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      const comment = window.prompt(`${status === "approved" ? "Approval" : "Rejection"} comment (optional):`, "") ?? "";
      const response = await fetch(`/api/leaves/${leave.id}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, hrComment: comment }),
      });
      const result = await safeResponseJson(response, {});
      if (!response.ok) throw new Error(result.error || "Unable to update leave.");
      setLeaves((current) => current.map((item) => (item.id === leave.id ? result.leave : item)));
      loadAnalytics(dateRange, selectedDepartment);
      setSuccessMsg(`Leave request for ${employeeMap.get(leave.employeeId)?.name || "Employee"} marked as ${status}!`);
    } catch (actionError) {
      if (actionError.name !== "AbortError") setError(actionError.message);
    } finally {
      setActionId("");
    }
  }

  async function handleCreatePayrollDraft() {
    setRunningPayroll(true);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: payrollMonth }),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Could not generate payroll draft.");
      setSuccessMsg(`Payroll draft for ${payrollMonth} generated with dynamic overtime and deduction calculation!`);
      await loadHRData();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningPayroll(false);
    }
  }

  async function viewEmployeePayslip(payrollId, employeeId) {
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

  async function handleCreateAnnouncement(e) {
    e.preventDefault();
    setSubmittingAnnouncement(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(announcementForm),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Failed to post announcement.");
      setSuccessMsg(`Announcement "${data.announcement.title}" broadcasted to team in Supabase!`);
      setShowAnnouncementModal(false);
      setAnnouncementForm({ title: "", content: "", audience: "ALL", priority: "normal" });
      await loadHRData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingAnnouncement(false);
    }
  }

  async function handleSummarize() {
    setLoadingSummary(true);
    try {
      const summaryResult = await getAISummary({
        headcount: employees.length,
        attendanceRate,
        onLeaveToday: onLeaveToday.length,
        lateToday: todayAttendance.filter((r) => r.status === "late").length,
        payrollCost: analytics?.admin?.kpis?.payrollCost || 0,
      });
      setAiSummary(summaryResult.summary || []);
    } catch (err) {
      window.alert(err.message || "Failed to generate AI executive summary.");
    } finally {
      setLoadingSummary(false);
    }
  }

  function logout() {
    localStorage.removeItem("hcm_token");
    window.location.assign("/login");
  }

  if (!mounted) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600 font-medium text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
          <span>Loading HR Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      {/* -------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION                                       */}
      {/* -------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-lg font-black text-white shadow-md shadow-violet-500/25">
              HR
            </span>
            <div>
              <strong className="block text-sm font-bold tracking-tight text-slate-900">HCM Lite</strong>
              <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-widest">People Operations</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
          >
            ✕
          </button>
        </div>

        {/* Database Status Tag */}
        <div className="mx-4 my-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-emerald-800">Supabase Cloud Active</span>
          </div>
          <p className="text-[10px] text-emerald-600/90 mt-0.5">
            {employees.length} Employees Live Synchronized
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 px-3 py-2">
          {HR_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = active === item.id;
            const badgeCount = item.id === "Leave approvals" ? pendingLeaves.length : null;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActive(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 font-bold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isSelected ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                  <span>{item.label}</span>
                </div>
                {badgeCount !== null && badgeCount > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200">
                {userRole === "ADMIN" ? "AD" : "HR"}
              </span>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800 leading-tight">
                  {userRole === "ADMIN" ? "Mohammad Asif" : "Sarah Ahmed"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {userRole === "ADMIN" ? "Administrator Access" : "People Ops (HR)"}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors"
              title="Sign Out"
            >
              <IconLogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* -------------------------------------------------------- */}
      {/* MAIN VIEWPORT AREA                                       */}
      {/* -------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Floating App Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            >
              ☰
            </button>
            <h1 className="text-base font-bold text-slate-900 hidden sm:block">
              {HR_NAV_ITEMS.find((n) => n.id === active)?.label || "HR Workspace"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {userRole === "ADMIN" && (
              <a
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
              >
                ← Back to Admin
              </a>
            )}

            <button
              onClick={() => setAiModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
            >
              <IconSparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Ask Humi AI</span>
            </button>

            <button
              onClick={() => loadHRData()}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              title="Refresh Live DB Data"
            >
              <IconRefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
          </div>
        </header>

        {/* Global Feedback Notifications */}
        <div className="px-4 sm:px-8 pt-4">
          {successMsg && (
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <IconCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800">✕</button>
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <IconAlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-800">✕</button>
            </div>
          )}
        </div>

        {/* Main Content Workspace */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 max-w-7xl">
          {/* ---------------------------------------------------- */}
          {/* TAB 1: HR DASHBOARD & INSIGHTS (PDF Section 7)       */}
          {/* ---------------------------------------------------- */}
          {active === "Overview" && (
            <div className="space-y-6">
              {/* Top KPI Cards (Section 7 Formula Compliance) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Headcount</span>
                    <IconUsers className="w-4 h-4 text-indigo-500" />
                  </div>
                  <strong className="mt-3 block text-2xl font-black text-slate-900">{employees.length}</strong>
                  <span className="text-xs text-slate-500 font-medium">Active workforce</span>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-xs">
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Present Today</span>
                    <IconCheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <strong className="mt-3 block text-2xl font-black text-emerald-800">{todayAttendance.length}</strong>
                  <span className="text-xs text-emerald-700 font-medium">Attendance Rate: {attendanceRate}%</span>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-xs">
                  <div className="flex items-center justify-between text-amber-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">On Leave Today</span>
                    <IconCalendar className="w-4 h-4 text-amber-600" />
                  </div>
                  <strong className="mt-3 block text-2xl font-black text-amber-800">{onLeaveToday.length}</strong>
                  <span className="text-xs text-amber-700 font-medium">Approved leaves active</span>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-xs">
                  <div className="flex items-center justify-between text-rose-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Late Today</span>
                    <IconClock className="w-4 h-4 text-rose-600" />
                  </div>
                  <strong className="mt-3 block text-2xl font-black text-rose-800">
                    {todayAttendance.filter((r) => r.status === "late").length}
                  </strong>
                  <span className="text-xs text-rose-700 font-medium">Arrived past 09:15 AM</span>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 shadow-xs">
                  <div className="flex items-center justify-between text-violet-700">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Pending Leaves</span>
                    <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                  </div>
                  <strong className="mt-3 block text-2xl font-black text-violet-800">{pendingLeaves.length}</strong>
                  <button
                    onClick={() => setActive("Leave approvals")}
                    className="mt-1 text-xs text-violet-700 hover:underline font-bold flex items-center gap-1"
                  >
                    Review in inbox →
                  </button>
                </div>
              </div>

              {/* AI Executive Summary Banner */}
              <div className="rounded-3xl border border-violet-200/80 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl shadow-indigo-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-violet-200 backdrop-blur-md mb-2">
                    <IconSparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI-Powered Executive Briefing</span>
                  </div>
                  <h3 className="text-lg font-extrabold">Instant HR Insights by Humi AI</h3>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Synthesizes attendance rates, top late-comers, leave queues, and payroll commitments.
                  </p>
                </div>

                <button
                  onClick={handleSummarize}
                  disabled={loadingSummary}
                  className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-indigo-900 shadow-md hover:bg-indigo-50 transition active:scale-95 disabled:opacity-50 shrink-0"
                >
                  {loadingSummary ? "Generating AI Summary..." : "Summarize HR Data ✨"}
                </button>
              </div>

              {aiSummary && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-xs animate-in fade-in space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <IconSparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Executive Summary (Live Database Fact Verified)
                    </strong>
                    <button onClick={() => setAiSummary(null)} className="text-xs text-indigo-400 hover:text-indigo-800">Dismiss</button>
                  </div>
                  <ul className="space-y-1 text-xs font-medium text-slate-700">
                    {aiSummary.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Insights Grid (Attendance Trend & Top Late-Comers) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Attendance Trend Bar Chart */}
                <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Attendance Trend (Recent Workdays)</h3>
                      <p className="text-xs text-slate-400">Daily present vs late attendance rate</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 font-mono">Formula: (P + L + 0.5×HD) ÷ Expected</span>
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-3 h-48 px-2">
                    {(analytics?.hr?.attendanceTrend || [
                      { date: today, rate: attendanceRate, present: todayAttendance.length, late: todayAttendance.filter((r) => r.status === "late").length },
                    ]).map((trend, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition">
                          {trend.rate}%
                        </span>
                        <div
                          style={{ height: `${Math.max(12, trend.rate)}%` }}
                          className="w-full max-w-[42px] rounded-xl bg-gradient-to-t from-violet-600 to-indigo-500 shadow-xs transition-all group-hover:brightness-110"
                          title={`${trend.date}: ${trend.rate}% Attendance (${trend.present} Present, ${trend.late} Late)`}
                        />
                        <span className="text-[10px] text-slate-400 font-medium truncate w-full text-center">
                          {trend.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top 5 Late-Comers (PDF Requirement) */}
                <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Top Late-Comers</h3>
                      <p className="text-xs text-slate-400">Arrivals past 09:15 AM</p>
                    </div>
                    <IconClock className="w-4 h-4 text-rose-500" />
                  </div>

                  <div className="mt-4 divide-y divide-slate-100">
                    {(analytics?.hr?.topLateComers || []).length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        🎉 Zero late check-ins recorded!
                      </div>
                    ) : (
                      (analytics?.hr?.topLateComers || []).slice(0, 5).map((person, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50 text-rose-700 font-black text-xs">
                              {idx + 1}
                            </span>
                            <div>
                              <strong className="block text-xs font-bold text-slate-800">{person.name}</strong>
                              <span className="text-[10px] text-slate-400">{person.department}</span>
                            </div>
                          </div>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                            {person.lateCount} late
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 2: EMPLOYEE MANAGEMENT 360                       */}
          {/* ---------------------------------------------------- */}
          {active === "Employees" && (
            <div className="space-y-4">
              {/* Header Action Surface */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Employee Directory & 360 Profiles</h2>
                  <p className="text-xs text-slate-400">Register new staff, manage salaries, or import/export CSV</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCsvModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    <IconUpload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>CSV Import</span>
                  </button>

                  <button
                    onClick={handleCsvExport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                  >
                    <IconDownload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Export</span>
                  </button>

                  <button
                    onClick={() => setShowAddEmployeeModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition active:scale-95"
                  >
                    <IconPlus className="w-3.5 h-3.5 text-white" />
                    <span>Hire / Add Employee</span>
                  </button>
                </div>
              </div>

              {/* Login Credentials Alert Modal after Employee Created */}
              {createdLoginInfo && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 shadow-sm space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <IconShieldCheck className="w-4 h-4 text-indigo-600" />
                      Employee Login Auto-Generated & Active in Supabase
                    </strong>
                    <button onClick={() => setCreatedLoginInfo(null)} className="text-xs text-indigo-400 hover:text-indigo-800">Close</button>
                  </div>
                  <p className="text-xs text-indigo-900/80">
                    A permanent user account was created for <strong>{createdLoginInfo.name}</strong>. Share these credentials:
                  </p>
                  <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-indigo-100 text-xs font-mono">
                    <div>Email: <strong className="text-slate-800">{createdLoginInfo.email}</strong></div>
                    <span className="text-slate-300">|</span>
                    <div>Temporary Password: <strong className="text-indigo-600">{createdLoginInfo.temporaryPassword}</strong></div>
                  </div>
                </div>
              )}

              {/* Search & Filter Bar */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                <IconSearch className="w-4 h-4 text-slate-400 ml-2" />
                <input
                  type="text"
                  placeholder="Search by name, email, department, or designation..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full text-xs text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
                />
              </div>

              {/* Employee Table */}
              <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-400">
                          No employees found matching query.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((emp, idx) => (
                        <TableRow key={emp.id} className="hover:bg-slate-50/60 transition text-xs">
                          <TableCell className="font-medium text-slate-900">
                            <div className="flex items-center gap-3">
                              <span className={`grid h-8 w-8 place-items-center rounded-xl font-bold text-xs border ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                {initials(emp.name)}
                              </span>
                              <div>
                                <strong className="block text-slate-900">{emp.name}</strong>
                                <span className="text-[11px] text-slate-400">{emp.email}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              {emp.department}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600">{emp.designation || "—"}</TableCell>
                          <TableCell className="font-semibold text-slate-900 font-mono">
                            {(Number(emp.salary) || 0).toLocaleString()} PKR
                          </TableCell>
                          <TableCell className="text-slate-500">{emp.phone || "—"}</TableCell>
                          <TableCell className="text-right">
                            <button
                              onClick={() => {
                                setEditingEmployee(emp);
                                setShowEditEmployeeModal(true);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                            >
                              Edit Profile
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 3: DAILY ATTENDANCE BOARD                        */}
          {/* ---------------------------------------------------- */}
          {active === "Attendance" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Daily Attendance & Overtime Board</h2>
                  <p className="text-xs text-slate-400">Real-time arrival, departure, 8.0h duty hours, and overtime earned</p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={attendanceFilterDate}
                    onChange={(e) => setAttendanceFilterDate(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none"
                  />
                  <button
                    onClick={() => setAttendanceFilterDate(today)}
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <TableHead>Employee</TableHead>
                      <TableHead>Arrival (Check-In)</TableHead>
                      <TableHead>Departure (Check-Out)</TableHead>
                      <TableHead>Duty Hours (8h standard)</TableHead>
                      <TableHead>Overtime Earned</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-400">
                          No attendance stamped for {formatDate(attendanceFilterDate || today)}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      todayAttendance.map((rec) => {
                        const emp = employeeMap.get(rec.employeeId);
                        const hours = Number(rec.totalWorkHours || 0);
                        const overtime = Number(rec.overtimeHours || (hours > 8 ? hours - 8 : 0));

                        return (
                          <TableRow key={rec.id} className="text-xs hover:bg-slate-50/60 transition">
                            <TableCell className="font-semibold text-slate-900">
                              <div>
                                <span className="block text-slate-900 font-bold">{emp?.name || rec.employeeId}</span>
                                <span className="text-[11px] text-slate-400">{emp?.department}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-slate-700">{formatTime(rec.checkInAt)}</TableCell>
                            <TableCell className="font-mono text-slate-700">{formatTime(rec.checkOutAt)}</TableCell>
                            <TableCell className="font-mono font-semibold text-slate-800">
                              {hours > 0 ? `${hours.toFixed(2)} hrs` : "Running..."}
                            </TableCell>
                            <TableCell>
                              {overtime > 0 ? (
                                <span className="font-bold text-emerald-600 font-mono">+{overtime.toFixed(2)} hrs</span>
                              ) : (
                                <span className="text-slate-400 font-mono">0.00 hrs</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  rec.status === "present"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : rec.status === "late"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {rec.status.toUpperCase()}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 4: LEAVE APPROVALS INBOX (PDF Module 5)          */}
          {/* ---------------------------------------------------- */}
          {active === "Leave approvals" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Leave Requests Approval Inbox</h2>
                  <p className="text-xs text-slate-400">Review employee leave requests with optional approval/rejection remarks</p>
                </div>
                <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 text-xs font-bold border border-violet-200">
                  {pendingLeaves.length} Pending Review
                </span>
              </div>

              <div className="rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Duration & Dates</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Decision Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-400">
                          No leave applications recorded in database.
                        </TableCell>
                      </TableRow>
                    ) : (
                      leaves.map((l) => {
                        const emp = employeeMap.get(l.employeeId);
                        const isPending = l.status === "pending";

                        return (
                          <TableRow key={l.id} className="text-xs hover:bg-slate-50/60 transition">
                            <TableCell className="font-bold text-slate-900">
                              <div>
                                <span>{emp?.name || l.employeeId}</span>
                                <span className="block text-[11px] text-slate-400 font-normal">{emp?.department}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold capitalize text-slate-700">{l.leaveType}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-slate-800">{formatDate(l.startDate)} → {formatDate(l.endDate)}</span>
                              <span className="block text-[11px] text-slate-400 font-semibold">{l.workingDays || l.days || 1} Working Day(s)</span>
                            </TableCell>
                            <TableCell className="text-slate-600 max-w-xs truncate" title={l.reason}>
                              {l.reason || "—"}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  l.status === "approved"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : l.status === "pending"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {l.status.toUpperCase()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => updateLeave(l, "approved")}
                                    disabled={actionId === l.id}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-2xs disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => updateLeave(l, "rejected")}
                                    disabled={actionId === l.id}
                                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition shadow-2xs disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic font-medium">
                                  {l.hrComment ? `Note: "${l.hrComment}"` : "Reviewed"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 5: PAYROLL DRAFT WORKSPACE (PDF Module 6)        */}
          {/* ---------------------------------------------------- */}
          {active === "Payroll" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Monthly Payroll Preparation Workspace</h2>
                  <p className="text-xs text-slate-400">
                    HR prepares and reviews the draft (Gross, Overtime 1.5×, Deductions, Net). Locking is finalized by Admin.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none"
                  />
                  <button
                    onClick={handleCreatePayrollDraft}
                    disabled={runningPayroll}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition active:scale-95 disabled:opacity-50"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span>{runningPayroll ? "Generating Draft..." : "Generate Payroll Draft"}</span>
                  </button>
                </div>
              </div>

              {/* Notice regarding Finalize Lock */}
              <div className="flex items-center gap-2 rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3.5 text-xs font-medium text-amber-900">
                <IconLock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>HR Permission Scope:</strong> HR prepares and reviews the monthly payroll calculation. Once verified, the System Administrator officially locks and finalizes the run.
                </span>
              </div>

              {/* Payroll Runs List */}
              <div className="space-y-4">
                {payrolls.length === 0 ? (
                  <div className="py-12 text-center rounded-3xl bg-white border border-slate-200/80 text-xs text-slate-400">
                    No payroll drafts created yet. Select month and click "Generate Payroll Draft".
                  </div>
                ) : (
                  payrolls.map((run) => (
                    <div key={run.id} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">Payroll Run: {run.month}</h3>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                run.status === "locked"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {run.status.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            Total Employees: {(run.lines || run.items || []).length} staff included
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>Gross: <strong className="text-slate-800">{(run.totals?.gross || run.totalGross || 0).toLocaleString()} PKR</strong></div>
                          <div>Net: <strong className="text-indigo-600">{(run.totals?.netPay || run.totalNet || 0).toLocaleString()} PKR</strong></div>
                        </div>
                      </div>

                      {/* Employee Lines in this Payroll */}
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <TableHead>Employee</TableHead>
                            <TableHead>Basic Salary</TableHead>
                            <TableHead>Overtime Pay</TableHead>
                            <TableHead>Late/Absent Fines</TableHead>
                            <TableHead>Income Tax</TableHead>
                            <TableHead>Net Pay</TableHead>
                            <TableHead className="text-right">Payslip</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(run.lines || run.items || []).map((line) => (
                            <TableRow key={line.employeeId} className="text-xs hover:bg-slate-50/60 transition">
                              <TableCell className="font-bold text-slate-900">
                                {line.employeeName}
                                <span className="block text-[11px] text-slate-400 font-normal">{line.department}</span>
                              </TableCell>
                              <TableCell className="font-mono">{(line.basic || 0).toLocaleString()} PKR</TableCell>
                              <TableCell className="font-mono text-emerald-600 font-semibold">
                                +{(line.overtimePay || 0).toLocaleString()} PKR
                              </TableCell>
                              <TableCell className="font-mono text-rose-600 font-semibold">
                                -{((line.lateDeduction || 0) + (line.absentDeduction || 0)).toLocaleString()} PKR
                              </TableCell>
                              <TableCell className="font-mono text-slate-500">-{(line.tax || 0).toLocaleString()} PKR</TableCell>
                              <TableCell className="font-mono font-bold text-indigo-700">
                                {(line.netPay || 0).toLocaleString()} PKR
                              </TableCell>
                              <TableCell className="text-right">
                                <button
                                  onClick={() => viewEmployeePayslip(run.id, line.employeeId)}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                >
                                  View Slip
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 6: ANNOUNCEMENTS (PDF Module 9)                  */}
          {/* ---------------------------------------------------- */}
          {active === "Announcements" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Company Announcements & Broadcasts</h2>
                  <p className="text-xs text-slate-400">Post notices to all employees or specific departments</p>
                </div>
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition active:scale-95"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>New Announcement</span>
                </button>
              </div>

              <div className="space-y-3">
                {announcements.length === 0 ? (
                  <div className="py-12 text-center rounded-3xl bg-white border border-slate-200/80 text-xs text-slate-400">
                    No announcements published yet.
                  </div>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-slate-900">{ann.title}</strong>
                          <span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-bold border border-indigo-200">
                            {ann.audience}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(ann.publishedAt || ann.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 whitespace-pre-line">{ann.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* -------------------------------------------------------- */}
      {/* ADD EMPLOYEE MODAL (Auto-Login Generation)               */}
      {/* -------------------------------------------------------- */}
      {showAddEmployeeModal && (
        <Dialog open={showAddEmployeeModal} onOpenChange={setShowAddEmployeeModal}>
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">Hire New Employee &amp; Create Login</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-slate-500">
              HR action: Onboards a new employee and auto-generates active login credentials in Supabase PostgreSQL.
            </p>

            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div>
                <Label>Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. Asad Ullah"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Work Email Address *</Label>
                <Input
                  required
                  type="email"
                  placeholder="e.g. asad@company.com"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department *</Label>
                  <Select
                    value={employeeForm.department}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Designation</Label>
                  <Input
                    placeholder="e.g. Software Engineer"
                    value={employeeForm.designation}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Basic Salary (PKR) *</Label>
                  <Input
                    required
                    type="number"
                    min="1"
                    placeholder="e.g. 120000"
                    value={employeeForm.salary}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, salary: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Phone Number</Label>
                  <Input
                    placeholder="e.g. 03001234567"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Address</Label>
                <Input
                  placeholder="e.g. Karachi, Pakistan"
                  value={employeeForm.address}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setShowAddEmployeeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingEmployee} className="bg-violet-600 hover:bg-violet-500 text-white font-bold">
                  {submittingEmployee ? "Hiring Employee..." : "Hire Employee & Save in Supabase"}
                </Button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* -------------------------------------------------------- */}
      {/* EDIT EMPLOYEE MODAL                                      */}
      {/* -------------------------------------------------------- */}
      {showEditEmployeeModal && editingEmployee && (
        <Dialog open={showEditEmployeeModal} onOpenChange={setShowEditEmployeeModal}>
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">Edit Employee 360 Profile</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUpdateEmployee} className="space-y-3 text-xs">
              <div>
                <Label>Full Name *</Label>
                <Input
                  required
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={editingEmployee.department}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label>Designation</Label>
                  <Input
                    value={editingEmployee.designation || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, designation: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Basic Salary (PKR)</Label>
                  <Input
                    type="number"
                    value={editingEmployee.salary}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, salary: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Phone</Label>
                  <Input
                    value={editingEmployee.phone || ""}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Address</Label>
                <Input
                  value={editingEmployee.address || ""}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, address: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setShowEditEmployeeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingEmployee} className="bg-violet-600 hover:bg-violet-500 text-white">
                  {submittingEmployee ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* -------------------------------------------------------- */}
      {/* CSV IMPORT MODAL (Dry Run Validator)                     */}
      {/* -------------------------------------------------------- */}
      {showCsvModal && (
        <Dialog open={showCsvModal} onOpenChange={setShowCsvModal}>
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">Bulk Employee CSV Import</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-slate-500">
              Required CSV headers: <code>Name, Email, Department, Salary</code> (Optional: <code>Designation, Phone, Address</code>).
            </p>

            <Textarea
              rows={6}
              placeholder="Name,Email,Department,Designation,Salary,Phone,Address&#10;Hamza Ali,hamza@example.com,Engineering,Fullstack Dev,120000,03001234567,Karachi"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="font-mono text-xs"
            />

            {csvDryRunResult && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>Dry Run Results:</span>
                  <span className="text-emerald-600">{csvDryRunResult.validRecords?.length || 0} valid</span>
                </div>
                {csvDryRunResult.errors?.length > 0 && (
                  <div className="text-rose-600 space-y-1">
                    {csvDryRunResult.errors.map((err, i) => (
                      <div key={i}>Row {err.row}: {err.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setShowCsvModal(false)}>Cancel</Button>
              <Button
                type="button"
                onClick={() => handleCsvImport(true)}
                disabled={csvLoading || !csvText.trim()}
                className="bg-slate-800 text-white"
              >
                Validate Dry Run
              </Button>
              <Button
                type="button"
                onClick={() => handleCsvImport(false)}
                disabled={csvLoading || !csvText.trim() || (csvDryRunResult && csvDryRunResult.errors?.length > 0)}
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                Commit Import to Supabase
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* -------------------------------------------------------- */}
      {/* ANNOUNCEMENT MODAL                                       */}
      {/* -------------------------------------------------------- */}
      {showAnnouncementModal && (
        <Dialog open={showAnnouncementModal} onOpenChange={setShowAnnouncementModal}>
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">Broadcast Announcement</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
              <div>
                <Label>Title *</Label>
                <Input
                  required
                  placeholder="e.g. Eid-ul-Fitr Public Holiday Schedule"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                />
              </div>

              <div>
                <Label>Audience</Label>
                <Select
                  value={announcementForm.audience}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })}
                >
                  <option value="ALL">All Company (Admins, HR, Staff)</option>
                  <option value="EMPLOYEE">Employees Only</option>
                  <option value="HR">HR Team Only</option>
                </Select>
              </div>

              <div>
                <Label>Content *</Label>
                <Textarea
                  required
                  rows={4}
                  placeholder="Enter details of your announcement..."
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button type="button" variant="outline" onClick={() => setShowAnnouncementModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submittingAnnouncement} className="bg-violet-600 hover:bg-violet-500 text-white">
                  {submittingAnnouncement ? "Publishing..." : "Publish to Team"}
                </Button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* -------------------------------------------------------- */}
      {/* PAYSLIP DETAIL MODAL                                     */}
      {/* -------------------------------------------------------- */}
      {activePayslip && (
        <Dialog open={Boolean(activePayslip)} onOpenChange={() => setActivePayslip(null)}>
          <div className="p-6 space-y-4 max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">Official Payslip Details</DialogTitle>
            </DialogHeader>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between border-b pb-2">
                <span>Employee:</span>
                <strong>{activePayslip.employeeName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Month:</span>
                <span>{activePayslip.month}</span>
              </div>
              <div className="flex justify-between">
                <span>Basic Salary:</span>
                <span>{(activePayslip.basic || 0).toLocaleString()} PKR</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Overtime ({activePayslip.totalOvertimeHours || 0} hrs @ 1.5×):</span>
                <span>+{(activePayslip.overtimePay || 0).toLocaleString()} PKR</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Late Deductions ({activePayslip.lateDays || 0} days):</span>
                <span>-{(activePayslip.lateDeduction || 0).toLocaleString()} PKR</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Absent Deductions ({activePayslip.absentDays || 0} days):</span>
                <span>-{(activePayslip.absentDeduction || 0).toLocaleString()} PKR</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Income Tax:</span>
                <span>-{(activePayslip.tax || 0).toLocaleString()} PKR</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-bold text-indigo-700">
                <span>Net Payable Salary:</span>
                <span>{(activePayslip.netPay || 0).toLocaleString()} PKR</span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setActivePayslip(null)} className="bg-slate-800 text-white">Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* AI Assistant Modal */}
      <AIAssistantModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onLeaveSubmitted={() => loadHRData()}
      />
    </div>
  );
}
