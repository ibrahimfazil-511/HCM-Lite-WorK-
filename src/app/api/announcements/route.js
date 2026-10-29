import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { auditLog } from "../../../lib/audit";
import { audienceMatches, createAnnouncement, createNotification, validateAnnouncement } from "../../../lib/communications";
import { readStore, writeStore } from "../../../lib/store";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);
  const store = await readStore();
  const announcements = (store.announcements || []).filter((announcement) => audienceMatches(announcement, auth.user));
  return NextResponse.json({ announcements: announcements.reverse() });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return authResponse(auth);
  let payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const validation = validateAnnouncement(payload);
  if (validation.errors.length) return NextResponse.json({ error: "Announcement validation failed.", errors: validation.errors }, { status: 422 });
  const store = await readStore();
  const announcement = createAnnouncement(validation.announcement, auth.user.userId);
  const recipients = (store.users || []).filter((user) => user.isActive !== false && audienceMatches(announcement, user));
  const notifications = recipients.map((user) => createNotification(user.id, announcement));
  await writeStore({
    ...store,
    announcements: [...(store.announcements || []), announcement],
    notifications: [...(store.notifications || []), ...notifications],
  });
  await auditLog(auth.user, "ANNOUNCEMENT_CREATED", `announcement:${announcement.id}`, null, announcement);
  return NextResponse.json({ announcement, notificationsCreated: notifications.length }, { status: 201 });
}
