import { CalendarPlus, FileSpreadsheet, Printer, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { circuitForCounty, ordinal } from "../engine/circuits";
import { diffDays, fmt, todayISO } from "../engine/dates";
import { download, toCSV, toICS } from "../engine/export";
import { generateTimeline } from "../engine/generate";
import { blankCase, type SavedCase, useCases } from "../store";
import { CaseForm } from "./CaseForm";
import { Checks, Docket } from "./Docket";
import { Button, Empty, PageHeader } from "./ui";

export function CaseView({ id, go }: { id: string; go: (r: string) => void }) {
  const { cases, upsert, remove } = useCases();
  const existing = cases.find((c) => c.id === id);
  const [draft, setDraft] = useState<SavedCase>(() => existing ?? blankCase());
  const c = existing ?? draft;
  const isNew = !existing;
  const today = todayISO();

  const update = (next: SavedCase) => (isNew ? setDraft(next) : upsert(next));
  const result = useMemo(() => generateTimeline(c.inputs, { overrides: c.overrides, orderItems: c.orderItems }), [c.inputs, c.overrides, c.orderItems]);
  const circuit = circuitForCounty(c.inputs.county);
  const title = c.inputs.name || (isNew ? "New case timeline" : "Untitled case");

  const upcoming = result.entries.filter((e) => e.kind === "deadline" && !(c.done[e.id] ?? e.satisfied) && e.date >= today);
  const overdue = result.entries.filter((e) => e.kind === "deadline" && !(c.done[e.id] ?? e.satisfied) && e.date < today);
  const trial = result.anchors.trial;

  const save = () => {
    const saved = { ...c, inputs: { ...c.inputs, name: c.inputs.name || "Untitled case" } };
    upsert(saved);
    go(`/case/${saved.id}`);
  };
  const filename = (c.inputs.caseNumber || c.inputs.name || "case").replace(/[^\w-]+/g, "_");

  return (
    <div className="max-w-[1180px]">
      <PageHeader
        title={title}
        sub={circuit ? <>
          {c.inputs.county} County, {ordinal(circuit.id)} Judicial Circuit, {c.inputs.court} court, {c.inputs.track} track
          {c.inputs.caseNumber && <>, <span className="tabular">{c.inputs.caseNumber}</span></>}
          {c.orderSource && <><br />Dates imported from {c.orderSource}.</>}
        </> : "Choose the county and enter the filing date. The timeline builds as you type."}
        actions={<>
          {isNew ? (
            <Button variant="primary" onClick={save} disabled={!c.inputs.county || !c.inputs.filingDate}><Save size={16} /> Save case</Button>
          ) : (
            <Button variant="danger" onClick={() => { if (confirm(`Delete “${title}”? This can't be undone.`)) { remove(c.id); go("/cases"); } }}><Trash2 size={16} /> Delete</Button>
          )}
          <Button disabled={!result.entries.length} onClick={() => download(`${filename}.ics`, toICS([{ name: c.inputs.name || "Case", caseNumber: c.inputs.caseNumber, entries: result.entries }]), "text/calendar")}><CalendarPlus size={16} /> Add to calendar</Button>
          <Button disabled={!result.entries.length} onClick={() => download(`${filename}.csv`, toCSV(c.inputs.name, result.entries), "text/csv")}><FileSpreadsheet size={16} /> CSV</Button>
          <Button disabled={!result.entries.length} onClick={() => window.print()}><Printer size={16} /> Print</Button>
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] items-start">
        <aside className="no-print rounded-xl border border-rule bg-white p-4 sm:p-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
          <CaseForm
            inputs={c.inputs}
            onChange={(inputs) => update({ ...c, inputs })}
            meta={{ claimNumber: c.claimNumber, client: c.client }}
            onMeta={(m) => update({ ...c, ...m })}
          />
          {c.orderItems && (
            <div className="mt-5 rounded-lg bg-paper p-3 text-[13px] text-ink-2">
              This timeline uses the {c.orderItems.length} dates imported from your order.
              <button className="block mt-1.5 font-semibold text-link" onClick={() => update({ ...c, orderItems: undefined, orderSource: undefined })}>Switch back to the circuit form</button>
            </div>
          )}
        </aside>

        <div className="min-w-0">
          {result.entries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <Stat label="Next deadline" value={upcoming[0] ? fmt(upcoming[0].date) : "None"} sub={upcoming[0]?.label} hl={!!upcoming[0] && diffDays(today, upcoming[0].date) <= 14} />
              <Stat label={trial?.estimated ? "Projected trial" : "Trial period"} value={trial ? fmt(trial.date) : "Not set"} sub={trial ? `${Math.max(0, diffDays(today, trial.date))} days away${trial.estimated ? ", estimate" : ""}` : undefined} />
              <Stat label="Past due" value={String(overdue.length)} sub={overdue.length ? "Mark them done or update the dates" : "Nothing past due"} late={overdue.length > 0} />
            </div>
          )}
          <Checks result={result} />
          {result.entries.length ? (
            <Docket
              result={result} today={today} done={c.done} overrides={c.overrides}
              onDone={(eid, v) => update({ ...c, done: { ...c.done, [eid]: v } })}
              onOverride={(eid, d) => {
                const o = { ...c.overrides };
                if (d) o[eid] = d; else delete o[eid];
                update({ ...c, overrides: o });
              }}
            />
          ) : (
            <Empty title="Your timeline appears here">
              Pick the county and enter the date the complaint was filed. Add service dates to unlock the answer, disclosure and proposal-for-settlement deadlines.
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, hl, late }: { label: string; value: string; sub?: string; hl?: boolean; late?: boolean }) {
  return (
    <div className="rounded-xl border border-rule bg-white px-4 py-3 min-w-0">
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className={`tabular text-[21px] font-extrabold tracking-tight mt-0.5 ${late ? "text-late" : "text-ink"}`}><span className={hl ? "hl" : ""}>{value}</span></p>
      {sub && <p className="text-[12.5px] text-ink-2 truncate" title={sub}>{sub}</p>}
    </div>
  );
}
