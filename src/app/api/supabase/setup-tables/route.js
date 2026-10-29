import { NextResponse } from "next/server";
import { readStore } from "../../../../lib/store.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hpmqeaxtrnrubjedgqsb.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_BmIKcEfY5KIxMmRw4Q4J2w_pL4PD_Oi";

export async function POST() {
  const attempts = [];

  // Attempt 1: Test Supabase PostgREST definitions to see if tables already exist
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const spec = await res.json().catch(() => null);
    const existingTables = spec?.definitions ? Object.keys(spec.definitions) : [];
    attempts.push({ target: "schema_check", ok: res.ok, existingTables });
  } catch (err) {
    attempts.push({ target: "schema_check", ok: false, error: err.message });
  }

  // Attempt 2: Try /rest/v1/rpc/exec_sql or /rest/v1/rpc/run_sql
  const testSql = "SELECT 1 as test;";
  for (const rpcName of ["exec_sql", "run_sql", "execute_sql"]) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: testSql, sql: testSql }),
      });
      const text = await res.text();
      attempts.push({ target: `rpc_${rpcName}`, status: res.status, ok: res.ok, body: text.slice(0, 200) });
    } catch (err) {
      attempts.push({ target: `rpc_${rpcName}`, ok: false, error: err.message });
    }
  }

  // Attempt 3: Try Supabase Management API or direct query endpoint
  try {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: testSql }),
    });
    const text = await res.text();
    attempts.push({ target: "pg_query", status: res.status, ok: res.ok, body: text.slice(0, 200) });
  } catch (err) {
    attempts.push({ target: "pg_query", ok: false, error: err.message });
  }

  // Check if users table is accessible
  let usersTableAccessible = false;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    usersTableAccessible = userRes.ok;
    attempts.push({ target: "users_table_check", status: userRes.status, ok: userRes.ok, text: (await userRes.text()).slice(0, 200) });
  } catch (err) {
    attempts.push({ target: "users_table_check", ok: false, error: err.message });
  }

  return NextResponse.json({
    supabaseUrl: SUPABASE_URL,
    usersTableAccessible,
    attempts,
  });
}
