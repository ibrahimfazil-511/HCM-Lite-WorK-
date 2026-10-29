import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { createLeaveRecord, validateLeaveRequest } from "../../../../lib/leaves";
import { readStore, writeStore } from "../../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const employeeId = auth.user.role === "EMPLOYEE" ? auth.user.employeeId : payload?.employeeId;
  if (!employeeId) return NextResponse.json({ error: "employeeId is required for HR and Admin applications." }, { status: 400 });
  const store = await readStore();
  const employee = (store.employees || []).find((candidate) => candidate.id === employeeId && candidate.isActive !== false);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const validation = validateLeaveRequest(payload, employeeId, store);
  if (validation.errors.length) {
    return NextResponse.json({ error: "Leave application cannot be submitted.", errors: validation.errors }, { status: 422 });
  }
  const leave = createLeaveRecord({ ...payload, startDate: validation.startDate, endDate: validation.endDate, leaveType: validation.leaveType }, employeeId, auth.user.userId, validation.workingDates);
  await writeStore({ ...store, leaves: [...(store.leaves || []), leave] });
  await auditLog(auth.user, "LEAVE_APPLIED", `leave:${leave.id}`, null, leave);
  return NextResponse.json({ leave }, { status: 201 });
}
