import { randomUUID } from "node:crypto";

export const LEAVE_QUOTAS = {
  annual: 14,
  sick: 8,
  casual: 10,
  unpaid: Infinity,
};

const LEAVE_TYPES = new Set(Object.keys(LEAVE_QUOTAS));

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function normalizeLeaveType(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getWorkingDates(startDate, endDate, publicHolidays = []) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) return [];
  const holidays = new Set((publicHolidays || []).map((holiday) => typeof holiday === "string" ? holiday : holiday?.date).filter(Boolean));
  const dates = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.getUTCDay();
    const key = dateKey(date);
    if (day !== 0 && day !== 6 && !holidays.has(key)) dates.push(key);
  }
  return dates;
}

function rangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart <= secondEnd && secondStart <= firstEnd;
}

export function validateLeaveRequest(input, employeeId, store) {
  const leaveType = normalizeLeaveType(input?.leaveType || input?.type);
  const startDate = typeof input?.startDate === "string" ? input.startDate : "";
  const endDate = typeof input?.endDate === "string" ? input.endDate : "";
  const errors = [];
  if (!LEAVE_TYPES.has(leaveType)) errors.push(`leaveType must be one of: ${Object.keys(LEAVE_QUOTAS).join(", ")}`);
  if (!parseDate(startDate)) errors.push("startDate must be a valid YYYY-MM-DD date");
  if (!parseDate(endDate)) errors.push("endDate must be a valid YYYY-MM-DD date");
  if (parseDate(startDate) && parseDate(endDate) && startDate > endDate) errors.push("endDate must be on or after startDate");
  if (errors.length) return { errors, leaveType, startDate, endDate, workingDates: [] };

  const workingDates = getWorkingDates(startDate, endDate, store.publicHolidays || []);
  if (workingDates.length === 0) errors.push("The selected date range contains no working days.");

  const existing = (store.leaves || []).filter((leave) => leave.employeeId === employeeId && ["pending", "approved"].includes(String(leave.status).toLowerCase()));
  if (existing.some((leave) => rangesOverlap(startDate, endDate, leave.startDate, leave.endDate))) {
    errors.push("The requested dates overlap an existing pending or approved leave.");
  }

  const quota = LEAVE_QUOTAS[leaveType];
  if (Number.isFinite(quota)) {
    const years = [...new Set(workingDates.map((date) => date.slice(0, 4)))];
    for (const year of years) {
      const requestedDays = workingDates.filter((date) => date.startsWith(`${year}-`)).length;
      const usedDays = existing
        .filter((leave) => normalizeLeaveType(leave.leaveType) === leaveType)
        .reduce((total, leave) => total + getWorkingDates(
          leave.startDate,
          leave.endDate,
          store.publicHolidays || [],
        ).filter((date) => date.startsWith(`${year}-`)).length, 0);
      if (usedDays + requestedDays > quota) {
        errors.push(`${leaveType} leave quota exceeded for ${year}. Available quota is ${quota} working days.`);
      }
    }
  }
  return { errors, leaveType, startDate, endDate, workingDates };
}

export function createLeaveRecord(input, employeeId, actorId, workingDates) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    employeeId,
    leaveType: normalizeLeaveType(input.leaveType || input.type),
    startDate: input.startDate,
    endDate: input.endDate,
    workingDays: workingDates.length,
    reason: typeof input.reason === "string" ? input.reason.trim() : "",
    status: "pending",
    hrComment: "",
    appliedBy: actorId,
    appliedAt: now,
    updatedAt: now,
  };
}

export function normalizeApprovalStatus(value) {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  return status === "approved" || status === "rejected" ? status : "";
}
