"use client";

import { useState } from "react";
import { saveSetup } from "../lib/api";

const initialForm = {
  companyName: "",
  companyEmail: "",
  officeStart: "09:00",
  graceMinutes: 15,
  radiusMeters: 150,
  latitude: "",
  longitude: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

export default function SetupWizard({ onComplete }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await saveSetup({ ...form, graceMinutes: Number(form.graceMinutes), radiusMeters: Number(form.radiusMeters), latitude: Number(form.latitude), longitude: Number(form.longitude) });
      onComplete(result.redirectTo);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return <main className="setup-page"><div className="setup-glow setup-glow-one" /><div className="setup-glow setup-glow-two" /><form className="setup-card" onSubmit={submit}><div className="setup-brand"><span>h</span><strong>HCM Lite</strong></div><div className="setup-heading"><p>FIRST-TIME CONFIGURATION</p><h1>Set up your workspace</h1><span>Configure your company once, then invite your team.</span></div><div className="setup-section"><div className="section-title"><span>01</span><div><strong>Company details</strong><small>Tell us about your organization</small></div></div><div className="form-grid"><label>Company name<input required value={form.companyName} onChange={update("companyName")} placeholder="Saylani IT Park" /></label><label>Company email<input required type="email" value={form.companyEmail} onChange={update("companyEmail")} placeholder="hr@company.com" /></label></div></div><div className="setup-section"><div className="section-title"><span>02</span><div><strong>Office rules</strong><small>Used for attendance and geofencing</small></div></div><div className="form-grid three"><label>Office starts<input required type="time" value={form.officeStart} onChange={update("officeStart")} /></label><label>Grace period (min)<input required type="number" min="0" value={form.graceMinutes} onChange={update("graceMinutes")} /></label><label>Radius (meters)<input required type="number" min="1" value={form.radiusMeters} onChange={update("radiusMeters")} /></label><label>Latitude<input required type="number" step="any" value={form.latitude} onChange={update("latitude")} placeholder="24.8607" /></label><label>Longitude<input required type="number" step="any" value={form.longitude} onChange={update("longitude")} placeholder="67.0011" /></label></div></div><div className="setup-section"><div className="section-title"><span>03</span><div><strong>Admin account</strong><small>Your secure administrator login</small></div></div><div className="form-grid"><label>Full name<input required value={form.adminName} onChange={update("adminName")} placeholder="Mohammad Asif" /></label><label>Work email<input required type="email" value={form.adminEmail} onChange={update("adminEmail")} placeholder="admin@company.com" /></label><label className="full">Password<input required minLength="8" type="password" value={form.adminPassword} onChange={update("adminPassword")} placeholder="At least 8 characters" /></label></div></div>{error && <div className="setup-error">{error}</div>}<button className="setup-submit" disabled={saving}>{saving ? "Saving workspace..." : "Create workspace"}<span>→</span></button><p className="setup-note">Your password is securely encrypted before it is stored.</p></form></main>;
}
