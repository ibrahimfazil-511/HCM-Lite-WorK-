import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authenticate, hashPassword } from "../../../lib/auth";
import { auditLog } from "../../../lib/audit";
import { readStore, writeStore } from "../../../lib/store";

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const store = await readStore();
  const users = (store.users || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    employeeId: u.employeeId || null,
    isActive: u.isActive !== false,
    mustChangePassword: Boolean(u.mustChangePassword),
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ users });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  const role = typeof payload?.role === "string" && ["HR", "ADMIN"].includes(payload.role.toUpperCase())
    ? payload.role.toUpperCase()
    : "HR";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, valid email, and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const store = await readStore();
  if ((store.users || []).some((u) => String(u.email || "").toLowerCase() === email)) {
    return NextResponse.json({ error: "A user account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const newUser = {
    id: randomUUID(),
    name,
    email,
    passwordHash,
    role,
    employeeId: null,
    mustChangePassword: false,
    isTempPassword: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const nextUsers = [...(store.users || []), newUser];
  await writeStore({ ...store, users: nextUsers });
  await auditLog(auth.user, "HR_USER_CREATED", `user:${newUser.id}`, null, { name, email, role });

  return NextResponse.json({
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
    },
  }, { status: 201 });
}
