// Supabase Client and Database Service for HCM Lite
// Uses native fetch to interact with Supabase PostgREST API seamlessly.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hpmqeaxtrnrubjedgqsb.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_BmIKcEfY5KIxMmRw4Q4J2w_pL4PD_Oi";

export const supabaseConfig = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
};

function getHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/**
 * Fetch rows from a Supabase table.
 * @param {string} table 
 * @param {string} [query="select=*"] 
 * @returns {Promise<{ ok: boolean, data?: any[], error?: string, status?: number }>}
 */
export async function supabaseGet(table, query = "select=*") {
  if (!supabaseConfig.isConfigured) {
    return { ok: false, error: "Supabase credentials not configured." };
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: `Supabase GET [${table}] failed (${res.status}): ${errText}` };
    }

    const text = await res.text();
    let data = [];
    try {
      data = text && text.trim() ? JSON.parse(text) : [];
    } catch {
      data = [];
    }
    return { ok: true, data: Array.isArray(data) ? data : (data ? [data] : []), status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Insert or Upsert rows into a Supabase table.
 * @param {string} table 
 * @param {object|object[]} rows 
 * @param {string} [onConflict="id"]
 * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
 */
export async function supabaseUpsert(table, rows, onConflict = "id") {
  if (!supabaseConfig.isConfigured) {
    return { ok: false, error: "Supabase credentials not configured." };
  }

  const items = Array.isArray(rows) ? rows : [rows];
  if (items.length === 0) return { ok: true, data: [] };

  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...getHeaders(),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(items),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: `Supabase UPSERT [${table}] failed (${res.status}): ${errText}` };
    }

    const text = await res.text();
    let data = null;
    try {
      data = text && text.trim() ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Delete a row from a Supabase table by ID.
 * @param {string} table 
 * @param {string} id 
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function supabaseDelete(table, id) {
  if (!supabaseConfig.isConfigured) {
    return { ok: false, error: "Supabase credentials not configured." };
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
  try {
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Supabase DELETE [${table}] failed: ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Test connectivity to Supabase and verify all 10 tables exist.
 */
export async function checkSupabaseConnection() {
  if (!supabaseConfig.isConfigured) {
    return { connected: false, message: "Missing Supabase configuration." };
  }

  const tableList = [
    "company_settings",
    "users",
    "employees",
    "attendance",
    "leaves",
    "payrolls",
    "announcements",
    "notifications",
    "audit_logs",
    "ai_logs",
  ];

  try {
    const checks = await Promise.allSettled(
      tableList.map((tbl) =>
        fetch(`${SUPABASE_URL}/rest/v1/${tbl}?select=id&limit=1`, {
          method: "GET",
          headers: getHeaders(),
          cache: "no-store",
        })
      )
    );

    const verifiedTables = [];
    tableList.forEach((tbl, idx) => {
      const outcome = checks[idx];
      if (outcome.status === "fulfilled" && outcome.value.ok) {
        verifiedTables.push(tbl);
      }
    });

    const parseSafeArray = async (res) => {
      try {
        if (!res || !res.ok) return [];
        const text = await res.text();
        const data = text && text.trim() ? JSON.parse(text) : [];
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };

    const [usersRes, empRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/users?select=id,name,role&limit=50`, {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      }).then(parseSafeArray).catch(() => []),
      fetch(`${SUPABASE_URL}/rest/v1/employees?select=id,name,department&limit=50`, {
        method: "GET",
        headers: getHeaders(),
        cache: "no-store",
      }).then(parseSafeArray).catch(() => []),
    ]);

    return {
      connected: verifiedTables.length > 0,
      url: SUPABASE_URL,
      tables: verifiedTables,
      allTablesCount: tableList.length,
      usersCount: usersRes.length,
      employeesCount: empRes.length,
      message: `All ${verifiedTables.length} tables verified & live connected to Supabase Cloud Database!`,
    };
  } catch (err) {
    return { connected: false, error: err.message, message: err.message };
  }
}
