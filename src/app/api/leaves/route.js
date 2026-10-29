import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { readStore } from "../../../lib/store";

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const store = await readStore();
  let leaves = store.leaves || [];
  if (auth.user.role === "EMPLOYEE") leaves = leaves.filter((leave) => leave.employeeId === auth.user.employeeId);
  return NextResponse.json({ leaves, publicHolidays: store.publicHolidays || [] });
}
