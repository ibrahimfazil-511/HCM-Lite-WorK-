import { NextResponse } from "next/server";
import { authenticate } from "../../../../../lib/auth";
import { auditLog } from "../../../../../lib/audit";
import { readStore, writeStore } from "../../../../../lib/store";

export async function PATCH(request, { params }) {
  const auth = await authenticate(request, ["ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const store = await readStore();
  const index = (store.payrolls || []).findIndex((payroll) => payroll.id === id);
  if (index < 0) return NextResponse.json({ error: "Payroll not found." }, { status: 404 });
  if (store.payrolls[index].status === "locked") return NextResponse.json({ error: "Payroll is already locked." }, { status: 409 });
  const payroll = { ...store.payrolls[index], status: "locked", finalizedBy: auth.user.userId, finalizedAt: new Date().toISOString() };
  const payrolls = [...store.payrolls];
  payrolls[index] = payroll;
  await writeStore({ ...store, payrolls });
  await auditLog(auth.user, "PAYROLL_LOCKED", `payroll:${id}`, store.payrolls[index], payroll);
  return NextResponse.json({ payroll });
}
