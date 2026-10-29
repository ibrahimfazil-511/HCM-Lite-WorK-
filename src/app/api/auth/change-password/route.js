import { NextResponse } from "next/server";
import { createToken, hashPassword, verifyPassword } from "../../../../lib/auth";
import { readStore, writeStore } from "../../../../lib/store";

export async function POST(request) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const currentPassword = typeof payload?.currentPassword === "string" ? payload.currentPassword : "";
    const newPassword = typeof payload?.newPassword === "string" ? payload.newPassword : "";

    if (!email || !currentPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "Email, current password, and a new password of at least 8 characters are required." }, { status: 400 });
    }

    const store = await readStore();
    const index = (store.users || []).findIndex((candidate) => String(candidate.email || "").toLowerCase() === email);
    const user = store.users?.[index];

    if (!user || user.isActive === false) {
      return NextResponse.json({ error: "Invalid email or current password." }, { status: 401 });
    }

    const hash = user.passwordHash || user.passwordhash || user.password_hash || "";
    const isMatch = await verifyPassword(currentPassword, hash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or current password." }, { status: 401 });
    }

    const isTemp = Boolean(user.mustChangePassword || user.mustchangepassword || user.isTempPassword || user.istemppassword);
    if (!isTemp) {
      return NextResponse.json({ error: "Password change is not required for this account." }, { status: 409 });
    }

    const newHash = await hashPassword(newPassword);
    const updatedUser = {
      ...user,
      passwordHash: newHash,
      mustChangePassword: false,
      isTempPassword: false,
      mustchangepassword: false,
      istemppassword: false,
    };

    const users = [...store.users];
    users[index] = updatedUser;
    await writeStore({ ...store, users });

    const identity = { userId: user.id, role: user.role, employeeId: user.employeeId || null, name: user.name || "", email: user.email || "" };
    const token = createToken(identity);
    const response = NextResponse.json({ token, user: identity });

    try {
      response.cookies.set("hcm_token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 8,
        path: "/",
      });
    } catch {}

    return response;
  } catch (err) {
    console.error("[Change Password Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to update password." }, { status: 500 });
  }
}
