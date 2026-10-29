import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { normalizeEmployee, validateEmployee } from "../../../../lib/employees";
import { readStore, writeStore } from "../../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);
  const { id } = await params;
  const store = await readStore();
  const employee = (store.employees || []).find((candidate) => candidate.id === id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (auth.user.role === "EMPLOYEE" && employee.id !== auth.user.employeeId && employee.userId !== auth.user.userId) {
    return NextResponse.json({ error: "You cannot access this employee." }, { status: 403 });
  }
  return NextResponse.json({ employee });
}

export async function PATCH(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);
  const { id } = await params;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const store = await readStore();
  const index = (store.employees || []).findIndex((candidate) => candidate.id === id);
  if (index < 0) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const current = store.employees[index];

  // Employee self-service: only allow updating phone and address
  if (auth.user.role === "EMPLOYEE") {
    if (current.id !== auth.user.employeeId && current.userId !== auth.user.userId) {
      return NextResponse.json({ error: "You can only edit your own profile." }, { status: 403 });
    }
    const updated = {
      ...current,
      phone: typeof payload.phone === "string" ? payload.phone.trim() : current.phone,
      address: typeof payload.address === "string" ? payload.address.trim() : current.address,
      updatedAt: new Date().toISOString(),
    };
    const employees = [...store.employees];
    employees[index] = updated;
    await writeStore({ ...store, employees });
    return NextResponse.json({ employee: updated });
  }

  // Admin & HR: update details
  const candidate = normalizeEmployee({ ...current, ...payload });
  const others = store.employees.filter((employee) => employee.id !== id);
  const validation = validateEmployee(candidate, others);
  if (validation.errors.length) {
    return NextResponse.json({ error: "Employee validation failed.", errors: validation.errors }, { status: 422 });
  }

  const employee = { ...current, ...candidate, updatedAt: new Date().toISOString() };
  const employees = [...store.employees];
  employees[index] = employee;
  const users = store.users.map((user) => (user.id === employee.userId ? { ...user, name: employee.name, email: employee.email } : user));
  await writeStore({ ...store, employees, users });
  return NextResponse.json({ employee });
}

export async function DELETE(request, { params }) {
  const auth = await authenticate(request, ["ADMIN"]);
  if (!auth.ok) return authResponse(auth);
  const { id } = await params;
  const store = await readStore();
  const employee = (store.employees || []).find((candidate) => candidate.id === id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  await writeStore({
    ...store,
    employees: store.employees.filter((candidate) => candidate.id !== id),
    users: store.users.filter((user) => user.id !== employee.userId),
  });
  return NextResponse.json({ success: true });
}
