import { Plus, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { circuitForCounty, suggestTrack } from "../engine/circuits";
import { fmt, isValidISO } from "../engine/dates";
import { CASE_TYPES, type CaseInputs, type Track } from "../engine/types";
import type { SavedCase } from "../store";
import { Button, CountyPicker, DateInput, Field, Segmented, Sheet } from "./ui";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-6 first:pt-1">
      <h3 className="display text-[18px] font-bold mb-4">{title}</h3>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function EditCase({ open, onClose, c, onSave }: { open: boolean; onClose: () => void; c: SavedCase; onSave: (c: SavedCase) => void }) {
  const [d, setD] = useState<SavedCase>(c);
  const [closure, setClosure] = useState({ date: "", name: "" });
  const i = d.inputs;
  const circuit = circuitForCounty(i.county);
  const suggestion = circuit ? suggestTrack(circuit, i.caseType, i.court, i.jury) : undefined;
  const back = circuit?.schedules[i.court]?.[i.track]?.backAnchor;
  const set = (p: Partial<CaseInputs>) => setD({ ...d, inputs: { ...d.inputs, ...p } });

  return (
    <Sheet open={open} onClose={onClose} wide
      title={<><p className="display text-[22px] font-bold">Case details</p><p className="text-[13.5px] text-muted">Changes recalculate every deadline.</p></>}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { onSave(d); onClose(); }}>Save changes</Button></>}>
      <div className="divide-y divide-line">
        <Group title="Trial setting">
          <p className="text-[14px] text-ink-2 -mt-2 leading-relaxed">
            {back === "calendarCall" ? "This circuit counts most deadlines back from Calendar Call. Add it from the Uniform Trial Order." : back === "pretrial" ? "This circuit counts most deadlines back from the pretrial conference. Add it once the trial order sets it." : "Add these once the trial order is entered. Until then the projected trial date is used."}
          </p>
          {(back === "calendarCall" || i.calendarCallDate) && <Field label="Calendar Call" htmlFor="e-cc"><DateInput id="e-cc" quick={false} value={i.calendarCallDate} onChange={(v) => set({ calendarCallDate: v })} /></Field>}
          {(back === "pretrial" || i.pretrialDate) && <Field label="Pretrial conference" htmlFor="e-ptc"><DateInput id="e-ptc" quick={false} value={i.pretrialDate} onChange={(v) => set({ pretrialDate: v })} /></Field>}
          <Field label="Trial period begins" htmlFor="e-trial"><DateInput id="e-trial" quick={false} value={i.trialDate} onChange={(v) => set({ trialDate: v })} /></Field>
        </Group>

        <Group title="Key dates">
          <Field label="Complaint filed" htmlFor="e-filing"><DateInput id="e-filing" quick={false} value={i.filingDate} onChange={(v) => set({ filingDate: v })} /></Field>
          <Field label="Our client served" htmlFor="e-svc"><DateInput id="e-svc" quick={false} value={i.serviceClientDate} onChange={(v) => set({ serviceClientDate: v })} /></Field>
          <Field label="File assigned to us" optional htmlFor="e-assigned" hint="Starts intake and carrier-reporting tasks."><DateInput id="e-assigned" quick={false} value={i.assignedDate} onChange={(v) => set({ assignedDate: v })} /></Field>
          <Field label="Last defendant served" htmlFor="e-last"><DateInput id="e-last" quick={false} value={i.serviceLastDate} onChange={(v) => set({ serviceLastDate: v })} /></Field>
          <Field label="Date of loss" optional htmlFor="e-dol"><DateInput id="e-dol" quick={false} value={i.dateOfLoss} onChange={(v) => set({ dateOfLoss: v })} /></Field>
        </Group>

        <Group title="Court and case">
          <Field label="County" htmlFor="e-county"><CountyPicker id="e-county" value={i.county} onChange={(county) => set({ county })} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Court"><Segmented label="Court" value={i.court} onChange={(court) => set({ court })} options={[{ v: "circuit", label: "Circuit" }, { v: "county", label: "County" }]} /></Field>
            <Field label="Trial"><Segmented label="Trial" value={i.jury ? "jury" : "bench"} onChange={(v) => set({ jury: v === "jury" })} options={[{ v: "jury", label: "Jury" }, { v: "bench", label: "Non-jury" }]} /></Field>
          </div>
          <Field label="Case type" htmlFor="e-type">
            <select id="e-type" className="input" value={i.caseType} onChange={(e) => set({ caseType: e.target.value as CaseInputs["caseType"] })}>
              {CASE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Track" hint={suggestion && `Suggested for this case: ${suggestion.track}.`}>
            <Segmented<Track> label="Track" value={i.track} onChange={(track) => set({ track })} options={[{ v: "streamlined", label: "Streamlined" }, { v: "general", label: "General" }, { v: "complex", label: "Complex" }]} />
          </Field>
        </Group>

        <Group title="Service and closures">
          <label className="flex items-start gap-2.5 text-[14.5px]">
            <input type="checkbox" className="h-4 w-4 mt-0.5 accent-[var(--color-brand)]" checked={!!i.discoveryWithComplaint} onChange={(e) => set({ discoveryWithComplaint: e.target.checked })} />
            <span>Discovery was served with the complaint<span className="block text-[13px] text-muted">Responses due 45 days after service of process.</span></span>
          </label>
          <label className="flex items-start gap-2.5 text-[14.5px]">
            <input type="checkbox" className="h-4 w-4 mt-0.5 accent-[var(--color-brand)]" checked={!!i.mailService} onChange={(e) => set({ mailService: e.target.checked })} />
            <span>Papers in this case are served by mail<span className="block text-[13px] text-muted">Adds 5 days to response periods (Rule 2.514(b)). E-mail and e-portal service add none.</span></span>
          </label>
          <Field label="Extra court closures" hint="Hurricane or emergency closures ordered by the chief judge. Deadlines on those days roll to the next open day.">
            {(i.extraClosures ?? []).length > 0 && (
              <ul className="space-y-1.5 mb-2.5">
                {(i.extraClosures ?? []).map((cl, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-[12px] bg-line-2 px-3 py-2 text-[14px]">
                    <span><span className="tabular font-semibold">{fmt(cl.date)}</span> <span className="text-ink-2">{cl.name}</span></span>
                    <button aria-label="Remove closure" className="p-1 rounded-full hover:bg-surface" onClick={() => set({ extraClosures: (i.extraClosures ?? []).filter((_, j) => j !== idx) })}><X size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <input type="date" aria-label="Closure date" className="input tabular !w-[170px]" value={closure.date} onChange={(e) => setClosure({ ...closure, date: e.target.value })} />
              <input aria-label="Closure reason" className="input flex-1 min-w-[140px]" placeholder="Hurricane Milton closure" value={closure.name} onChange={(e) => setClosure({ ...closure, name: e.target.value })} />
              <Button disabled={!isValidISO(closure.date)} onClick={() => { set({ extraClosures: [...(i.extraClosures ?? []), { date: closure.date, name: closure.name || "Court closure" }] }); setClosure({ date: "", name: "" }); }}><Plus size={16} /> Add</Button>
            </div>
          </Field>
        </Group>

        <Group title="File details">
          <Field label="Case name" htmlFor="e-name"><input id="e-name" className="input" value={i.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Case number" htmlFor="e-cno"><input id="e-cno" className="input tabular" value={i.caseNumber ?? ""} onChange={(e) => set({ caseNumber: e.target.value })} /></Field>
            <Field label="Claim number" htmlFor="e-claim"><input id="e-claim" className="input tabular" value={d.claimNumber ?? ""} onChange={(e) => setD({ ...d, claimNumber: e.target.value })} /></Field>
          </div>
          <Field label="Client or insured" htmlFor="e-client"><input id="e-client" className="input" value={d.client ?? ""} onChange={(e) => setD({ ...d, client: e.target.value })} /></Field>
        </Group>
      </div>
    </Sheet>
  );
}
