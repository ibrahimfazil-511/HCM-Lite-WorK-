import { NextResponse } from "next/server";
import { authenticate } from "../../../../../lib/auth";
import { auditLog } from "../../../../../lib/audit";
import { normalizeApprovalStatus } from "../../../../../lib/leaves";
import { readStore, writeStore } from "../../../../../lib/store";

export async function PATCH(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const status = normalizeApprovalStatus(payload?.status);
  const hrComment = typeof payload?.hrComment === "string" ? payload.hrComment.trim() : "";
  if (!status) return NextResponse.json({ error: "status must be Approved or Rejected." }, { status: 422 });
  const store = await readStore();
  const index = (store.leaves || []).findIndex((leave) => leave.id === id);
  if (index < 0) return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
  const current = store.leaves[index];
  if (current.status !== "pending") return NextResponse.json({ error: "Only pending leave requests can be approved or rejected." }, { status: 409 });
  const leave = { ...current, status, hrComment, approvedBy: auth.user.userId, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const leaves = [...store.leaves];
  leaves[index] = leave;
  await writeStore({ ...store, leaves });
  await auditLog(auth.user, `LEAVE_${status.toUpperCase()}`, `leave:${id}`, current, leave);
  return NextResponse.json({ leave });
}
