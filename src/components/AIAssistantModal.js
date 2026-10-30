"use client";

import { useState, useRef, useEffect } from "react";
import { askAI, parseSmartLeave, safeResponseJson } from "../lib/api.js";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { IconSparkles, IconSend, IconCalendar, IconCheckCircle, IconAlertCircle } from "./ui/icons";

const DEFAULT_SUGGESTIONS = [
  "Who is on leave today?",
  "What is this month's attendance rate?",
  "Who came late most often this month?",
  "How many sick leaves do I have left this year?",
  "I need next Monday and Tuesday off for sister's wedding",
];

export default function AIAssistantModal({ open, onClose, onLeaveSubmitted }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(null);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveFeedback, setLeaveFeedback] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages((current) =>
      current.length > 0
        ? current
        : [
            {
              role: "assistant",
              content:
                "Hello! I am **Humi AI**, your intelligent HR assistant. Ask me questions about company attendance, leaves, late-comers, or use natural language to apply for a **Smart Leave**.",
              isAiGenerated: true,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingLeave, loading]);

  if (!open) return null;

  async function handleSend(textToSend) {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput("");
    setLeaveFeedback("");
    const userMsg = {
      role: "user",
      content: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const isLeaveIntent =
      /\b(leave|off|chutti|vacation)\b/i.test(query) &&
      /\b(need|want|chahiye|apply|taking|next|tomorrow|kal)\b/i.test(query);

    try {
      if (isLeaveIntent) {
        const parsed = await parseSmartLeave(query);
        if (parsed.success && parsed.leave) {
          setPendingLeave(parsed.leave);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `I've prepared a **${parsed.leave.type.toUpperCase()} Leave** application based on your request. Please review the pre-filled form below and confirm:`,
              toolUsed: "smart_leave_parser",
              isAiGenerated: true,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setLoading(false);
          return;
        }
      }

      const result = await askAI(query);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          toolUsed: result.toolUsed,
          isAiGenerated: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err.message || "Unable to reach AI Assistant."}`,
          isAiGenerated: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmLeaveSubmission() {
    if (!pendingLeave) return;
    setSubmittingLeave(true);
    setLeaveFeedback("");

    try {
      const token = localStorage.getItem("hcm_token");
      const res = await fetch("/api/leaves/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leaveType: pendingLeave.type,
          startDate: pendingLeave.start,
          endDate: pendingLeave.end,
          reason: pendingLeave.reason,
        }),
      });

      const data = await safeResponseJson(res, {});
      if (!res.ok) {
        throw new Error(data.error || "Leave submission failed.");
      }

      setLeaveFeedback("✅ Leave request submitted successfully to HR!");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `🎉 Your **${pendingLeave.type} leave** from **${pendingLeave.start}** to **${pendingLeave.end}** (${pendingLeave.workingDays} working days) has been recorded in Supabase for HR review!`,
          isAiGenerated: false,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setPendingLeave(null);
      if (onLeaveSubmitted) onLeaveSubmitted();
    } catch (err) {
      setLeaveFeedback(`❌ ${err.message}`);
    } finally {
      setSubmittingLeave(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="relative flex h-[88dvh] sm:h-[620px] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-white px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-base sm:text-lg font-bold text-white shadow-md shadow-indigo-500/25 shrink-0">
              <IconSparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Ask Humi AI</h3>
                <Badge variant="gradient" className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0">Live Tool Calling</Badge>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 truncate max-w-[200px] xs:max-w-[280px] sm:max-w-none">Live Supabase Database Scope &amp; Smart Leave Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/50 px-4 sm:px-5 py-2 sm:py-2.5 scrollbar-none">
          {DEFAULT_SUGGESTIONS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSend(chip)}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-semibold text-slate-600 shadow-xs hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 transition"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-xs"
                    : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {msg.content.split("\n").map((line, i) => (
                    <p key={i} className="mb-1 last:mb-0">
                      {line}
                    </p>
                  ))}
                </div>

                {msg.toolUsed && (
                  <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-1.5 text-[10px] text-indigo-700 font-semibold">
                    <span>⚡ Source:</span>
                    <code className="bg-indigo-50 px-1.5 py-0.5 rounded font-mono text-indigo-800">{msg.toolUsed}</code>
                  </div>
                )}
              </div>

              <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-400">
                <span>{msg.time}</span>
                {msg.isAiGenerated && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] text-slate-500 font-medium">
                    AI-generated
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Pending Smart Leave Confirmation Card */}
          {pendingLeave && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <IconCalendar className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-sm font-bold text-slate-900">Smart Leave Confirmation</h4>
                </div>
                <Badge variant="outline" className="uppercase font-mono text-indigo-700">
                  {pendingLeave.type}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-semibold">Start Date:</span>
                  <strong className="text-slate-800">{pendingLeave.start}</strong>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-semibold">End Date:</span>
                  <strong className="text-slate-800">{pendingLeave.end}</strong>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                  <span className="block text-[10px] text-slate-400 font-semibold">Reason:</span>
                  <strong className="text-slate-800">{pendingLeave.reason}</strong>
                  <span className="block mt-1 text-[10px] text-indigo-600 font-bold">
                    Working Days: {pendingLeave.workingDays} days
                  </span>
                </div>
              </div>

              {leaveFeedback && (
                <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs font-medium">
                  {leaveFeedback}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingLeave(null)}
                  disabled={submittingLeave}
                >
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  size="sm"
                  onClick={confirmLeaveSubmission}
                  disabled={submittingLeave}
                >
                  {submittingLeave ? "Submitting..." : "Confirm & Submit Leave →"}
                </Button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium p-2">
              <IconSparkles className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Querying verified database records...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5 sm:gap-2 border-t border-slate-100 bg-white p-2.5 sm:p-4 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI anything, e.g. 'Who is on leave today?'..."
            disabled={loading}
            className="flex-1 min-w-0 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50/70 px-3 sm:px-4 py-2 sm:py-2.5 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
          />
          <Button
            type="submit"
            variant="gradient"
            size="sm"
            disabled={!input.trim() || loading}
            className="h-9 sm:h-10 px-3.5 sm:px-5 shrink-0"
          >
            <span>Ask</span>
            <IconSend className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}