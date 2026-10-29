import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { readStore } from "../../../lib/store";

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const store = await readStore();
  const notifications = [...(store.notifications || [])].filter((notification) => notification.userId === auth.user.userId).reverse();
  return NextResponse.json({ notifications, unreadCount: notifications.filter((notification) => !notification.readAt).length });
}
