import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { buildDashboardAnalytics } from "../../../lib/analytics";
import { createPayrollDraft } from "../../../lib/payroll";
import { readStore } from "../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);

  try {
    const { searchParams } = new URL(request.url);
    const store = await readStore();
    const employeeId = auth.user.employeeId;
    const usersById = new Map((store.users || []).map((user) => [user.id, user]));
    const employees = auth.user.role === "EMPLOYEE"
      ? (store.employees || []).filter((employee) => employee.id === employeeId || employee.userId === auth.user.userId)
      : (store.employees || []);
    const enrichedEmployees = employees.map((employee) => {
      const user = usersById.get(employee.userId) || (store.users || []).find((item) => item.email === employee.email);
      return {
        ...employee,
        mustChangePassword: Boolean(user?.mustChangePassword || user?.isTempPassword),
      };
    });
    const attendance = auth.user.role === "EMPLOYEE"
      ? (store.attendance || []).filter((record) => record.employeeId === employeeId)
      : (store.attendance || []);
    const leaves = auth.user.role === "EMPLOYEE"
      ? (store.leaves || []).filter((leave) => leave.employeeId === employeeId)
      : (store.leaves || []);
    const payrolls = (store.payrolls || []).map((payroll) => {
      const recalculated = createPayrollDraft(payroll.month, store, payroll.createdBy);
      return {
        ...recalculated,
        id: payroll.id,
        status: payroll.status,
        createdAt: payroll.createdAt,
        createdBy: payroll.createdBy,
      };
    }).map((payroll) => auth.user.role === "EMPLOYEE"
      ? { ...payroll, lines: (payroll.lines || []).filter((line) => line.employeeId === employeeId) }
      : payroll);

    const analytics = buildDashboardAnalytics({
      store,
      user: auth.user,
      dateRange: searchParams.get("dateRange") || "this_month",
      department: searchParams.get("department") || "",
      startDate: searchParams.get("startDate") || "",
      endDate: searchParams.get("endDate") || "",
    });

    return NextResponse.json({
      company: store.company || null,
      office: store.office || null,
      employees: enrichedEmployees,
      attendance,
      leaves,
      publicHolidays: store.publicHolidays || [],
      payrolls,
      announcements: store.announcements || [],
      users: auth.user.role === "ADMIN"
        ? (store.users || []).map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          employeeId: user.employeeId || null,
          isActive: user.isActive !== false,
          mustChangePassword: Boolean(user.mustChangePassword),
          createdAt: user.createdAt,
        }))
        : [],
      analytics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to load dashboard data." },
      { status: 500 }
    );
  }
}
