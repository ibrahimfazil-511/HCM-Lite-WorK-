import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "supabase_schema.sql");
    const sql = await readFile(filePath, "utf8");
    return new NextResponse(sql, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to read supabase_schema.sql" }, { status: 500 });
  }
}
