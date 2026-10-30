"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { clearClientSession, getClientIdentity } from "../../lib/client-auth";

const HRDashboard = dynamic(() => import("../../components/HRDashboard.js"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-violet-600">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-violet-500/30 animate-pulse">
          HR
        </span>
        <span className="text-xs text-slate-400">Loading People Operations Portal...</span>
      </div>
    </div>
  ),
});

export default function HRPage() {
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const identity = getClientIdentity();
    if (!identity) {
      window.location.replace("/login?redirect=/hr");
      return;
    }

    if (identity.role === "ADMIN") {
      window.location.replace("/dashboard");
      return;
    }

    if (identity.role === "EMPLOYEE") {
      window.location.replace("/employee");
      return;
    }

    if (identity.role !== "HR") {
      window.location.replace("/login?redirect=/hr");
      return;
    }

    setAuthorized(true);
  }, []);

  if (!authorized) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-violet-600 font-medium">
        Verifying secure HR credentials...
      </div>
    );
  }

  return <HRDashboard />;
}
