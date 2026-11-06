import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { getTodayKey, getOvertimeMinutes } from "../../../../lib/attendance";
import { readStore, writeStore } from "../../../../lib/store";

function resolveEmployeeId(authUser, payload, store) {
  if (String(authUser.role || "").toUpperCase() === "EMPLOYEE") {
    const employees = store.employees || [];
    const tokenEmployeeId = String(authUser.employeeId || "").trim();
    if (tokenEmployeeId && employees.some((employee) => String(employee.id) === tokenEmployeeId)) {
      return tokenEmployeeId;
    }

    const match = employees.find((employee) =>
      (employee.userId && String(employee.userId) === String(authUser.userId || "")) ||
      (employee.email && String(employee.email).toLowerCase() === String(authUser.email || "").toLowerCase())
    );
    return match?.id || null;
  }
  return typeof payload?.employeeId === "string" ? payload.employeeId : null;
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // optional payload
  }

  const store = await readStore();
  const employeeId = resolveEmployeeId(auth.user, payload, store);
  if (!employeeId) return NextResponse.json({ error: "employeeId is required for this account." }, { status: 400 });

  const today = getTodayKey();
  const attendance = store.attendance || [];
  const index = attendance.findIndex((record) => record.employeeId === employeeId && record.date === today);

  if (index < 0) {
    return NextResponse.json({ error: "No check-in exists for today.", code: "CHECK_IN_REQUIRED" }, { status: 409 });
  }

  if (attendance[index].checkOutAt) {
    return NextResponse.json({ error: "Employee has already checked out today.", code: "ALREADY_CHECKED_OUT", attendance: attendance[index] }, { status: 409 });
  }

  const checkOutAt = new Date();
  const checkInAt = new Date(attendance[index].checkInAt);
  const durationMilliseconds = Math.max(0, checkOutAt.getTime() - checkInAt.getTime());
  const totalWorkHours = Number((durationMilliseconds / (1000 * 60 * 60)).toFixed(2));

  // Office duty standard: 09:00 AM - 05:00 PM (8.0 hours).
  // Overtime starts after the office end time.
  const dutyHours = 8;
  const overtimeHours = Number((getOvertimeMinutes(checkOutAt, store.office) / 60).toFixed(2));

  // Rate calculation strictly based on standard 30-day Basic Salary
  const employee = (store.employees || []).find((e) => e.id === employeeId);
  const salary = Number(employee?.salary || 0);
  const perDayRate = salary > 0 ? salary / 30 : 0;
  const hourlyRate = perDayRate > 0 ? perDayRate / 8 : 0;
  const overtimeRate = hourlyRate * 1.5;
  const overtimePay = overtimeHours > 0 ? Math.round(overtimeHours * overtimeRate) : 0;

  // Status reflects actual arrival & work:
  // No arbitrary half_day cut for small minutes; duty pay is strictly proportional to hours worked.
  const finalStatus = attendance[index].isLate ? "late" : (totalWorkHours < 8 ? "partial" : "present");

  const updated = {
    ...attendance[index],
    checkOutAt: checkOutAt.toISOString(),
    totalWorkHours,
    dutyHours,
    overtimeHours,
    overtimePay,
    status: finalStatus,
  };

  const nextAttendance = [...attendance];
  nextAttendance[index] = updated;

  await writeStore({ ...store, attendance: nextAttendance });
  await auditLog(auth.user, "ATTENDANCE_CHECK_OUT", `attendance:${updated.id}`, attendance[index], updated);

  return NextResponse.json({ attendance: updated }, { status: 200 });
}
