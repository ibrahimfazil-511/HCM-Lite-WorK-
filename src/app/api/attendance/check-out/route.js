import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { getTodayKey } from "../../../../lib/attendance";
import { readStore, writeStore } from "../../../../lib/store";

function resolveEmployeeId(authUser, payload) {
  if (authUser.role === "EMPLOYEE") return authUser.employeeId;
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

  const employeeId = resolveEmployeeId(auth.user, payload);
  if (!employeeId) return NextResponse.json({ error: "employeeId is required for this account." }, { status: 400 });

  const store = await readStore();
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

  // Duty is 8 hours. Overtime is any time beyond 8 hours.
  const dutyHours = 8;
  const overtimeHours = totalWorkHours > dutyHours ? Number((totalWorkHours - dutyHours).toFixed(2)) : 0;

  let finalStatus = attendance[index].status;
  if (totalWorkHours < 4) {
    finalStatus = "half_day";
  }

  const updated = {
    ...attendance[index],
    checkOutAt: checkOutAt.toISOString(),
    totalWorkHours,
    dutyHours,
    overtimeHours,
    status: finalStatus,
  };

  const nextAttendance = [...attendance];
  nextAttendance[index] = updated;

  await writeStore({ ...store, attendance: nextAttendance });
  await auditLog(auth.user, "ATTENDANCE_CHECK_OUT", `attendance:${updated.id}`, attendance[index], updated);

  return NextResponse.json({ attendance: updated }, { status: 200 });
}
