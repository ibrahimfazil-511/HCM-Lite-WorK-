import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { auditLog } from "../../../lib/audit";
import { createEmployeeRecord, createTemporaryPassword, hashPassword, validateEmployee, DEPARTMENTS } from "../../../lib/employees";
import { sendEmployeeWelcomeEmail } from "../../../lib/email";
import { readStore, writeStore } from "../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);
  const store = await readStore();
  const params = new URL(request.url).searchParams;
  const requestedPage = Number(params.get("page") || 1);
  const requestedPageSize = Number(params.get("pageSize") || 10);
  const page = Number.isInteger(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = Number.isInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 10;
  const search = (params.get("search") || "").trim().toLowerCase();
  const department = params.get("department") || "";
  let results = store.employees || [];
  if (auth.user.role === "EMPLOYEE") results = results.filter((employee) => employee.id === auth.user.employeeId || employee.userId === auth.user.userId);
  if (search) results = results.filter((employee) => `${employee.name} ${employee.email} ${employee.designation}`.toLowerCase().includes(search));
  if (department) results = results.filter((employee) => employee.department === department);
  const total = results.length;
  const start = (page - 1) * pageSize;
  return NextResponse.json({ employees: results.slice(start, start + pageSize), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, departments: DEPARTMENTS });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return authResponse(auth);
  let payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const store = await readStore();
  const validation = validateEmployee(payload, store.employees || []);
  if (validation.errors.length) return NextResponse.json({ error: "Employee validation failed.", errors: validation.errors }, { status: 422 });
  const temporaryPassword = createTemporaryPassword();
  const userId = randomUUID();
  const employee = createEmployeeRecord(validation.employee, userId);
  const user = { id: userId, name: employee.name, email: employee.email, passwordHash: await hashPassword(temporaryPassword), role: "EMPLOYEE", employeeId: employee.id, mustChangePassword: true, isTempPassword: true, isActive: true, createdAt: employee.createdAt };
  await writeStore({ ...store, employees: [...(store.employees || []), employee], users: [...store.users, user] });
  const emailDelivery = await sendEmployeeWelcomeEmail({
    name: employee.name,
    email: employee.email,
    temporaryPassword,
    companyName: store.company?.name,
  });
  await auditLog(auth.user, "EMPLOYEE_CREATED", `employee:${employee.id}`, null, { ...employee, emailDelivery: { sent: emailDelivery.sent } });
  return NextResponse.json({
    employee,
    user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId, mustChangePassword: true },
    temporaryPassword: emailDelivery.sent ? undefined : temporaryPassword,
    emailDelivery,
  }, { status: 201 });
}
