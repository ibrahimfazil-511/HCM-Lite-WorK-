import { randomUUID } from "node:crypto";
import { getWorkingDates, LEAVE_QUOTAS, normalizeLeaveType } from "./leaves.js";
import { calculateAttendanceRate, getTopLateComers, calculatePayrollMetrics } from "./analytics.js";
import { readStore, writeStore } from "./store.js";

// Rate limiting: 20 requests per user per hour
const rateLimits = new Map();

export function checkRateLimit(userId) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const timestamps = (rateLimits.get(userId) || []).filter((time) => now - time < windowMs);

  if (timestamps.length >= 20) {
    return false;
  }

  timestamps.push(now);
  rateLimits.set(userId, timestamps);
  return true;
}

// -------------------------------------------------------------
// Tool Implementations (Executing strictly on live DB records)
// -------------------------------------------------------------

export function executeTool(toolName, args = {}, store, user, now = new Date()) {
  const todayStr = now.toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const publicHolidays = store.publicHolidays || [];
  const employees = store.employees || [];
  const attendance = store.attendance || [];
  const leaves = store.leaves || [];
  const payrolls = store.payrolls || [];

  switch (toolName) {
    case "get_attendance_summary": {
      const dept = args.department;
      let targetEmployees = employees.filter((e) => e.isActive !== false);
      if (dept && dept.toLowerCase() !== "all") {
        targetEmployees = targetEmployees.filter((e) => (e.department || "").toLowerCase() === dept.toLowerCase());
      }
      const employeeIds = new Set(targetEmployees.map((e) => e.id));
      const todayRecords = attendance.filter((r) => r.date === todayStr && employeeIds.has(r.employeeId));

      const present = todayRecords.filter((r) => r.status === "present").length;
      const late = todayRecords.filter((r) => r.status === "late").length;
      const halfDay = todayRecords.filter((r) => r.status === "half_day").length;
      const totalCheckedIn = present + late + halfDay;

      const onLeave = leaves.filter((l) =>
        employeeIds.has(l.employeeId) &&
        l.status === "approved" &&
        l.startDate <= todayStr &&
        l.endDate >= todayStr
      ).length;

      const workingDates = getWorkingDates(todayStr, todayStr, publicHolidays);
      const isWorkday = workingDates.length > 0;
      const absent = isWorkday ? Math.max(0, targetEmployees.length - totalCheckedIn - onLeave) : 0;

      // Rate for this month
      const monthStart = `${currentMonthStr}-01`;
      const monthWorkingDates = getWorkingDates(monthStart, todayStr, publicHolidays);
      const monthlyAttendanceRate = calculateAttendanceRate(targetEmployees, attendance, leaves, monthWorkingDates, publicHolidays);

      return {
        date: todayStr,
        department: dept || "All",
        headcount: targetEmployees.length,
        checkedInToday: totalCheckedIn,
        presentToday: present,
        lateToday: late,
        halfDayToday: halfDay,
        onLeaveToday: onLeave,
        absentToday: absent,
        monthlyAttendanceRate: `${monthlyAttendanceRate}%`,
      };
    }

    case "get_late_comers": {
      const monthStart = `${currentMonthStr}-01`;
      const monthWorkingDates = getWorkingDates(monthStart, todayStr, publicHolidays);
      const topLate = getTopLateComers(employees, attendance, monthWorkingDates);
      return {
        month: currentMonthStr,
        topLateComers: topLate.slice(0, args.limit || 5),
      };
    }

    case "get_my_leave_balance": {
      if (!user.employeeId) {
        return { error: "No employee profile linked to current account." };
      }
      const myEmpId = user.employeeId;
      const currentYear = todayStr.slice(0, 4);
      const myApprovedLeaves = leaves.filter((l) => l.employeeId === myEmpId && String(l.status).toLowerCase() === "approved");

      const balance = {};
      for (const type of Object.keys(LEAVE_QUOTAS)) {
        const quota = LEAVE_QUOTAS[type];
        const isUnlimited = !Number.isFinite(quota);
        let used = 0;
        for (const l of myApprovedLeaves) {
          if (normalizeLeaveType(l.leaveType) === type) {
            const lDates = getWorkingDates(l.startDate, l.endDate, publicHolidays);
            used += lDates.filter((d) => d.startsWith(`${currentYear}-`)).length;
          }
        }
        balance[type] = {
          usedDays: used,
          totalQuota: isUnlimited ? "Unlimited" : quota,
          remainingDays: isUnlimited ? "Unlimited" : Math.max(0, quota - used),
        };
      }
      return {
        employeeId: myEmpId,
        year: currentYear,
        leaveBalances: balance,
      };
    }

    case "get_payroll_summary": {
      if (user.role === "EMPLOYEE") {
        return {
          error: "Permission Denied: Employees are not allowed to view payroll or company salary data.",
        };
      }
      const month = args.month || currentMonthStr;
      const activeEmployees = employees.filter((e) => e.isActive !== false);
      const metrics = calculatePayrollMetrics(activeEmployees, payrolls, month);
      return {
        month,
        activeEmployees: activeEmployees.length,
        totalGrossCost: metrics.totalGross,
        averageSalary: metrics.avgSalary,
      };
    }

    case "get_headcount": {
      const dept = args.department;
      let activeEmployees = employees.filter((e) => e.isActive !== false);
      if (dept && dept.toLowerCase() !== "all") {
        activeEmployees = activeEmployees.filter((e) => (e.department || "").toLowerCase() === dept.toLowerCase());
      }
      return {
        department: dept || "Company-wide",
        activeHeadcount: activeEmployees.length,
      };
    }

    case "search_employees": {
      const q = (args.query || "").toLowerCase();
      const filtered = employees
        .filter((e) => e.isActive !== false && (`${e.name} ${e.department} ${e.designation}`.toLowerCase().includes(q)))
        .map((e) => ({
          name: e.name,
          department: e.department,
          designation: e.designation,
          // Hide salary if user is Employee
          salary: user.role === "EMPLOYEE" ? undefined : e.salary,
        }));
      return {
        query: args.query,
        count: filtered.length,
        employees: filtered.slice(0, 10),
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// -------------------------------------------------------------
// Gemini Function Declarations Schema
// -------------------------------------------------------------

export const AI_TOOL_DECLARATIONS = [
  {
    name: "get_attendance_summary",
    description: "Get today's and this month's attendance summary (present, late, absent, on-leave, attendance rate) matching the dashboard.",
    parameters: {
      type: "OBJECT",
      properties: {
        department: { type: "STRING", description: "Optional department filter (e.g. Engineering, HR)" },
      },
    },
  },
  {
    name: "get_late_comers",
    description: "Get top employees who arrived late most frequently this month.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "INTEGER", description: "Number of late comers to return (default 5)" },
      },
    },
  },
  {
    name: "get_my_leave_balance",
    description: "Get the current authenticated employee's remaining and used leave balances for Annual, Sick, Casual, and Unpaid leaves.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_payroll_summary",
    description: "Get company monthly payroll summary (gross, deductions, net pay) for Admin and HR. BLOCKED for Employee role.",
    parameters: {
      type: "OBJECT",
      properties: {
        month: { type: "STRING", description: "Month in YYYY-MM format (e.g. 2026-10)" },
      },
    },
  },
  {
    name: "get_headcount",
    description: "Get the number of active employees, optionally by department.",
    parameters: {
      type: "OBJECT",
      properties: {
        department: { type: "STRING", description: "Optional department name" },
      },
    },
  },
  {
    name: "search_employees",
    description: "Search active employees by name or role.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Employee name or keyword" },
      },
    },
  },
];

// -------------------------------------------------------------
// Smart Rule-Based & Gemini NLP Parser for Smart Leave
// -------------------------------------------------------------

export function parseSmartLeaveRuleBased(text, now = new Date()) {
  const lower = text.toLowerCase();
  const today = new Date(now);

  // 1. Detect Leave Type
  let type = "casual";
  if (/\b(sick|fever|doctor|ill|hospital|medical|tabiyat|bimar|pain|cough)\b/i.test(lower)) {
    type = "sick";
  } else if (/\b(annual|vacation|trip|holiday|family tour|recreation)\b/i.test(lower)) {
    type = "annual";
  } else if (/\b(unpaid|without pay|bina tankhwah)\b/i.test(lower)) {
    type = "unpaid";
  }

  // 2. Detect Dates
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayIndex = today.getDay(); // 0 is Sunday

  let start = new Date(today);
  let end = new Date(today);

  if (/\btomorrow\b|\bkal\b/i.test(lower)) {
    start.setDate(today.getDate() + 1);
    end.setDate(today.getDate() + 1);
  } else if (/\bnext monday\b/i.test(lower)) {
    // Days until next Monday
    const daysUntilNextMon = ((8 - dayIndex) % 7) || 7;
    start.setDate(today.getDate() + daysUntilNextMon);
    end = new Date(start);

    if (/\band tuesday\b|\btuesday\b|\b2 days\b|\bdo din\b/i.test(lower)) {
      end.setDate(start.getDate() + 1);
    } else if (/\bto friday\b|\btill friday\b/i.test(lower)) {
      end.setDate(start.getDate() + 4);
    }
  } else {
    // Check if mentions any day of week
    for (let i = 0; i < dayNames.length; i++) {
      if (lower.includes(dayNames[i])) {
        const diff = (i - dayIndex + 7) % 7 || 7;
        start.setDate(today.getDate() + diff);
        end = new Date(start);
        break;
      }
    }
  }

  // 3. Extract Reason
  let reason = text.trim();
  const reasonMatch = text.match(/(?:for|due to|because of|ke liye|ki wajah se)\s+(.+)/i);
  if (reasonMatch && reasonMatch[1]) {
    reason = reasonMatch[1].replace(/[.,?!]+$/, "").trim();
  }

  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const workingDays = getWorkingDates(startStr, endStr, []).length || 1;

  return {
    type,
    start: startStr,
    end: endStr,
    reason,
    workingDays,
  };
}

export async function parseSmartLeaveWithLLM(text, apiKey, now = new Date()) {
  const todayStr = now.toISOString().slice(0, 10);
  const prompt = `You are a Smart Leave extractor for an HR system.
Today is ${todayStr} (${new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now)}).
User request: "${text}"

Extract the leave request into a JSON object with this exact structure:
{
  "type": "annual" | "sick" | "casual" | "unpaid",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD",
  "reason": "extracted reason string"
}
Rules:
- If wedding or family event, default type is "casual".
- If illness or doctor, type is "sick".
- If vacation, type is "annual".
- Output ONLY the raw JSON without markdown formatting or code fences.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const workingDays = getWorkingDates(parsed.start, parsed.end, []).length || 1;
        return {
          type: normalizeLeaveType(parsed.type) || "casual",
          start: parsed.start,
          end: parsed.end,
          reason: parsed.reason || text,
          workingDays,
        };
      }
    }
  } catch {
    // Graceful fallback to rule-based
  }

  return parseSmartLeaveRuleBased(text, now);
}

// -------------------------------------------------------------
// Offline / Mock Tool Caller when API Key is missing or unavailable
// -------------------------------------------------------------

export function runAssistantOffline(message, user, store, now = new Date()) {
  const lower = message.toLowerCase();

  // Guardrail: Employee asking about someone else's salary
  if (user.role === "EMPLOYEE" && /\b(salary|pay|earns|kamata|tankhwah|compensation|income|paisa)\b/i.test(lower)) {
    return {
      reply: "I apologize, but as an Employee, you do not have permission to view other employees' salary or compensation details. This information is strictly confidential.",
      toolUsed: null,
      isAiGenerated: true,
    };
  }

  // Tool 1: Who is on leave today / leave summary
  if (/\b(on leave|chutti|leaves|leave summary)\b/i.test(lower) && !/\bmy leave\b|\bmera leave\b/i.test(lower)) {
    const summary = executeTool("get_attendance_summary", {}, store, user, now);
    const todayStr = now.toISOString().slice(0, 10);
    const onLeaveEmployees = (store.leaves || [])
      .filter((l) => l.status === "approved" && l.startDate <= todayStr && l.endDate >= todayStr)
      .map((l) => {
        const emp = (store.employees || []).find((e) => e.id === l.employeeId);
        return `${emp?.name || "Employee"} (${l.leaveType})`;
      });

    const leaveList = onLeaveEmployees.length > 0 ? onLeaveEmployees.join(", ") : "no employees";
    return {
      reply: `Today there are **${summary.onLeaveToday} employees** on approved leave: ${leaveList}. Today's overall attendance rate is **${summary.monthlyAttendanceRate}**.`,
      toolUsed: "get_attendance_summary",
      isAiGenerated: true,
    };
  }

  // Tool 2: Attendance rate or summary
  if (/\b(attendance rate|attendance summary|how many present|who is present|hazri)\b/i.test(lower)) {
    const summary = executeTool("get_attendance_summary", {}, store, user, now);
    return {
      reply: `For today (${summary.date}), **${summary.checkedInToday}** out of **${summary.headcount}** employees are checked in (**${summary.presentToday}** on time, **${summary.lateToday}** late). The month-to-date attendance rate is **${summary.monthlyAttendanceRate}**.`,
      toolUsed: "get_attendance_summary",
      isAiGenerated: true,
    };
  }

  // Tool 3: Top late-comers
  if (/\b(late|late comers|deri se|late-comers)\b/i.test(lower)) {
    const result = executeTool("get_late_comers", { limit: 5 }, store, user, now);
    const topList = result.topLateComers
      .map((c, i) => `${i + 1}. **${c.name}** (${c.department}) — ${c.lateCount} lates`)
      .join("\n");

    return {
      reply: `Here are the top late-comers for this month:\n\n${topList || "No employees have arrived late this month!"}`,
      toolUsed: "get_late_comers",
      isAiGenerated: true,
    };
  }

  // Tool 4: Employee Leave Balance
  if (/\b(my leave|leave balance|sick leave|casual leave|annual leave|kitni chuttiyan)\b/i.test(lower)) {
    const result = executeTool("get_my_leave_balance", {}, store, user, now);
    if (result.error) {
      return { reply: result.error, toolUsed: "get_my_leave_balance", isAiGenerated: true };
    }
    const b = result.leaveBalances;
    return {
      reply: `Here is your current leave balance for ${result.year}:\n- **Annual Leave**: ${b.annual.remainingDays} days remaining (Used: ${b.annual.usedDays}/${b.annual.totalQuota})\n- **Sick Leave**: ${b.sick.remainingDays} days remaining (Used: ${b.sick.usedDays}/${b.sick.totalQuota})\n- **Casual Leave**: ${b.casual.remainingDays} days remaining (Used: ${b.casual.usedDays}/${b.casual.totalQuota})\n- **Unpaid Leave**: ${b.unpaid.usedDays} days used (Unlimited quota)`,
      toolUsed: "get_my_leave_balance",
      isAiGenerated: true,
    };
  }

  // Tool 5: Headcount query
  if (/\b(headcount|how many employees|total staff|kitne log)\b/i.test(lower)) {
    const deptMatch = message.match(/in\s+([a-zA-Z]+)/i);
    const dept = deptMatch ? deptMatch[1] : null;
    const result = executeTool("get_headcount", { department: dept }, store, user, now);
    return {
      reply: `There are currently **${result.activeHeadcount}** active employees in ${result.department}.`,
      toolUsed: "get_headcount",
      isAiGenerated: true,
    };
  }

  // Tool 6: Payroll summary (Admin/HR only)
  if (/\b(payroll|total salary cost|payroll summary)\b/i.test(lower)) {
    if (user.role === "EMPLOYEE") {
      return {
        reply: "I apologize, but as an Employee, you do not have permission to view payroll or company salary data.",
        toolUsed: null,
        isAiGenerated: true,
      };
    }
    const result = executeTool("get_payroll_summary", {}, store, user, now);
    return {
      reply: `The estimated payroll gross cost for active staff in ${result.month} is **${result.totalGrossCost.toLocaleString()} PKR** across **${result.activeEmployees} employees** (Average gross salary: ${result.averageSalary.toLocaleString()} PKR).`,
      toolUsed: "get_payroll_summary",
      isAiGenerated: true,
    };
  }

  // General Policy Q&A / Fallback
  return {
    reply: "I am your HCM Lite AI Assistant. You can ask me:\n- *'Who is on leave today?'*\n- *'What is this month's attendance rate?'*\n- *'Who came late most often?'*\n- *'How many sick leaves do I have left?'*\n- Or apply for Smart Leave (e.g. *'Need next Monday and Tuesday off for sister's wedding'*).",
    toolUsed: null,
    isAiGenerated: true,
  };
}

// -------------------------------------------------------------
// Live Gemini Tool Calling Engine
// -------------------------------------------------------------

export async function askAIAssistant({ message, user, store, now = new Date() }) {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  // Strict Guardrail check upfront for Employee salary queries
  const lower = message.toLowerCase();
  if (user.role === "EMPLOYEE" && /\b(salary|pay|earns|kamata|tankhwah|compensation|income|paisa)\b/i.test(lower)) {
    return {
      reply: "I apologize, but as an Employee, you do not have permission to view other employees' salary or compensation details. This information is strictly confidential.",
      toolUsed: null,
      isAiGenerated: true,
    };
  }

  if (!apiKey) {
    // Graceful offline fallback with live database numbers
    return runAssistantOffline(message, user, store, now);
  }

  const todayStr = now.toISOString().slice(0, 10);
  const systemInstruction = `You are Humi AI, the intelligent HR assistant for HCM Lite.
Current date: ${todayStr}.
User role: ${user.role}.
Employee ID: ${user.employeeId || "None"}.

Rules:
1. Always base answers on facts returned by calling tools. The database is the only source of truth.
2. If role is 'EMPLOYEE', you must NEVER reveal another employee's salary or confidential data.
3. Keep answers concise, factual, and polite.
4. Support English and Roman Urdu gracefully.`;

  // Filter tools based on role: if Employee, omit get_payroll_summary
  const availableTools = AI_TOOL_DECLARATIONS.filter((decl) => {
    if (user.role === "EMPLOYEE" && decl.name === "get_payroll_summary") return false;
    return true;
  });

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    // First call: Send user prompt with tool definitions
    const requestBody = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: message }] }],
      tools: [{ functionDeclarations: availableTools }],
    };

    const firstResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });

    if (!firstResponse.ok) {
      return runAssistantOffline(message, user, store, now);
    }

    const firstData = await firstResponse.json();
    const candidate = firstData.candidates?.[0]?.content;
    const functionCallPart = candidate?.parts?.find((p) => p.functionCall);

    if (!functionCallPart) {
      // Model replied directly without tools (e.g. policy Q&A)
      const text = candidate?.parts?.map((p) => p.text).join("") || "No response received.";
      return { reply: text, toolUsed: null, isAiGenerated: true };
    }

    // Model called a tool: execute it with user scope
    const { name: toolName, args: toolArgs } = functionCallPart.functionCall;
    const toolResult = executeTool(toolName, toolArgs, store, user, now);

    // Second call: Provide function response back to Gemini to synthesize final natural answer
    const followUpBody = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ functionCall: functionCallPart.functionCall }] },
        {
          role: "function",
          parts: [
            {
              functionResponse: {
                name: toolName,
                response: { output: toolResult },
              },
            },
          ],
        },
      ],
    };

    const secondResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(followUpBody),
      signal: AbortSignal.timeout(15000),
    });

    if (secondResponse.ok) {
      const secondData = await secondResponse.json();
      const finalReply = secondData.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || JSON.stringify(toolResult);
      return {
        reply: finalReply,
        toolUsed: toolName,
        isAiGenerated: true,
      };
    }

    // Fallback if second turn fails
    return {
      reply: `Based on your request, ${toolName} returned: ${JSON.stringify(toolResult)}`,
      toolUsed: toolName,
      isAiGenerated: true,
    };
  } catch {
    // Fallback gracefully on timeout or network error
    return runAssistantOffline(message, user, store, now);
  }
}

// -------------------------------------------------------------
// Audit / AI Interaction Logging
// -------------------------------------------------------------

export async function logAIInteraction({ userId, userRole, query, toolUsed, reply }) {
  try {
    const store = await readStore();
    const logEntry = {
      id: randomUUID(),
      userId,
      userRole,
      query,
      toolUsed: toolUsed || "direct_answer",
      replyPreview: (reply || "").slice(0, 150),
      createdAt: new Date().toISOString(),
    };
    const aiLogs = [...(store.aiLogs || []), logEntry];
    await writeStore({ ...store, aiLogs });
  } catch {
    // Ignore logging failures to keep user flow seamless
  }
}
