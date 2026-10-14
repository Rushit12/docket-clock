import { Check, ChevronDown, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { ALL_COUNTIES, ordinal } from "../engine/circuits";
import { addDays, diffDays, fmt, type ISODate, todayISO } from "../engine/dates";
import type { Confidence } from "../engine/types";

// ---------- Buttons ----------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "sun";
export function Button({ children, onClick, variant = "secondary", type = "button", disabled, title, size = "md", className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: Variant; type?: "button" | "submit"; disabled?: boolean; title?: string; size?: "sm" | "md" | "lg"; className?: string;
}) {
  const v: Record<Variant, string> = {
    primary: "bg-brand text-white hover:bg-brand-2",
    secondary: "bg-surface text-ink border-[1.5px] border-line hover:border-[#c9d3cf]",
    ghost: "text-ink-2 hover:bg-line-2",
    danger: "text-late hover:bg-late-soft",
    sun: "bg-sun text-ink hover:brightness-[.97]",
  };
  const s = { sm: "h-8 px-3 text-[13.5px] rounded-[10px]", md: "h-10 px-4 text-[14.5px] rounded-xl", lg: "h-12 px-5 text-[15.5px] rounded-[14px]" }[size];
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none ${s} ${v[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ---------- Source tags ----------
const CONF: Record<Confidence, { label: string; cls: string; title: string }> = {
  verified: { label: "Circuit form", cls: "bg-brand-soft text-brand-2", title: "Day count from the circuit's published case management order." },
  rule: { label: "By rule", cls: "bg-sky-soft text-sky", title: "Fixed by a Florida rule or statute, computed under Rule 2.514." },
  estimate: { label: "Estimate", cls: "bg-sun-soft text-sun-ink", title: "Depends on a date that isn't set yet. Add it to lock this deadline." },
  order: { label: "Your order", cls: "bg-ink text-white", title: "Date printed in the order you imported." },
  manual: { label: "Set by you", cls: "bg-line-2 text-ink-2", title: "Entered or changed by you." },
};
export function SourceTag({ c }: { c: Confidence }) {
  const m = CONF[c];
  return <span title={m.title} className={`inline-flex items-center rounded-full px-2 py-[1px] text-[12px] font-semibold ${m.cls}`}>{m.label}</span>;
}
export const confidenceLabel = (c: Confidence) => CONF[c].label;

// ---------- Dates ----------
export function relDays(date: ISODate, today: ISODate): string {
  const d = diffDays(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 0 && d < 60) return `In ${d} days`;
  if (d >= 60) return `In ${Math.round(d / 7)} weeks`;
  return `${-d} days ago`;
}

export function DateChip({ date, tone = "default" }: { date: ISODate; tone?: "default" | "soon" | "late" | "done" | "quiet" | "dark" }) {
  const d = new Date(date + "T00:00:00Z");
  const mo = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const wd = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const cls = {
    default: "bg-line-2 text-ink",
    soon: "bg-sun text-ink",
    late: "bg-late-soft text-late",
    done: "bg-line-2 text-muted",
    quiet: "bg-transparent text-ink-2 border border-line",
    dark: "bg-white/10 text-white",
  }[tone];
  return (
    <div className={`w-[58px] shrink-0 rounded-[12px] py-1.5 text-center leading-none ${cls}`}>
      <div className="text-[11px] font-semibold opacity-80">{mo}{d.getUTCFullYear() !== new Date().getFullYear() ? ` ’${String(d.getUTCFullYear()).slice(2)}` : ""}</div>
      <div className="display tabular text-[21px] font-bold my-[3px]">{d.getUTCDate()}</div>
      <div className="text-[11px] opacity-75">{wd}</div>
    </div>
  );
}

// ---------- Form controls ----------
export function Field({ label, hint, children, htmlFor, optional }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[14px] font-semibold text-ink">{label}</span>
        {optional && <span className="text-[12.5px] text-muted">Optional</span>}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-[14px] bg-line-2 p-1 gap-1">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`flex-1 h-9 rounded-[10px] px-3 text-[14px] font-semibold transition-colors ${value === o.v ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DateInput({ id, value, onChange, quick = true, max }: { id: string; value?: ISODate; onChange: (v?: ISODate) => void; quick?: boolean; max?: ISODate }) {
  const today = todayISO();
  const chips = [{ l: "Today", d: today }, { l: "Yesterday", d: addDays(today, -1) }];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input id={id} type="date" max={max} className="input tabular !w-auto min-w-[170px] flex-1 sm:flex-none" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} />
      {quick && chips.map((c) => (
        <button key={c.l} type="button" onClick={() => onChange(c.d)}
          className={`h-9 rounded-full px-3 text-[13px] font-semibold border-[1.5px] ${value === c.d ? "border-brand bg-brand-soft text-brand-2" : "border-line text-ink-2 hover:border-[#c9d3cf]"}`}>
          {c.l}
        </button>
      ))}
      {value && <button type="button" onClick={() => onChange(undefined)} className="text-[13px] text-muted hover:text-ink underline underline-offset-2">Clear</button>}
    </div>
  );
}

export function CountyPicker({ value, onChange, id }: { value: string; onChange: (county: string) => void; id?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => setQ(value), [value]);
  useEffect(() => {
    const on = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, []);
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = ALL_COUNTIES.filter((c) => !t || c.county.toLowerCase().includes(t) || `${ordinal(c.circuit)}`.startsWith(t));
    return list.sort((a, b) => Number(!a.county.toLowerCase().startsWith(t)) - Number(!b.county.toLowerCase().startsWith(t)));
  }, [q]);
  const pick = (c: string) => { onChange(c); setQ(c); setOpen(false); };
  return (
    <div ref={wrap} className="relative">
      <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        id={inputId} role="combobox" aria-expanded={open} aria-controls={`${inputId}-list`} aria-autocomplete="list" autoComplete="off"
        className="input !pl-10 !pr-10" placeholder="Type a county, e.g. Broward" value={q}
        onFocus={() => { setOpen(true); setHi(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Enter" && results[hi]) { e.preventDefault(); pick(results[hi].county); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      {open && (
        <ul id={`${inputId}-list`} role="listbox" className="absolute z-40 mt-2 w-full max-h-72 overflow-auto rounded-[14px] border border-line bg-surface p-1.5 shadow-lift anim-fade">
          {results.length === 0 && <li className="px-3 py-2.5 text-[14px] text-muted">No Florida county matches “{q}”.</li>}
          {results.map((c, i) => (
            <li key={c.county} role="option" aria-selected={c.county === value}
              onMouseDown={(e) => { e.preventDefault(); pick(c.county); }} onMouseEnter={() => setHi(i)}
              className={`flex items-center justify-between rounded-[10px] px-3 py-2 cursor-pointer text-[14.5px] ${i === hi ? "bg-line-2" : ""}`}>
              <span className="font-medium">{c.county}</span>
              <span className="flex items-center gap-2 text-[13px] text-muted">{ordinal(c.circuit)} Circuit{c.county === value && <Check size={15} className="text-brand" />}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Sheet (side drawer / bottom sheet) ----------
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", on);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", on); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/30 anim-fade" onClick={onClose} />
      <div className={`absolute bottom-0 inset-x-0 sm:inset-y-0 sm:left-auto sm:right-0 w-full ${wide ? "sm:w-[560px]" : "sm:w-[460px]"} max-h-[92vh] sm:max-h-none flex flex-col bg-surface rounded-t-[22px] sm:rounded-none sm:rounded-l-[22px] shadow-lift sheet-panel`}>
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3">
          <div className="min-w-0">{title}</div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 shrink-0 grid place-items-center rounded-full hover:bg-line-2"><X size={19} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-6">{children}</div>
        {footer && <div className="border-t border-line px-5 sm:px-6 py-3.5 flex flex-wrap gap-2 justify-end" style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}>{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
type ToastMsg = { id: number; text: string; action?: { label: string; run: () => void } };
let toasts: ToastMsg[] = [];
const toastListeners = new Set<(t: ToastMsg[]) => void>();
export function toast(text: string, action?: ToastMsg["action"]) {
  const t = { id: Date.now() + Math.random(), text, action };
  toasts = [t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); toastListeners.forEach((l) => l(toasts)); }, 4500);
}
export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => { toastListeners.add(setList); return () => void toastListeners.delete(setList); }, []);
  return (
    <div aria-live="polite" className="no-print">
      {list.map((t) => (
        <div key={t.id} className="fixed z-[60] left-1/2 bottom-24 sm:bottom-8 -translate-x-1/2 anim-toast flex items-center gap-4 rounded-[14px] bg-ink text-white pl-4 pr-2 py-2 shadow-lift text-[14.5px]">
          <span>{t.text}</span>
          {t.action && <button className="h-8 rounded-[10px] px-3 font-semibold text-sun hover:bg-white/10" onClick={() => { t.action!.run(); toasts = []; toastListeners.forEach((l) => l([])); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface px-6 py-12 text-center">
      {icon && <div className="mx-auto mb-3 h-12 w-12 grid place-items-center rounded-full bg-brand-soft text-brand">{icon}</div>}
      <p className="display text-[19px] font-bold text-ink">{title}</p>
      {children && <p className="mt-1.5 text-[14.5px] text-ink-2 max-w-md mx-auto leading-relaxed">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export const fmtLong = (d: ISODate) => fmt(d, { weekday: true });
