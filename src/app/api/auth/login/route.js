import { NextResponse } from "next/server";
import { createToken, verifyPassword } from "../../../../lib/auth";
import { readStore } from "../../../../lib/store";

export async function POST(request) {
  try {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const password = typeof payload?.password === "string" ? payload.password : "";
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const store = await readStore();
    const users = Array.isArray(store?.users) ? store.users : [];
    const user = users.find((candidate) => String(candidate.email || "").toLowerCase().trim() === email);

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const isActive = user.isActive !== false && user.isactive !== false && user.is_active !== false;
    if (!isActive) {
      return NextResponse.json({ error: "Account is inactive. Please contact administrator." }, { status: 403 });
    }

    const hash = user.passwordHash || user.passwordhash || user.password_hash || "";
    const isMatch = await verifyPassword(password, hash);

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const role = String(user.role || "EMPLOYEE").toUpperCase();
    const employeeId = user.employeeId || user.employeeid || user.employee_id || null;
    const identity = { userId: user.id, role, employeeId, name: user.name || "", email: user.email || "" };

    const mustChange = Boolean(user.mustChangePassword || user.mustchangepassword || user.isTempPassword || user.istemppassword);
    if (mustChange) {
      return NextResponse.json({
        error: "Password change is required before continuing.",
        code: "MUST_CHANGE_PASSWORD",
        mustChangePassword: true,
        user: identity,
      }, { status: 403 });
    }

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
    } catch {
      // Cookies might not be supported in some runtime environments, client local storage handles token
    }
    return response;
  } catch (err) {
    console.error("[Login Handler Error]:", err);
    return NextResponse.json({ error: err.message || "An authentication error occurred." }, { status: 500 });
  }
}
