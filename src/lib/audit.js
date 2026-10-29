import { randomUUID } from "node:crypto";
import { readStore, writeStore } from "./store";

function actorIdOf(actor) {
  if (typeof actor === "string") return actor;
  return actor?.userId || actor?.id || "system";
}

export async function auditLog(actor, action, entity, before = null, after = null) {
  if (!action || !entity) throw new Error("Audit action and entity are required.");
  const store = await readStore();
  const entry = {
    id: randomUUID(),
    actorId: actorIdOf(actor),
    action,
    entity,
    before,
    after,
    createdAt: new Date().toISOString(),
  };
  await writeStore({ ...store, auditLogs: [...(store.auditLogs || []), entry] });
  return entry;
}
