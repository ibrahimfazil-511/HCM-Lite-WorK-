export function getClientIdentity() {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("hcm_token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(normalized));
  } catch {
    return null;
  }
}

export function clearClientSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem("hcm_token");
}
