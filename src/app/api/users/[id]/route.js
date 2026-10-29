import { NextResponse } from "next/server";
import { authenticate, hashPassword } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { readStore, writeStore } from "../../../../lib/store";

export async function PATCH(request, { params }) {
  const auth = await authenticate(request, ["ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const store = await readStore();
  const index = (store.users || []).findIndex((u) => u.id === id);
  if (index < 0) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const user = store.users[index];

  // Prevent admin from deactivating themselves
  if (user.id === auth.user.userId && payload.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own admin account." }, { status: 400 });
  }

  let updatedHash = user.passwordHash;
  if (typeof payload.password === "string" && payload.password.length >= 8) {
    updatedHash = await hashPassword(payload.password);
  }

  const updatedUser = {
    ...user,
    isActive: typeof payload.isActive === "boolean" ? payload.isActive : user.isActive,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : user.name,
    passwordHash: updatedHash,
  };

  const users = [...store.users];
  users[index] = updatedUser;
  await writeStore({ ...store, users });
  await auditLog(auth.user, "USER_STATUS_UPDATED", `user:${id}`, user, updatedUser);

  return NextResponse.json({
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    },
  });
}
