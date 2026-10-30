export function setClientSession(token, user) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem("hcm_token", token);
    try {
      document.cookie = `hcm_token=${token}; path=/; max-age=${60 * 60 * 8}; SameSite=Lax`;
    } catch {}
  }
  if (user) {
    try {
      window.localStorage.setItem("hcm_user", JSON.stringify(user));
    } catch {}
  }
}

export function getClientIdentity() {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem("hcm_token");
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length >= 2) {
      let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4 !== 0) {
        base64 += "=";
      }
      let jsonStr = "";
      try {
        jsonStr = decodeURIComponent(
          window
            .atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
      } catch {
        jsonStr = window.atob(base64);
      }
      const payload = JSON.parse(jsonStr);
      if (payload && payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        clearClientSession();
        return null;
      }
      return payload;
    }
  } catch {
    // Fallback to stored user if base64 decoding fails but token exists
    try {
      const stored = window.localStorage.getItem("hcm_user");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return null;
  }

  try {
    const stored = window.localStorage.getItem("hcm_user");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}

  return null;
}

export function clearClientSession() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("hcm_token");
      window.localStorage.removeItem("hcm_user");
      document.cookie = "hcm_token=; path=/; max-age=0; SameSite=Lax";
    } catch {}
  }
}
