import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { circuitForCounty, ordinal } from "../engine/circuits";
import { fmt, todayISO } from "../engine/dates";
import { generateTimeline } from "../engine/generate";
import { useCases } from "../store";
import { Button, Empty, PageHeader, relDays } from "./ui";

export function CaseList({ go }: { go: (r: string) => void }) {
  const { cases } = useCases();
  const [q, setQ] = useState("");
  const today = todayISO();
  const rows = useMemo(() => cases.map((c) => {
    const r = generateTimeline(c.inputs, { overrides: c.overrides, orderItems: c.orderItems });
    const next = r.entries.find((e) => e.kind !== "info" && !(c.done[e.id] ?? e.satisfied) && e.date >= today);
    const overdue = r.entries.filter((e) => e.kind === "deadline" && !(c.done[e.id] ?? e.satisfied) && e.date < today).length;
    return { c, next, overdue, trial: r.anchors.trial };
  }).filter(({ c }) => !q || [c.inputs.name, c.inputs.caseNumber, c.claimNumber, c.client, c.inputs.county].join(" ").toLowerCase().includes(q.toLowerCase())), [cases, q, today]);

  return (
    <div className="max-w-[1080px]">
      <PageHeader title="Cases" actions={<Button variant="primary" onClick={() => go("/case/new")}><Plus size={16} /> New case timeline</Button>} />
      {cases.length === 0 ? (
        <Empty title="No cases yet" action={<Button variant="primary" onClick={() => go("/case/new")}><Plus size={16} /> New case timeline</Button>}>Cases you save are stored in this browser.</Empty>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Search cases" className="field !pl-9" placeholder="Search by name, case or claim number" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="rounded-xl border border-rule bg-white overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="text-left text-[12.5px] text-muted bg-rule-2/60">
                <tr><th className="px-4 py-2 font-semibold">Case</th><th className="px-3 py-2 font-semibold">Court</th><th className="px-3 py-2 font-semibold">Next deadline</th><th className="px-3 py-2 font-semibold">Trial</th></tr>
              </thead>
              <tbody className="divide-y divide-rule-2">
                {rows.map(({ c, next, overdue, trial }) => {
                  const cir = circuitForCounty(c.inputs.county);
                  return (
                    <tr key={c.id} className="hover:bg-paper cursor-pointer" onClick={() => go(`/case/${c.id}`)}>
                      <td className="px-4 py-3">
                        <a href={`#/case/${c.id}`} className="font-semibold text-ink hover:underline">{c.inputs.name}</a>
                        <p className="text-[12.5px] text-muted tabular">{[c.inputs.caseNumber, c.claimNumber && `Claim ${c.claimNumber}`].filter(Boolean).join(", ")}</p>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{c.inputs.county}{cir && <span className="text-muted">, {ordinal(cir.id)}</span>}<p className="text-[12.5px] text-muted capitalize">{c.inputs.track}</p></td>
                      <td className="px-3 py-3">
                        {next ? <><p className="text-ink">{next.label}</p><p className="text-[12.5px] text-muted tabular">{fmt(next.date)}, {relDays(next.date, today).toLowerCase()}</p></> : <span className="text-muted">None</span>}
                        {overdue > 0 && <p className="text-[12.5px] font-semibold text-late">{overdue} past due</p>}
                      </td>
                      <td className="px-3 py-3 tabular text-ink-2 whitespace-nowrap">{trial ? fmt(trial.date) : "—"}{trial?.estimated && <p className="text-[12.5px] text-muted">projected</p>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
