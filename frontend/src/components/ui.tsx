import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return (
    <article className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </article>
  );
}

export function CardHeader({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <header className={`p-4 ${className}`}>{children}</header>;
}

export function CardContent({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`px-4 pb-4 ${className}`}>{children}</div>;
}

export function Badge({
  children,
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300 ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
