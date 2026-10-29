import { NextResponse } from "next/server";
import { authenticate } from "../../../../../lib/auth";
import { auditLog } from "../../../../../lib/audit";
import { readStore, writeStore } from "../../../../../lib/store";

export async function PATCH(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const store = await readStore();
  const index = (store.notifications || []).findIndex((notification) => notification.id === id && notification.userId === auth.user.userId);
  if (index < 0) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  const notification = { ...store.notifications[index], readAt: new Date().toISOString() };
  const notifications = [...store.notifications];
  notifications[index] = notification;
  await writeStore({ ...store, notifications });
  await auditLog(auth.user, "NOTIFICATION_READ", `notification:${id}`, store.notifications[index], notification);
  return NextResponse.json({ notification });
}
