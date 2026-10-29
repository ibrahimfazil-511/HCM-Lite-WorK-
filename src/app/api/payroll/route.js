import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { auditLog } from "../../../lib/audit";
import { createPayrollDraft, isValidPayrollMonth } from "../../../lib/payroll";
import { readStore, writeStore } from "../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);
  const store = await readStore();
  let payrolls = store.payrolls || [];
  if (auth.user.role === "EMPLOYEE") {
    payrolls = payrolls.map((payroll) => ({
      ...payroll,
      lines: (payroll.lines || []).filter((line) => line.employeeId === auth.user.employeeId),
    }));
  }
  return NextResponse.json({ payrolls });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return authResponse(auth);
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const month = typeof payload?.month === "string" ? payload.month.trim() : "";
  if (!isValidPayrollMonth(month)) {
    return NextResponse.json({ error: "month must use YYYY-MM format." }, { status: 422 });
  }

  const store = await readStore();
  if ((store.payrolls || []).some((payroll) => payroll.month === month && payroll.status !== "cancelled")) {
    return NextResponse.json({ error: `A payroll for ${month} already exists.` }, { status: 409 });
  }

  const payroll = createPayrollDraft(month, store, auth.user.userId);
  await writeStore({ ...store, payrolls: [...(store.payrolls || []), payroll] });
  await auditLog(auth.user, "PAYROLL_DRAFT_CREATED", `payroll:${payroll.id}`, null, payroll);
  return NextResponse.json({ payroll }, { status: 201 });
}
