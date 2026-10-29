import { NextResponse } from "next/server";
import { authenticate } from "../../../lib/auth";
import { readStore } from "../../../lib/store";

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") || 25)));
  const store = await readStore();
  const logs = [...(store.auditLogs || [])].reverse();
  const start = (page - 1) * pageSize;
  return NextResponse.json({
    auditLogs: logs.slice(start, start + pageSize),
    pagination: { page, pageSize, total: logs.length, totalPages: Math.ceil(logs.length / pageSize) },
  });
}
