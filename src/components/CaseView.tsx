import { ArrowLeft, CalendarPlus, Check, ChevronDown, ChevronRight, Download, ExternalLink, FileSpreadsheet, Info, Lock, Pencil, Printer, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { phaseOf, summarize } from "../caseUtils";
import { circuitForCounty, ordinal } from "../engine/circuits";
import { diffDays, fmt, fmtMonth, type ISODate, todayISO } from "../engine/dates";
import { download, toCSV, toICS } from "../engine/export";
import type { Phase, Role, TimelineEntry } from "../engine/types";
import { type SavedCase, useCases, usePref, useSettings } from "../store";
import { EditCase } from "./EditCase";
import { Button, DateChip, DateInput, Empty, relDays, Sheet, SourceTag, toast } from "./ui";

const framed = typeof window !== "undefined" && window.self !== window.top;

const SHORT: Record<string, string> = {
  service: "Service", answer: "Answer", initialDisclosures: "Disclosures", factDiscovery: "Fact discovery",
  discoveryComplete: "Discovery closes", discovery: "Discovery closes", expertDisclosure: "Experts disclosed", expertP: "Plaintiff experts",
  expertDiscovery: "Expert discovery", msjFile: "MSJ deadline", mediation: "Mediation", calendarCall: "Calendar Call",
  pretrial: "Pretrial", trial: "Trial", projectedTrial: "Trial", trialTerm: "Trial",
};

type S = ReturnType<typeof summarize>;

export function CaseView({ id, go }: { id: string; go: (r: string) => void }) {
  const { cases, upsert, remove } = useCases();
  const c = cases.find((x) => x.id === id);
  const today = todayISO();
  const [tab, setTab] = usePref<"upcoming" | "plan" | "all" | "checks">("caseTab", "upcoming");
  const [show, setShow] = usePref<"everything" | "deadlines" | "tasks">("caseShow", "everything");
  const [role, setRole] = usePref<Role | "all">("caseRole", "all");
  const [settings] = useSettings();
  const [selected, setSelected] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const s = useMemo(() => (c ? summarize(c, today, settings) : undefined), [c, today, settings]);

  if (!c || !s) {
    return <Empty title="This case isn't in this browser" action={<Button variant="primary" onClick={() => go("/cases")}>Go to cases</Button>}>Cases are saved on the device where they were created.</Empty>;
  }
  const { result } = s;
  const circuit = circuitForCounty(c.inputs.county);
  const filename = (c.inputs.caseNumber || c.inputs.name || "case").replace(/[^\w-]+/g, "_");
  const sel = result.entries.find((e) => e.id === selected);

  const setDone = (e: TimelineEntry, v: boolean) => {
    upsert({ ...c, done: { ...c.done, [e.id]: v } });
    if (v) toast(`Marked “${e.label}” done`, { label: "Undo", run: () => upsert({ ...c, done: { ...c.done, [e.id]: false } }) });
  };
  const setOverride = (eid: string, d?: ISODate) => {
    const o = { ...c.overrides };
    if (d) o[eid] = d; else delete o[eid];
    upsert({ ...c, overrides: o });
  };

  const estimatedCount = result.entries.filter((e) => e.confidence === "estimate").length;
  const back = result.schedule?.backAnchor;
  const lockKey = back === "calendarCall" ? "calendarCallDate" : back === "pretrial" ? "pretrialDate" : "trialDate";
  const lockLabel = back === "calendarCall" ? "Calendar Call" : back === "pretrial" ? "pretrial conference" : "trial date";
  const warnCount = result.warnings.filter((w) => w.level !== "info").length;
  const list = result.entries.filter((e) =>
    (show === "everything" || (show === "tasks" ? e.kind === "task" : e.kind !== "task")) &&
    (role === "all" || e.kind !== "task" || e.role === role));
  const nDeadlines = result.entries.filter((e) => e.kind === "deadline").length;
  const nTasks = result.entries.filter((e) => e.kind === "task").length;
  const setCheck = (key: string, v: boolean) => upsert({ ...c, checks: { ...(c.checks ?? {}), [key]: v } });

  return (
    <div>
      <a href="#/cases" className="no-print inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={16} /> Cases</a>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-[30px] sm:text-[40px] leading-[1.05] font-bold">{c.inputs.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            <Pill>{c.inputs.county} County{circuit ? `, ${ordinal(circuit.id)} Circuit` : ""}</Pill>
            <Pill><span className="capitalize">{c.inputs.track}</span> track</Pill>
            <span className="rounded-full bg-brand-soft text-brand-2 px-2.5 py-1 font-semibold">{phaseOf(s, today)}</span>
            {c.inputs.caseNumber && <Pill>{c.inputs.caseNumber}</Pill>}
            {c.claimNumber && <Pill>Claim {c.claimNumber}</Pill>}
          </div>
          {c.orderSource && <p className="mt-2.5 text-[13.5px] text-ink-2">Dates from {c.orderSource}. <button className="font-semibold text-brand hover:underline" onClick={() => upsert({ ...c, orderItems: undefined, orderSource: undefined })}>Use the circuit form instead</button></p>}
        </div>
        <div className="no-print flex gap-2 relative">
          <Button onClick={() => setEditing(true)}><Pencil size={16} /> Edit details</Button>
          <Button onClick={() => setMenu(!menu)} title="Export and more"><Download size={16} /><span className="hidden sm:inline">Export</span><ChevronDown size={15} /></Button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-12 z-40 w-[260px] rounded-[16px] bg-surface shadow-lift p-1.5 anim-fade">
                {framed && <p className="px-3 py-2 text-[12.5px] text-muted">Calendar, CSV and print work on the deployed site.</p>}
                <MenuItem disabled={framed} icon={<CalendarPlus size={17} />} onClick={() => { download(`${filename}.ics`, toICS([{ name: c.inputs.name, caseNumber: c.inputs.caseNumber, entries: result.entries }]), "text/calendar"); setMenu(false); }}>Add all to calendar</MenuItem>
                <MenuItem disabled={framed} icon={<FileSpreadsheet size={17} />} onClick={() => { download(`${filename}.csv`, toCSV(c.inputs.name, result.entries), "text/csv"); setMenu(false); }}>Download CSV</MenuItem>
                <MenuItem disabled={framed} icon={<Printer size={17} />} onClick={() => { setMenu(false); setTimeout(() => window.print(), 50); }}>Print</MenuItem>
                <div className="my-1 h-px bg-line" />
                <MenuItem icon={<Trash2 size={17} />} danger onClick={() => { setMenu(false); setConfirmDelete(true); }}>Delete case</MenuItem>
              </div>
            </>
          )}
        </div>
      </header>

      <Journey s={s} today={today} onPick={setSelected} />

      {back && !c.orderItems && !c.inputs[lockKey] && estimatedCount > 0 && (
        <LockBanner label={lockLabel} count={estimatedCount} onSet={(d) => { upsert({ ...c, inputs: { ...c.inputs, [lockKey]: d } }); toast(`${lockLabel[0].toUpperCase()}${lockLabel.slice(1)} added. Deadlines locked.`); }} />
      )}

      <div className="mt-8 flex items-center gap-1 border-b border-line no-print" role="tablist">
        {([["upcoming", "Upcoming"], ["plan", "Case plan"], ["all", "All dates"], ["checks", "Checks"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`relative h-11 px-3.5 text-[14.5px] font-semibold ${tab === k ? "text-ink" : "text-muted hover:text-ink"}`}>
            {l}{k === "checks" && result.warnings.length > 0 && <span className={`ml-1.5 rounded-full px-1.5 py-[1px] text-[11.5px] ${warnCount ? "bg-sun text-ink" : "bg-line-2 text-ink-2"}`}>{result.warnings.length}</span>}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full bg-ink" />}
          </button>
        ))}
      </div>

      {tab !== "checks" && (
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 no-print">
          <div className="inline-flex rounded-[12px] bg-line-2 p-1 gap-1" role="radiogroup" aria-label="Show">
            {([["everything", `Everything`], ["deadlines", `Court deadlines (${nDeadlines})`], ["tasks", `Tasks (${nTasks})`]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={show === k} onClick={() => setShow(k)} className={`h-8 px-3 rounded-[9px] text-[13.5px] font-semibold ${show === k ? "bg-surface shadow-soft text-ink" : "text-ink-2"}`}>{l}</button>
            ))}
          </div>
          {show !== "deadlines" && (
            <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
              Tasks for
              <select className="input !w-auto !py-1.5 !text-[13.5px]" value={role} onChange={(ev) => setRole(ev.target.value as Role | "all")}>
                <option value="all">Everyone</option>
                <option value="Attorney">Attorney</option>
                <option value="Paralegal">Paralegal</option>
                <option value="Legal assistant">Legal assistant</option>
              </select>
            </label>
          )}
        </div>
      )}

      <div className="mt-5">
        {tab === "upcoming" && <Upcoming s={s} list={list} today={today} onPick={setSelected} onDone={setDone} onDoneAll={(list) => {
          const done = { ...c.done };
          list.forEach((e) => { done[e.id] = true; });
          upsert({ ...c, done });
          toast(`Marked ${list.length} items done`, { label: "Undo", run: () => upsert({ ...c }) });
        }} />}
        {tab === "plan" && <Plan s={s} list={list} today={today} onPick={setSelected} onDone={setDone} />}
        {tab === "all" && <AllDates s={s} list={list} today={today} onPick={setSelected} onDone={setDone} />}
        {tab === "checks" && <Checks s={s} onPick={setSelected} />}
      </div>

      {sel && (
        <DeadlineSheet key={sel.id} e={sel} s={s} today={today} done={s.isDone(sel)} override={c.overrides[sel.id]} c={c}
          onClose={() => setSelected(undefined)} onDone={(v) => setDone(sel, v)} onOverride={(d) => setOverride(sel.id, d)} onPick={setSelected} onCheck={setCheck} />
      )}
      {editing && <EditCase open onClose={() => setEditing(false)} c={c} onSave={(n) => { upsert(n); toast("Case updated. Deadlines recalculated."); }} />}
      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={<p className="display text-[22px] font-bold">Delete this case?</p>}
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep case</Button><Button variant="primary" className="!bg-late" onClick={() => { remove(c.id); toast("Case deleted"); go("/cases"); }}><Trash2 size={16} /> Delete case</Button></>}>
        <p className="text-[15px] text-ink-2 leading-relaxed">“{c.inputs.name}” and its deadlines, completions and date changes will be removed from this browser. This can't be undone.</p>
      </Sheet>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface border border-line px-2.5 py-1 font-semibold tabular">{children}</span>;
}

function MenuItem({ children, icon, onClick, danger, disabled }: { children: ReactNode; icon: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14.5px] font-medium disabled:opacity-40 ${danger ? "text-late hover:bg-late-soft" : "hover:bg-line-2"}`}>
      {icon}{children}
    </button>
  );
}

// ---------- Journey: the whole case on one line, filing to trial ----------
function Journey({ s, today, onPick }: { s: S; today: ISODate; onPick: (id: string) => void }) {
  const filing = s.c.inputs.filingDate;
  const trial = s.result.anchors.trial?.date;
  if (!filing || !trial) return null;
  const span = Math.max(1, diffDays(filing, trial));
  const pos = (d: ISODate) => Math.min(100, Math.max(0, (diffDays(filing, d) / span) * 100));
  const seen = new Set<string>();
  const marks = s.result.entries
    .filter((e) => SHORT[e.id] && e.date >= filing && e.date <= trial)
    .filter((e) => { const k = SHORT[e.id]; if (seen.has(k)) return false; seen.add(k); return true; });
  const nextId = s.next?.id;
  const dayN = diffDays(filing, today);
  const todayPos = pos(today);

  return (
    <section className="mt-7 rounded-[22px] bg-surface shadow-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-[15px] text-ink-2 max-w-[70ch]">
          <span className="display text-[22px] font-bold text-ink tabular">Day {Math.max(0, dayN)}</span> of about {span}.{" "}
          {s.next ? <>Next up: <button className="font-semibold text-ink underline decoration-sun decoration-[3px] underline-offset-4" onClick={() => onPick(s.next!.id)}>{s.next.label}</button>, {relDays(s.next.date, today).toLowerCase()}.</> : "No open deadlines."}
        </p>
        <p className="text-[14px] text-ink-2">
          {s.result.anchors.trial?.estimated ? "Projected trial" : "Trial"} <b className="text-ink tabular">{fmt(trial)}</b>
          {s.overdue.length > 0 && <span className="ml-3 font-semibold text-late">{s.overdue.length} past due</span>}
        </p>
      </div>
      <div className="mt-5 overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6 pb-1">
        <div className="relative min-w-[760px] h-[124px] mx-10">
          <div className="absolute inset-x-0 top-[57px] h-1.5 rounded-full bg-line-2" />
          <div className="absolute left-0 top-[57px] h-1.5 rounded-full bg-brand" style={{ width: `${todayPos}%` }} />
          {dayN >= 0 && dayN <= span && (
            <div className="absolute top-[47px] -translate-x-1/2" style={{ left: `${todayPos}%` }} title={`Today, ${fmt(today)}`}>
              <span className="block h-[26px] w-[3px] rounded-full bg-ink" />
            </div>
          )}
          {marks.map((e, idx) => {
            const up = idx % 2 === 0;
            const done = s.isDone(e) || e.date < today;
            const isNext = e.id === nextId;
            return (
              <button key={e.id} onClick={() => onPick(e.id)} className="absolute -translate-x-1/2 group" style={{ left: `${pos(e.date)}%`, top: up ? 0 : 53 }} title={`${e.label}, ${fmt(e.date)}`}>
                <span className={`flex items-center ${up ? "flex-col" : "flex-col-reverse"}`}>
                  <span className={`whitespace-nowrap text-[12px] leading-tight text-center ${isNext ? "font-bold text-ink" : "text-ink-2"}`}>
                    {SHORT[e.id]}<br /><span className="text-muted tabular">{fmt(e.date).replace(/, \d{4}$/, "")}</span>
                  </span>
                  <span className="my-1 h-3 w-[1.5px] bg-line" />
                  <span className={`h-3.5 w-3.5 rounded-full border-[2.5px] transition-transform group-hover:scale-125 ${isNext ? "bg-sun border-ink" : done ? "bg-brand border-brand" : "bg-surface border-brand"}`} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LockBanner({ label, count, onSet }: { label: string; count: number; onSet: (d: ISODate) => void }) {
  const [d, setD] = useState<ISODate>();
  return (
    <section className="mt-5 rounded-[20px] bg-sun-soft p-4 sm:p-5 flex flex-wrap items-center gap-4 no-print">
      <span className="h-10 w-10 grid place-items-center rounded-full bg-sun shrink-0"><Lock size={18} /></span>
      <div className="flex-1 min-w-[220px]">
        <p className="font-semibold">Got the trial order? Add the {label} to lock {count} estimated {count === 1 ? "deadline" : "deadlines"}.</p>
        <p className="text-[13.5px] text-ink-2 mt-0.5">Until then they're counted from the projected trial date.</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="date" aria-label={label} className="input tabular !w-[170px]" value={d ?? ""} onChange={(e) => setD(e.target.value || undefined)} />
        <Button variant="primary" disabled={!d} onClick={() => d && onSet(d)}>Lock dates</Button>
      </div>
    </section>
  );
}

// ---------- Lists ----------
const actionable = (e: TimelineEntry) => e.kind === "deadline" || e.kind === "task";

function Row({ e, s, today, onPick, onDone }: { e: TimelineEntry; s: S; today: ISODate; onPick: (id: string) => void; onDone: (e: TimelineEntry, v: boolean) => void }) {
  const done = s.isDone(e);
  const d = diffDays(today, e.date);
  const late = d < 0 && !done && actionable(e);
  const tone = done ? "done" : late ? "late" : d >= 0 && d <= 14 && e.kind !== "info" ? "soon" : "default";
  const isTask = e.kind === "task";
  return (
    <li className={`flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 hover:bg-canvas/60 ${isTask ? "" : "bg-surface"}`}>
      {actionable(e) ? (
        <button onClick={() => onDone(e, !done)} aria-pressed={done} aria-label={done ? `Mark ${e.label} not done` : `Mark ${e.label} done`}
          className={`h-7 w-7 shrink-0 grid place-items-center border-[1.5px] transition-colors ${isTask ? "rounded-[8px]" : "rounded-full"} ${done ? "bg-brand border-brand text-white" : "border-[#c9d3cf] text-transparent hover:border-brand hover:text-brand"}`}>
          <Check size={15} strokeWidth={3} />
        </button>
      ) : <span className="h-7 w-7 shrink-0 grid place-items-center text-muted" title={e.kind === "earliest" ? "Window opens" : "Court checkpoint"}>{e.kind === "earliest" ? <ChevronRight size={17} /> : <Info size={16} />}</span>}
      <DateChip date={e.date} tone={tone} />
      <button onClick={() => onPick(e.id)} className="min-w-0 flex-1 text-left">
        <p className={`leading-snug ${isTask ? "font-medium" : "font-semibold"} ${done ? "text-muted line-through decoration-1" : ""}`}>
          {e.kind === "earliest" && <span className="font-normal text-ink-2">Window opens: </span>}{e.label}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted">
          <span className={late ? "font-semibold text-late" : tone === "soon" ? "font-semibold text-sun-ink" : ""}>{done ? "Done" : relDays(e.date, today)}</span>
          {isTask ? <span className="rounded-full border border-line px-2 py-[1px] text-[12px] font-semibold text-ink-2">{e.role}</span> : <span className="rounded-full bg-ink/90 text-white px-2 py-[1px] text-[12px] font-semibold">Court deadline</span>}
          <SourceTag c={e.confidence} />
          {e.rolled && <span>Moved from {fmt(e.raw).replace(/, \d{4}$/, "")}</span>}
          {e.possibleClosure && <span className="text-sun-ink">Check: {e.possibleClosure}</span>}
        </p>
      </button>
      <ChevronRight size={18} className="text-muted shrink-0 hidden sm:block" />
    </li>
  );
}

function Block({ title, sub, children, tone, action }: { title: string; sub?: string; children: ReactNode; tone?: "late"; action?: ReactNode }) {
  return (
    <section className="mb-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2.5">
        <h2 className={`display text-[19px] font-bold ${tone === "late" ? "text-late" : ""}`}>{title}</h2>
        {sub && <span className="text-[13.5px] text-muted flex-1 min-w-[200px]">{sub}</span>}
        {action}
      </div>
      <ul className="rounded-[18px] bg-surface shadow-soft divide-y divide-line-2 overflow-hidden">{children}</ul>
    </section>
  );
}

function byMonth(list: TimelineEntry[]) {
  const g: { m: string; items: TimelineEntry[] }[] = [];
  list.forEach((e) => { const m = fmtMonth(e.date); if (!g.length || g[g.length - 1].m !== m) g.push({ m, items: [] }); g[g.length - 1].items.push(e); });
  return g;
}

type ListProps = { s: S; list: TimelineEntry[]; today: ISODate; onPick: (id: string) => void; onDone: (e: TimelineEntry, v: boolean) => void };

function Upcoming({ s, list, today, onPick, onDone, onDoneAll }: ListProps & { onDoneAll: (list: TimelineEntry[]) => void }) {
  const [showDone, setShowDone] = useState(false);
  const act = list.filter((e) => e.kind !== "info");
  const overdue = act.filter((e) => actionable(e) && !s.isDone(e) && e.date < today);
  const soon = act.filter((e) => !s.isDone(e) && e.date >= today && diffDays(today, e.date) <= 30);
  const later = act.filter((e) => !s.isDone(e) && diffDays(today, e.date) > 30);
  const done = act.filter((e) => s.isDone(e) || (!actionable(e) && e.date < today));
  const row = (e: TimelineEntry) => <Row key={e.id} e={e} s={s} today={today} onPick={onPick} onDone={onDone} />;
  return (
    <div>
      {overdue.length > 0 && <Block title="Past due" sub="Mark done, or open one to record a new date" tone="late" action={overdue.length > 1 ? <Button size="sm" onClick={() => onDoneAll(overdue)}><Check size={15} /> Mark all {overdue.length} done</Button> : undefined}>{overdue.map(row)}</Block>}
      <Block title="Next 30 days">{soon.length ? soon.map(row) : <li className="px-4 py-4 text-[14.5px] text-muted">Nothing due in the next 30 days.</li>}</Block>
      {byMonth(later).map((g) => <Block key={g.m} title={g.m}>{g.items.map(row)}</Block>)}
      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ink-2 hover:text-ink">
            <ChevronDown size={17} className={showDone ? "rotate-180" : ""} /> {showDone ? "Hide" : "Show"} {done.length} completed or past
          </button>
          {showDone && <div className="mt-3"><Block title="Completed and past">{done.map(row)}</Block></div>}
        </div>
      )}
    </div>
  );
}

const PHASES: Phase[] = ["Intake & pleadings", "Disclosures & written discovery", "Records & subpoenas", "Depositions", "Medical exam", "Experts", "Dispositive motions", "Mediation & settlement", "Trial preparation", "Carrier reporting"];
const DEADLINE_PHASE: Record<string, Phase> = {
  service: "Intake & pleadings", serviceExt: "Intake & pleadings", answer: "Intake & pleadings", discWithComplaint: "Disclosures & written discovery", sol: "Intake & pleadings",
  initialDisclosures: "Disclosures & written discovery", addParties: "Intake & pleadings", objections: "Intake & pleadings", objectionsFile: "Intake & pleadings", objectionsResolve: "Intake & pleadings", fabre: "Intake & pleadings",
  factDiscovery: "Depositions", discoveryComplete: "Depositions", discovery: "Depositions", discoveryInitiated: "Disclosures & written discovery", writtenDiscovery: "Disclosures & written discovery", compel: "Disclosures & written discovery",
  factWitness: "Trial preparation", factWitnessPrelim: "Disclosures & written discovery", witnessExhibitList: "Trial preparation", finalWitnesses: "Trial preparation", surveillance: "Disclosures & written discovery", northrup: "Trial preparation",
  cme: "Medical exam", cmeReport: "Medical exam",
  expertDisclosure: "Experts", expertP: "Experts", expertD: "Experts", expertRebuttal: "Experts", rebuttal: "Experts", expertDiscovery: "Experts", daubert: "Experts", daubertFile: "Experts", daubertHeard: "Experts",
  msjFile: "Dispositive motions", msjHeard: "Dispositive motions", msjResolve: "Dispositive motions", pretrialMotions: "Trial preparation", pretrialMotionsFile: "Trial preparation", pretrialMotionsResolve: "Dispositive motions", motionsHeard: "Trial preparation", milFile: "Trial preparation", milResolve: "Trial preparation", milHeard: "Trial preparation",
  mediation: "Mediation & settlement", mediatorSelect: "Mediation & settlement", mediatorAgreed: "Mediation & settlement", pfsDefenseOpens: "Mediation & settlement", pfsPlaintiffOpens: "Mediation & settlement", pfsLast: "Mediation & settlement",
};
const phaseFor = (e: TimelineEntry): Phase => e.phase ?? DEADLINE_PHASE[e.id.replace(/_\d+$/, "")] ?? (e.category === "settlement" ? "Mediation & settlement" : e.category === "adr" ? "Mediation & settlement" : e.category === "experts" ? "Experts" : e.category === "discovery" ? "Disclosures & written discovery" : e.category === "motions" ? "Dispositive motions" : e.category === "pleadings" || e.category === "service" ? "Intake & pleadings" : "Trial preparation");

function Plan({ s, list, today, onPick, onDone }: ListProps) {
  const act = list.filter((e) => e.kind !== "info");
  return (
    <div>
      <p className="mb-5 text-[14.5px] text-ink-2 max-w-[72ch] leading-relaxed">The full case plan by stage: every court deadline and the work it takes to meet it. Court deadlines come from your CMO and the rules; tasks are worked back from them.</p>
      {PHASES.map((p) => {
        const items = act.filter((e) => phaseFor(e) === p);
        if (!items.length) return null;
        const done = items.filter((e) => s.isDone(e)).length;
        return (
          <Block key={p} title={p} action={<span className="ml-auto flex items-center gap-2 text-[13px] text-muted tabular"><span className="h-1.5 w-20 rounded-full bg-line-2 overflow-hidden inline-block"><span className="block h-full bg-brand" style={{ width: `${Math.round((done / items.length) * 100)}%` }} /></span>{done} of {items.length}</span>}>
            {items.map((e) => <Row key={e.id} e={e} s={s} today={today} onPick={onPick} onDone={onDone} />)}
          </Block>
        );
      })}
    </div>
  );
}

function AllDates({ s, list, today, onPick, onDone }: ListProps) {
  return (
    <div>
      <p className="mb-4 text-[14px] text-ink-2 max-w-[70ch]">Every date on this case, including court checkpoints like the CMO issuance deadline and the limitations date.</p>
      {byMonth(list).map((g) => <Block key={g.m} title={g.m}>{g.items.map((e) => <Row key={e.id} e={e} s={s} today={today} onPick={onPick} onDone={onDone} />)}</Block>)}
    </div>
  );
}

function Checks({ s, onPick }: { s: S; onPick: (id: string) => void }) {
  const ws = s.result.warnings;
  if (!ws.length) return <Empty title="No problems found" icon={<Check size={22} />}>Every computed date lands on an open court day, and the deadlines run in a sensible order.</Empty>;
  return (
    <ul className="space-y-3">
      {ws.map((w, i) => (
        <li key={i} className={`rounded-[18px] p-4 flex gap-3 ${w.level === "info" ? "bg-surface shadow-soft" : "bg-sun-soft"}`}>
          {w.level === "info" ? <Info size={19} className="text-sky shrink-0 mt-0.5" /> : <TriangleAlert size={19} className="text-sun-ink shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <p className="text-[14.5px] leading-relaxed">{w.message}</p>
            {w.itemId && s.result.entries.some((e) => e.id === w.itemId) && <button onClick={() => onPick(w.itemId!)} className="mt-1.5 text-[13.5px] font-semibold text-brand hover:underline underline-offset-2">Open this deadline</button>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Deadline / task detail ----------
function DeadlineSheet({ e, s, today, done, override, c, onClose, onDone, onOverride, onPick, onCheck }: {
  e: TimelineEntry; s: S; today: ISODate; done: boolean; override?: ISODate; c: SavedCase;
  onClose: () => void; onDone: (v: boolean) => void; onOverride: (d?: ISODate) => void; onPick: (id: string) => void; onCheck: (key: string, v: boolean) => void;
}) {
  const d = diffDays(today, e.date);
  const isTask = e.kind === "task";
  const parent = e.parentId ? s.result.entries.find((x) => x.id === e.parentId) : undefined;
  const children = s.result.entries.filter((x) => x.parentId === e.id);
  return (
    <Sheet open onClose={onClose}
      title={<div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {isTask ? <span className="rounded-full border border-line px-2 py-[1px] text-[12px] font-semibold text-ink-2">Task for {e.role}</span> : <span className="rounded-full bg-ink text-white px-2 py-[1px] text-[12px] font-semibold">Court deadline</span>}
          <SourceTag c={e.confidence} />
          {done && <span className="rounded-full bg-brand-soft text-brand-2 px-2 py-[1px] text-[12px] font-semibold">Done</span>}
        </div>
        <p className="display text-[23px] font-bold leading-tight">{e.label}</p>
        {e.phase && <p className="text-[13.5px] text-muted mt-1">{e.phase}</p>}
      </div>}
      footer={<>
        {!framed && <Button onClick={() => download(`${e.id}.ics`, toICS([{ name: c.inputs.name, caseNumber: c.inputs.caseNumber, entries: [e] }]), "text/calendar")}><CalendarPlus size={16} /> Add to calendar</Button>}
        {actionable(e) && <Button variant={done ? "secondary" : "primary"} onClick={() => onDone(!done)}><Check size={16} /> {done ? "Mark not done" : "Mark done"}</Button>}
      </>}>
      <p className="display text-[32px] font-bold tabular leading-tight"><span className={d >= 0 && d <= 14 && !done ? "hl" : ""}>{fmt(e.date, { weekday: true })}</span></p>
      <p className={`mt-1.5 text-[15px] font-semibold ${d < 0 && !done && actionable(e) ? "text-late" : "text-ink-2"}`}>{relDays(e.date, today)}</p>

      {parent && (
        <button onClick={() => onPick(parent.id)} className="mt-5 w-full text-left rounded-[14px] border border-line p-3 hover:border-[#c9d3cf]">
          <p className="text-[12.5px] font-semibold text-muted">Supports</p>
          <p className="font-semibold leading-snug">{parent.label}</p>
          <p className="text-[13px] text-ink-2 tabular">{fmt(parent.date, { weekday: true })}</p>
        </button>
      )}

      {e.checklist && e.checklist.length > 0 && (
        <>
          <h3 className="mt-7 text-[14px] font-semibold text-muted">Checklist</h3>
          <ul className="mt-2.5 space-y-1.5">
            {e.checklist.map((item, i) => {
              const key = `${e.id}:${i}`;
              const on = !!c.checks?.[key];
              return (
                <li key={key}>
                  <label className="flex items-start gap-2.5 text-[14.5px] cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 mt-[3px] accent-[var(--color-brand)]" checked={on} onChange={(ev) => onCheck(key, ev.target.checked)} />
                    <span className={on ? "text-muted line-through" : ""}>{item}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h3 className="mt-7 text-[14px] font-semibold text-muted">How this date is counted</h3>
      <ol className="mt-3 relative space-y-4 pl-7 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-line">
        {e.anchorDate && e.confidence !== "manual" && <Step dot="bg-surface border-brand" title={e.anchorLabel ?? "Trigger"} body={fmt(e.anchorDate, { weekday: true })} />}
        {e.confidence === "manual"
          ? <Step dot="bg-ink border-ink" title="Set by you" body="This date replaces the computed one." />
          : e.confidence === "order"
            ? <Step dot="bg-ink border-ink" title="Printed in your order" body="The order controls this date." />
            : <Step dot="bg-surface border-brand" title={e.basis} body={`Lands on ${fmt(e.raw, { weekday: true })}${e.rolled ? "" : ", an open court day"}`} />}
        {e.rolled && <Step dot="bg-sun border-ink" title={`Court closed: ${e.rollReason}`} body={`Rule 2.514(a) moves it ${e.date > e.raw ? "forward" : "back"} to ${fmt(e.date, { weekday: true })}.`} />}
      </ol>
      {e.confidence === "practice" && <p className="mt-4 text-[13.5px] text-ink-2 leading-relaxed">This lead time is a firm or carrier-guideline default, not a rule. Change it for every case in <a href="#/settings" className="font-semibold text-brand hover:underline">Firm settings</a>, or set a different date below for this case.</p>}
      {e.possibleClosure && <p className="mt-5 rounded-[14px] bg-sun-soft p-3.5 text-[14px] leading-relaxed">{fmt(e.date)} is {e.possibleClosure}. Some circuits close that day. Check your circuit's holiday order; if the court is closed, the deadline moves.</p>}

      {(e.citation || e.note || e.source?.url) && (
        <>
          <h3 className="mt-7 text-[14px] font-semibold text-muted">{isTask ? "Why and authority" : "Authority"}</h3>
          {e.citation && <p className="mt-2 text-[15px] leading-relaxed">{e.citation}</p>}
          {e.note && <p className="mt-2 text-[14.5px] text-ink-2 leading-relaxed">{e.note}</p>}
          {e.source?.url && <a href={e.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-brand hover:underline underline-offset-2">Open the source order <ExternalLink size={14} /></a>}
        </>
      )}

      {children.length > 0 && (
        <>
          <h3 className="mt-7 text-[14px] font-semibold text-muted">Tasks that lead up to this</h3>
          <ul className="mt-2 rounded-[14px] border border-line divide-y divide-line-2 overflow-hidden">
            {children.map((k) => (
              <li key={k.id}>
                <button onClick={() => onPick(k.id)} className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-canvas">
                  <span className={`text-[14px] leading-snug ${s.isDone(k) ? "text-muted line-through" : ""}`}>{k.label}</span>
                  <span className="text-[13px] text-ink-2 tabular shrink-0">{fmt(k.date).replace(/, \d{4}$/, "")}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-7 text-[14px] font-semibold text-muted">{isTask ? "Planning a different date?" : "Did the court set a different date?"}</h3>
      <div className="mt-2.5"><DateInput id={`ov-${e.id}`} quick={false} value={override} onChange={(v) => onOverride(v)} /></div>
      {override && <button onClick={() => onOverride(undefined)} className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand"><RotateCcw size={14} /> Go back to the computed date</button>}
      {!isTask && children.length > 0 && <p className="mt-2 text-[13px] text-muted">Changing this date moves every task that leads up to it.</p>}
    </Sheet>
  );
}

function Step({ dot, title, body }: { dot: string; title: string; body: string }) {
  return (
    <li className="relative">
      <span className={`absolute -left-7 top-1 h-4 w-4 rounded-full border-[2.5px] ${dot}`} />
      <p className="font-semibold text-[15px] leading-snug">{title}</p>
      <p className="text-[14px] text-ink-2 mt-0.5">{body}</p>
    </li>
  );
}
