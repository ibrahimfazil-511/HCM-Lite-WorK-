import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { getTodayKey, isLate, calculateLateHours } from "../../../../lib/attendance";
import { readStore, writeStore } from "../../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

function resolveEmployeeId(authUser, payload, store) {
  if (authUser.role === "EMPLOYEE") {
    if (authUser.employeeId) return authUser.employeeId;
    const match = (store.employees || []).find((c) =>
      (c.userId && c.userId === authUser.userId) ||
      (c.email && String(c.email).toLowerCase() === String(authUser.email || "").toLowerCase())
    );
    return match?.id || null;
  }
  return typeof payload?.employeeId === "string" ? payload.employeeId : null;
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // optional body
  }

  const store = await readStore();
  const employeeId = resolveEmployeeId(auth.user, payload, store);
  if (!employeeId) return NextResponse.json({ error: "employeeId is required for this account." }, { status: 400 });

  const now = new Date();
  const today = getTodayKey(now);

  // Check if employee is on approved leave today.
  // If yes, check-in is blocked because their salary is already safeguarded by approved leave quota.
  const leaves = store.leaves || [];
  const onApprovedLeave = leaves.find((l) =>
    l.employeeId === employeeId &&
    String(l.status).toLowerCase() === "approved" &&
    today >= l.startDate &&
    today <= l.endDate
  );
  if (onApprovedLeave) {
    return NextResponse.json({
      error: `You are on approved ${onApprovedLeave.leaveType} leave today (${onApprovedLeave.startDate} to ${onApprovedLeave.endDate}). Check-in is disabled.`,
      code: "ON_APPROVED_LEAVE",
    }, { status: 403 });
  }

  const attendance = store.attendance || [];
  const existing = attendance.find((record) => record.employeeId === employeeId && record.date === today);
  if (existing) {
    return NextResponse.json({ error: "Employee has already checked in today.", code: "ALREADY_CHECKED_IN", attendance: existing }, { status: 409 });
  }

  const late = isLate(now, store.office);
  const lateHours = late ? calculateLateHours(now, store.office) : 0;
  const record = {
    id: randomUUID(),
    employeeId,
    date: today,
    checkInAt: now.toISOString(),
    checkOutAt: null,
    status: late ? "late" : "present",
    totalWorkHours: 0,
    overtimeHours: 0,
    lateHours: lateHours,
    dutyHours: 8,
    isLate: Boolean(late),
  };

  await writeStore({ ...store, attendance: [...attendance, record] });
  await auditLog(auth.user, "ATTENDANCE_CHECK_IN", `attendance:${record.id}`, null, record);
  return NextResponse.json({ attendance: record }, { status: 201 });
}
