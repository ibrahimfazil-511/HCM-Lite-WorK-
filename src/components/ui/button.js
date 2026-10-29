"use client";

export function Button({
  children,
  className = "",
  variant = "default",
  size = "md",
  disabled = false,
  type = "button",
  onClick,
  ...props
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const variants = {
    default: "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800",
    gradient: "bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25 hover:from-indigo-500 hover:via-purple-500 hover:to-violet-500 hover:shadow-md hover:shadow-indigo-500/30",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200/80 active:bg-slate-200",
    outline: "border border-slate-200/90 bg-white text-slate-800 shadow-xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
    ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
    destructive: "bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800",
    success: "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg",
    md: "h-9 px-4 text-xs font-semibold rounded-xl",
    lg: "h-11 px-6 text-sm font-bold rounded-xl",
    icon: "h-9 w-9 rounded-xl p-0",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
