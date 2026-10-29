"use client";

import { useEffect } from "react";

export function Dialog({ open, onClose, children, className = "" }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && open && onClose) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop with frosted glass effect */}
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-md transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-50 w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className = "", children }) {
  return (
    <div className={`flex items-start justify-between border-b border-slate-100 pb-4 mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ className = "", children }) {
  return (
    <h3 className={`text-lg font-bold text-slate-900 tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

export function DialogClose({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      aria-label="Close"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
