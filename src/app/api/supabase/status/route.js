import { NextResponse } from "next/server";
import { checkSupabaseConnection, supabaseConfig } from "../../../../lib/supabase.js";

export async function GET() {
  const status = await checkSupabaseConnection();
  return NextResponse.json({
    configured: supabaseConfig.isConfigured,
    url: supabaseConfig.url,
    connection: status,
  });
}
