"use client";

import { useState } from "react";
import { safeResponseJson } from "../../lib/api.js";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const result = await safeResponseJson(response, {});
      if (!response.ok) {
        throw new Error(result?.error || "Invalid administrator email or password.");
      }

      if (!result?.user || !["ADMIN", "HR"].includes(result.user.role)) {
        throw new Error("This secure control center is only accessible by Admin and HR accounts.");
      }

      if (!result?.token) {
        throw new Error("Failed to receive authentication session token.");
      }

      window.localStorage.setItem("hcm_token", result.token);
      if (result.user.role === "HR") {
        window.location.assign("/hr");
      } else {
        window.location.assign("/dashboard");
      }
    } catch (loginError) {
      window.localStorage.removeItem("hcm_token");
      setError(loginError.message || "An error occurred while signing in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-glow" />
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span>h</span>
          <strong>HCM Lite</strong>
        </div>
        <p className="login-eyebrow">ADMIN CONTROL CENTER</p>
        <h1>Secure admin access</h1>
        <p className="login-subtitle">This panel is available only to authorized Admin and HR accounts.</p>
        <label>
          Email address
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="login-submit" disabled={loading}>
          {loading ? "Verifying access..." : "Open admin dashboard"}
          <span>→</span>
        </button>
        <p className="login-note">Employee accounts cannot access this workspace.</p>
      </form>
    </main>
  );
}
