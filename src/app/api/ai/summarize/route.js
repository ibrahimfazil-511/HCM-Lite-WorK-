import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth.js";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR"]);
  if (!auth.ok) return authResponse(auth);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const kpis = payload?.kpis || {};
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `You are an executive HR analyst for HCM Lite.
Summarize the following live dashboard KPIs into exactly 3 to 5 concise, actionable insight bullets using ONLY these numbers:
${JSON.stringify(kpis, null, 2)}

Rules:
- Strictly use the provided numbers only.
- Output each bullet point starting with a bullet symbol (•).
- Keep each point under 20 words.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const bullets = text
            .split("\n")
            .map((b) => b.trim().replace(/^[-•*]\s*/, ""))
            .filter(Boolean);

          return NextResponse.json({
            summary: bullets.slice(0, 5),
            isAiGenerated: true,
          });
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Deterministic calculation fallback
  const attendanceRate = kpis.attendanceRate ?? 100;
  const headcount = kpis.headcount ?? 0;
  const onLeave = kpis.onLeaveToday ?? 0;
  const late = kpis.lateToday ?? 0;
  const payrollCost = kpis.payrollCost || 0;

  const bullets = [
    `Current workspace headcount stands at ${headcount} active employee${headcount === 1 ? "" : "s"}.`,
    `Month-to-date attendance rate is healthy at ${attendanceRate}%.`,
    onLeave > 0
      ? `${onLeave} employee(s) are currently on approved leave.`
      : "No employees are scheduled on leave today.",
    late > 0
      ? `${late} late check-in(s) recorded for today.`
      : "Excellent punctuality today with zero late check-ins recorded.",
  ];

  if (payrollCost > 0) {
    bullets.push(`Estimated gross payroll commitment is ${(payrollCost).toLocaleString()} PKR.`);
  }

  return NextResponse.json({
    summary: bullets.slice(0, 5),
    isAiGenerated: true,
  });
}
