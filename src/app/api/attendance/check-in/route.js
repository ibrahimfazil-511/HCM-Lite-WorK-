import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { getTodayKey, isLate } from "../../../../lib/attendance";
import { readStore, writeStore } from "../../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

function resolveEmployeeId(authUser, payload) {
  if (authUser.role === "EMPLOYEE") return authUser.employeeId;
  return typeof payload?.employeeId === "string" ? payload.employeeId : null;
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // optional payload
  }

  const employeeId = resolveEmployeeId(auth.user, payload);
  if (!employeeId) return NextResponse.json({ error: "employeeId is required for this account." }, { status: 400 });

  const store = await readStore();
  const employee = (store.employees || []).find((candidate) => candidate.id === employeeId);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const now = new Date();
  const today = getTodayKey(now);
  const attendance = store.attendance || [];
  const existing = attendance.find((record) => record.employeeId === employeeId && record.date === today);
  if (existing) {
    return NextResponse.json({ error: "Employee has already checked in today.", code: "ALREADY_CHECKED_IN", attendance: existing }, { status: 409 });
  }

  const late = isLate(now, store.office);
  const record = {
    id: randomUUID(),
    employeeId,
    date: today,
    checkInAt: now.toISOString(),
    checkOutAt: null,
    status: late ? "late" : "present",
    totalWorkHours: 0,
    overtimeHours: 0,
    dutyHours: 8,
    isLate: Boolean(late),
  };

  await writeStore({ ...store, attendance: [...attendance, record] });
  await auditLog(auth.user, "ATTENDANCE_CHECK_IN", `attendance:${record.id}`, null, record);
  return NextResponse.json({ attendance: record }, { status: 201 });
}
