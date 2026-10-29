import { NextResponse } from "next/server";
import { authenticate } from "../../../../../lib/auth";
import { auditLog } from "../../../../../lib/audit";
import { createTemporaryPassword, hashPassword } from "../../../../../lib/employees";
import { sendEmployeeWelcomeEmail } from "../../../../../lib/email";
import { readStore, writeStore } from "../../../../../lib/store";

export async function POST(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const store = await readStore();
  const employee = (store.employees || []).find((candidate) => candidate.id === id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const temporaryPassword = createTemporaryPassword();
  const users = store.users.map((user) => user.id === employee.userId ? { ...user, passwordHash: null, mustChangePassword: true, isTempPassword: true } : user);
  const targetUser = users.find((user) => user.id === employee.userId);
  if (!targetUser) return NextResponse.json({ error: "Employee login account not found." }, { status: 404 });
  targetUser.passwordHash = await hashPassword(temporaryPassword);
  const emailDelivery = await sendEmployeeWelcomeEmail({ name: employee.name, email: employee.email, temporaryPassword, companyName: store.company?.name });
  await writeStore({ ...store, users });
  await auditLog(auth.user, "EMPLOYEE_INVITE_RESENT", `employee:${id}`, null, { employeeId: id, email: employee.email, emailSent: emailDelivery.sent });
  return NextResponse.json({ emailDelivery, temporaryPassword: emailDelivery.sent ? undefined : temporaryPassword });
}
