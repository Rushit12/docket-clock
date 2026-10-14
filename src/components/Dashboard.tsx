import { CalendarPlus, FileInput, Plus } from "lucide-react";
import { useMemo } from "react";
import { addDays, diffDays, fmt, type ISODate, todayISO } from "../engine/dates";
import { download, toICS } from "../engine/export";
import { generateTimeline } from "../engine/generate";
import type { TimelineEntry } from "../engine/types";
import { newId, type SavedCase, useCases } from "../store";
import { Button, ConfidenceTag, DateBlock, PageHeader, relDays } from "./ui";

interface Item { c: SavedCase; e: TimelineEntry }

export function sampleCase(today: ISODate): SavedCase {
  return {
    id: newId(),
    inputs: {
      name: "Rivera v. Gulfstream Mutual (sample)", caseNumber: "CACE-26-004417", county: "Broward", court: "circuit",
      caseType: "auto", track: "general", jury: true,
      filingDate: addDays(today, -95), serviceClientDate: addDays(today, -71), serviceLastDate: addDays(today, -64), dateOfLoss: addDays(today, -400),
    },
    claimNumber: "GM-2025-118204", client: "Dana Whitfield (insured)",
    overrides: {}, done: { answer: true, initialDisclosures: true, mediatorSelect: true }, createdAt: "", updatedAt: "",
  };
}

export function Dashboard({ go }: { go: (r: string) => void }) {
  const { cases, upsert } = useCases();
  const today = todayISO();
  const all = useMemo(() => cases.flatMap((c) => {
    const r = generateTimeline(c.inputs, { overrides: c.overrides, orderItems: c.orderItems });
    return r.entries.filter((e) => e.kind !== "info" && !(c.done[e.id] ?? e.satisfied)).map((e) => ({ c, e }));
  }), [cases]);

  const overdue = all.filter((x) => x.e.kind === "deadline" && x.e.date < today).sort(by);
  const week = all.filter((x) => x.e.date >= today && diffDays(today, x.e.date) <= 7).sort(by);
  const month = all.filter((x) => diffDays(today, x.e.date) > 7 && diffDays(today, x.e.date) <= 30).sort(by);

  if (!cases.length) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Every CMO deadline, counted the way the court counts it." sub="Pick the county and the filing date. Docket Clock applies that circuit's case management order, Florida's 2025 Rule 1.200 overhaul, Rule 2.514 time computation and the circuit's court holidays, then shows the authority behind every date." />
        <div className="grid sm:grid-cols-3 gap-3">
          <Start title="Build a timeline" body="From the county, track and filing date." onClick={() => go("/case/new")} icon={<Plus size={18} />} primary />
          <Start title="Import an issued CMO" body="Drop the PDF or paste the text; we pull the dates and check them." onClick={() => go("/import")} icon={<FileInput size={18} />} />
          <Start title="Open a sample case" body="A Broward auto negligence file, already served." onClick={() => { const s = sampleCase(today); upsert(s); go(`/case/${s.id}`); }} icon={<CalendarPlus size={18} />} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[920px]">
      <PageHeader
        title={`Week of ${fmt(today)}`}
        sub={`${week.length} due in the next 7 days, ${overdue.length} past due, across ${cases.length} ${cases.length === 1 ? "case" : "cases"}.`}
        actions={<Button onClick={() => download("docket-clock-all-cases.ics", toICS(cases.map((c) => ({ name: c.inputs.name, caseNumber: c.inputs.caseNumber, entries: generateTimeline(c.inputs, { overrides: c.overrides, orderItems: c.orderItems }).entries }))), "text/calendar")}><CalendarPlus size={16} /> Export all to calendar</Button>}
      />
      {overdue.length > 0 && <Group title="Past due" items={overdue} today={today} go={go} late />}
      <Group title="Next 7 days" items={week} today={today} go={go} emptyText="Nothing due this week." />
      <Group title="Later this month" items={month} today={today} go={go} emptyText="Nothing else due in the next 30 days." />
    </div>
  );
}

const by = (a: Item, b: Item) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : 0);

function Group({ title, items, today, go, late, emptyText }: { title: string; items: Item[]; today: ISODate; go: (r: string) => void; late?: boolean; emptyText?: string }) {
  return (
    <section className="mb-7">
      <h2 className={`text-[17px] font-bold mb-2.5 ${late ? "text-late" : "text-ink"}`}>{title}</h2>
      {items.length === 0 ? <p className="text-sm text-muted">{emptyText}</p> : (
        <ul className="rounded-xl border border-rule bg-white divide-y divide-rule-2 overflow-hidden">
          {items.map(({ c, e }) => (
            <li key={c.id + e.id}>
              <button onClick={() => go(`/case/${c.id}`)} className="w-full text-left flex items-start gap-4 px-4 py-3 hover:bg-paper">
                <DateBlock date={e.date} emphasize={!late && diffDays(today, e.date) <= 7} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-semibold text-ink leading-snug">{e.kind === "earliest" ? "Opens: " : ""}{e.label}</p>
                  <p className="text-[13px] text-ink-2 mt-0.5 truncate">{c.inputs.name}{c.inputs.caseNumber ? `, ${c.inputs.caseNumber}` : ""}</p>
                </div>
                <div className="text-right shrink-0 pt-0.5">
                  <p className={`text-[13px] font-semibold ${late ? "text-late" : "text-ink-2"}`}>{relDays(e.date, today)}</p>
                  <div className="mt-1"><ConfidenceTag c={e.confidence} /></div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Start({ title, body, onClick, icon, primary }: { title: string; body: string; onClick: () => void; icon: React.ReactNode; primary?: boolean }) {
  return (
    <button onClick={onClick} className={`text-left rounded-xl p-4 border ${primary ? "bg-ink text-white border-ink" : "bg-white border-rule hover:border-ink-2/40"}`}>
      <span className={`inline-grid place-items-center h-8 w-8 rounded-lg mb-3 ${primary ? "bg-highlight text-ink" : "bg-rule-2 text-ink"}`}>{icon}</span>
      <p className="font-bold">{title}</p>
      <p className={`text-[13.5px] mt-1 leading-snug ${primary ? "text-white/75" : "text-ink-2"}`}>{body}</p>
    </button>
  );
}
