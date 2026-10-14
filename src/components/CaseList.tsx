import { FolderOpen, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { phaseOf, summarize } from "../caseUtils";
import { circuitForCounty, ordinal } from "../engine/circuits";
import { diffDays, fmt, todayISO } from "../engine/dates";
import { useCases } from "../store";
import { Button, DateChip, Empty, relDays } from "./ui";

type Filter = "all" | "late" | "trial90";

export function CaseList({ go }: { go: (r: string) => void }) {
  const { cases } = useCases();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayISO();
  const sums = useMemo(() => cases.map((c) => summarize(c, today)), [cases, today]);
  const rows = sums
    .filter((s) => !q || [s.c.inputs.name, s.c.inputs.caseNumber, s.c.claimNumber, s.c.client, s.c.inputs.county].join(" ").toLowerCase().includes(q.toLowerCase()))
    .filter((s) => filter === "all" || (filter === "late" ? s.overdue.length > 0 : s.daysToTrial !== undefined && s.daysToTrial >= 0 && s.daysToTrial <= 90))
    .sort((a, b) => (a.next?.date ?? "9999") < (b.next?.date ?? "9999") ? -1 : 1);
  const counts = { all: sums.length, late: sums.filter((s) => s.overdue.length).length, trial90: sums.filter((s) => s.daysToTrial !== undefined && s.daysToTrial >= 0 && s.daysToTrial <= 90).length };

  if (!cases.length) {
    return <Empty title="No cases yet" icon={<FolderOpen size={22} />} action={<Button variant="primary" onClick={() => go("/new")}><Plus size={17} /> Build a timeline</Button>}>Create a case from the county and filing date, or import an order the court already entered. Cases are saved in this browser.</Empty>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-[34px] sm:text-[44px] leading-none font-bold">Cases</h1>
        <div className="relative w-full sm:w-[320px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input aria-label="Search cases" className="input !pl-10" placeholder="Name, case or claim number" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist">
        {([["all", "All cases"], ["late", "Past due"], ["trial90", "Trial within 90 days"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`h-9 rounded-full px-3.5 text-[14px] font-semibold border-[1.5px] ${filter === k ? "bg-ink text-white border-ink" : "bg-surface text-ink-2 border-line hover:border-[#c9d3cf]"}`}>
            {l} <span className={filter === k ? "text-white/70" : "text-muted"}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {rows.map((s) => {
          const cir = circuitForCounty(s.c.inputs.county);
          const d = s.next ? diffDays(today, s.next.date) : undefined;
          return (
            <li key={s.c.id}>
              <a href={`#/case/${s.c.id}`} className="flex flex-col h-full rounded-[20px] bg-surface shadow-soft p-5 hover:shadow-lift transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="display text-[19px] font-bold leading-snug">{s.c.inputs.name}</p>
                    <p className="text-[13.5px] text-muted mt-0.5 tabular">{[`${s.c.inputs.county}${cir ? `, ${ordinal(cir.id)} Cir.` : ""}`, s.c.inputs.caseNumber, s.c.claimNumber && `Claim ${s.c.claimNumber}`].filter(Boolean).join("  /  ")}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-soft text-brand-2 px-2.5 py-1 text-[12px] font-semibold">{phaseOf(s, today)}</span>
                </div>
                <div className="mt-4 flex items-center gap-3 flex-1">
                  {s.next ? <>
                    <DateChip date={s.next.date} tone={d !== undefined && d <= 14 ? "soon" : "default"} />
                    <div className="min-w-0">
                      <p className="text-[13px] text-muted">Next deadline, {relDays(s.next.date, today).toLowerCase()}</p>
                      <p className="font-semibold leading-snug">{s.next.label}</p>
                    </div>
                  </> : <p className="text-[14px] text-muted">No open deadlines.</p>}
                </div>
                <div className="mt-4">
                  <div className="h-1.5 rounded-full bg-line-2 overflow-hidden" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(s.progress * 100)}%` }} /></div>
                  <div className="mt-2 flex justify-between text-[12.5px] text-ink-2">
                    <span>{s.overdue.length ? <b className="text-late">{s.overdue.length} past due</b> : `${s.open.length} open`}</span>
                    <span className="tabular">{s.result.anchors.trial ? `${s.result.anchors.trial.estimated ? "Projected trial" : "Trial"} ${fmt(s.result.anchors.trial.date)}` : ""}</span>
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="mt-6 text-muted">No cases match. Clear the search or pick another filter.</p>}
    </div>
  );
}
