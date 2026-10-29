import { NextResponse } from "next/server";
import { authenticate } from "../../../../lib/auth.js";
import { readStore } from "../../../../lib/store.js";
import { askAIAssistant, checkRateLimit, logAIInteraction } from "../../../../lib/ai-assistant.js";

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

  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  // Rate Limiting check (20 requests per hour per user)
  if (!checkRateLimit(auth.user.userId)) {
    return NextResponse.json(
      { error: "Rate limit reached. Maximum 20 AI requests per user per hour." },
      { status: 429 }
    );
  }

  try {
    const store = await readStore();
    const result = await askAIAssistant({
      message,
      user: auth.user,
      store,
      now: new Date(),
    });

    // Asynchronously log to ai_logs
    await logAIInteraction({
      userId: auth.user.userId,
      userRole: auth.user.role,
      query: message,
      toolUsed: result.toolUsed,
      reply: result.reply,
    });

    return NextResponse.json(
      {
        reply: result.reply,
        toolUsed: result.toolUsed,
        userRole: auth.user.role,
        isAiGenerated: true,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "AI Assistant encountered an error." },
      { status: 500 }
    );
  }
}
