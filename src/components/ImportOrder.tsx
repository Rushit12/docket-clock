import { ClipboardPaste, FileText, Info, ShieldCheck, TriangleAlert, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { circuitForCounty, ordinal } from "../engine/circuits";
import { rollToCourtDay } from "../engine/compute";
import { fmt, isValidISO, todayISO } from "../engine/dates";
import { generateTimeline, type OrderItem } from "../engine/generate";
import { CANONICAL, parseOrderText, resolveRelative, type ParsedItem, type RelAnchor } from "../engine/parser";
import type { CaseInputs } from "../engine/types";
import { extractPdfText } from "../pdf";
import { blankCase, useCases } from "../store";
import { Button, CountyPicker, DateInput, Field, toast } from "./ui";

const SAMPLE = `CASE MANAGEMENT ORDER (GENERAL PATHWAY)
Deadline for Service of Complaint: 04/06/2026
Deadline for Service Under Extensions: 05/06/2026
Deadline for Rule 1.280(a) Initial Discovery Disclosures: 04/20/2026
Deadline for Adding Parties: 07/13/2026
Deadline for Witness and Exhibit List: 01/15/2027
Deadline for Inspections/Examinations: 12/12/2026
Deadline for Fact Discovery Completion (Including Depositions): 11/30/2026
Deadline for Expert Disclosure: 12/14/2026
Deadline for Expert Discovery Completion: 02/15/2027
Deadline for Filing and Service of Motions for Summary Judgment: 03/01/2027
Deadline for Resolution of all Pretrial Motions (Motions in Limine and Daubert) and Jury Instructions: 05/21/2027
Deadline for ADR/Mediation: 03/31/2027
Projected Trial Date: 06/07/2027`;

type Facts = Pick<CaseInputs, "county" | "court" | "track" | "filingDate" | "serviceClientDate" | "name" | "caseNumber">;

export function ImportOrder({ go }: { go: (r: string) => void }) {
  const { cases, upsert } = useCases();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedItem[] | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<"file" | "paste">("file");
  const fileRef = useRef<HTMLInputElement>(null);
  const [facts, setFacts] = useState<Facts>({ county: "", court: "circuit", track: "general", name: "" });
  const [target, setTarget] = useState<string>("new");

  const run = (t: string, src?: string) => {
    const parsed = parseOrderText(t);
    setText(t);
    setFileName(src);
    const cn = /\b(\d{2,4}[- ]?(?:CA|CC|SC|CACE|COCE|CA-01)[- ]?\d{3,7}[\w-]*)\b/i.exec(t);
    if (cn) setFacts((f) => ({ ...f, caseNumber: f.caseNumber || cn[1] }));
    if (!parsed.length) { setErr("No dated deadlines found. If this is a scanned PDF it has no text layer: run OCR in your PDF viewer, then paste the text here."); setMode("paste"); return; }
    setErr(undefined);
    setRows(parsed);
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    setErr(undefined);
    try {
      const t = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") ? await extractPdfText(f) : await f.text();
      run(t, f.name);
    } catch {
      setErr("That file couldn't be read. Paste the order's text instead.");
      setMode("paste");
    } finally {
      setBusy(false);
    }
  };

  const circuit = circuitForCounty(facts.county);
  const anchors: Partial<Record<RelAnchor, string>> = {
    filing: facts.filingDate, service: facts.serviceClientDate,
    trial: rows?.find((r) => r.id === "trial")?.date, calendarCall: rows?.find((r) => r.id === "calendarCall")?.date, pretrial: rows?.find((r) => r.id === "pretrial")?.date,
  };
  const baseInputs: CaseInputs = { ...blankCase().inputs, ...facts };
  const calendar = useMemo(() => generateTimeline({ ...baseInputs, county: facts.county || "Orange", filingDate: facts.filingDate ?? todayISO() }).calendar, [facts.county, facts.filingDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolved = (rows ?? []).map((r) => {
    let date = resolveRelative(r, anchors);
    if (date && !r.date) date = rollToCourtDay(date, (r.relative?.days ?? 1) < 0 ? -1 : 1, calendar).date;
    return { r, date };
  });
  const usable = resolved.filter(({ r, date }) => r.include && date && isValidISO(date));
  const orderItems: OrderItem[] = usable.map(({ r, date }, i, arr) => ({ id: arr.findIndex((x) => x.r.id === r.id) === i ? r.id : `${r.id}_${i}`, label: r.label, category: r.category, date: date! }));
  const preview = useMemo(() => (facts.county && facts.filingDate && orderItems.length ? generateTimeline(baseInputs, { orderItems }) : null), [JSON.stringify(orderItems), JSON.stringify(facts)]); // eslint-disable-line react-hooks/exhaustive-deps
  const issues = preview?.warnings.filter((w) => w.level !== "info") ?? [];

  const patch = (key: string, p: Partial<ParsedItem>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const save = () => {
    const src = fileName ? `“${fileName}”` : "the pasted order";
    const trialSet = { trialDate: anchors.trial, calendarCallDate: anchors.calendarCall, pretrialDate: anchors.pretrial };
    if (target === "new") {
      const c = blankCase();
      c.inputs = { ...c.inputs, ...facts, name: facts.name || `Imported order, ${fmt(todayISO())}`, ...trialSet };
      c.orderItems = orderItems;
      c.orderSource = src;
      upsert(c);
      toast(`${orderItems.length} deadlines saved`);
      go(`/case/${c.id}`);
    } else {
      const c = cases.find((x) => x.id === target)!;
      upsert({ ...c, orderItems, orderSource: src, inputs: { ...c.inputs, trialDate: anchors.trial ?? c.inputs.trialDate, calendarCallDate: anchors.calendarCall ?? c.inputs.calendarCallDate, pretrialDate: anchors.pretrial ?? c.inputs.pretrialDate } });
      toast(`${orderItems.length} deadlines added to ${c.inputs.name}`);
      go(`/case/${c.id}`);
    }
  };

  const canSave = orderItems.length > 0 && (target !== "new" || (!!facts.county && !!facts.filingDate));

  if (!rows) {
    return (
      <div>
        <h1 className="display text-[34px] sm:text-[44px] leading-none font-bold">Import an order</h1>
        <p className="mt-3 text-[16px] text-ink-2 max-w-[62ch] leading-relaxed">Drop in the CMO or trial order the court entered. Docket Clock finds every deadline, checks each date against the court calendar, and turns it into a case you can track. The file is read on your device and never uploaded.</p>

        <div className="mt-8 max-w-[760px]">
          <div className="inline-flex rounded-[14px] bg-line-2 p-1 gap-1 mb-4" role="tablist">
            {([["file", "Upload a file", <Upload size={16} key="u" />], ["paste", "Paste text", <ClipboardPaste size={16} key="p" />]] as const).map(([k, l, ic]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-9 px-3.5 rounded-[10px] inline-flex items-center gap-2 text-[14px] font-semibold ${mode === k ? "bg-surface shadow-soft" : "text-ink-2"}`}>{ic}{l}</button>
            ))}
          </div>
          {mode === "file" ? (
            <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
              className={`rounded-[22px] border-2 border-dashed ${drag ? "border-brand bg-brand-soft" : "border-[#cdd6d2] bg-surface"} grid place-items-center text-center px-6 py-16 transition-colors`}>
              <div>
                <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-brand-soft text-brand"><FileText size={24} /></div>
                <p className="display text-[21px] font-bold mt-4">{busy ? "Reading the order…" : "Drop the order here"}</p>
                <p className="text-[14.5px] text-muted mt-1">PDF with selectable text, or a .txt file</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => fileRef.current?.click()}>Choose a file</Button>
                  <Button variant="ghost" onClick={() => run(SAMPLE, "a sample 11th Circuit order")}>Try a sample order</Button>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] bg-surface shadow-soft p-4">
              <label htmlFor="paste" className="sr-only">Order text</label>
              <textarea id="paste" className="input min-h-[260px] text-[14px] tabular !border-0 !shadow-none !p-2" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Paste the deadlines section of the order, for example:\nDeadline for Fact Discovery Completion: 11/30/2026"} />
              <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
                <Button variant="primary" disabled={!text.trim()} onClick={() => run(text)}>Find deadlines</Button>
                <Button variant="ghost" onClick={() => run(SAMPLE, "a sample 11th Circuit order")}>Try a sample order</Button>
              </div>
            </div>
          )}
          {err && <p role="alert" className="mt-4 rounded-[14px] bg-late-soft text-late p-3.5 text-[14.5px]">{err}</p>}
          <p className="mt-6 text-[14px] text-ink-2 leading-relaxed max-w-[64ch]">Orders from the 9th (circuit civil), 11th and 15th Circuits print specific dates instead of day counts, so importing the entered order is the most accurate way to build those cases.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[30px] sm:text-[40px] leading-none font-bold">Review {rows.length} deadlines</h1>
          <p className="mt-2 text-[15px] text-ink-2">From {fileName ?? "the pasted text"}. Fix anything that looks off, then save.</p>
        </div>
        <Button variant="ghost" onClick={() => { setRows(null); setErr(undefined); }}>Start over</Button>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_380px] items-start">
        <div className="min-w-0 space-y-3">
          {preview && (
            <div className={`rounded-[18px] p-4 flex gap-3 ${issues.length ? "bg-sun-soft" : "bg-brand-soft"}`}>
              {issues.length ? <TriangleAlert size={20} className="text-sun-ink shrink-0 mt-0.5" /> : <ShieldCheck size={20} className="text-brand shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="font-semibold">{issues.length ? `${issues.length} ${issues.length === 1 ? "date needs" : "dates need"} a second look` : "Every date checks out"}</p>
                {issues.length > 0 && <ul className="mt-1.5 space-y-1.5 text-[14px] text-ink-2 leading-relaxed">{issues.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
              </div>
            </div>
          )}
          {!preview && <div className="rounded-[18px] bg-surface shadow-soft p-4 flex gap-3 text-[14.5px] text-ink-2"><Info size={19} className="text-sky shrink-0 mt-0.5" />Add the county and filing date on the right to check these dates against that circuit's court calendar.</div>}

          <ul className="space-y-2.5">
            {resolved.map(({ r, date }) => (
              <li key={r.key} className={`rounded-[18px] bg-surface shadow-soft p-3.5 sm:p-4 ${r.include ? "" : "opacity-55"}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" aria-label="Include this deadline" className="mt-3 h-4 w-4 accent-[var(--color-brand)]" checked={r.include} onChange={(e) => patch(r.key, { include: e.target.checked })} />
                  <div className="min-w-0 flex-1 grid gap-2.5 sm:grid-cols-[1fr_190px]">
                    <div className="min-w-0 space-y-2">
                      <input aria-label="Deadline name" className="input !py-2 font-semibold" value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} />
                      <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Deadline type" className="input !w-auto !py-1.5 !text-[13.5px]" value={r.id.replace(/_\d+$/, "")} onChange={(e) => { const cn = CANONICAL.find((x) => x.id === e.target.value)!; patch(r.key, { id: cn.id, category: cn.category }); }}>
                          {CANONICAL.map((cn) => <option key={cn.id} value={cn.id}>{cn.label}</option>)}
                        </select>
                        {r.confidence !== "high" && <span className="rounded-full bg-sun-soft text-sun-ink px-2 py-0.5 text-[12px] font-semibold">Check this row</span>}
                      </div>
                    </div>
                    <div>
                      <input aria-label="Date" type="date" className="input tabular" value={r.date ?? date ?? ""} onChange={(e) => patch(r.key, { date: e.target.value || undefined, relative: undefined, months: undefined })} />
                      {!r.date && r.relative && <p className="text-[12.5px] text-muted mt-1">{Math.abs(r.relative.days)} days {r.relative.days < 0 ? "before" : "after"} {r.relative.anchor === "calendarCall" ? "Calendar Call" : r.relative.anchor}{date ? "" : ". Add that date to compute it."}</p>}
                    </div>
                  </div>
                </div>
                <p className="mt-2 ml-7 text-[12.5px] text-muted truncate" title={r.sourceLine}>In the order: “{r.sourceLine}”</p>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-[22px] bg-surface shadow-soft p-5 lg:sticky lg:top-24 space-y-5">
          <h2 className="display text-[19px] font-bold">Save to a case</h2>
          <Field label="Save to" htmlFor="itarget">
            <select id="itarget" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="new">A new case</option>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.inputs.name}</option>)}
            </select>
          </Field>
          {target === "new" && <>
            <Field label="County" htmlFor="icounty" hint={circuit ? `${ordinal(circuit.id)} Circuit holidays are used to check the dates.` : "Used to check the dates against the court's holidays."}><CountyPicker id="icounty" value={facts.county} onChange={(county) => setFacts({ ...facts, county })} /></Field>
            <Field label="Complaint filed" htmlFor="ifile"><DateInput id="ifile" quick={false} value={facts.filingDate} onChange={(filingDate) => setFacts({ ...facts, filingDate })} /></Field>
            <Field label="Our client served" optional htmlFor="isvc" hint="Adds the answer, disclosure and proposal-for-settlement dates."><DateInput id="isvc" quick={false} value={facts.serviceClientDate} onChange={(serviceClientDate) => setFacts({ ...facts, serviceClientDate })} /></Field>
            <Field label="Case name" htmlFor="iname"><input id="iname" className="input" value={facts.name} onChange={(e) => setFacts({ ...facts, name: e.target.value })} /></Field>
            <Field label="Case number" htmlFor="ino"><input id="ino" className="input tabular" value={facts.caseNumber ?? ""} onChange={(e) => setFacts({ ...facts, caseNumber: e.target.value })} /></Field>
          </>}
          <Button variant="primary" size="lg" className="w-full" disabled={!canSave} onClick={save}>Save {orderItems.length} deadlines</Button>
          {!canSave && target === "new" && <p className="text-[13px] text-muted -mt-2">Add the county and filing date to save.</p>}
        </aside>
      </div>
    </div>
  );
}
