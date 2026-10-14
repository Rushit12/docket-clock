import type { ReactNode } from "react";
import { diffDays, type ISODate, toDate } from "../engine/dates";
import type { Confidence } from "../engine/types";

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end gap-4 justify-between">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        {sub && <p className="mt-2 text-[15px] leading-relaxed text-ink-2 max-w-[68ch]">{sub}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Button({ children, onClick, variant = "secondary", type = "button", disabled, title, small }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; type?: "button" | "submit"; disabled?: boolean; title?: string; small?: boolean;
}) {
  const v = {
    primary: "bg-ink text-white hover:bg-ink-2",
    secondary: "bg-white text-ink border border-rule hover:border-ink-2/40",
    ghost: "text-ink-2 hover:bg-rule-2",
    danger: "text-late hover:bg-late-soft",
  }[variant];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-40 ${small ? "px-2.5 py-1 text-[13px]" : "px-3.5 py-2 text-sm"} ${v}`}>
      {children}
    </button>
  );
}

const CONF: Record<Confidence, { label: string; cls: string; title: string }> = {
  verified: { label: "Circuit form", cls: "bg-done-soft text-done", title: "Day count taken from the circuit's published case management order form." },
  rule: { label: "By rule", cls: "bg-[#e6ecf6] text-link", title: "Fixed by a Florida rule or statute, computed under Rule 2.514." },
  estimate: { label: "Estimate", cls: "bg-highlight-soft text-[#6b5500]", title: "Depends on a date that isn't set yet (e.g. Calendar Call). Enter it to lock this deadline." },
  order: { label: "Your order", cls: "bg-ink text-white", title: "Date printed in the order you imported." },
  manual: { label: "Set by you", cls: "bg-rule-2 text-ink-2", title: "Entered or overridden manually." },
};

export function ConfidenceTag({ c }: { c: Confidence }) {
  const m = CONF[c];
  return <span title={m.title} className={`inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${m.cls}`}>{m.label}</span>;
}

export function relDays(date: ISODate, today: ISODate): string {
  const d = diffDays(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return d > 0 ? `In ${d} days` : `${-d} days ago`;
}

export function DateBlock({ date, emphasize, muted }: { date: ISODate; emphasize?: boolean; muted?: boolean }) {
  const d = toDate(date);
  const wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mo = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return (
    <div className={`w-[58px] shrink-0 text-center leading-none ${muted ? "opacity-55" : ""}`}>
      <div className="text-[11.5px] font-semibold text-muted">{mo}</div>
      <div className={`tabular text-[26px] font-extrabold tracking-tight text-ink my-0.5 ${emphasize ? "hl" : ""}`}>{d.getUTCDate()}</div>
      <div className="text-[11.5px] text-muted">{wd}</div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-rule bg-white px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mt-1.5 text-sm text-ink-2 max-w-md mx-auto leading-relaxed">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block mb-1.5">
      <span className="text-[13.5px] font-semibold text-ink">{children}</span>
      {hint && <span className="block text-[12.5px] text-muted mt-0.5 leading-snug">{hint}</span>}
    </label>
  );
}
