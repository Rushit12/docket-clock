import { AlertTriangle, Check, ChevronDown, ExternalLink, Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { diffDays, fmt, fmtMonth, type ISODate } from "../engine/dates";
import type { GenerateResult } from "../engine/generate";
import { CATEGORY_META, type Category, type TimelineEntry } from "../engine/types";
import { ConfidenceTag, DateBlock, relDays } from "./ui";

const SOON = 14;

export function Checks({ result }: { result: GenerateResult }) {
  const ws = result.warnings;
  if (!ws.length) return null;
  const icon = (l: string) => (l === "info" ? <Info size={16} className="text-link shrink-0 mt-0.5" /> : <AlertTriangle size={16} className={`${l === "error" ? "text-late" : "text-[#8a6d00]"} shrink-0 mt-0.5`} />);
  return (
    <section aria-label="Checks" className="rounded-xl border border-rule bg-white mb-5">
      <h2 className="px-4 pt-3.5 pb-1 text-[15px] font-bold">Checks on this timeline</h2>
      <ul className="divide-y divide-rule-2">
        {ws.map((w, i) => (
          <li key={i} className="flex gap-2.5 px-4 py-2.5 text-[13.5px] leading-relaxed text-ink-2">{icon(w.level)}<span>{w.message}</span></li>
        ))}
      </ul>
    </section>
  );
}

function Row({ e, today, done, onDone, override, onOverride }: {
  e: TimelineEntry; today: ISODate; done: boolean; onDone?: (v: boolean) => void; override?: ISODate; onOverride?: (d?: ISODate) => void;
}) {
  const [open, setOpen] = useState(false);
  const d = diffDays(today, e.date);
  const late = d < 0 && !done && e.kind === "deadline";
  const soon = d >= 0 && d <= SOON && !done && e.kind !== "info";
  const isInfo = e.kind === "info";
  return (
    <li className={`group ${done ? "bg-paper/60" : ""}`}>
      <div className="flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-3">
        <DateBlock date={e.date} emphasize={soon} muted={done} />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`font-semibold text-[15px] leading-snug ${done ? "line-through text-muted" : "text-ink"}`}>
              {e.kind === "earliest" && <span className="font-normal text-ink-2">Opens: </span>}
              {e.label}
            </p>
            <ConfidenceTag c={e.confidence} />
          </div>
          <p className="mt-1 text-[13px] text-muted leading-snug">
            <span className="tabular">{fmt(e.date, { weekday: true })}</span>
            <span className={`ml-2 font-semibold ${late ? "text-late" : soon ? "text-[#6b5500]" : "text-ink-2"}`}>{done ? "Done" : relDays(e.date, today)}</span>
            {e.rolled && <span className="ml-2">Moved from {fmt(e.raw)} ({e.rollReason})</span>}
          </p>
          {e.possibleClosure && <p className="mt-1 text-[12.5px] text-[#6b5500]">Possible closure: {e.possibleClosure}. Confirm with the circuit.</p>}
        </div>
        <div className="no-print flex items-center gap-1 pt-0.5">
          {onDone && !isInfo && (
            <button onClick={() => onDone(!done)} aria-pressed={done} title={done ? "Mark not done" : "Mark done"}
              className={`h-8 w-8 grid place-items-center rounded-full border ${done ? "bg-done border-done text-white" : "border-rule text-muted hover:border-done hover:text-done"}`}>
              <Check size={16} />
            </button>
          )}
          <button onClick={() => setOpen(!open)} aria-expanded={open} title="Details" className="h-8 w-8 grid place-items-center rounded-full text-muted hover:bg-rule-2">
            <ChevronDown size={18} className={open ? "rotate-180" : ""} />
          </button>
        </div>
      </div>
      {open && (
        <div className="ml-[70px] sm:ml-[78px] mr-4 mb-3 rounded-lg bg-paper px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 space-y-1.5">
          <p><b className="text-ink">How it's counted:</b> {e.basis}{e.rolled && `. Raw date ${fmt(e.raw, { weekday: true })} fell on ${e.rollReason}, so it moves ${e.date > e.raw ? "forward" : "back"} under Rule 2.514(a).`}</p>
          {e.citation && <p><b className="text-ink">Authority:</b> {e.citation}</p>}
          {e.note && <p><b className="text-ink">Note:</b> {e.note}</p>}
          {e.source?.url && <p><a className="inline-flex items-center gap-1 text-link underline underline-offset-2" href={e.source.url} target="_blank" rel="noreferrer">Open the source order <ExternalLink size={13} /></a></p>}
          {onOverride && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label htmlFor={`ov-${e.id}`} className="font-semibold text-ink">Court changed it?</label>
              <input id={`ov-${e.id}`} type="date" className="field tabular !w-[160px] !py-1" value={override ?? ""} onChange={(ev) => onOverride(ev.target.value || undefined)} />
              {override && <button className="inline-flex items-center gap-1 text-link" onClick={() => onOverride(undefined)}><RotateCcw size={13} /> Restore computed date</button>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function Docket({ result, today, done = {}, onDone, overrides = {}, onOverride }: {
  result: GenerateResult; today: ISODate; done?: Record<string, boolean>; onDone?: (id: string, v: boolean) => void;
  overrides?: Record<string, ISODate>; onOverride?: (id: string, d?: ISODate) => void;
}) {
  const [cat, setCat] = useState<Category | "all">("all");
  const [hideDone, setHideDone] = useState(false);
  const [showRef, setShowRef] = useState(true);
  const cats = useMemo(() => Array.from(new Set(result.entries.map((e) => e.category))), [result.entries]);
  const shown = result.entries.filter((e) => (cat === "all" || e.category === cat) && (!hideDone || !(done[e.id] ?? e.satisfied)) && (showRef || e.kind !== "info"));
  const groups = useMemo(() => {
    const g: { month: string; items: TimelineEntry[] }[] = [];
    for (const e of shown) {
      const m = fmtMonth(e.date);
      if (!g.length || g[g.length - 1].month !== m) g.push({ month: m, items: [] });
      g[g.length - 1].items.push(e);
    }
    return g;
  }, [shown]);

  if (!result.entries.length) return null;
  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-1.5 mb-3">
        <button onClick={() => setCat("all")} className={`rounded-full px-3 py-1 text-[13px] font-semibold border ${cat === "all" ? "bg-ink text-white border-ink" : "bg-white border-rule text-ink-2"}`}>All</button>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-[13px] font-semibold border ${cat === c ? "bg-ink text-white border-ink" : "bg-white border-rule text-ink-2"}`}>{CATEGORY_META[c].label}</button>
        ))}
        <span className="flex-1" />
        <label className="text-[13px] text-ink-2 flex items-center gap-1.5"><input type="checkbox" className="accent-ink" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> Hide done</label>
        <label className="text-[13px] text-ink-2 flex items-center gap-1.5 ml-3"><input type="checkbox" className="accent-ink" checked={showRef} onChange={(e) => setShowRef(e.target.checked)} /> Court checkpoints</label>
      </div>
      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.month} className="rounded-xl border border-rule bg-white overflow-hidden">
            <h3 className="px-4 py-2 text-[13px] font-bold text-ink-2 bg-rule-2/60 border-b border-rule">{g.month}</h3>
            <ul className="divide-y divide-rule-2">
              {g.items.map((e) => (
                <Row key={e.id} e={e} today={today} done={done[e.id] ?? !!e.satisfied} onDone={onDone ? (v) => onDone(e.id, v) : undefined}
                  override={overrides[e.id]} onOverride={onOverride ? (d) => onOverride(e.id, d) : undefined} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
