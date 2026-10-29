export function Badge({
  children,
  className = "",
  variant = "default",
  ...props
}) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide rounded-full transition-colors select-none";

  const variants = {
    default: "bg-indigo-50 text-indigo-700 border border-indigo-200/60",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200/60",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
    warning: "bg-amber-50 text-amber-800 border border-amber-200/80",
    destructive: "bg-rose-50 text-rose-700 border border-rose-200/70",
    outline: "text-slate-700 border border-slate-200 bg-white",
    gradient: "bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 text-indigo-800 border border-indigo-200/80",
  };

  return (
    <span className={`${base} ${variants[variant] || variants.default} ${className}`} {...props}>
      {children}
    </span>
  );
}
