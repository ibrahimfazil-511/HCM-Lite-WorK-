import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { auditLog } from "../../../../lib/audit";
import { normalizeAnnouncement, validateAnnouncement } from "../../../../lib/communications";
import { readStore, writeStore } from "../../../../lib/store";

export async function PATCH(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  let payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const store = await readStore();
  const index = (store.announcements || []).findIndex((announcement) => announcement.id === id);
  if (index < 0) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  const candidate = normalizeAnnouncement({ ...store.announcements[index], ...payload });
  const validation = validateAnnouncement(candidate);
  if (validation.errors.length) return NextResponse.json({ error: "Announcement validation failed.", errors: validation.errors }, { status: 422 });
  const updated = { ...store.announcements[index], ...validation.announcement, updatedAt: new Date().toISOString() };
  const announcements = [...store.announcements];
  announcements[index] = updated;
  await writeStore({ ...store, announcements });
  await auditLog(auth.user, "ANNOUNCEMENT_UPDATED", `announcement:${id}`, store.announcements[index], updated);
  return NextResponse.json({ announcement: updated });
}

export async function DELETE(request, { params }) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const store = await readStore();
  const announcement = (store.announcements || []).find((candidate) => candidate.id === id);
  if (!announcement) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  await writeStore({
    ...store,
    announcements: store.announcements.filter((candidate) => candidate.id !== id),
    notifications: (store.notifications || []).filter((notification) => notification.announcementId !== id),
  });
  await auditLog(auth.user, "ANNOUNCEMENT_DELETED", `announcement:${id}`, announcement, null);
  return NextResponse.json({ deleted: true, id });
}
