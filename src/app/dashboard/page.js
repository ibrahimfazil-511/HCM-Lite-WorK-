"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { clearClientSession, getClientIdentity } from "../../lib/client-auth";

const AdminDashboard = dynamic(() => import("../../components/AdminDashboard.js"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center bg-[#f8f9fc] text-sm font-medium text-[#7161df]">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7161df] text-2xl font-bold text-white shadow-lg shadow-[#7161df]/30 animate-pulse">
          h
        </span>
        <span className="text-xs text-[#9094a6]">Loading HCM Lite workspace...</span>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const identity = getClientIdentity();
    if (!identity) {
      clearClientSession();
      window.location.replace("/login?redirect=/dashboard");
      return;
    }
    if (identity.role === "EMPLOYEE") {
      window.location.replace("/employee");
      return;
    }
    if (identity.role === "HR") {
      window.location.replace("/hr");
      return;
    }
    if (identity.role !== "ADMIN") {
      clearClientSession();
      window.location.replace("/login?redirect=/dashboard");
      return;
    }
    setAuthorized(true);
  }, []);

  if (!authorized) return <div className="grid min-h-screen place-items-center bg-[#f8f9fc] text-sm text-[#7161df]">Verifying secure access...</div>;
  return <AdminDashboard />;
}
