import { ArrowLeft, ArrowRight, Building2, Car, CircleDollarSign, FileSignature, Home as HomeIcon, ShieldAlert, ShieldCheck, Stethoscope, TriangleAlert, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { circuitForCounty, ordinal, suggestTrack } from "../engine/circuits";
import { diffDays, fmt, todayISO } from "../engine/dates";
import { generateTimeline } from "../engine/generate";
import { CASE_TYPES, type CaseInputs, type CaseType, type Track } from "../engine/types";
import { blankCase, type SavedCase, useCases } from "../store";
import { Button, CountyPicker, DateChip, DateInput, Field, Segmented, SourceTag, toast } from "./ui";

const TYPE_ICON: Record<CaseType, ReactNode> = {
  auto: <Car size={20} />, premises: <TriangleAlert size={20} />, negligentSecurity: <ShieldAlert size={20} />,
  otherNegligence: <Building2 size={20} />, propertyInsurance: <HomeIcon size={20} />, umUim: <ShieldCheck size={20} />,
  pip: <Stethoscope size={20} />, badFaith: <CircleDollarSign size={20} />, contract: <FileSignature size={20} />,
};

const STEPS = ["Court", "Case type", "Key dates", "File details"];

export function NewCase({ go }: { go: (r: string) => void }) {
  const { upsert } = useCases();
  const [c, setC] = useState<SavedCase>(blankCase);
  const [step, setStep] = useState(0);
  const [sameService, setSameService] = useState(true);
  const today = todayISO();
  const i = c.inputs;
  const circuit = circuitForCounty(i.county);

  const set = (patch: Partial<CaseInputs>) => {
    setC((prev) => {
      const next = { ...prev.inputs, ...patch };
      if (sameService && "serviceClientDate" in patch) next.serviceLastDate = patch.serviceClientDate;
      const cir = circuitForCounty(next.county);
      if (cir && ("county" in patch || "caseType" in patch || "court" in patch || "jury" in patch)) next.track = suggestTrack(cir, next.caseType, next.court, next.jury).track;
      return { ...prev, inputs: next };
    });
  };

  const valid = [!!circuit, true, !!i.filingDate, true][step];
  const result = useMemo(() => generateTimeline(i), [i]);
  const create = () => {
    const name = i.name.trim() || `${i.county} ${CASE_TYPES.find((t) => t.id === i.caseType)?.label.toLowerCase()} case`;
    const saved = { ...c, inputs: { ...i, name } };
    upsert(saved);
    toast("Timeline created");
    go(`/case/${saved.id}`);
  };
  const next = () => (step < 3 ? setStep(step + 1) : create());

  const suggestion = circuit ? suggestTrack(circuit, i.caseType, i.court, i.jury) : undefined;
  const schedule = circuit?.schedules[i.court]?.[i.track];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
      <div className="px-4 sm:px-10 lg:px-16 py-6 sm:py-8 flex flex-col">
        <div className="flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2.5"><img src="./favicon.svg" alt="" className="h-8 w-8" /><span className="display text-[18px] font-bold">Docket Clock</span></a>
          <a href="#/" aria-label="Cancel" className="h-10 w-10 grid place-items-center rounded-full hover:bg-line-2"><X size={20} /></a>
        </div>

        <ol className="mt-8 sm:mt-12 flex gap-2" aria-label="Progress">
          {STEPS.map((s, idx) => (
            <li key={s} className="flex-1">
              <button disabled={idx > step && !valid} onClick={() => idx <= step && setStep(idx)} className="w-full text-left group" aria-current={idx === step ? "step" : undefined}>
                <span className={`block h-1.5 rounded-full ${idx <= step ? "bg-brand" : "bg-line"}`} />
                <span className={`hidden sm:block mt-2 text-[13px] font-semibold ${idx === step ? "text-ink" : "text-muted"}`}>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <form className="mt-8 sm:mt-12 max-w-[600px] w-full flex-1" onSubmit={(e) => { e.preventDefault(); if (valid) next(); }}>
          {step === 0 && (
            <Step title="Where is the case filed?" sub="The county sets the circuit, its case management order form, and the court holidays used to count every deadline.">
              <Field label="County" htmlFor="county"><CountyPicker id="county" value={i.county} onChange={(county) => set({ county })} /></Field>
              <Field label="Court"><Segmented label="Court" value={i.court} onChange={(court) => set({ court })} options={[{ v: "circuit", label: "Circuit court" }, { v: "county", label: "County court" }]} /></Field>
              {circuit && (
                <div className="rounded-[18px] bg-brand-soft p-4 text-[14.5px] leading-relaxed anim-fade">
                  <p className="font-semibold text-brand-2">{ordinal(circuit.id)} Judicial Circuit</p>
                  <p className="text-ink-2 mt-1">{circuit.howIssued[i.court] ?? "The court issues a case management order under Rule 1.200 within 120 days of filing."}</p>
                  <p className="text-ink-2 mt-2">
                    {Object.keys(circuit.schedules[i.court] ?? {}).length
                      ? "We have this circuit's published form, so most deadlines are computed exactly."
                      : "This circuit sets dates order by order. We'll compute the rule-based deadlines now, and you can import the entered order later for the rest."}
                  </p>
                </div>
              )}
            </Step>
          )}

          {step === 1 && (
            <Step title="What kind of case is it?" sub="This picks the presumptive case management track. You can change it if the court assigned a different one.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Case type">
                {CASE_TYPES.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={i.caseType === t.id} onClick={() => set({ caseType: t.id, ...(t.id === "pip" ? { court: "county" as const } : {}) })}
                    className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 rounded-[16px] border-[1.5px] p-3.5 text-left transition-colors ${i.caseType === t.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-[#c9d3cf]"}`}>
                    <span className={i.caseType === t.id ? "text-brand" : "text-ink-2"}>{TYPE_ICON[t.id]}</span>
                    <span><span className="block font-semibold text-[14.5px] leading-tight">{t.label}</span><span className="block text-[12.5px] text-muted mt-0.5 leading-snug">{t.hint}</span></span>
                  </button>
                ))}
              </div>
              <Field label="Trial"><Segmented label="Trial" value={i.jury ? "jury" : "bench"} onChange={(v) => set({ jury: v === "jury" })} options={[{ v: "jury", label: "Jury" }, { v: "bench", label: "Non-jury" }]} /></Field>
              <Field label="Case management track" hint={suggestion && <><b className="text-ink-2 font-semibold">Suggested: {suggestion.track}.</b> {suggestion.why}</>}>
                <Segmented<Track> label="Track" value={i.track} onChange={(track) => set({ track })} options={[{ v: "streamlined", label: "Streamlined" }, { v: "general", label: "General" }, { v: "complex", label: "Complex" }]} />
              </Field>
            </Step>
          )}

          {step === 2 && (
            <Step title="When did things happen?" sub="Only the filing date is required. Each date you add unlocks more deadlines.">
              <Field label="Complaint filed" htmlFor="filing" hint="The action commences on filing (Rule 1.050)."><DateInput id="filing" value={i.filingDate} max={today} onChange={(filingDate) => set({ filingDate })} /></Field>
              <Field label="Our client served" optional htmlFor="svc" hint="Starts the answer, initial disclosure and proposal-for-settlement clocks."><DateInput id="svc" value={i.serviceClientDate} max={today} onChange={(serviceClientDate) => set({ serviceClientDate })} /></Field>
              <Field label="File assigned to us" optional htmlFor="assigned" hint="Starts the intake and carrier-reporting tasks. Leave blank to use the service date."><DateInput id="assigned" value={i.assignedDate} max={today} onChange={(assignedDate) => set({ assignedDate })} /></Field>
              <label className="flex items-center gap-2.5 text-[14.5px] -mt-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={sameService} onChange={(e) => { setSameService(e.target.checked); if (e.target.checked) set({ serviceLastDate: i.serviceClientDate }); }} />
                Our client was the last defendant served
              </label>
              {!sameService && <Field label="Last defendant served" optional htmlFor="svcLast" hint="Drives the Rule 2.250 time standard and the CMO issuance deadline."><DateInput id="svcLast" value={i.serviceLastDate} max={today} onChange={(serviceLastDate) => set({ serviceLastDate })} /></Field>}
              <Field label="Date of loss" optional htmlFor="dol" hint="Runs the 2-year negligence limitations check that applies after HB 837."><DateInput id="dol" quick={false} value={i.dateOfLoss} max={today} onChange={(dateOfLoss) => set({ dateOfLoss })} /></Field>
              <label className="flex items-start gap-2.5 text-[14.5px]">
                <input type="checkbox" className="h-4 w-4 mt-0.5 accent-[var(--color-brand)]" checked={!!i.discoveryWithComplaint} onChange={(e) => set({ discoveryWithComplaint: e.target.checked })} />
                <span>Discovery was served with the complaint<span className="block text-[13px] text-muted">Responses are due 45 days after service of process.</span></span>
              </label>
            </Step>
          )}

          {step === 3 && (
            <Step title="Name the file" sub="So you can find it later. All of these are optional.">
              <Field label="Case name" htmlFor="name"><input id="name" autoFocus className="input" placeholder="Smith v. Coastal Mutual" value={i.name} onChange={(e) => set({ name: e.target.value })} /></Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Case number" htmlFor="cno"><input id="cno" className="input tabular" placeholder="2026-CA-001234" value={i.caseNumber ?? ""} onChange={(e) => set({ caseNumber: e.target.value })} /></Field>
                <Field label="Claim number" htmlFor="claim"><input id="claim" className="input tabular" value={c.claimNumber ?? ""} onChange={(e) => setC({ ...c, claimNumber: e.target.value })} /></Field>
              </div>
              <Field label="Client or insured" htmlFor="client"><input id="client" className="input" value={c.client ?? ""} onChange={(e) => setC({ ...c, client: e.target.value })} /></Field>
            </Step>
          )}

          <div className="mt-10 flex items-center gap-3">
            {step > 0 && <Button size="lg" variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={18} /> Back</Button>}
            <Button size="lg" type="submit" variant="primary" disabled={!valid}>
              {step < 3 ? <>Continue <ArrowRight size={18} /></> : "Create timeline"}
            </Button>
            {step === 2 && !i.filingDate && <span className="text-[13.5px] text-muted">Add the filing date to continue.</span>}
          </div>
        </form>
      </div>

      <Preview result={result} inputs={i} schedule={!!schedule} today={today} />
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="anim-fade">
      <h1 className="display text-[30px] sm:text-[40px] leading-[1.05] font-bold">{title}</h1>
      <p className="mt-3 text-[16px] text-ink-2 leading-relaxed max-w-[56ch]">{sub}</p>
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}

function Preview({ result, inputs, schedule, today }: { result: ReturnType<typeof generateTimeline>; inputs: CaseInputs; schedule: boolean; today: string }) {
  const rows = result.entries.filter((e) => e.kind !== "info" && !e.satisfied && e.date >= today).slice(0, 6);
  const count = result.entries.filter((e) => e.kind !== "info").length;
  const trial = result.anchors.trial;
  return (
    <aside className="bg-ink text-white px-6 sm:px-10 py-8 lg:py-12 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
      <p className="text-[13.5px] font-semibold text-white/60">Live preview</p>
      {!inputs.county || !inputs.filingDate ? (
        <div className="mt-4">
          <p className="display text-[26px] font-bold leading-tight">Your timeline builds here as you answer.</p>
          <p className="mt-3 text-[14.5px] text-white/70 leading-relaxed max-w-[40ch]">Pick a county and the filing date and you'll see the first deadlines, the projected trial month, and where each date comes from.</p>
        </div>
      ) : (
        <div className="mt-4 anim-fade">
          <p className="display text-[30px] font-bold leading-tight tabular">{count} deadlines</p>
          {trial && <p className="text-[14.5px] text-white/70 mt-1">{trial.estimated ? "Projected trial" : "Trial"}: {fmt(trial.date)}, {Math.max(0, diffDays(today, trial.date))} days out</p>}
          <p className="text-[13px] text-white/55 mt-1">{schedule ? "Using the circuit's published CMO form." : "Rule-based deadlines. Import the entered order to add the rest."}</p>
          <ul className="mt-6 space-y-2.5">
            {rows.map((e, idx) => (
              <li key={e.id} className="flex items-center gap-3 rounded-[16px] bg-white/[.06] p-2.5">
                <DateChip date={e.date} tone={idx === 0 ? "soon" : "dark"} />
                <div className="min-w-0">
                  <p className="font-semibold text-[14.5px] leading-snug">{e.label}</p>
                  <p className="text-[12.5px] text-white/60 mt-0.5 flex flex-wrap items-center gap-2">{e.basis}<SourceTag c={e.confidence} /></p>
                </div>
              </li>
            ))}
            {rows.length === 0 && <li className="text-white/60 text-[14px]">No upcoming deadlines yet. Add the service date to unlock more.</li>}
          </ul>
        </div>
      )}
    </aside>
  );
}
