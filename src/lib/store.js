import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { supabaseGet, supabaseUpsert, supabaseConfig } from "./supabase.js";

// Primary project data paths
const projectDataDir = path.join(process.cwd(), "data");
const projectDataFile = path.join(projectDataDir, "hcm.json");

// Serverless / Lambda / Vercel fallback writable path in /tmp
const tmpDataDir = path.join(os.tmpdir(), "hcm-data");
const tmpDataFile = path.join(tmpDataDir, "hcm.json");

// Detect serverless environment (Vercel, AWS Lambda, or /var/task read-only filesystem)
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  (typeof process.cwd === "function" && (process.cwd().startsWith("/var/task") || process.cwd() === "/"))
);

// In-memory runtime cache for serverless containers
let memoryStore = null;

const emptyStore = {
  configured: false,
  company: null,
  office: null,
  users: [],
  employees: [],
  attendance: [],
  leaves: [],
  publicHolidays: [],
  payrolls: [],
  announcements: [],
  notifications: [],
  auditLogs: [],
  aiLogs: [],
};

function parseOrRepairJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Self-healing: if file has trailing junk after final '}', trim and repair
    const lastBrace = raw.lastIndexOf("}");
    if (lastBrace !== -1) {
      try {
        return JSON.parse(raw.slice(0, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function readLocalStore() {
  if (memoryStore) {
    return structuredClone(memoryStore);
  }

  // 1. Try reading from bundled project file (data/hcm.json) without calling mkdir
  try {
    const raw = await readFile(projectDataFile, "utf8");
    const parsed = parseOrRepairJson(raw);
    if (parsed) {
      memoryStore = parsed;
      return structuredClone(parsed);
    }
  } catch {
    // File doesn't exist or is not readable in current working dir (e.g. serverless)
  }

  // 2. Try reading from /tmp fallback
  try {
    const raw = await readFile(tmpDataFile, "utf8");
    const parsed = parseOrRepairJson(raw);
    if (parsed) {
      memoryStore = parsed;
      return structuredClone(parsed);
    }
  } catch {
    // /tmp file doesn't exist yet
  }

  // 3. Fallback to empty store
  memoryStore = structuredClone(emptyStore);
  return structuredClone(emptyStore);
}

async function writeLocalStore(store) {
  // Always update in-memory cache first
  memoryStore = structuredClone(store);

  // In local development, write to project data directory
  // When running on Vercel / AWS Lambda (/var/task), the filesystem is read-only.
  // NEVER attempt mkdir on /var/task/data!
  if (!isServerless) {
    try {
      await mkdir(projectDataDir, { recursive: true });
      await writeFile(projectDataFile, JSON.stringify(store, null, 2), "utf8");
      return store;
    } catch {
      // Fallback to /tmp if project directory is not writable
    }
  }

  // Fallback: write to /tmp (always writable in serverless environments)
  try {
    await mkdir(tmpDataDir, { recursive: true });
    await writeFile(tmpDataFile, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    // Even if /tmp fails for some reason, do NOT throw an exception.
    // memoryStore and Supabase Cloud Database guarantee data persistence.
    console.warn("[HCM Store] Local filesystem write skipped in serverless environment:", err.message);
  }

  return store;
}

// ---------------------------------------------------------------------------
// SANITIZERS (Outgoing: JavaScript Object -> PostgREST Table Columns)
// Ensures PostgREST NEVER rejects an upsert due to schema cache mismatch
// ---------------------------------------------------------------------------

function sanitizeUser(u) {
  return {
    id: String(u.id),
    name: String(u.name || ""),
    email: String(u.email || "").toLowerCase().trim(),
    passwordHash: String(u.passwordHash || ""),
    role: String(u.role || "EMPLOYEE"),
    employeeId: u.employeeId ? String(u.employeeId) : null,
    mustChangePassword: Boolean(u.mustChangePassword),
    isTempPassword: Boolean(u.isTempPassword),
    isActive: u.isActive !== false,
    createdAt: u.createdAt || new Date().toISOString(),
  };
}

function sanitizeEmployee(e) {
  return {
    id: String(e.id),
    userId: e.userId ? String(e.userId) : null,
    name: String(e.name || ""),
    email: String(e.email || "").toLowerCase().trim(),
    department: String(e.department || "Engineering"),
    salary: Number(e.salary) || 0,
    phone: String(e.phone || ""),
    address: String(e.address || ""),
    designation: String(e.designation || ""),
    bankDetails: e.bankDetails || null,
    isActive: e.isActive !== false,
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
  };
}

function sanitizeAttendance(a) {
  let remarksPayload = {};
  try {
    remarksPayload = typeof a.remarks === "string" && a.remarks.startsWith("{") ? JSON.parse(a.remarks) : {};
  } catch {
    remarksPayload = {};
  }
  remarksPayload.overtimeHours = Number(a.overtimeHours || (Number(a.totalWorkHours || 0) > 8 ? Number(a.totalWorkHours) - 8 : 0));
  remarksPayload.dutyHours = Number(a.dutyHours || 8);
  remarksPayload.isLate = Boolean(a.isLate || a.status === "late");

  return {
    id: String(a.id),
    employeeId: String(a.employeeId),
    date: String(a.date),
    checkInAt: a.checkInAt ? new Date(a.checkInAt).toISOString() : null,
    checkOutAt: a.checkOutAt ? new Date(a.checkOutAt).toISOString() : null,
    status: String(a.status || "present"),
    totalWorkHours: Number(a.totalWorkHours) || 0,
    distanceMeters: Number(a.distanceMeters) || 0,
    checkOutDistanceMeters: Number(a.checkOutDistanceMeters) || 0,
    isManualOverride: Boolean(a.isManualOverride),
    remarks: JSON.stringify(remarksPayload),
    createdAt: a.createdAt || new Date().toISOString(),
  };
}

function sanitizeLeave(l) {
  return {
    id: String(l.id),
    employeeId: String(l.employeeId),
    leaveType: String(l.leaveType || "casual"),
    startDate: String(l.startDate),
    endDate: String(l.endDate),
    days: Number(l.workingDays || l.days || 1),
    reason: String(l.reason || ""),
    status: String(l.status || "pending"),
    approvedBy: l.approvedBy ? String(l.approvedBy) : null,
    rejectionReason: String(l.hrComment || l.rejectionReason || ""),
    createdAt: l.appliedAt || l.createdAt || new Date().toISOString(),
  };
}

function sanitizePayroll(p) {
  const lines = Array.isArray(p.lines) ? p.lines : Array.isArray(p.items) ? p.items : [];
  const gross = Number(p.totals?.gross || p.totalGross || 0);
  const net = Number(p.totals?.netPay || p.totalNet || 0);
  const monthStr = String(p.month || "");
  const yearVal = p.year || (monthStr.length >= 4 ? Number(monthStr.slice(0, 4)) : new Date().getFullYear());

  return {
    id: String(p.id),
    month: monthStr,
    year: yearVal,
    status: String(p.status || "draft"),
    finalizedAt: p.finalizedAt ? new Date(p.finalizedAt).toISOString() : null,
    finalizedBy: p.finalizedBy ? String(p.finalizedBy) : null,
    items: lines,
    totalGross: gross,
    totalNet: net,
    createdAt: p.createdAt || new Date().toISOString(),
  };
}

function sanitizeAnnouncement(a) {
  return {
    id: String(a.id),
    title: String(a.title || ""),
    content: String(a.content || ""),
    audience: String(a.audience || "ALL"),
    priority: String(a.priority || "normal"),
    createdBy: a.createdBy ? String(a.createdBy) : null,
    publishedAt: a.publishedAt || new Date().toISOString(),
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString(),
  };
}

function sanitizeNotification(n) {
  return {
    id: String(n.id),
    userId: String(n.userId),
    type: String(n.type || "general"),
    title: String(n.title || ""),
    message: String(n.message || ""),
    announcementId: n.announcementId ? String(n.announcementId) : null,
    priority: String(n.priority || "normal"),
    readAt: n.readAt || null,
    createdAt: n.createdAt || new Date().toISOString(),
  };
}

function sanitizeAuditLog(log) {
  return {
    id: String(log.id),
    actorId: log.actorId ? String(log.actorId) : null,
    action: String(log.action || ""),
    entity: String(log.entity || ""),
    before: log.before || null,
    after: log.after || null,
    createdAt: log.createdAt || new Date().toISOString(),
  };
}

function sanitizeAILog(log) {
  return {
    id: String(log.id),
    userId: log.userId ? String(log.userId) : null,
    userRole: log.userRole ? String(log.userRole) : null,
    query: String(log.query || ""),
    toolUsed: log.toolUsed ? String(log.toolUsed) : null,
    replyPreview: String(log.replyPreview || "").slice(0, 150),
    createdAt: log.createdAt || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// DESERIALIZERS (Incoming: PostgREST Table Columns -> JavaScript App State)
// Re-maps fields into application properties seamlessly
// ---------------------------------------------------------------------------

function unmapUser(u) {
  return {
    ...u,
    id: String(u.id),
    name: String(u.name || ""),
    email: String(u.email || "").toLowerCase().trim(),
    passwordHash: u.passwordHash || u.passwordhash || u.password_hash || "",
    role: String(u.role || "EMPLOYEE").toUpperCase(),
    employeeId: u.employeeId || u.employeeid || u.employee_id || null,
    mustChangePassword: Boolean(u.mustChangePassword ?? u.mustchangepassword ?? u.must_change_password),
    isTempPassword: Boolean(u.isTempPassword ?? u.istemppassword ?? u.is_temp_password),
    isActive: u.isActive !== false && u.isactive !== false && u.is_active !== false,
  };
}

function unmapEmployee(e) {
  return {
    ...e,
    id: String(e.id),
    userId: e.userId || e.userid || e.user_id || null,
    name: String(e.name || ""),
    email: String(e.email || "").toLowerCase().trim(),
    department: String(e.department || "Engineering"),
    salary: Number(e.salary) || 0,
    phone: String(e.phone || ""),
    address: String(e.address || ""),
    designation: String(e.designation || ""),
    bankDetails: e.bankDetails || e.bankdetails || e.bank_details || null,
    isActive: e.isActive !== false && e.isactive !== false && e.is_active !== false,
  };
}

function unmapAttendance(a) {
  let extra = {};
  try {
    if (typeof a.remarks === "string" && a.remarks.startsWith("{")) {
      extra = JSON.parse(a.remarks);
    }
  } catch {
    extra = {};
  }
  const hours = Number(a.totalWorkHours || 0);
  const ot = Number(extra.overtimeHours || (hours > 8 ? hours - 8 : 0));

  return {
    ...a,
    overtimeHours: ot,
    dutyHours: Number(extra.dutyHours || 8),
    isLate: Boolean(extra.isLate || a.status === "late"),
  };
}

function unmapLeave(l) {
  return {
    ...l,
    workingDays: Number(l.days || l.workingDays || 1),
    hrComment: l.rejectionReason || l.hrComment || "",
    appliedAt: l.createdAt || l.appliedAt,
  };
}

function unmapPayroll(p) {
  const lines = Array.isArray(p.items) ? p.items : Array.isArray(p.lines) ? p.lines : [];
  const totals = p.totals || {
    gross: Number(p.totalGross || 0),
    netPay: Number(p.totalNet || 0),
    deductions: Math.max(0, Number(p.totalGross || 0) - Number(p.totalNet || 0)),
  };

  return {
    ...p,
    lines,
    totals,
  };
}

/**
 * Read the current store state.
 * Prefers Supabase live data; falls back to local cache gracefully.
 */
export async function readStore() {
  let local;
  try {
    local = await readLocalStore();
  } catch (err) {
    console.warn("[HCM Store] Local store read warning:", err.message);
    local = structuredClone(emptyStore);
  }

  if (supabaseConfig.isConfigured) {
    try {
      const [
        settingsRes,
        usersRes,
        employeesRes,
        attendanceRes,
        leavesRes,
        payrollsRes,
        announcementsRes,
        notificationsRes,
        auditRes,
        aiRes,
      ] = await Promise.all([
        supabaseGet("company_settings"),
        supabaseGet("users"),
        supabaseGet("employees"),
        supabaseGet("attendance"),
        supabaseGet("leaves"),
        supabaseGet("payrolls"),
        supabaseGet("announcements"),
        supabaseGet("notifications"),
        supabaseGet("audit_logs"),
        supabaseGet("ai_logs"),
      ]);

      if (settingsRes.ok || usersRes.ok) {
        const configRow = settingsRes.data?.[0];

        // Retrieve live lists from Supabase with safe deserialization
        const rawUsers = usersRes.ok && Array.isArray(usersRes.data) ? usersRes.data.map(unmapUser) : [];
        const rawEmployees = employeesRes.ok && Array.isArray(employeesRes.data) ? employeesRes.data.map(unmapEmployee) : [];

        // Ensure passwordHash is never lost if Supabase table column casing differs
        const dbUsers = rawUsers.map((u) => {
          if (!u.passwordHash) {
            const match = (local.users || []).find((lu) => (lu.email || "").toLowerCase() === (u.email || "").toLowerCase());
            if (match?.passwordHash) u.passwordHash = match.passwordHash;
          }
          return u;
        });

        const dbEmployees = rawEmployees;
        const dbAttendance = attendanceRes.ok && Array.isArray(attendanceRes.data) ? attendanceRes.data.map(unmapAttendance) : [];
        const dbLeaves = leavesRes.ok && Array.isArray(leavesRes.data) ? leavesRes.data.map(unmapLeave) : [];
        const dbPayrolls = payrollsRes.ok && Array.isArray(payrollsRes.data) ? payrollsRes.data.map(unmapPayroll) : [];
        const dbAnnouncements = announcementsRes.ok && Array.isArray(announcementsRes.data) ? announcementsRes.data : [];
        const dbNotifications = notificationsRes.ok && Array.isArray(notificationsRes.data) ? notificationsRes.data : [];
        const dbAudit = auditRes.ok && Array.isArray(auditRes.data) ? auditRes.data : [];
        const dbAI = aiRes.ok && Array.isArray(aiRes.data) ? aiRes.data : [];

        // If database has records, use database. If database is fresh but local has records, backfill!
        const finalUsers = dbUsers.length > 0 ? dbUsers : (local.users || []);
        const finalEmployees = dbEmployees.length > 0 ? dbEmployees : (local.employees || []);
        const finalAttendance = dbAttendance.length > 0 ? dbAttendance : (local.attendance || []);
        const finalLeaves = dbLeaves.length > 0 ? dbLeaves : (local.leaves || []);
        const finalPayrolls = dbPayrolls.length > 0 ? dbPayrolls : (local.payrolls || []);

        const store = {
          configured: configRow?.configured ?? local.configured ?? true,
          company: configRow?.company || local.company || { name: "Saylani Tech" },
          office: configRow?.office || local.office || {},
          users: finalUsers,
          employees: finalEmployees,
          attendance: finalAttendance,
          leaves: finalLeaves,
          publicHolidays: local.publicHolidays || [],
          payrolls: finalPayrolls,
          announcements: dbAnnouncements.length > 0 ? dbAnnouncements : (local.announcements || []),
          notifications: dbNotifications.length > 0 ? dbNotifications : (local.notifications || []),
          auditLogs: dbAudit.length > 0 ? dbAudit : (local.auditLogs || []),
          aiLogs: dbAI.length > 0 ? dbAI : (local.aiLogs || []),
        };

        // Cache fresh data locally
        writeLocalStore(store).catch(() => {});
        return store;
      }
    } catch (err) {
      console.warn("[HCM Store] Supabase read warning, using local file:", err.message);
    }
  }

  return local;
}

/**
 * Write updated store state.
 * Persists locally and automatically pushes sanitized, schema-compliant rows to Supabase tables.
 */
export async function writeStore(store) {
  // 1. Write locally / update memory store safely without throwing
  try {
    await writeLocalStore(store);
  } catch (err) {
    console.warn("[HCM Store] writeLocalStore warning:", err.message);
  }

  // 2. Synchronize to Supabase Cloud Database with schema-matched sanitization
  if (supabaseConfig.isConfigured) {
    try {
      const configRow = {
        id: "current",
        configured: Boolean(store.configured),
        company: store.company || {},
        office: store.office || {},
        updatedAt: new Date().toISOString(),
      };

      const syncTasks = [
        supabaseUpsert("company_settings", configRow),
        store.users?.length
          ? supabaseUpsert("users", store.users.map(sanitizeUser))
          : Promise.resolve({ ok: true }),
        store.employees?.length
          ? supabaseUpsert("employees", store.employees.map(sanitizeEmployee))
          : Promise.resolve({ ok: true }),
        store.attendance?.length
          ? supabaseUpsert("attendance", store.attendance.map(sanitizeAttendance))
          : Promise.resolve({ ok: true }),
        store.leaves?.length
          ? supabaseUpsert("leaves", store.leaves.map(sanitizeLeave))
          : Promise.resolve({ ok: true }),
        store.payrolls?.length
          ? supabaseUpsert("payrolls", store.payrolls.map(sanitizePayroll))
          : Promise.resolve({ ok: true }),
        store.announcements?.length
          ? supabaseUpsert("announcements", store.announcements.map(sanitizeAnnouncement))
          : Promise.resolve({ ok: true }),
        store.notifications?.length
          ? supabaseUpsert("notifications", store.notifications.map(sanitizeNotification))
          : Promise.resolve({ ok: true }),
        store.auditLogs?.length
          ? supabaseUpsert("audit_logs", store.auditLogs.map(sanitizeAuditLog))
          : Promise.resolve({ ok: true }),
        store.aiLogs?.length
          ? supabaseUpsert("ai_logs", store.aiLogs.map(sanitizeAILog))
          : Promise.resolve({ ok: true }),
      ];

      const results = await Promise.all(syncTasks);
      const errors = results.filter((res) => res && !res.ok);
      if (errors.length > 0) {
        console.error("[HCM Store] Supabase upsert errors:", errors.map((e) => e.error));
      }
    } catch (err) {
      console.error("[HCM Store] Supabase sync exception:", err.message);
    }
  }

  return store;
}