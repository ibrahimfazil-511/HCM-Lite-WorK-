import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { readStore } from "../../../lib/store";

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const employeeFilter = searchParams.get("employeeId");
  const dateFilter = searchParams.get("date");

  const store = await readStore();
  let attendance = store.attendance || [];

  // Strict RBAC: Employees can ONLY view their own attendance
  if (auth.user.role === "EMPLOYEE") {
    attendance = attendance.filter((record) => record.employeeId === auth.user.employeeId);
  } else if (employeeFilter) {
    attendance = attendance.filter((record) => record.employeeId === employeeFilter);
  }

  if (dateFilter) {
    attendance = attendance.filter((record) => record.date === dateFilter);
  }

  // Sort descending by date, then by checkInAt
  attendance.sort((a, b) => {
    const dComp = String(b.date || "").localeCompare(String(a.date || ""));
    if (dComp !== 0) return dComp;
    return String(b.checkInAt || "").localeCompare(String(a.checkInAt || ""));
  });

  return NextResponse.json({ attendance });
}
