import { randomUUID } from "node:crypto";

export const ANNOUNCEMENT_AUDIENCES = new Set(["all", "ADMIN", "HR", "EMPLOYEE"]);

export function normalizeAnnouncement(input) {
  return {
    title: typeof input?.title === "string" ? input.title.trim() : "",
    content: typeof input?.content === "string" ? input.content.trim() : "",
    audience: typeof input?.audience === "string" ? input.audience.trim().toUpperCase() : "ALL",
    priority: typeof input?.priority === "string" ? input.priority.trim().toLowerCase() : "normal",
  };
}

export function validateAnnouncement(input) {
  const announcement = normalizeAnnouncement(input);
  const errors = [];
  if (!announcement.title) errors.push("title is required");
  if (!announcement.content) errors.push("content is required");
  if (!ANNOUNCEMENT_AUDIENCES.has(announcement.audience.toLowerCase()) && !ANNOUNCEMENT_AUDIENCES.has(announcement.audience)) {
    errors.push("audience must be all, ADMIN, HR, or EMPLOYEE");
  }
  if (!["normal", "important", "urgent"].includes(announcement.priority)) errors.push("priority must be normal, important, or urgent");
  return { announcement, errors };
}

export function audienceMatches(announcement, user) {
  const audience = String(announcement.audience || "ALL").toUpperCase();
  return audience === "ALL" || audience === user.role;
}

export function createAnnouncement(input, actorId) {
  const now = new Date().toISOString();
  return { id: randomUUID(), ...input, createdBy: actorId, createdAt: now, updatedAt: now, publishedAt: now };
}

export function createNotification(userId, announcement) {
  return {
    id: randomUUID(),
    userId,
    type: "announcement",
    title: announcement.title,
    message: announcement.content,
    announcementId: announcement.id,
    priority: announcement.priority,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
}
