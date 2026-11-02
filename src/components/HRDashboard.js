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
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState("");

  // Add Employee Form State
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    email: "",
    department: "Engineering",
    designation: "",
    salary: "",
    phone: "",
    address: "",
    temporaryPassword: "",
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
  const [payrollViewMode, setPayrollViewMode] = useState("individual"); // "summary" | "individual"
  const [payrollEmployeeFilter, setPayrollEmployeeFilter] = useState("all");
  const [payrollSearch, setPayrollSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [expandedMonthRecordEmpId, setExpandedMonthRecordEmpId] = useState(null);

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

      if ([employeeResponse, attendanceResponse, leaveResponse].some((r) => r && r.status === 401)) {
        localStorage.removeItem("hcm_token");
        window.location.assign("/login?redirect=/hr");
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
        temporaryPassword: "",
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

  async function handleResendInvite(employeeId) {
    setResendingInviteId(employeeId);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch(`/api/employees/${employeeId}/resend-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Failed to reset temporary password.");

      setCreatedLoginInfo({
        name: data.employee?.name || "Employee",
        email: data.employee?.email || "",
        temporaryPassword: data.temporaryPassword,
        department: "",
      });
      setSuccessMsg(`Temporary password reset for ${data.employee?.name || "Employee"}!`);
      await loadHRData();
    } catch (err) {
      setError(err.message);
    } finally {
      setResendingInviteId("");
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
      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* -------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION                                       */}
      {/* -------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur-md transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 sm:h-20 items-center justify-between px-5 sm:px-6 border-b border-slate-100">
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
            className="lg:hidden text-slate-400 hover:text-slate-600 p-2 text-base"
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
                HR
              </span>
              <div className="text-left">
                <span className="block text-xs font-bold text-slate-800 leading-tight">
                  HR Portal
                </span>
                <span className="text-[10px] text-slate-400">
                  People Operations (HR)
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
        <header className="sticky top-0 z-30 flex h-16 sm:h-20 items-center justify-between border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
              title="Open Navigation"
            >
              ☰
            </button>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {HR_NAV_ITEMS.find((n) => n.id === active)?.label || "HR Workspace"}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-sm shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
            >
              <IconSparkles className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden xs:inline">Ask Humi AI</span>
              <span className="xs:hidden">AI</span>
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
        <div className="px-4 sm:px-6 lg:px-8 pt-4">
          {successMsg && (
            <div className="mb-4 flex items-center justify-between rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 sm:p-4 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <IconCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg("")} className="text-emerald-500 hover:text-emerald-800 p-1">✕</button>
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-xl sm:rounded-2xl bg-rose-50 border border-rose-200 p-3.5 sm:p-4 text-xs font-semibold text-rose-800 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <IconAlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-800 p-1">✕</button>
            </div>
          )}
        </div>

        {/* Main Content Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl w-full mx-auto">
          {/* ---------------------------------------------------- */}
          {/* TAB 1: HR DASHBOARD & INSIGHTS (PDF Section 7)       */}
          {/* ---------------------------------------------------- */}
          {active === "Overview" && (
            <div className="space-y-5 sm:space-y-6">
              {/* Top KPI Cards (Section 7 Formula Compliance) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Employee Directory &amp; 360 Profiles</h2>
                  <p className="text-xs text-slate-400">Register new staff, manage salaries, or import/export CSV</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setShowCsvModal(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition flex-1 sm:flex-none"
                  >
                    <IconUpload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>CSV Import</span>
                  </button>

                  <button
                    onClick={handleCsvExport}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition flex-1 sm:flex-none"
                  >
                    <IconDownload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Export</span>
                  </button>

                  <button
                    onClick={() => setShowAddEmployeeModal(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition active:scale-95 w-full sm:w-auto"
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
                      <TableHead>Password Status</TableHead>
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
                          <TableCell>
                            {emp.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Temp Password (Pending Setup)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Permanent Password Set
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleResendInvite(emp.id)}
                                disabled={resendingInviteId === emp.id}
                                className="text-xs text-amber-700 hover:text-amber-900 font-bold hover:underline"
                                title="Reset / View Temporary Password"
                              >
                                {resendingInviteId === emp.id ? "Resetting..." : "🔑 Reset Temp Pass"}
                              </button>
                              <span className="text-slate-200">|</span>
                              <button
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setShowEditEmployeeModal(true);
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                              >
                                Edit Profile
                              </button>
                            </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Daily Attendance &amp; Overtime Board</h2>
                  <p className="text-xs text-slate-400">Real-time arrival, departure, 8.0h duty hours, and overtime earned</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {/* Attendance Search Bar */}
                  <div className="relative flex-1 sm:w-60">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search attendance by staff / dept..."
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                    {attendanceSearch && (
                      <button
                        onClick={() => setAttendanceSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={attendanceFilterDate}
                    onChange={(e) => setAttendanceFilterDate(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none flex-1 sm:flex-none"
                  />
                  <button
                    onClick={() => setAttendanceFilterDate(today)}
                    className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shrink-0"
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
                      <TableHead>Late Cut (-)</TableHead>
                      <TableHead>Overtime Earned</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayAttendance
                      .filter((rec) => {
                        const emp = employeeMap.get(rec.employeeId);
                        return `${emp?.name || ""} ${emp?.department || ""} ${rec.employeeId}`
                          .toLowerCase()
                          .includes(attendanceSearch.toLowerCase());
                      })
                      .length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-xs text-slate-400">
                          No attendance stamped for {formatDate(attendanceFilterDate || today)}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      todayAttendance
                        .filter((rec) => {
                          const emp = employeeMap.get(rec.employeeId);
                          return `${emp?.name || ""} ${emp?.department || ""} ${rec.employeeId}`
                            .toLowerCase()
                            .includes(attendanceSearch.toLowerCase());
                        })
                        .map((rec) => {
                        const emp = employeeMap.get(rec.employeeId);
                        const hours = Number(rec.totalWorkHours || 0);
                        const overtime = Number(rec.overtimeHours || (hours > 8 ? hours - 8 : 0));
                        const dailyRate = Math.round(Number(emp?.salary || 0) / 30);
                        const hourlyRate = Math.round(dailyRate / 8);
                        const isLateRec = rec.status === "late" || rec.isLate;
                        const lateHours = Number(rec.lateHours || (isLateRec ? 1 : 0));
                        const lateCut = Math.round(lateHours * hourlyRate);

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
                            <TableCell className="font-mono text-rose-600 font-bold">
                              {lateHours > 0 ? `-${lateCut.toLocaleString()} PKR (${lateHours}h)` : "—"}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Leave Requests Approval Inbox</h2>
                  <p className="text-xs text-slate-400">Review employee leave requests with optional approval/rejection remarks</p>
                </div>
                <span className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 text-xs font-bold border border-violet-200 self-start sm:self-auto">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Monthly Payroll Preparation Workspace</h2>
                  <p className="text-xs text-slate-400">
                    HR prepares and reviews the draft (Gross, Overtime 1.5×, Deductions, Net). Locking is finalized by Admin.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <input
                    type="month"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none flex-1 sm:flex-none"
                  />
                  <button
                    onClick={handleCreatePayrollDraft}
                    disabled={runningPayroll}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition active:scale-95 disabled:opacity-50"
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
                            Standard 30-Day Working Month · {(run.lines || run.items || []).length} staff included
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div>Gross: <strong className="text-slate-800">{(run.totals?.gross || run.totalGross || 0).toLocaleString()} PKR</strong></div>
                          <div>Net: <strong className="text-indigo-600">{(run.totals?.netPay || run.totalNet || 0).toLocaleString()} PKR</strong></div>
                        </div>
                      </div>

                      {/* View Switcher: Individual Employee Tables vs Summary Table & Search */}
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setPayrollViewMode("individual")}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                payrollViewMode === "individual"
                                  ? "bg-violet-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              👥 Har Employee Ka Alag Table ({(run.lines || run.items || []).length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayrollViewMode("summary")}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                                payrollViewMode === "summary"
                                  ? "bg-violet-600 text-white shadow-xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              📊 Summary Master Table
                            </button>
                          </div>

                          {payrollViewMode === "individual" && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">Filter Staff:</span>
                              <select
                                value={payrollEmployeeFilter}
                                onChange={(e) => setPayrollEmployeeFilter(e.target.value)}
                                className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 outline-none"
                              >
                                <option value="all">All Employees ({(run.lines || run.items || []).length})</option>
                                {(run.lines || run.items || []).map((l) => (
                                  <option key={l.employeeId} value={l.employeeId}>
                                    {l.employeeName} ({l.department})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        {/* Search Bar for Payroll Workspace */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search employee (name, dept, role)..."
                            value={payrollSearch}
                            onChange={(e) => setPayrollSearch(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                          />
                          {payrollSearch && (
                            <button
                              onClick={() => setPayrollSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>

                      {payrollViewMode === "summary" ? (
                        /* SUMMARY MASTER TABLE (FBR Tax Removed) */
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                              <TableHead>Employee</TableHead>
                              <TableHead>Basic Salary</TableHead>
                              <TableHead>Overtime Pay</TableHead>
                              <TableHead>Late Cuts (-PKR)</TableHead>
                              <TableHead>Absent Cuts (-PKR)</TableHead>
                              <TableHead>Net Pay</TableHead>
                              <TableHead className="text-right">Payslip</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(run.lines || run.items || [])
                              .filter((line) =>
                                `${line.employeeName} ${line.department} ${line.designation} ${line.employeeId}`
                                  .toLowerCase()
                                  .includes(payrollSearch.toLowerCase())
                              )
                              .map((line) => (
                              <TableRow key={line.employeeId} className="text-xs hover:bg-slate-50/60 transition">
                                <TableCell className="font-bold text-slate-900">
                                  {line.employeeName}
                                  <span className="block text-[11px] text-slate-400 font-normal">{line.department} · {line.designation || "Staff"}</span>
                                </TableCell>
                                <TableCell className="font-mono">{(line.basic || 0).toLocaleString()} PKR</TableCell>
                                <TableCell className="font-mono text-emerald-600 font-semibold">
                                  +{(line.overtimePay || 0).toLocaleString()} PKR
                                </TableCell>
                                <TableCell className="font-mono text-rose-600 font-semibold">
                                  -{(line.lateDeduction || 0).toLocaleString()} PKR ({line.totalLateHours || line.lateDays || 0}h late)
                                </TableCell>
                                <TableCell className="font-mono text-rose-600 font-semibold">
                                  -{(line.absentDeduction || 0).toLocaleString()} PKR ({line.absentDays || 0} abs)
                                </TableCell>
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
                      ) : (
                        /* INDIVIDUAL DEDICATED CALCULATION TABLES FOR EACH EMPLOYEE */
                        <div className="space-y-6 pt-2">
                          {(run.lines || run.items || [])
                            .filter((line) =>
                              `${line.employeeName} ${line.department} ${line.designation} ${line.employeeId}`
                                .toLowerCase()
                                .includes(payrollSearch.toLowerCase())
                            )
                            .filter((l) => payrollEmployeeFilter === "all" || l.employeeId === payrollEmployeeFilter)
                            .map((line) => {
                              const dailyRate = Math.round(Number(line.basic || 0) / 30);
                              const hourlyRate = Math.round(dailyRate / 8);
                              const is30DayExpanded = expandedMonthRecordEmpId === line.employeeId;

                              return (
                                <div key={line.employeeId} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                                  {/* Employee Header Ribbon */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-slate-50 to-violet-50/40 border-b border-slate-200">
                                    <div className="flex items-center gap-3">
                                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600 text-white font-extrabold text-sm shadow-sm">
                                        {initials(line.employeeName)}
                                      </span>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <strong className="text-sm font-bold text-slate-900">{line.employeeName}</strong>
                                          <span className="rounded-full bg-violet-100 text-violet-700 px-2.5 py-0.5 text-[10px] font-bold">
                                            {line.department}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 font-medium">{line.designation || "Staff"} · Month: {run.month}</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px]">
                                        Basic: <strong className="text-slate-900 font-bold">{Number(line.basic || 0).toLocaleString()} PKR</strong>
                                      </span>
                                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px]">
                                        30 Days Base | Daily: <strong className="text-violet-700 font-bold">{dailyRate.toLocaleString()} PKR</strong>
                                      </span>
                                      <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px]">
                                        Hourly: <strong className="text-violet-700 font-bold">{hourlyRate.toLocaleString()} PKR</strong>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpandedMonthRecordEmpId(is30DayExpanded ? null : line.employeeId)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition flex items-center gap-1.5 ${
                                          is30DayExpanded
                                            ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                                            : "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                                        }`}
                                      >
                                        <span>📅</span>
                                        <span>{is30DayExpanded ? "Hide 30-Day Table" : "Poore Month Ka 30-Day Table"}</span>
                                      </button>
                                      <button
                                        onClick={() => viewEmployeePayslip(run.id, line.employeeId)}
                                        className="h-7 px-3 rounded-lg text-xs font-bold bg-white text-violet-700 hover:bg-slate-50 border border-violet-200 transition"
                                      >
                                        Print Slip 🖨
                                      </button>
                                    </div>
                                  </div>

                                  {/* Detailed Calculation Table */}
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs divide-y divide-slate-100">
                                      <thead>
                                        <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                          <th className="py-2.5 px-4">Component</th>
                                          <th className="py-2.5 px-4">Formula / Calculation Basis</th>
                                          <th className="py-2.5 px-4">Units / Count</th>
                                          <th className="py-2.5 px-4 text-right">Amount (PKR)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium">
                                        {/* Basic Salary */}
                                        <tr className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-4 font-bold text-slate-800">
                                            Basic Monthly Salary
                                          </td>
                                          <td className="py-2.5 px-4 text-slate-500">Standard 30 Days Base Working Month</td>
                                          <td className="py-2.5 px-4 font-semibold text-slate-700">30 Days</td>
                                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                                            +{Number(line.basic || 0).toLocaleString()} PKR
                                          </td>
                                        </tr>

                                        {/* Attendance Present */}
                                        <tr className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-4 text-slate-700">Attendance (Present Days)</td>
                                          <td className="py-2.5 px-4 text-slate-500">Daily Arrival &amp; Duty Recorded</td>
                                          <td className="py-2.5 px-4 font-semibold text-emerald-700 font-mono">
                                            {line.presentDays || 0} Days Present
                                          </td>
                                          <td className="py-2.5 px-4 text-right text-emerald-600 font-semibold font-mono">
                                            Included in Base
                                          </td>
                                        </tr>

                                        {/* Approved Paid Leaves */}
                                        <tr className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-4 text-slate-700">Approved Paid Leaves</td>
                                          <td className="py-2.5 px-4 text-slate-500">Casual / Sick / Annual (Quota Protected)</td>
                                          <td className="py-2.5 px-4 font-semibold text-violet-700 font-mono">
                                            {line.approvedPaidLeaves || 0} Days Approved
                                          </td>
                                          <td className="py-2.5 px-4 text-right text-violet-600 font-semibold font-mono">
                                            100% Paid (No Cut)
                                          </td>
                                        </tr>

                                        {/* Overtime */}
                                        <tr className="hover:bg-slate-50/50 bg-emerald-50/20">
                                          <td className="py-2.5 px-4 font-bold text-emerald-800">
                                            Overtime Pay Addition (+)
                                          </td>
                                          <td className="py-2.5 px-4 text-emerald-700 font-mono">
                                            1.5× Hourly Rate ({Math.round(hourlyRate * 1.5).toLocaleString()} PKR/hr)
                                          </td>
                                          <td className="py-2.5 px-4 font-semibold text-emerald-800 font-mono">
                                            {line.totalOvertimeHours || 0} Hours OT
                                          </td>
                                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono">
                                            +{Number(line.overtimePay || 0).toLocaleString()} PKR
                                          </td>
                                        </tr>

                                        {/* Absent / Leaves Cut */}
                                        <tr className="hover:bg-slate-50/50 bg-rose-50/20">
                                          <td className="py-2.5 px-4 font-bold text-rose-800">
                                            Leaves / Absent Deduction (-)
                                          </td>
                                          <td className="py-2.5 px-4 text-rose-700 font-mono">
                                            Daily Rate: Basic ÷ 30 ({dailyRate.toLocaleString()} PKR/day)
                                          </td>
                                          <td className="py-2.5 px-4 font-semibold text-rose-800 font-mono">
                                            {line.absentDays || 0} Days Absent
                                          </td>
                                          <td className="py-2.5 px-4 text-right font-bold text-rose-700 font-mono">
                                            -{Number(line.absentDeduction || 0).toLocaleString()} PKR
                                          </td>
                                        </tr>

                                        {/* Late Arrivals Cut (Exact Hourly Cut) */}
                                        <tr className="hover:bg-slate-50/50 bg-rose-50/20">
                                          <td className="py-2.5 px-4 font-bold text-rose-800">
                                            Late Arrival Cut (Exact Hourly Cut) (-)
                                          </td>
                                          <td className="py-2.5 px-4 text-rose-700 font-mono">
                                            Hourly Rate Cut: Basic ÷ 30 ÷ 8 ({hourlyRate.toLocaleString()} PKR/hr)
                                          </td>
                                          <td className="py-2.5 px-4 font-semibold text-rose-800 font-mono">
                                            {line.totalLateHours || 0} Hours Late ({line.lateDays || 0} late days)
                                          </td>
                                          <td className="py-2.5 px-4 text-right font-bold text-rose-700 font-mono">
                                            -{Number(line.lateDeduction || 0).toLocaleString()} PKR
                                          </td>
                                        </tr>
                                      </tbody>

                                      {/* Table Footer: Total Amount */}
                                      <tfoot>
                                        <tr className="bg-gradient-to-r from-slate-900 via-violet-950 to-slate-900 text-white font-bold">
                                          <td colSpan={3} className="py-3.5 px-4 text-xs font-black uppercase tracking-wider text-violet-200">
                                            TOTAL PAYABLE AMOUNT (NET SALARY TRANSFERRED)
                                          </td>
                                          <td className="py-3.5 px-4 text-right text-base sm:text-lg font-black text-emerald-400 font-mono">
                                            {Number(line.netPay || 0).toLocaleString()} PKR
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>

                                  {/* POORE MONTH KA 30-DAY RECORD TABLE */}
                                  {is30DayExpanded && (
                                    <div className="p-4 sm:p-5 bg-slate-900 text-white border-t border-slate-800">
                                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-3">
                                        <div>
                                          <strong className="text-sm font-bold text-white flex items-center gap-2">
                                            <span>📅</span> Poora 30-Day Monthly Attendance &amp; Salary Register — {line.employeeName} ({run.month})
                                          </strong>
                                          <p className="text-[11px] text-slate-400 mt-0.5">
                                            Standard 30 Days Month · Day-by-Day Attendance, Check-In/Out, Late Hours Cut, Overtime Pay &amp; Daily Wages
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Basic: <strong className="text-white">{Number(line.basic || 0).toLocaleString()} PKR</strong></span>
                                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Daily: <strong className="text-violet-300">{dailyRate.toLocaleString()} PKR</strong></span>
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
                                            {(line.monthlyRecords && line.monthlyRecords.length > 0 ? line.monthlyRecords : (() => {
                                              const days = [];
                                              const m = run.month || "2026-10";
                                              const todayStr = new Date().toISOString().slice(0, 10);
                                              for (let i = 1; i <= 30; i++) {
                                                const dStr = `${m}-${String(i).padStart(2, "0")}`;
                                                const dObj = new Date(`${dStr}T12:00:00Z`);
                                                const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dObj.getUTCDay()];
                                                const isFuture = dStr > todayStr;
                                                const isToday = dStr === todayStr;
                                                const rec = attendance.find((a) => a.employeeId === line.employeeId && a.date === dStr);
                                                const lv = leaves.find((l) => l.employeeId === line.employeeId && l.status === "approved" && dStr >= l.startDate && dStr <= l.endDate);
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
                                          <tfoot className="sticky bottom-0 bg-slate-900 border-t-2 border-violet-500 font-bold">
                                            <tr>
                                              <td colSpan={5} className="py-3 px-3 text-slate-300 text-xs font-bold uppercase tracking-wider">
                                                Month Total ({run.month}): {line.presentDays || 0} Present · {line.approvedPaidLeaves || 0} Leaves · {line.absentDays || 0} Absents · {line.totalLateHours || 0}h Late · {line.totalOvertimeHours || 0}h OT
                                              </td>
                                              <td className="py-3 px-3 text-rose-400 font-mono text-xs">
                                                Late: -{Number(line.lateDeduction || 0).toLocaleString()} PKR
                                              </td>
                                              <td className="py-3 px-3 text-emerald-400 font-mono text-xs">
                                                OT: +{Number(line.overtimePay || 0).toLocaleString()} PKR
                                              </td>
                                              <td className="py-3 px-3 text-right font-mono text-sm text-emerald-400 font-black">
                                                Total Net: {Number(line.netPay || 0).toLocaleString()} PKR
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Company Announcements &amp; Broadcasts</h2>
                  <p className="text-xs text-slate-400">Post notices to all employees or specific departments</p>
                </div>
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500 transition active:scale-95"
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
        <Dialog open={showAddEmployeeModal} onClose={() => setShowAddEmployeeModal(false)}>
          <div className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Initial Temporary Password (Optional)</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = "Welcome@" + Math.random().toString(36).slice(-6);
                      setEmployeeForm({ ...employeeForm, temporaryPassword: rand });
                    }}
                    className="text-[10px] text-indigo-600 font-bold hover:underline"
                  >
                    🎲 Auto-generate
                  </button>
                </div>
                <Input
                  placeholder="Leave empty for auto-generated (e.g. Welcome@abcd1234)"
                  value={employeeForm.temporaryPassword || ""}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, temporaryPassword: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  The employee will use this temporary password to sign in for the first time, and will be prompted to create their own permanent password.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setShowAddEmployeeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingEmployee} className="bg-violet-600 hover:bg-violet-500 text-white font-bold w-full sm:w-auto">
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
        <Dialog open={showEditEmployeeModal} onClose={() => setShowEditEmployeeModal(false)}>
          <div className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setShowEditEmployeeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingEmployee} className="bg-violet-600 hover:bg-violet-500 text-white w-full sm:w-auto">
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
        <Dialog open={showCsvModal} onClose={() => setShowCsvModal(false)} className="max-w-2xl">
          <div className="space-y-4">
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

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
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
        <Dialog open={showAnnouncementModal} onClose={() => setShowAnnouncementModal(false)}>
          <div className="space-y-4">
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

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setShowAnnouncementModal(false)}>Cancel</Button>
                <Button type="submit" disabled={submittingAnnouncement} className="bg-violet-600 hover:bg-violet-500 text-white w-full sm:w-auto">
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
        <Dialog open={Boolean(activePayslip)} onClose={() => setActivePayslip(null)} className="max-w-xl">
          <div className="space-y-4 text-xs">
            <DialogHeader>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600">Official Payslip Details</span>
                <DialogTitle className="text-xl">{activePayslip.employeeName}</DialogTitle>
                <p className="text-xs text-slate-500">{activePayslip.department} · {activePayslip.month}</p>
              </div>
            </DialogHeader>

            {/* Rates & 30-Day Base Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center font-mono">
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Standard Base</span>
                <strong className="text-xs font-bold text-slate-800">30 Working Days</strong>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Per-Day Salary</span>
                <strong className="text-xs font-bold text-violet-700">
                  {Number(activePayslip.perDayRate || Math.round((activePayslip.basic || 0) / 30)).toLocaleString()} PKR
                </strong>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Hourly Rate (8h)</span>
                <strong className="text-xs font-bold text-violet-700">
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
                    <td className="py-2 px-3 text-violet-700 font-mono font-semibold">{activePayslip.approvedPaidLeaves || 0} Days</td>
                    <td className="py-2 px-3 text-right text-violet-600 font-mono">100% Paid (0 PKR)</td>
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

                <tfoot>
                  <tr className="bg-gradient-to-r from-slate-900 via-violet-950 to-slate-900 text-white font-bold">
                    <td colSpan={3} className="py-3 px-3 text-xs font-black uppercase tracking-wider text-violet-200">
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
              <Button onClick={() => setActivePayslip(null)} variant="outline" size="sm" className="bg-slate-100">
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="bg-violet-600 hover:bg-violet-500 text-white font-bold"
              >
                Print Official Slip 🖨
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* -------------------------------------------------------- */}
      {/* TEMPORARY LOGIN CREDENTIALS MODAL                        */}
      {/* -------------------------------------------------------- */}
      {createdLoginInfo && (
        <Dialog open={Boolean(createdLoginInfo)} onClose={() => setCreatedLoginInfo(null)} className="max-w-md">
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2 text-emerald-600">
                <IconShieldCheck className="w-5 h-5 text-emerald-600" />
                <DialogTitle className="text-base font-bold text-slate-900">
                  Temporary Employee Login Created 🔑
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Employee Name &amp; Email:</span>
                <strong className="text-slate-900 text-sm block">{createdLoginInfo.name}</strong>
                <span className="text-slate-600 font-mono text-xs">{createdLoginInfo.email}</span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <span className="text-slate-500 block text-[11px] mb-1.5 font-semibold">Temporary Password:</span>
                <div className="flex items-center justify-between gap-2 p-2.5 bg-indigo-50/90 rounded-xl border border-indigo-200">
                  <code className="text-sm font-mono font-bold text-indigo-700 tracking-wider">
                    {createdLoginInfo.temporaryPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(createdLoginInfo.temporaryPassword || "");
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 2000);
                      } catch {}
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition active:scale-95"
                  >
                    {copiedPassword ? "Copied! ✓" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1 leading-relaxed">
              <strong className="block text-amber-950 font-bold">📌 How the flow works:</strong>
              <p>1. Provide this Temporary Password to the employee.</p>
              <p>2. Employee inputs their email &amp; this temporary password on the Login page (<code>/login</code>).</p>
              <p>3. Once the temporary password is verified, the system gives them the option to <strong>Create their own permanent password</strong>.</p>
              <p>4. For all future logins, the employee will sign in using their newly created password.</p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setCreatedLoginInfo(null)} className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                Done
              </Button>
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
