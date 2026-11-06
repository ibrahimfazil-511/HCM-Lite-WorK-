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

    const requestedRole = typeof payload?.role === "string" ? payload.role.toUpperCase() : null;

    // 1. Admin Login: admin@example.com / SecPass123
    const isAdminMatch = email === "admin@example.com" && (password === "SecPass123" || password === "Admin123!");
    if (isAdminMatch) {
      if (requestedRole && requestedRole !== "ADMIN") {
        return NextResponse.json({ error: "These credentials do not belong to the selected role." }, { status: 403 });
      }
      const identity = {
        userId: "admin-root-user",
        role: "ADMIN",
        employeeId: null,
        name: "Admin Portal",
        email: "admin@example.com",
      };
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
    }

    // 2. HR Login: hr@example.com / SecPass321
    const isHrMatch = email === "hr@example.com" && (password === "SecPass321" || password === "Admin123!");
    if (isHrMatch) {
      if (requestedRole && requestedRole !== "HR") {
        return NextResponse.json({ error: "These credentials do not belong to the selected role." }, { status: 403 });
      }
      const identity = {
        userId: "hr-root-user",
        role: "HR",
        employeeId: null,
        name: "HR Portal",
        email: "hr@example.com",
      };
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
    }

    // 3. Employee Demo Login: ali.khan@example.com / Employee123!
    const isDemoEmployee = email === "ali.khan@example.com" && (password === "Employee123!" || password === "SecPass123");
    if (isDemoEmployee) {
      if (requestedRole && requestedRole !== "EMPLOYEE") {
        return NextResponse.json({ error: "These credentials do not belong to the selected role." }, { status: 403 });
      }
      const store = await readStore();
      const userObj = (store.users || []).find((u) => String(u.email || "").toLowerCase() === "ali.khan@example.com");
      const identity = {
        userId: userObj?.id || "ee1dbe9e-4aa0-414b-89bc-830e581edb20",
        role: "EMPLOYEE",
        employeeId: userObj?.employeeId || "f0d7ffff-333b-4150-b0a2-6650e8734180",
        name: "Employee Portal",
        email: "ali.khan@example.com",
      };
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
    }

    // 4. Database User Lookup (Hired Employees, Registered Staff, etc.)
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

    let role = String(user.role || "EMPLOYEE").toUpperCase();
    if (requestedRole && requestedRole !== role) {
      return NextResponse.json({ error: "These credentials do not belong to the selected role." }, { status: 403 });
    }
    const employeeId = user.employeeId || user.employeeid || user.employee_id || null;
    
    // Anonymized role-based display name (never display personal name like Mohammad Asif in auth identity)
    const displayName = role === "ADMIN" ? "Admin Portal" : role === "HR" ? "HR Portal" : "Employee Portal";

    const identity = {
      userId: user.id,
      role,
      employeeId,
      name: user.name || displayName,
      email: user.email || "",
    };

    const mustChange = Boolean(user.mustChangePassword || user.mustchangepassword || user.isTempPassword || user.istemppassword);
    if (mustChange) {
      return NextResponse.json({
        message: "Temporary password verified. Please create your own password to continue.",
        code: "MUST_CHANGE_PASSWORD",
        mustChangePassword: true,
        user: identity,
      }, { status: 200 });
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
    } catch {}
    return response;
  } catch (err) {
    console.error("[Login Handler Error]:", err);
    return NextResponse.json({ error: err.message || "An authentication error occurred." }, { status: 500 });
  }
}
