import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ALL_COUNTIES, circuitForCounty, ordinal, suggestTrack } from "../engine/circuits";
import { fmt, isValidISO } from "../engine/dates";
import { CASE_TYPES, type CaseInputs, type Track } from "../engine/types";
import { Label } from "./ui";

function Seg<T extends string>({ value, options, onChange, name }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="inline-flex rounded-lg border border-rule bg-white p-0.5 w-full">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={`flex-1 rounded-md px-2.5 py-1.5 text-[13.5px] font-semibold ${value === o.v ? "bg-ink text-white" : "text-ink-2 hover:bg-rule-2"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DateField({ id, label, hint, value, onChange, required }: { id: string; label: string; hint?: string; value?: string; onChange: (v: string | undefined) => void; required?: boolean }) {
  const bad = value && !isValidISO(value);
  return (
    <div>
      <Label htmlFor={id} hint={hint}>{label}{required && <span className="text-late"> *</span>}</Label>
      <input id={id} type="date" className="field tabular" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} aria-invalid={!!bad} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-rule pt-4 mt-5 first:mt-0 first:border-0 first:pt-0">
      <legend className="text-[15px] font-bold text-ink mb-3 float-left w-full">{title}</legend>
      <div className="clear-both space-y-3.5">{children}</div>
    </fieldset>
  );
}

export function CaseForm({ inputs, onChange, meta, onMeta }: {
  inputs: CaseInputs;
  onChange: (i: CaseInputs) => void;
  meta: { claimNumber?: string; client?: string };
  onMeta: (m: { claimNumber?: string; client?: string }) => void;
}) {
  const set = <K extends keyof CaseInputs>(k: K, v: CaseInputs[K]) => onChange({ ...inputs, [k]: v });
  const circuit = circuitForCounty(inputs.county);
  const suggestion = circuit ? suggestTrack(circuit, inputs.caseType, inputs.court, inputs.jury) : undefined;
  const schedule = circuit?.schedules[inputs.court]?.[inputs.track];
  const back = schedule?.backAnchor;
  const [closure, setClosure] = useState({ date: "", name: "" });

  const applyCounty = (county: string) => {
    const c = circuitForCounty(county);
    const next = { ...inputs, county };
    if (c) next.track = suggestTrack(c, next.caseType, next.court, next.jury).track;
    onChange(next);
  };
  const applyType = (caseType: CaseInputs["caseType"]) => {
    const next = { ...inputs, caseType, court: caseType === "pip" ? "county" as const : inputs.court };
    if (circuit) next.track = suggestTrack(circuit, caseType, next.court, next.jury).track;
    onChange(next);
  };

  const circuitGroups = Array.from(new Set(ALL_COUNTIES.map((c) => c.circuit))).sort((a, b) => a - b);

  return (
    <div>
      <Section title="Court">
        <div>
          <Label htmlFor="county" hint={circuit ? `${ordinal(circuit.id)} Judicial Circuit` : "Sets the circuit, its CMO form and its court holidays."}>County</Label>
          <select id="county" className="field" value={inputs.county} onChange={(e) => applyCounty(e.target.value)}>
            <option value="">Choose a county…</option>
            {circuitGroups.map((g) => (
              <optgroup key={g} label={`${ordinal(g)} Circuit`}>
                {ALL_COUNTIES.filter((c) => c.circuit === g).map((c) => <option key={c.county} value={c.county}>{c.county}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Court</Label>
            <Seg name="Court" value={inputs.court} onChange={(v) => {
              const next = { ...inputs, court: v };
              if (circuit) next.track = suggestTrack(circuit, next.caseType, v, next.jury).track;
              onChange(next);
            }} options={[{ v: "circuit", label: "Circuit" }, { v: "county", label: "County" }]} />
          </div>
          <div>
            <Label>Trial</Label>
            <Seg name="Trial" value={inputs.jury ? "jury" : "bench"} onChange={(v) => {
              const next = { ...inputs, jury: v === "jury" };
              if (circuit) next.track = suggestTrack(circuit, next.caseType, next.court, next.jury).track;
              onChange(next);
            }} options={[{ v: "jury", label: "Jury" }, { v: "bench", label: "Non-jury" }]} />
          </div>
        </div>
        <div>
          <Label htmlFor="ctype">Case type</Label>
          <select id="ctype" className="field" value={inputs.caseType} onChange={(e) => applyType(e.target.value as CaseInputs["caseType"])}>
            {CASE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label} — {t.hint}</option>)}
          </select>
        </div>
        <div>
          <Label hint={suggestion ? <>Suggested: <b className="text-ink-2">{suggestion.track}</b>. {suggestion.why}</> : undefined}>Case management track</Label>
          <Seg<Track> name="Track" value={inputs.track} onChange={(v) => set("track", v)}
            options={[{ v: "streamlined", label: "Streamlined" }, { v: "general", label: "General" }, { v: "complex", label: "Complex" }]} />
        </div>
      </Section>

      <Section title="Key dates">
        <DateField id="filing" label="Complaint filed" required value={inputs.filingDate} onChange={(v) => set("filingDate", v)} hint="The action commences on filing (Rule 1.050)." />
        <DateField id="svcClient" label="Our client served" value={inputs.serviceClientDate} onChange={(v) => set("serviceClientDate", v)} hint="Starts the answer, initial disclosures and PFS clocks." />
        <DateField id="svcLast" label="Last defendant served" value={inputs.serviceLastDate} onChange={(v) => set("serviceLastDate", v)} hint="Drives the Rule 2.250 time standard and CMO issuance deadline." />
        <DateField id="dol" label="Date of loss" value={inputs.dateOfLoss} onChange={(v) => set("dateOfLoss", v)} hint="Optional. Runs the post-HB 837 limitations check for negligence claims." />
      </Section>

      <Section title="Trial setting">
        <p className="text-[13px] text-ink-2 leading-relaxed -mt-1">
          {back === "calendarCall" && "This circuit counts most deadlines back from Calendar Call. Enter it from the Uniform Trial Order to lock them in."}
          {back === "pretrial" && "This circuit counts most deadlines back from the pretrial conference. Enter it once the trial order sets it."}
          {(!back || back === "trial") && "Add these once the trial order is entered. Until then the projected trial date is used."}
        </p>
        {back === "calendarCall" && <DateField id="cc" label="Calendar Call" value={inputs.calendarCallDate} onChange={(v) => set("calendarCallDate", v)} />}
        {back === "pretrial" && <DateField id="ptc" label="Pretrial conference" value={inputs.pretrialDate} onChange={(v) => set("pretrialDate", v)} />}
        <DateField id="trial" label="Trial period begins" value={inputs.trialDate} onChange={(v) => set("trialDate", v)} />
        {back !== "calendarCall" && inputs.calendarCallDate && <DateField id="cc2" label="Calendar Call" value={inputs.calendarCallDate} onChange={(v) => set("calendarCallDate", v)} />}
      </Section>

      <Section title="Service and closures">
        <label className="flex gap-2.5 items-start text-[14px] text-ink">
          <input type="checkbox" className="mt-1 accent-ink" checked={!!inputs.discoveryWithComplaint} onChange={(e) => set("discoveryWithComplaint", e.target.checked)} />
          <span>Discovery was served with the complaint <span className="block text-[12.5px] text-muted">Responses due 45 days after service of process.</span></span>
        </label>
        <label className="flex gap-2.5 items-start text-[14px] text-ink">
          <input type="checkbox" className="mt-1 accent-ink" checked={!!inputs.mailService} onChange={(e) => set("mailService", e.target.checked)} />
          <span>Papers in this case are served by mail <span className="block text-[12.5px] text-muted">Adds 5 days to response periods under Rule 2.514(b). E-mail and e-portal service add none.</span></span>
        </label>
        <div>
          <Label hint="Hurricane or emergency closures ordered by the chief judge. Deadlines falling on them roll to the next open day.">Extra court closures</Label>
          <ul className="space-y-1 mb-2">
            {(inputs.extraClosures ?? []).map((c, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-rule-2 px-2.5 py-1.5 text-[13px]">
                <span className="tabular">{fmt(c.date)} <span className="text-ink-2">{c.name}</span></span>
                <button aria-label="Remove closure" className="p-0.5 hover:text-late" onClick={() => set("extraClosures", (inputs.extraClosures ?? []).filter((_, j) => j !== i))}><X size={15} /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input type="date" aria-label="Closure date" className="field tabular !w-[150px]" value={closure.date} onChange={(e) => setClosure({ ...closure, date: e.target.value })} />
            <input aria-label="Closure reason" className="field" placeholder="Reason" value={closure.name} onChange={(e) => setClosure({ ...closure, name: e.target.value })} />
            <button aria-label="Add closure" disabled={!isValidISO(closure.date)} className="rounded-lg border border-rule bg-white px-2.5 disabled:opacity-40"
              onClick={() => { set("extraClosures", [...(inputs.extraClosures ?? []), { date: closure.date, name: closure.name || "Court closure" }]); setClosure({ date: "", name: "" }); }}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      </Section>

      <Section title="File details">
        <div>
          <Label htmlFor="cname">Case name</Label>
          <input id="cname" className="field" placeholder="Smith v. Coastal Mutual" value={inputs.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cno">Case number</Label>
            <input id="cno" className="field tabular" placeholder="2026-CA-001234" value={inputs.caseNumber ?? ""} onChange={(e) => set("caseNumber", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="claim">Claim number</Label>
            <input id="claim" className="field tabular" value={meta.claimNumber ?? ""} onChange={(e) => onMeta({ ...meta, claimNumber: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="client">Client / insured</Label>
          <input id="client" className="field" value={meta.client ?? ""} onChange={(e) => onMeta({ ...meta, client: e.target.value })} />
        </div>
      </Section>
    </div>
  );
}
