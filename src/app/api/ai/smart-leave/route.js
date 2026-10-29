import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth.js";
import { parseSmartLeaveWithLLM } from "../../../../lib/ai-assistant.js";

function authResponse(auth) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

export async function POST(request) {
  const auth = await authenticate(request, ["ADMIN", "HR", "EMPLOYEE"]);
  if (!auth.ok) return authResponse(auth);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text parameter is required." }, { status: 400 });
  }

  try {
    const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
    const leave = await parseSmartLeaveWithLLM(text, apiKey, new Date());

    return NextResponse.json({
      success: true,
      leave,
      isAiGenerated: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Failed to parse leave request." },
      { status: 500 }
    );
  }
}
