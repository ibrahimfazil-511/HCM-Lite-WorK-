export async function safeResponseJson(response, fallback = {}) {
  try {
    if (!response) return fallback;
    const text = await response.text();
    if (!text || !text.trim()) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export const safeJson = safeResponseJson;

export async function getSetupStatus() {
  const response = await fetch("/api/setup", { cache: "no-store" });
  if (!response.ok) return { configured: true };
  return safeResponseJson(response, { configured: true });
}

export async function saveSetup(payload) {
  const response = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await safeResponseJson(response, {});
  if (!response.ok) throw new Error(result.error || "Could not save setup.");
  return result;
}

export async function getDashboardAnalytics(filters = {}, token) {
  const query = new URLSearchParams();
  if (filters.dateRange) query.set("dateRange", filters.dateRange);
  if (filters.department) query.set("department", filters.department);
  if (filters.startDate) query.set("startDate", filters.startDate);
  if (filters.endDate) query.set("endDate", filters.endDate);

  const headers = {};
  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("hcm_token") : null);
  if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

  const response = await fetch(`/api/analytics/dashboard?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  const result = await safeResponseJson(response, null);
  if (!response.ok) throw new Error(result?.error || "Could not load dashboard analytics.");
  return result;
}

export async function askAI(message, token) {
  const headers = { "Content-Type": "application/json" };
  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("hcm_token") : null);
  if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
  });
  const result = await safeResponseJson(response, {});
  if (!response.ok) throw new Error(result.error || "AI Assistant failed to respond.");
  return result;
}

export async function parseSmartLeave(text, token) {
  const headers = { "Content-Type": "application/json" };
  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("hcm_token") : null);
  if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

  const response = await fetch("/api/ai/smart-leave", {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });
  const result = await safeResponseJson(response, {});
  if (!response.ok) throw new Error(result.error || "Failed to parse smart leave.");
  return result;
}

export async function getAISummary(kpis, token) {
  const headers = { "Content-Type": "application/json" };
  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("hcm_token") : null);
  if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

  const response = await fetch("/api/ai/summarize", {
    method: "POST",
    headers,
    body: JSON.stringify({ kpis }),
  });
  const result = await safeResponseJson(response, {});
  if (!response.ok) throw new Error(result.error || "Failed to generate AI summary.");
  return result;
}