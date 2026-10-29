import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth";
import { readStore } from "../../../../lib/store";
import { buildDashboardAnalytics } from "../../../../lib/analytics";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function GET(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);

  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange") || "this_month";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const department = searchParams.get("department") || "";

    const store = await readStore();

    const analytics = buildDashboardAnalytics({
      store,
      user: auth.user,
      dateRange,
      department,
      startDate,
      endDate,
    });

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to calculate dashboard analytics." },
      { status: 500 }
    );
  }
}
