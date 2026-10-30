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
} from "./ui/icons";

const NAV_ITEMS = [
  { id: "Overview", label: "Overview", icon: IconLayers },
  { id: "HR Team", label: "HR Team & Logins", icon: IconShieldCheck },
  { id: "Employees", label: "Employees", icon: IconUsers },
  { id: "Attendance", label: "Attendance & Overtime", icon: IconClock },
  { id: "Leave requests", label: "Leave Requests", icon: IconCalendar },
  { id: "Payroll", label: "Payroll Workspace", icon: IconDollarSign },
  { id: "Reports", label: "Reports & Analytics", icon: IconTrendingUp },
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

function getStatusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "present" || s === "approved" || s === "locked") return <Badge variant="success">{s.replace("_", " ")}</Badge>;
  if (s === "late" || s === "draft" || s === "pending") return <Badge variant="warning">{s.replace("_", " ")}</Badge>;
  if (s === "rejected" || s === "absent") return <Badge variant="destructive">{s.replace("_", " ")}</Badge>;
  if (s === "on_leave") return <Badge variant="secondary">On Leave</Badge>;
  return <Badge variant="default">{s.replace("_", " ")}</Badge>;
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionId, setActionId] = useState("");
  const [now, setNow] = useState(null);

  // Modals
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [activePayslip, setActivePayslip] = useState(null);
  const [createdLoginInfo, setCreatedLoginInfo] = useState(null);

  // HR Team & System Users State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddHRModal, setShowAddHRModal] = useState(false);
  const [hrForm, setHrForm] = useState({ name: "", email: "", password: "", role: "HR" });
  const [submittingHR, setSubmittingHR] = useState(false);
  const [userActionId, setUserActionId] = useState("");

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
  const [submittingEmployee, setSubmittingEmployee] = useState(false);

  // CSV Import State
  const [csvText, setCsvText] = useState("");
  const [csvDryRunResult, setCsvDryRunResult] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);

  // Payroll draft form
  const [payrollMonth, setPayrollMonth] = useState("2026-10");
  const [runningPayroll, setRunningPayroll] = useState(false);

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
  const [supabaseStatus, setSupabaseStatus] = useState({ connected: false, tables: [] });
  const [copiedSql, setCopiedSql] = useState(false);
  const [verifyingSupabase, setVerifyingSupabase] = useState(false);

  async function handleVerifySupabase() {
    setVerifyingSupabase(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/supabase/status", { cache: "no-store" });
      const data = await safeResponseJson(res, {});
      if (data?.connection?.connected) {
        setSupabaseStatus({
          connected: true,
          tables: data.connection.tables || [],
          usersCount: data.connection.usersCount || 0,
          employeesCount: data.connection.employeesCount || 0,
        });
        setSuccessMsg(`🎉 Supabase Cloud Database Connected! ${data.connection.usersCount || 5} users & ${data.connection.employeesCount || 4} employees are live.`);
        await loadDashboard();
      } else {
        const errorReason = data?.connection?.message || data?.connection?.error || "Could not verify connection.";
        setError(`Supabase connection check: ${errorReason}`);
      }
    } catch (err) {
      setError(`Verification error: ${err.message}`);
    } finally {
      setVerifyingSupabase(false);
    }
  }

  async function handleCopySql() {
    try {
      const res = await fetch("/api/supabase/sql");
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 4000);
    } catch {
      window.open("/api/supabase/sql", "_blank");
    }
  }

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

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      if (!token) {
        window.location.assign("/login");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };
      const [employeeResponse, attendanceResponse, leaveResponse, setupResponse, payrollResponse, userResponse, supaResponse] = await Promise.all([
        fetch("/api/employees?page=1&pageSize=100", { headers, cache: "no-store" }),
        fetch("/api/attendance", { headers, cache: "no-store" }),
        fetch("/api/leaves", { headers, cache: "no-store" }),
        fetch("/api/setup", { cache: "no-store" }),
        fetch("/api/payroll", { headers, cache: "no-store" }),
        fetch("/api/users", { headers, cache: "no-store" }).catch(() => null),
        fetch("/api/supabase/status", { cache: "no-store" }).catch(() => null),
      ]);

      if ([employeeResponse, attendanceResponse, leaveResponse].some((r) => r && r.status === 401)) {
        localStorage.removeItem("hcm_token");
        window.location.assign("/login?redirect=/dashboard");
        return;
      }

      const [employeeData, attendanceData, leaveData, setupData, payrollData, userData, supaData] = await Promise.all([
        safeResponseJson(employeeResponse, { employees: [] }),
        safeResponseJson(attendanceResponse, { attendance: [] }),
        safeResponseJson(leaveResponse, { leaves: [] }),
        safeResponseJson(setupResponse, { company: null }),
        safeResponseJson(payrollResponse, { payrolls: [] }),
        safeResponseJson(userResponse, { users: [] }),
        safeResponseJson(supaResponse, null),
      ]);

      if (supaData?.connection) {
        setSupabaseStatus({
          connected: Boolean(supaData.connection.connected),
          usersCount: supaData.connection.usersCount || 0,
          employeesCount: supaData.connection.employeesCount || 0,
          tables: supaData.connection.tables || [],
        });
      }
      const failed = [employeeResponse, attendanceResponse, leaveResponse].find((response) => response && !response.ok);
      if (failed) throw new Error(employeeData?.error || attendanceData?.error || leaveData?.error || "Unable to load dashboard data.");
      setEmployees(employeeData?.employees || []);
      setAttendance(attendanceData?.attendance || []);
      setLeaves(leaveData?.leaves || []);
      setPayrolls(payrollData?.payrolls || []);
      setUsers(userData?.users || []);
      setCompany(setupData?.company || null);
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
    loadDashboard();
  }, []);

  const today = now ? dateKey(now) : "";
  const todayAttendance = attendance.filter((record) => record.date === (attendanceFilterDate || today));
  const pendingLeaves = leaves.filter((leave) => leave.status === "pending");
  const onLeaveToday = leaves.filter((leave) => leave.status === "approved" && leave.startDate <= today && leave.endDate >= today);
  const attendanceRate = analytics?.admin?.kpis?.attendanceRate ?? (employees.length ? Math.round((todayAttendance.length / employees.length) * 100) : 0);
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
      setSuccessMsg(`Employee ${data.employee.name} registered successfully with automatic login creation!`);
      await loadDashboard();
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
        await loadDashboard();
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

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await safeResponseJson(res, { users: [] });
      if (res && res.ok && data?.users) {
        setUsers(data.users);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleCreateHR(e) {
    e.preventDefault();
    setSubmittingHR(true);
    setError("");
    setSuccessMsg("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(hrForm),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Failed to create user account.");
      setSuccessMsg(`Account for ${data.user?.name || hrForm.name} created successfully and saved in Supabase!`);
      setShowAddHRModal(false);
      setHrForm({ name: "", email: "", password: "", role: "HR" });
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingHR(false);
    }
  }

  async function handleToggleUserStatus(userId, currentStatus) {
    setUserActionId(userId);
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Failed to update account status.");
      setSuccessMsg(`User status updated to ${!currentStatus ? "Active" : "Deactivated"}!`);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setUserActionId("");
    }
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
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningPayroll(false);
    }
  }

  async function handleFinalizePayroll(payrollId) {
    if (!window.confirm("Are you sure you want to lock and finalize this payroll run? This action will permanently lock edits and make payslips final.")) return;
    setError("");
    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch(`/api/payroll/${payrollId}/finalize`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await safeResponseJson(res, {});
      if (!res.ok) throw new Error(data.error || "Could not finalize payroll.");
      setSuccessMsg("Payroll run officially locked and finalized by Administrator!");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
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
          <span>Loading workspace...</span>
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
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-lg font-black text-white shadow-md shadow-indigo-500/25">
              H
            </span>
            <div>
              <strong className="block text-sm font-bold tracking-tight text-slate-900">HCM Lite</strong>
              <span className="text-[10px] font-medium text-slate-400">AI-Powered HR Suite</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-2 text-base"
          >
            ✕
          </button>
        </div>

        {/* Workspace Card */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 shadow-xs">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
              {(company?.name || "H").slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-xs font-bold text-slate-800">
                {company?.name || "Saylani Tech Workspace"}
              </strong>
              <small className="block truncate text-[10px] font-medium text-slate-400">HR &amp; Admin Console</small>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <span className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-400">Workspace</span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isSelected = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActive(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                  isSelected
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-500/20"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === "Leave requests" && pendingLeaves.length > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {pendingLeaves.length}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4">
            <span className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-400">Intelligent Tools</span>
            <button
              onClick={() => {
                setAiModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3.5 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100/60"
            >
              <IconSparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
              <span className="flex-1 text-left font-bold">Ask Humi AI Assistant</span>
              <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-1.5 py-0.5 rounded font-mono">✦</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Supabase Badge & Admin Profile */}
        <div className="border-t border-slate-100 p-4 space-y-3">
          {/* Supabase Status Pill */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <IconShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Cloud Database
              </span>
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  supabaseStatus.connected ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-amber-400 animate-pulse"
                }`}
              />
            </div>
            <strong className="block text-xs font-bold text-slate-800 mt-1">
              {supabaseStatus.connected ? "Supabase Connected" : "Supabase Dynamic"}
            </strong>
            <span className="text-[10px] text-slate-500 block">
              {supabaseStatus.connected ? `${supabaseStatus.tables?.length || 10} tables live synced` : "Click sync below"}
            </span>
            <button
              onClick={handleVerifySupabase}
              disabled={verifyingSupabase}
              className="mt-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 disabled:opacity-50"
            >
              <IconRefreshCw className={`w-3 h-3 ${verifyingSupabase ? "animate-spin" : ""}`} />
              {verifyingSupabase ? "Verifying..." : "Sync Database →"}
            </button>
          </div>

          {/* User Signout */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-xs">
                MA
              </div>
              <div className="min-w-0">
                <strong className="block truncate text-xs font-bold text-slate-800">Mohammad Asif</strong>
                <span className="block truncate text-[10px] text-slate-400">Administrator</span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
            >
              <IconLogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* -------------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                        */}
      {/* -------------------------------------------------------- */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header Navbar */}
        <header className="sticky top-0 z-30 flex h-16 sm:h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
              title="Open Navigation"
            >
              ☰
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs min-w-0 truncate">
              <span className="text-slate-400 hidden xs:inline">Console</span>
              <span className="text-slate-300 hidden xs:inline">/</span>
              <span className="font-bold text-slate-800 truncate">{active}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-xs"
              title="Administrator Role Active"
            >
              <IconShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Role: Admin
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={loadingSummary}
              className="hidden lg:inline-flex"
            >
              <IconSparkles className="h-3.5 w-3.5 text-indigo-600" />
              {loadingSummary ? "Summarizing..." : "AI Summarize"}
            </Button>

            <Button
              variant="gradient"
              size="sm"
              onClick={() => setAiModalOpen(true)}
              className="shadow-indigo-500/25 px-2.5 sm:px-3.5"
            >
              <IconSparkles className="h-3.5 w-3.5 text-white" />
              <span className="hidden xs:inline">Ask Humi AI</span>
              <span className="xs:hidden">AI</span>
            </Button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 sm:mx-1 hidden xs:block" />

            <button
              onClick={() => setActive("Leave requests")}
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shrink-0"
              title="Pending leave notifications"
            >
              <IconCalendar className="h-4 w-4" />
              {pendingLeaves.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs">
                  {pendingLeaves.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 max-w-7xl w-full mx-auto">
          {/* Welcome & Date Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400">
                {now ? new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(now) : "Welcome"}
              </span>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                Good morning, Mohammad 👋
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage employees, real-time attendance, leave reviews, and monthly payroll end-to-end.
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboard}
                disabled={loading}
                className="w-full sm:w-auto shadow-xs justify-center"
              >
                <IconRefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Supabase Cloud Connection Alert */}
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-white p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span
                className={`grid h-11 w-11 place-items-center rounded-2xl text-lg font-bold shadow-xs ${
                  supabaseStatus.connected ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-indigo-50 text-indigo-600 border border-indigo-200"
                }`}
              >
                {supabaseStatus.connected ? <IconCheckCircle className="w-5 h-5" /> : <IconShieldCheck className="w-5 h-5" />}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm font-bold text-slate-900">Supabase Cloud Database</strong>
                  <Badge variant={supabaseStatus.connected ? "success" : "warning"}>
                    {supabaseStatus.connected ? "10 Tables Live Connected" : "Connection Pending"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {supabaseStatus.connected
                    ? `Live connected to Supabase (${supabaseStatus.usersCount || 5} users, ${supabaseStatus.employeesCount || 4} employees). Real-time attendance, leaves & payroll active.`
                    : "PostgreSQL tables configured on cloud. Click 'Verify' to test live database connection."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {supabaseStatus.connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Database Active
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifySupabase}
                    disabled={verifyingSupabase}
                  >
                    {verifyingSupabase ? "Syncing..." : "Sync"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="default" size="sm" onClick={handleCopySql}>
                    <IconFileText className="w-3.5 h-3.5 mr-1" />
                    {copiedSql ? "Copied!" : "Copy SQL Script"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifySupabase}
                    disabled={verifyingSupabase}
                  >
                    {verifyingSupabase ? "Checking..." : "Verify Connection"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-medium text-rose-700 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <IconAlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-800 text-sm font-bold">✕</button>
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-medium text-emerald-800 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <IconCheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-900 text-sm font-bold">✕</button>
            </div>
          )}

          {/* New Employee Credentials Banner */}
          {createdLoginInfo && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50/40 p-5 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎉</span>
                  <strong className="text-sm font-bold text-emerald-900">New Employee Account &amp; Login Ready!</strong>
                </div>
                <button onClick={() => setCreatedLoginInfo(null)} className="text-xs text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <p className="mt-2 text-xs text-emerald-800">
                Share these official credentials with <strong>{createdLoginInfo.name}</strong> ({createdLoginInfo.department}):
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 bg-white/90 rounded-xl p-3.5 border border-emerald-200 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Login Email</span>
                  <strong className="text-slate-800 font-mono">{createdLoginInfo.email}</strong>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Temporary Password</span>
                  <strong className="font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {createdLoginInfo.temporaryPassword}
                  </strong>
                </div>
                <div className="text-[11px] text-slate-500 italic ml-auto">
                  * Employee must update password upon first portal sign-in
                </div>
              </div>
            </div>
          )}

          {/* AI Executive Summary Banner */}
          {aiSummary && (
            <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/40 to-white shadow-xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconSparkles className="w-4 h-4 text-indigo-600" />
                    <CardTitle className="text-sm">AI Executive Dashboard Summary</CardTitle>
                    <Badge variant="gradient">AI-Generated</Badge>
                  </div>
                  <button onClick={() => setAiSummary(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <ul className="space-y-2 text-xs text-slate-600">
                  {aiSummary.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-sm text-indigo-600 font-bold leading-none mt-0.5">•</span>
                      <span className="leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 1: OVERVIEW                                      */}
          {/* ---------------------------------------------------- */}
          {active === "Overview" && (
            <div className="space-y-6">
              {/* 4 Metric KPI Cards with modern subtle gradients */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="hover:border-indigo-300 hover:shadow-md transition">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Staff</span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <IconUsers className="w-4 h-4" />
                      </div>
                    </div>
                    <strong className="block text-2xl font-extrabold text-slate-900 mt-2">
                      {loading ? "—" : employees.length}
                    </strong>
                    <span className="text-[11px] text-slate-500 block mt-1">Live active employee records</span>
                  </CardContent>
                </Card>

                <Card className="hover:border-emerald-300 hover:shadow-md transition">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Attendance Today</span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                        <IconClock className="w-4 h-4" />
                      </div>
                    </div>
                    <strong className="block text-2xl font-extrabold text-emerald-700 mt-2">
                      {attendanceRate}%
                    </strong>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {todayAttendance.length} of {employees.length} checked in today
                    </span>
                  </CardContent>
                </Card>

                <Card className="hover:border-amber-300 hover:shadow-md transition">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">On Leave Today</span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600">
                        <IconCalendar className="w-4 h-4" />
                      </div>
                    </div>
                    <strong className="block text-2xl font-extrabold text-amber-700 mt-2">
                      {onLeaveToday.length}
                    </strong>
                    <span className="text-[11px] text-slate-500 block mt-1">Approved active leaves</span>
                  </CardContent>
                </Card>

                <Card className="hover:border-rose-300 hover:shadow-md transition">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Leaves</span>
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600">
                        <IconAlertCircle className="w-4 h-4" />
                      </div>
                    </div>
                    <strong className="block text-2xl font-extrabold text-rose-700 mt-2">
                      {pendingLeaves.length}
                    </strong>
                    <span className="text-[11px] text-slate-500 block mt-1">Awaiting HR decision</span>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions & Attendance Snapshot */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Attendance Today Board Snapshot */}
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <CardTitle className="text-base">Today&apos;s Live Attendance</CardTitle>
                      <CardDescription>Instant arrival &amp; departure tracking without GPS requirement.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActive("Attendance")}>
                      Full Board →
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Arrival (In)</TableHead>
                          <TableHead>Departure (Out)</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.slice(0, 5).map((emp, idx) => {
                          const record = todayAttendance.find((r) => r.employeeId === emp.id);
                          const isLeave = leaves.some(
                            (l) => l.employeeId === emp.id && l.status === "approved" && l.startDate <= today && l.endDate >= today
                          );
                          const status = isLeave ? "on_leave" : record ? record.status : "absent";
                          return (
                            <TableRow key={emp.id}>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold border ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                    {initials(emp.name)}
                                  </span>
                                  <div>
                                    <strong className="block text-slate-800">{emp.name}</strong>
                                    <span className="text-[10px] text-slate-400">{emp.designation || "Staff"}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{emp.department}</TableCell>
                              <TableCell>{formatTime(record?.checkInAt)}</TableCell>
                              <TableCell>{formatTime(record?.checkOutAt)}</TableCell>
                              <TableCell>{getStatusBadge(status)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {employees.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-slate-400">
                              No employees registered in database yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Right 1 Col: Quick Actions & Pending Requests */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <CardTitle className="text-sm">Quick Operations</CardTitle>
                      <CardDescription>Shortcut to daily management tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 space-y-1.5">
                      <button
                        onClick={() => setShowAddEmployeeModal(true)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40 transition group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                            <IconPlus className="w-4 h-4" />
                          </span>
                          <div>
                            <strong className="block text-xs text-slate-800 group-hover:text-indigo-600">Register Staff Member</strong>
                            <span className="text-[10px] text-slate-400">Generates instant credentials</span>
                          </div>
                        </div>
                        <IconArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600" />
                      </button>

                      <button
                        onClick={() => setActive("Leave requests")}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left hover:border-amber-200 hover:bg-amber-50/40 transition group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 font-bold text-sm">
                            <IconCalendar className="w-4 h-4" />
                          </span>
                          <div>
                            <strong className="block text-xs text-slate-800 group-hover:text-amber-700">Leave Approvals Inbox</strong>
                            <span className="text-[10px] text-slate-400">{pendingLeaves.length} pending review</span>
                          </div>
                        </div>
                        <IconArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600" />
                      </button>

                      <button
                        onClick={() => setActive("Payroll")}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left hover:border-purple-200 hover:bg-purple-50/40 transition group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600 font-bold text-sm">
                            <IconDollarSign className="w-4 h-4" />
                          </span>
                          <div>
                            <strong className="block text-xs text-slate-800 group-hover:text-purple-700">Run Monthly Payroll</strong>
                            <span className="text-[10px] text-slate-400">Dynamic overtime + deductions</span>
                          </div>
                        </div>
                        <IconArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600" />
                      </button>
                    </CardContent>
                  </Card>

                  {/* Pending Leave Requests Widget */}
                  {pendingLeaves.length > 0 && (
                    <Card className="border-amber-200 bg-amber-50/30">
                      <CardHeader className="pb-3 border-b border-amber-100">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs text-amber-900">Pending Leave Review</CardTitle>
                          <Badge variant="warning">{pendingLeaves.length} pending</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {pendingLeaves.slice(0, 3).map((leave) => {
                          const emp = employeeMap.get(leave.employeeId);
                          return (
                            <div key={leave.id} className="rounded-xl bg-white p-3 border border-amber-100 shadow-xs flex items-center justify-between">
                              <div>
                                <strong className="block text-xs text-slate-800">{emp?.name || "Employee"}</strong>
                                <span className="text-[10px] text-slate-500 font-medium">{leave.leaveType.toUpperCase()} · {leave.workingDays} working days</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-7 px-2 text-[10px]"
                                  disabled={actionId === leave.id}
                                  onClick={() => updateLeave(leave, "rejected")}
                                >
                                  Decline
                                </Button>
                                <Button
                                  variant="success"
                                  size="sm"
                                  className="h-7 px-2 text-[10px]"
                                  disabled={actionId === leave.id}
                                  onClick={() => updateLeave(leave, "approved")}
                                >
                                  Approve
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB: HR TEAM & LOGINS (PDF Admin Control of HR Data) */}
          {/* ---------------------------------------------------- */}
          {active === "HR Team" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                      Administrative Governance · Supabase Cloud
                    </span>
                    <CardTitle className="text-xl">Hire HR Team &amp; System Logins</CardTitle>
                    <CardDescription>
                      Admin action: Hire HR team members, create authorized logins, and manage user access directly stored in Supabase PostgreSQL (`public.users`).
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href="/hr"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                    >
                      <IconArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                      Open HR Portal (/hr)
                    </a>
                    <Button variant="gradient" size="sm" onClick={() => setShowAddHRModal(true)}>
                      <IconPlus className="w-3.5 h-3.5 mr-1" />
                      Hire / Add HR Manager
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Total System Users</span>
                      <strong className="block text-2xl font-black text-slate-900 mt-1">{users.length}</strong>
                      <span className="text-[10px] text-slate-500">Live in Supabase `users` table</span>
                    </div>
                    <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">HR Managers</span>
                      <strong className="block text-2xl font-black text-purple-900 mt-1">
                        {users.filter((u) => u.role === "HR").length}
                      </strong>
                      <span className="text-[10px] text-slate-500">Authorized for `/hr` console</span>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Administrators</span>
                      <strong className="block text-2xl font-black text-emerald-900 mt-1">
                        {users.filter((u) => u.role === "ADMIN").length}
                      </strong>
                      <span className="text-[10px] text-slate-500">Root system operators</span>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Scope / Access</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u, idx) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold border ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                {initials(u.name)}
                              </span>
                              <div>
                                <strong className="block text-xs font-bold text-slate-900">{u.name}</strong>
                                <span className="text-[11px] text-slate-500">{u.email}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === "ADMIN" ? "default" : u.role === "HR" ? "secondary" : "outline"}>
                              {u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600">
                              {u.role === "ADMIN"
                                ? "Full System, Settings, Payroll Lock, HR Governance"
                                : u.role === "HR"
                                ? "Employee 360, Daily Attendance, Leave Approval, Draft Payroll"
                                : "Employee Self-Service (Stamping, Leaves, Payslips)"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.isActive ? "success" : "destructive"}>
                              {u.isActive ? "Active" : "Deactivated"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-500 font-mono">
                              {u.createdAt ? u.createdAt.slice(0, 10) : "—"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {u.role !== "ADMIN" ? (
                              <Button
                                variant={u.isActive ? "destructive" : "outline"}
                                size="sm"
                                disabled={userActionId === u.id}
                                onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                                className="h-7 px-2.5 text-[11px]"
                              >
                                {userActionId === u.id
                                  ? "Updating..."
                                  : u.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                              </Button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">Protected Admin</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 2: EMPLOYEES DIRECTORY                           */}
          {/* ---------------------------------------------------- */}
          {active === "Employees" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Module 3 Management</span>
                    <CardTitle className="text-xl">Employee Directory</CardTitle>
                    <CardDescription>
                      Register employees, generate temporary credentials, or bulk import staff members via CSV.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button variant="outline" size="sm" onClick={handleCsvExport}>
                      <IconDownload className="w-3.5 h-3.5 mr-1" />
                      Export CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowCsvModal(true); setCsvDryRunResult(null); }}>
                      <IconUpload className="w-3.5 h-3.5 mr-1" />
                      Import CSV
                    </Button>
                    <Button variant="gradient" size="sm" onClick={() => setShowAddEmployeeModal(true)}>
                      <IconPlus className="w-3.5 h-3.5 mr-1" />
                      Register Employee
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                    <div className="relative w-full max-w-xs">
                      <IconSearch className="absolute left-3.5 top-3 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search by name, role, email..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Total Staff: <strong className="text-slate-800">{filteredEmployees.length}</strong>
                    </span>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Basic Salary</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp, idx) => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold border ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                {initials(emp.name)}
                              </span>
                              <div>
                                <strong className="block text-slate-900">{emp.name}</strong>
                                <span className="text-[11px] text-slate-400">{emp.email}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{emp.department}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 font-medium">{emp.designation || "Staff"}</TableCell>
                          <TableCell className="font-bold text-slate-900">
                            {Number(emp.salary || 0).toLocaleString()} PKR
                          </TableCell>
                          <TableCell className="text-slate-500">{emp.phone || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={emp.isActive !== false ? "success" : "destructive"}>
                              {emp.isActive !== false ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-12 text-center text-slate-400">
                            No employees match your search. Click &quot;Register Employee&quot; above to create one.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 3: ATTENDANCE & OVERTIME PORTIONS                */}
          {/* ---------------------------------------------------- */}
          {active === "Attendance" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Module 4 Engine</span>
                    <CardTitle className="text-xl">Attendance &amp; Overtime Management</CardTitle>
                    <CardDescription>
                      Arrival and departure recorded on 1 click (no GPS required). Overtime paid at 1.5× rate; late arrival cuts 0.5 hour pay.
                    </CardDescription>
                  </div>

                  {/* Filter Controls: Employee Selector & Date */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Scope:</Label>
                      <select
                        value={attendanceEmployeeFilter}
                        onChange={(e) => setAttendanceEmployeeFilter(e.target.value)}
                        className="text-xs font-bold text-slate-800 outline-none bg-transparent"
                      >
                        <option value="all">👥 All Staff (Daily Board)</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>👤 {e.name} ({e.department})</option>
                        ))}
                      </select>
                    </div>

                    {attendanceEmployeeFilter === "all" && (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-xs">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">Date:</Label>
                        <input
                          type="date"
                          value={attendanceFilterDate}
                          onChange={(e) => setAttendanceFilterDate(e.target.value)}
                          className="text-xs font-semibold text-slate-700 outline-none bg-transparent"
                        />
                      </div>
                    )}

                    <Button variant="outline" size="sm" onClick={loadDashboard}>
                      <IconRefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {/* INDIVIDUAL EMPLOYEE DEDICATED PORTION */}
                  {attendanceEmployeeFilter !== "all" && (() => {
                    const selectedEmp = employees.find((e) => e.id === attendanceEmployeeFilter);
                    if (!selectedEmp) return null;
                    const empRecords = attendance.filter((r) => r.employeeId === selectedEmp.id);
                    const totalHours = empRecords.reduce((sum, r) => sum + Number(r.totalWorkHours || 0), 0);
                    const totalOvertime = empRecords.reduce((sum, r) => sum + Number(r.overtimeHours || (r.totalWorkHours > 8 ? r.totalWorkHours - 8 : 0)), 0);
                    const lateCount = empRecords.filter((r) => r.status === "late" || r.isLate).length;
                    const presentCount = empRecords.filter((r) => ["present", "late"].includes(r.status)).length;
                    const hourlyRate = (Number(selectedEmp.salary || 0) / 22) / 8;
                    const overtimeEarned = Math.round(totalOvertime * (hourlyRate * 1.5));
                    const latePenalty = Math.round(lateCount * (hourlyRate * 0.5));

                    return (
                      <div className="space-y-6">
                        {/* Dedicated Employee Profile & Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card className="border-indigo-100 bg-gradient-to-tr from-indigo-50/50 to-white">
                            <CardContent className="p-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Staff Profile</span>
                              <strong className="block text-base font-bold text-slate-900 mt-1">{selectedEmp.name}</strong>
                              <span className="text-xs font-semibold text-indigo-700">{selectedEmp.department} · {selectedEmp.designation || "Staff"}</span>
                              <div className="mt-2 text-xs text-slate-600 font-medium">
                                Base: <strong>{Number(selectedEmp.salary || 0).toLocaleString()} PKR</strong>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="border-emerald-200 bg-emerald-50/40">
                            <CardContent className="p-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Overtime Logged</span>
                              <strong className="block text-2xl font-black text-emerald-800 mt-1">
                                +{totalOvertime.toFixed(1)} hrs
                              </strong>
                              <span className="text-xs font-bold text-emerald-700">
                                Overtime Pay: +{overtimeEarned.toLocaleString()} PKR
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-1">Extra hours &gt; 8h paid @ 1.5× hourly rate</span>
                            </CardContent>
                          </Card>

                          <Card className="border-rose-200 bg-rose-50/40">
                            <CardContent className="p-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Late Arrivals</span>
                              <strong className="block text-2xl font-black text-rose-700 mt-1">
                                {lateCount} times
                              </strong>
                              <span className="text-xs font-bold text-rose-600">
                                Fine: -{latePenalty.toLocaleString()} PKR
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-1">0.5 hour pay cut per late arrival</span>
                            </CardContent>
                          </Card>

                          <Card className="border-slate-200">
                            <CardContent className="p-4">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance &amp; Hours</span>
                              <strong className="block text-2xl font-black text-slate-800 mt-1">
                                {presentCount} days
                              </strong>
                              <span className="text-xs font-semibold text-slate-600">
                                Total Duty: {totalHours.toFixed(1)} hrs
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-1">Rate: {Math.round(hourlyRate)} PKR/hr</span>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Dedicated Date-Wise Attendance Table */}
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                            <strong className="text-sm font-bold text-slate-800">
                              {selectedEmp.name}&apos;s Complete Date-Wise Records
                            </strong>
                            <span className="text-xs text-slate-400 font-medium">Total logged days: {empRecords.length}</span>
                          </div>

                          <Table className="mt-2">
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Arrival (Check-In)</TableHead>
                                <TableHead>Departure (Check-Out)</TableHead>
                                <TableHead>Duty Hours</TableHead>
                                <TableHead>Overtime Hours</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {empRecords.map((r) => {
                                const hours = Number(r.totalWorkHours || 0);
                                const ot = Number(r.overtimeHours || (hours > 8 ? hours - 8 : 0));
                                return (
                                  <TableRow key={r.id}>
                                    <TableCell className="font-bold text-slate-800">{formatDate(r.date)}</TableCell>
                                    <TableCell>{formatTime(r.checkInAt)}</TableCell>
                                    <TableCell>{formatTime(r.checkOutAt)}</TableCell>
                                    <TableCell className="font-semibold text-slate-800">{hours.toFixed(2)} hrs</TableCell>
                                    <TableCell className="font-bold text-emerald-600">
                                      {ot > 0 ? `+${ot.toFixed(2)} hrs` : "—"}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                                  </TableRow>
                                );
                              })}
                              {empRecords.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={6} className="py-10 text-center text-slate-400">
                                    No attendance records logged yet for this employee.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ALL EMPLOYEES DAILY BOARD */}
                  {attendanceEmployeeFilter === "all" && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Arrival (Check-In)</TableHead>
                          <TableHead>Departure (Check-Out)</TableHead>
                          <TableHead>Duty Hours</TableHead>
                          <TableHead>Overtime</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employees.map((emp, idx) => {
                          const record = todayAttendance.find((r) => r.employeeId === emp.id);
                          const isLeave = leaves.some(
                            (l) =>
                              l.employeeId === emp.id &&
                              l.status === "approved" &&
                              l.startDate <= attendanceFilterDate &&
                              l.endDate >= attendanceFilterDate
                          );
                          const status = isLeave ? "on_leave" : record ? record.status : "absent";
                          const hours = Number(record?.totalWorkHours || 0);
                          const ot = Number(record?.overtimeHours || (hours > 8 ? hours - 8 : 0));

                          return (
                            <TableRow key={emp.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold border ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                                    {initials(emp.name)}
                                  </span>
                                  <div>
                                    <strong className="block text-slate-800">{emp.name}</strong>
                                    <span className="text-[10px] text-slate-400">{emp.designation || "Staff"}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{emp.department}</Badge>
                              </TableCell>
                              <TableCell>{formatTime(record?.checkInAt)}</TableCell>
                              <TableCell>{formatTime(record?.checkOutAt)}</TableCell>
                              <TableCell className="font-semibold text-slate-800">
                                {hours > 0 ? `${hours.toFixed(2)} hrs` : "—"}
                              </TableCell>
                              <TableCell className="font-bold text-emerald-600">
                                {ot > 0 ? `+${ot.toFixed(2)} hrs` : "—"}
                              </TableCell>
                              <TableCell>{getStatusBadge(status)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {employees.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                              No employees in database.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 4: LEAVE REQUESTS & APPROVALS                    */}
          {/* ---------------------------------------------------- */}
          {active === "Leave requests" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Module 5 Leave Engine</span>
                    <CardTitle className="text-xl">Leave Requests &amp; Approvals Inbox</CardTitle>
                    <CardDescription>
                      Connected with Employee Dashboard. Working days calculated automatically (excluding weekends). Approved leaves safeguard salary from absent cuts.
                    </CardDescription>
                  </div>
                  <Badge variant={pendingLeaves.length > 0 ? "warning" : "success"}>
                    {pendingLeaves.length} Pending Approval
                  </Badge>
                </CardHeader>
                <CardContent className="p-5">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Working Days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">HR Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => {
                        const emp = employeeMap.get(leave.employeeId);
                        return (
                          <TableRow key={leave.id}>
                            <TableCell>
                              <strong className="block text-slate-900">{emp?.name || "Unknown"}</strong>
                              <span className="text-[10px] text-slate-400">{emp?.department}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-indigo-700 uppercase">
                                {leave.leaveType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-600 font-medium">
                              {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                            </TableCell>
                            <TableCell className="font-bold text-slate-800">{leave.workingDays} days</TableCell>
                            <TableCell className="text-slate-500 max-w-xs truncate" title={leave.reason}>
                              {leave.reason || "No reason given"}
                            </TableCell>
                            <TableCell>{getStatusBadge(leave.status)}</TableCell>
                            <TableCell className="text-right">
                              {leave.status === "pending" ? (
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={actionId === leave.id}
                                    onClick={() => updateLeave(leave, "rejected")}
                                  >
                                    Decline
                                  </Button>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    disabled={actionId === leave.id}
                                    onClick={() => updateLeave(leave, "approved")}
                                  >
                                    Approve
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">
                                  {leave.hrComment ? `Note: ${leave.hrComment}` : "Reviewed"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {leaves.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-12 text-center text-slate-400">
                            No leave applications submitted yet by employees.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 5: PAYROLL WORKSPACE                             */}
          {/* ---------------------------------------------------- */}
          {active === "Payroll" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Module 6 Lite</span>
                    <CardTitle className="text-xl">Monthly Payroll Workspace</CardTitle>
                    <CardDescription>
                      Dynamically calculates live salaries, adds overtime (1.5× hourly rate), and deducts late fines (0.5h pay) and unexcused absences.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={payrollMonth}
                      onChange={(e) => setPayrollMonth(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none shadow-xs"
                    />
                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={handleCreatePayrollDraft}
                      disabled={runningPayroll}
                    >
                      {runningPayroll ? "Generating Draft..." : "Run Monthly Draft →"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Salary Formula Infobox */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Basic Base</span>
                      <strong className="block text-sm font-bold text-slate-800 mt-1">Per-Day = Basic / 22</strong>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Hourly = Per-Day / 8 hrs</span>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-700">Overtime Addition</span>
                      <strong className="block text-sm font-bold text-emerald-800 mt-1">+1.5× Hourly Rate</strong>
                      <span className="text-[10px] text-emerald-600 block mt-0.5">Extra hours beyond 8h added</span>
                    </div>

                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
                      <span className="text-[10px] font-bold uppercase text-rose-700">Late Deductions</span>
                      <strong className="block text-sm font-bold text-rose-800 mt-1">-0.5h Pay Cut</strong>
                      <span className="text-[10px] text-rose-600 block mt-0.5">Per late arrival after 09:15</span>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                      <span className="text-[10px] font-bold uppercase text-amber-700">Absent Cuts</span>
                      <strong className="block text-sm font-bold text-amber-800 mt-1">-Daily Rate Per Absent</strong>
                      <span className="text-[10px] text-amber-600 block mt-0.5">Unexcused off-days deducted</span>
                    </div>
                  </div>

                  {/* Active Payroll Runs */}
                  <div className="space-y-6">
                    {payrolls.map((payroll) => (
                      <Card key={payroll.id} className="border-slate-200/90 shadow-xs">
                        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <CardTitle className="text-base">{payroll.month} Payroll Run</CardTitle>
                              <Badge variant={payroll.status === "locked" ? "success" : "warning"}>
                                {payroll.status === "locked" ? "Finalized & Locked" : "Draft (Pending Admin Lock)"}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1">
                              Created on {formatDate((payroll.createdAt || "").slice(0, 10))}
                            </CardDescription>
                          </div>

                          <div className="flex flex-wrap items-center gap-5 text-xs">
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Gross Total</span>
                              <strong className="text-sm font-bold text-slate-800">{payroll.totals.gross.toLocaleString()} PKR</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Deductions</span>
                              <strong className="text-sm font-bold text-rose-600">-{payroll.totals.deductions.toLocaleString()} PKR</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-400 uppercase">Net Pay Transferred</span>
                              <strong className="text-base font-black text-indigo-700">{payroll.totals.netPay.toLocaleString()} PKR</strong>
                            </div>

                            {payroll.status !== "locked" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleFinalizePayroll(payroll.id)}
                                className="bg-slate-900 hover:bg-black text-white"
                              >
                                <IconLock className="w-3.5 h-3.5 mr-1" />
                                Lock &amp; Finalize
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Basic Salary</TableHead>
                                <TableHead>Overtime (+PKR)</TableHead>
                                <TableHead>Late Cuts (-PKR)</TableHead>
                                <TableHead>Absent Cuts (-PKR)</TableHead>
                                <TableHead>Tax</TableHead>
                                <TableHead>Net Pay</TableHead>
                                <TableHead className="text-right">Payslip</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {payroll.lines.map((line) => (
                                <TableRow key={line.employeeId}>
                                  <TableCell className="font-bold text-slate-800">{line.employeeName}</TableCell>
                                  <TableCell>{Number(line.basic || line.basicSalary || 0).toLocaleString()} PKR</TableCell>
                                  <TableCell className="font-bold text-emerald-600">
                                    {Number(line.overtimePay || 0) > 0
                                      ? `+${Number(line.overtimePay || 0).toLocaleString()} PKR (${line.totalOvertimeHours || 0}h)`
                                      : "0 PKR"}
                                  </TableCell>
                                  <TableCell className="font-medium text-rose-600">
                                    {Number(line.lateDeduction || 0) > 0
                                      ? `-${Number(line.lateDeduction || 0).toLocaleString()} PKR (${line.lateDays || 0} late)`
                                      : "0 PKR"}
                                  </TableCell>
                                  <TableCell className="font-medium text-rose-600">
                                    {Number(line.absentDeduction || line.deductions || 0) > 0
                                      ? `-${Number(line.absentDeduction || line.deductions || 0).toLocaleString()} PKR (${line.absentDays || 0} abs)`
                                      : "0 PKR"}
                                  </TableCell>
                                  <TableCell className="text-slate-500">-{Number(line.tax || 0).toLocaleString()} PKR</TableCell>
                                  <TableCell className="font-black text-indigo-700 text-sm">
                                    {Number(line.netPay || 0).toLocaleString()} PKR
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => viewEmployeePayslip(payroll.id, line.employeeId)}
                                      className="text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                                    >
                                      <IconFileText className="w-3.5 h-3.5 mr-1" />
                                      View Payslip
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}

                    {payrolls.length === 0 && (
                      <div className="py-16 text-center text-slate-400">
                        <IconDollarSign className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <h3 className="text-sm font-bold text-slate-700">No Payroll Drafts Run Yet</h3>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                          Select a month above and click &quot;Run Monthly Draft&quot; to calculate dynamic salaries, overtime, and deductions!
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* TAB 6: REPORTS & REAL-TIME ANALYTICS                 */}
          {/* ---------------------------------------------------- */}
          {active === "Reports" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Module 7 Analytics</span>
                    <CardTitle className="text-xl">Dashboards &amp; Real-time Aggregations</CardTitle>
                    <CardDescription>
                      All numbers computed dynamically on server from database records (zero mock numbers).
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={dateRange}
                      onChange={(e) => {
                        setDateRange(e.target.value);
                        loadAnalytics(e.target.value, selectedDepartment);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none shadow-xs"
                    >
                      <option value="this_month">This Month</option>
                      <option value="last_month">Last Month</option>
                      <option value="this_week">This Week</option>
                      <option value="today">Today</option>
                    </select>

                    <select
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        loadAnalytics(dateRange, e.target.value);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none shadow-xs"
                    >
                      {departmentOptions.map((dept) => (
                        <option key={dept} value={dept}>{dept} Department</option>
                      ))}
                    </select>

                    <Button
                      variant="gradient"
                      size="sm"
                      onClick={() => loadAnalytics(dateRange, selectedDepartment)}
                      disabled={loadingAnalytics}
                    >
                      {loadingAnalytics ? "Calculating..." : "Apply Filter ↻"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* KPI Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Attendance Rate</span>
                      <strong className="block text-3xl font-extrabold text-indigo-600 mt-1">
                        {analytics?.admin?.kpis?.attendanceRate ?? 0}%
                      </strong>
                      <span className="text-[10px] text-slate-400 block mt-1">(P + L + MC) ÷ (Workdays − Leaves)</span>
                    </Card>

                    <Card className="p-5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Headcount &amp; Active</span>
                      <strong className="block text-3xl font-extrabold text-emerald-700 mt-1">
                        {analytics?.admin?.kpis?.headcount ?? employees.length}
                      </strong>
                      <span className="text-[10px] text-slate-400 block mt-1">Staff active in selected scope</span>
                    </Card>

                    <Card className="p-5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Total Payroll Cost</span>
                      <strong className="block text-2xl font-extrabold text-slate-900 mt-1">
                        {(analytics?.admin?.kpis?.payrollCost || 0).toLocaleString()} PKR
                      </strong>
                      <span className="text-[10px] text-slate-400 block mt-1">Calculated base across staff</span>
                    </Card>

                    <Card className="p-5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Average Salary</span>
                      <strong className="block text-2xl font-extrabold text-amber-700 mt-1">
                        {(analytics?.admin?.kpis?.avgSalary || 0).toLocaleString()} PKR
                      </strong>
                      <span className="text-[10px] text-slate-400 block mt-1">Mean salary per employee</span>
                    </Card>
                  </div>

                  {/* Top Late Comers & Absenteeism by Dept */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <strong className="block text-sm font-bold text-slate-800">Top Late-Comers</strong>
                          <span className="text-[10px] text-slate-400">Employees with late check-ins in {dateRange.replace("_", " ")}</span>
                        </div>
                        <Badge variant="warning">{analytics?.hr?.topLateComers?.length || 0} recorded</Badge>
                      </div>
                      <div className="mt-3 divide-y divide-slate-100">
                        {(analytics?.hr?.topLateComers || []).length > 0 ? (
                          analytics.hr.topLateComers.map((person, idx) => (
                            <div key={person.employeeId} className="flex items-center justify-between py-2.5 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <strong className="block text-slate-800">{person.name}</strong>
                                  <span className="text-[10px] text-slate-400">{person.department}</span>
                                </div>
                              </div>
                              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200">
                                {person.lateCount} lates
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-xs text-slate-400">No late arrivals recorded for this period. ✨</div>
                        )}
                      </div>
                    </Card>

                    <Card className="p-5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <strong className="block text-sm font-bold text-slate-800">Absenteeism by Department</strong>
                          <span className="text-[10px] text-slate-400">Unexcused off-days percentage</span>
                        </div>
                        <Badge variant="secondary">{analytics?.hr?.absenteeismByDept?.length || 0} depts</Badge>
                      </div>
                      <div className="mt-3 divide-y divide-slate-100">
                        {(analytics?.hr?.absenteeismByDept || []).length > 0 ? (
                          analytics.hr.absenteeismByDept.map((item) => (
                            <div key={item.department} className="flex items-center justify-between py-2.5 text-xs">
                              <div>
                                <strong className="block text-slate-800">{item.department}</strong>
                                <span className="text-[10px] text-slate-400">{item.headcount} staff · {item.absentDays} absent</span>
                              </div>
                              <Badge variant={item.absenteeismRate > 10 ? "destructive" : "success"}>
                                {item.absenteeismRate}% absent
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center text-xs text-slate-400">No department absenteeism records found.</div>
                        )}
                      </div>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Footer */}
          <footer className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <span>© 2026 Saylani HCM Lite. Real-time dynamic Human Capital Management.</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All backend engines &amp; Supabase operational</span>
            </div>
          </footer>
        </main>
      </div>

      {/* -------------------------------------------------------- */}
      {/* REGISTER EMPLOYEE MODAL (SHADCN DIALOG)                   */}
      {/* -------------------------------------------------------- */}
      <Dialog open={showAddEmployeeModal} onClose={() => setShowAddEmployeeModal(false)}>
        <DialogHeader>
          <div>
            <DialogTitle>Register New Staff Member</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Generates their employee profile &amp; instant login credentials.</p>
          </div>
          <button onClick={() => setShowAddEmployeeModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
        </DialogHeader>

        <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs">
          <div>
            <Label>Full Name *</Label>
            <Input
              required
              placeholder="e.g. Sara Ahmed"
              value={employeeForm.name}
              onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Work Email *</Label>
              <Input
                required
                type="email"
                placeholder="sara.ahmed@example.com"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Department *</Label>
              <Select
                value={employeeForm.department}
                onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                className="mt-1"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Designation</Label>
              <Input
                placeholder="e.g. HR Executive"
                value={employeeForm.designation}
                onChange={(e) => setEmployeeForm({ ...employeeForm, designation: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Basic Salary (PKR) *</Label>
              <Input
                required
                type="number"
                min="1"
                placeholder="e.g. 120000"
                value={employeeForm.salary}
                onChange={(e) => setEmployeeForm({ ...employeeForm, salary: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Contact Phone</Label>
              <Input
                placeholder="0300-1234567"
                value={employeeForm.phone}
                onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                placeholder="Karachi, Pakistan"
                value={employeeForm.address}
                onChange={(e) => setEmployeeForm({ ...employeeForm, address: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowAddEmployeeModal(false)}>
              Cancel
            </Button>
            <Button variant="gradient" size="sm" type="submit" disabled={submittingEmployee}>
              {submittingEmployee ? "Creating..." : "Create Employee & Login →"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* -------------------------------------------------------- */}
      {/* CSV IMPORT MODAL (DRY RUN VALIDATION)                     */}
      {/* -------------------------------------------------------- */}
      <Dialog open={showCsvModal} onClose={() => setShowCsvModal(false)} className="max-w-2xl">
        <DialogHeader>
          <div>
            <DialogTitle>Bulk Import Employees via CSV</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Dry-run validation checks required columns, email uniqueness &amp; salaries.</p>
          </div>
          <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div>
            <Label className="block mb-1.5">
              CSV Data (Header: <code>Name,Email,Department,Designation,Salary,Phone,Address</code>):
            </Label>
            <Textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Name,Email,Department,Designation,Salary,Phone,Address\nBilal Khan,bilal.khan@example.com,Engineering,Backend Lead,180000,03001234567,Karachi\nAyesha Noor,ayesha.noor@example.com,Design,UI Designer,140000,03121234567,Lahore`}
              className="font-mono text-xs"
            />
          </div>

          {csvDryRunResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <strong className="text-emerald-800 font-bold">Dry-Run Report:</strong>
                <span className="font-semibold text-slate-600">
                  Total: {csvDryRunResult.totalRows} | Valid: <span className="text-emerald-700 font-bold">{csvDryRunResult.validCount}</span> | Errors: <span className="text-rose-600 font-bold">{csvDryRunResult.errorCount}</span>
                </span>
              </div>

              {csvDryRunResult.errors?.length > 0 && (
                <div className="rounded-lg bg-rose-50 p-2 text-rose-700 space-y-1">
                  {csvDryRunResult.errors.map((err, i) => (
                    <div key={i}>• Row {err.row}: <strong>{err.field}</strong> — {err.reason}</div>
                  ))}
                </div>
              )}

              {csvDryRunResult.errorCount === 0 && (
                <p className="text-emerald-700 font-medium">
                  ✓ All rows are valid and ready to be committed to Supabase!
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={!csvText.trim() || csvLoading}
              onClick={() => handleCsvImport(true)}
            >
              {csvLoading ? "Validating..." : "1. Run Dry-Run Check 🔍"}
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCsvModal(false)}>
                Cancel
              </Button>
              <Button
                variant="gradient"
                size="sm"
                disabled={!csvDryRunResult || csvDryRunResult.errorCount > 0 || csvLoading}
                onClick={() => handleCsvImport(false)}
              >
                2. Commit &amp; Create Accounts →
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* -------------------------------------------------------- */}
      {/* PAYSLIP MODAL (PRINTABLE / ITEM DETAILS)                  */}
      {/* -------------------------------------------------------- */}
      {activePayslip && (
        <Dialog open={Boolean(activePayslip)} onClose={() => setActivePayslip(null)} className="max-w-xl">
          <DialogHeader>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">Official Payslip</span>
              <DialogTitle className="text-xl">{activePayslip.employeeName}</DialogTitle>
              <p className="text-xs text-slate-500">{activePayslip.department} · {activePayslip.month}</p>
            </div>
            <button onClick={() => setActivePayslip(null)} className="text-slate-400 hover:text-slate-700">✕</button>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Working Days in Month</span>
                <strong className="text-sm font-bold text-slate-800">{activePayslip.workingDays} days</strong>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Per-Day Rate</span>
                <strong className="text-sm font-bold text-slate-800">{Math.round(activePayslip.perDayRate || 0).toLocaleString()} PKR</strong>
              </div>
            </div>

            <div>
              <span className="block font-bold text-slate-700 mb-1.5 uppercase text-[10px]">Earnings</span>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="flex justify-between p-2.5">
                  <span>Basic Base Salary</span>
                  <strong className="text-slate-800">{Number(activePayslip.basic || activePayslip.basicSalary || 0).toLocaleString()} PKR</strong>
                </div>
                <div className="flex justify-between p-2.5 text-emerald-700">
                  <span>Overtime Pay ({activePayslip.totalOvertimeHours || 0} hrs @ 1.5× hourly rate)</span>
                  <strong className="font-bold">+{Number(activePayslip.overtimePay || 0).toLocaleString()} PKR</strong>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-50 font-bold text-slate-900">
                  <span>Total Gross</span>
                  <span className="text-indigo-700">{Number(activePayslip.gross || 0).toLocaleString()} PKR</span>
                </div>
              </div>
            </div>

            <div>
              <span className="block font-bold text-slate-700 mb-1.5 uppercase text-[10px]">Deductions &amp; Tax</span>
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                <div className="flex justify-between p-2.5 text-rose-600">
                  <span>Late Arrival Penalty ({activePayslip.lateDays || 0} late arrivals)</span>
                  <strong className="font-bold">-{Number(activePayslip.lateDeduction || 0).toLocaleString()} PKR</strong>
                </div>
                <div className="flex justify-between p-2.5 text-rose-600">
                  <span>Absent / Unpaid Leave ({activePayslip.absentDays || 0} days)</span>
                  <strong className="font-bold">-{Number(activePayslip.absentDeduction || activePayslip.deductions || 0).toLocaleString()} PKR</strong>
                </div>
                <div className="flex justify-between p-2.5 text-rose-600">
                  <span>Income Tax Withholding</span>
                  <strong className="font-bold">-{Number(activePayslip.tax || 0).toLocaleString()} PKR</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-3.5 sm:p-4 text-white shadow-md">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-indigo-100 font-semibold">Net Pay Transferred</span>
                <strong className="text-xl sm:text-2xl font-black">{activePayslip.netPay.toLocaleString()} PKR</strong>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="w-full sm:w-auto bg-white text-indigo-700 hover:bg-slate-50 border-0"
              >
                Print Payslip 🖨
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* -------------------------------------------------------- */}
      {/* ADD HR / ADMIN ACCOUNT MODAL                             */}
      {/* -------------------------------------------------------- */}
      <Dialog open={showAddHRModal} onClose={() => setShowAddHRModal(false)}>
        <DialogHeader>
          <div>
            <DialogTitle>Hire New HR Team Member / Manager</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Admin action: Creates an authorized HR login stored directly in Supabase PostgreSQL (`public.users`).
            </p>
          </div>
          <button onClick={() => setShowAddHRModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
        </DialogHeader>

        <form onSubmit={handleCreateHR} className="space-y-4 text-xs">
          <div>
            <Label>Full Name *</Label>
            <Input
              required
              placeholder="e.g. Sarah Ahmed"
              value={hrForm.name}
              onChange={(e) => setHrForm({ ...hrForm, name: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Official Email Address *</Label>
            <Input
              required
              type="email"
              placeholder="hr.manager@example.com"
              value={hrForm.email}
              onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Assigned Role *</Label>
              <Select
                value={hrForm.role}
                onChange={(e) => setHrForm({ ...hrForm, role: e.target.value })}
                className="mt-1"
              >
                <option value="HR">HR Manager (/hr)</option>
                <option value="ADMIN">System Administrator (/dashboard)</option>
              </Select>
            </div>
            <div>
              <Label>Initial Password (min 8 chars) *</Label>
              <Input
                required
                type="password"
                placeholder="••••••••"
                value={hrForm.password}
                onChange={(e) => setHrForm({ ...hrForm, password: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-slate-600">
            <span className="font-semibold block text-slate-800">Role Capabilities:</span>
            <p className="text-[11px] mt-0.5">
              {hrForm.role === "HR"
                ? "HR will manage Employees, review/approve daily Leaves, track Attendance, generate Payroll drafts, and post Announcements."
                : "Admin has full privileges, company setup, geofence, payroll finalization, and user access control."}
            </p>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddHRModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" size="sm" disabled={submittingHR}>
              {submittingHR ? "Hiring HR Manager..." : "Hire HR Manager & Save to Supabase"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* AI Assistant Modal */}
      <AIAssistantModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onLeaveSubmitted={loadDashboard}
      />
    </div>
  );
}