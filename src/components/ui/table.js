export function Table({ className = "", children, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto rounded-xl">
      <table className={`w-full caption-bottom text-xs text-left min-w-[520px] sm:min-w-full ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = "", children, ...props }) {
  return (
    <thead className={`border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = "", children, ...props }) {
  return (
    <tbody className={`divide-y divide-slate-100 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = "", children, ...props }) {
  return (
    <tr className={`transition-colors duration-150 hover:bg-indigo-50/30 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ className = "", children, ...props }) {
  return (
    <th className={`h-10 px-3.5 text-left align-middle font-bold text-slate-500 ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className = "", children, ...props }) {
  return (
    <td className={`p-3.5 align-middle text-slate-700 ${className}`} {...props}>
      {children}
    </td>
  );
}
