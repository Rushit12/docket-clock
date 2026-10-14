import { ArrowUpRight, Check, FileUp, Plus, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { phaseOf, summarize } from "../caseUtils";
import { addDays, diffDays, fmt, type ISODate, todayISO } from "../engine/dates";
import type { TimelineEntry } from "../engine/types";
import { newId, type SavedCase, useCases } from "../store";
import { Button, DateChip, relDays, SourceTag, toast } from "./ui";

export function sampleCase(today: ISODate): SavedCase {
  return {
    id: newId(),
    inputs: {
      name: "Rivera v. Gulfstream Mutual", caseNumber: "CACE-26-004417", county: "Broward", court: "circuit",
      caseType: "auto", track: "general", jury: true,
      filingDate: addDays(today, -95), serviceClientDate: addDays(today, -71), serviceLastDate: addDays(today, -64), dateOfLoss: addDays(today, -400),
    },
    claimNumber: "GM-2025-118204", client: "Dana Whitfield (insured)",
    overrides: {}, done: { answer: true, initialDisclosures: true, mediatorSelect: true }, createdAt: "", updatedAt: "",
  };
}

interface Item { c: SavedCase; e: TimelineEntry }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function Home({ go }: { go: (r: string) => void }) {
  const { cases, upsert } = useCases();
  const today = todayISO();
  const sums = useMemo(() => cases.map((c) => summarize(c, today)), [cases, today]);
  const items: Item[] = useMemo(() => sums.flatMap((s) => s.open.map((e) => ({ c: s.c, e }))).sort((a, b) => (a.e.date < b.e.date ? -1 : 1)), [sums]);

  const openSample = () => { const s = sampleCase(today); upsert(s); go(`/case/${s.id}`); };

  if (!cases.length) return <Welcome go={go} openSample={openSample} />;

  const overdue = items.filter((x) => x.e.kind === "deadline" && x.e.date < today);
  const upcoming = items.filter((x) => x.e.date >= today);
  const week = upcoming.filter((x) => diffDays(today, x.e.date) <= 7);
  const month = upcoming.filter((x) => diffDays(today, x.e.date) > 7 && diffDays(today, x.e.date) <= 30);
  const featured = upcoming.find((x) => x.e.kind === "deadline");

  const markDone = (c: SavedCase, e: TimelineEntry) => {
    upsert({ ...c, done: { ...c.done, [e.id]: true } });
    toast(`Marked “${e.label}” done`, { label: "Undo", run: () => upsert({ ...c, done: { ...c.done, [e.id]: false } }) });
  };

  const summary = [
    week.length ? `${week.length} ${week.length === 1 ? "deadline" : "deadlines"} in the next 7 days` : "Nothing due in the next 7 days",
    overdue.length ? `${overdue.length} past due` : null,
  ].filter(Boolean).join(", ");

  return (
    <div>
      <h1 className="display text-[34px] sm:text-[44px] leading-[1.05] font-bold">{greeting()}.</h1>
      <p className="mt-2 text-[16.5px] text-ink-2">{summary}, across {cases.length} {cases.length === 1 ? "case" : "cases"}.</p>

      <WeekStrip today={today} items={upcoming} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {overdue.length > 0 && (
            <section className="rounded-[20px] bg-late-soft p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="display text-[19px] font-bold text-late">Past due</h2>
                {overdue.length > 1 && <Button size="sm" onClick={() => {
                  const before = cases;
                  const byCase = new Map<string, string[]>();
                  overdue.forEach(({ c, e }) => byCase.set(c.id, [...(byCase.get(c.id) ?? []), e.id]));
                  byCase.forEach((ids, cid) => { const c = cases.find((x) => x.id === cid)!; const done = { ...c.done }; ids.forEach((i) => { done[i] = true; }); upsert({ ...c, done }); });
                  toast(`Marked ${overdue.length} deadlines done`, { label: "Undo", run: () => before.forEach((c) => upsert(c)) });
                }}><Check size={15} /> Mark all {overdue.length} done</Button>}
              </div>
              <p className="text-[14px] text-ink-2 mt-0.5 mb-3">Mark these done, or open the case and update the date if the court moved it.</p>
              <List items={overdue} today={today} go={go} onDone={markDone} tone="late" />
            </section>
          )}

          {featured && (
            <section className="rounded-[22px] bg-surface shadow-soft p-5 sm:p-7">
              <p className="text-[14px] font-semibold text-brand">Up next</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="display text-[30px] sm:text-[40px] font-bold leading-none tabular">
                    <span className={diffDays(today, featured.e.date) <= 14 ? "hl" : ""}>{fmt(featured.e.date, { weekday: true })}</span>
                  </p>
                  <p className="mt-3 text-[18px] font-semibold leading-snug">{featured.e.label}</p>
                  <p className="mt-1 text-[14.5px] text-ink-2">{featured.c.inputs.name}{featured.c.inputs.caseNumber ? `, ${featured.c.inputs.caseNumber}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="display text-[44px] font-bold leading-none tabular">{diffDays(today, featured.e.date)}</p>
                  <p className="text-[13px] text-muted">{diffDays(today, featured.e.date) === 1 ? "day left" : "days left"}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => go(`/case/${featured.c.id}`)}>Open case <ArrowUpRight size={16} /></Button>
                <Button onClick={() => markDone(featured.c, featured.e)}><Check size={16} /> Mark done</Button>
              </div>
            </section>
          )}

          <section>
            <h2 className="display text-[21px] font-bold mb-3">This week</h2>
            {week.length ? <List items={week} today={today} go={go} onDone={markDone} /> : <p className="text-[14.5px] text-muted">Nothing due in the next 7 days.</p>}
          </section>
          <section>
            <h2 className="display text-[21px] font-bold mb-3">Later this month</h2>
            {month.length ? <List items={month} today={today} go={go} onDone={markDone} /> : <p className="text-[14.5px] text-muted">Nothing else due in the next 30 days.</p>}
          </section>
        </div>

        <aside className="min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="display text-[21px] font-bold">Your cases</h2>
            <a href="#/cases" className="text-[14px] font-semibold text-brand hover:underline underline-offset-2">See all</a>
          </div>
          <ul className="space-y-3">
            {sums.slice(0, 6).map((s) => (
              <li key={s.c.id}>
                <a href={`#/case/${s.c.id}`} className="block rounded-[18px] bg-surface shadow-soft p-4 hover:shadow-lift transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug">{s.c.inputs.name}</p>
                    <span className="shrink-0 rounded-full bg-line-2 px-2 py-0.5 text-[12px] font-semibold text-ink-2">{phaseOf(s, today)}</span>
                  </div>
                  <p className="text-[13px] text-muted mt-0.5">{s.c.inputs.county} County{s.c.inputs.caseNumber ? `, ${s.c.inputs.caseNumber}` : ""}</p>
                  <div className="mt-3 h-1.5 rounded-full bg-line-2 overflow-hidden" aria-hidden>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(s.progress * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[12.5px] text-ink-2">
                    <span>{s.next ? `Next: ${relDays(s.next.date, today).toLowerCase()}` : "No open deadlines"}</span>
                    <span>{s.daysToTrial !== undefined && s.daysToTrial >= 0 ? `Trial in ${s.daysToTrial} days` : ""}</span>
                  </div>
                  {s.overdue.length > 0 && <p className="mt-1.5 text-[12.5px] font-semibold text-late">{s.overdue.length} past due</p>}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function WeekStrip({ today, items }: { today: ISODate; items: Item[] }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  return (
    <div className="mt-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
      <div className="grid grid-cols-14 gap-1.5 min-w-[640px]" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {days.map((d, i) => {
          const n = items.filter((x) => x.e.date === d && x.e.kind !== "info").length;
          const dt = new Date(d + "T00:00:00Z");
          const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
          return (
            <div key={d} title={n ? `${n} due ${fmt(d)}` : fmt(d)}
              className={`rounded-[14px] px-1 py-2 text-center ${i === 0 ? "bg-ink text-white" : n ? "bg-surface shadow-soft" : weekend ? "bg-transparent text-muted" : "bg-surface/60"}`}>
              <div className={`text-[11.5px] font-semibold ${i === 0 ? "text-white/70" : "text-muted"}`}>{dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</div>
              <div className="display text-[18px] font-bold tabular">{dt.getUTCDate()}</div>
              <div className="h-4 flex items-center justify-center gap-0.5">
                {n > 0 && (n <= 3 ? Array.from({ length: n }, (_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-sun" : "bg-brand"}`} />) : <span className="text-[11px] font-bold text-brand">{n}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function List({ items, today, go, onDone, tone }: { items: Item[]; today: ISODate; go: (r: string) => void; onDone: (c: SavedCase, e: TimelineEntry) => void; tone?: "late" }) {
  return (
    <ul className="rounded-[18px] bg-surface shadow-soft divide-y divide-line-2 overflow-hidden">
      {items.map(({ c, e }) => {
        const d = diffDays(today, e.date);
        return (
          <li key={c.id + e.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
            <DateChip date={e.date} tone={tone === "late" ? "late" : d <= 7 ? "soon" : "default"} />
            <button onClick={() => go(`/case/${c.id}`)} className="min-w-0 flex-1 text-left">
              <p className="font-semibold leading-snug">{e.kind === "earliest" ? "Window opens: " : ""}{e.label}</p>
              <p className="text-[13.5px] text-ink-2 mt-0.5 truncate">{c.inputs.name}</p>
              <p className={`text-[13px] mt-0.5 flex flex-wrap items-center gap-2 ${tone === "late" ? "text-late font-semibold" : "text-muted"}`}>{relDays(e.date, today)} <SourceTag c={e.confidence} /></p>
            </button>
            {e.kind === "deadline" && (
              <button onClick={() => onDone(c, e)} title="Mark done" aria-label={`Mark ${e.label} done`}
                className="h-9 w-9 shrink-0 grid place-items-center rounded-full border-[1.5px] border-line text-muted hover:border-brand hover:text-brand hover:bg-brand-soft">
                <Check size={17} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Welcome({ go, openSample }: { go: (r: string) => void; openSample: () => void }) {
  const today = todayISO();
  const preview = useMemo(() => summarize(sampleCase(today), today), [today]);
  const rows = preview.result.entries.filter((e) => e.kind !== "info" && !e.satisfied && e.date >= addDays(today, -45)).slice(0, 5);
  const moved = preview.result.entries.find((e) => e.rolled && e.kind === "deadline" && e.date >= today && !e.satisfied);
  return (
    <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] items-center lg:min-h-[70vh]">
      <div>
        <h1 className="display text-[40px] sm:text-[58px] leading-[0.98] font-bold">Your CMO, turned into a docket you can trust.</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2 max-w-[54ch]">
          Choose the county and the filing date. Docket Clock applies that circuit's case management order, Florida's 2025 Rule 1.200 changes, Rule 2.514 day counting and local court holidays, and shows you why every date is what it is.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={() => go("/new")}><Plus size={19} /> Build a timeline</Button>
          <Button size="lg" onClick={() => go("/import")}><FileUp size={18} /> Import an order</Button>
        </div>
        <button onClick={openSample} className="mt-5 inline-flex items-center gap-2 text-[14.5px] font-semibold text-brand hover:underline underline-offset-2">
          <Sparkles size={16} /> Or open a sample Broward auto case
        </button>
      </div>

      <div className="relative" aria-label="Example timeline">
        <div className="rounded-[26px] bg-surface shadow-lift p-5 sm:p-6 rotate-[0.6deg]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Rivera v. Gulfstream Mutual</p>
              <p className="text-[13px] text-muted">Broward, 17th Circuit, general track</p>
            </div>
            <span className="rounded-full bg-sun-soft text-sun-ink px-2.5 py-1 text-[12px] font-semibold">Example</span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {rows.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3">
                <DateChip date={e.date} tone={e.date < today ? "done" : rows.findIndex((r) => r.date >= today) === i ? "soon" : "default"} />
                <div className="min-w-0">
                  <p className="font-semibold text-[14.5px] leading-snug truncate">{e.label}</p>
                  <p className="text-[12.5px] text-muted flex items-center gap-2">{e.basis} <SourceTag c={e.confidence} /></p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        {moved && (
          <div className="absolute -bottom-5 -left-3 sm:-left-6 rounded-[16px] bg-ink text-white px-4 py-3 shadow-lift max-w-[290px] -rotate-[1.2deg]">
            <p className="text-[13px] leading-snug"><span className="text-sun font-semibold">Moved to {fmt(moved.date, { weekday: true }).split(",")[0]}.</span> “{moved.label}” fell on {moved.rollReason}, so Rule 2.514(a) carries it to the next open court day.</p>
          </div>
        )}
      </div>
    </div>
  );
}
