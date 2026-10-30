"use client";

import { useEffect } from "react";

export function Dialog({ open, onClose, onOpenChange, children, className = "" }) {
  const handleClose = () => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  };

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop with frosted glass effect */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={handleClose}
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-50 w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto my-auto rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 md:p-7 shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 ${className}`}
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
