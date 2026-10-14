import { FileText, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ALL_COUNTIES, circuitForCounty, ordinal } from "../engine/circuits";
import { rollToCourtDay } from "../engine/compute";
import { fmt, isValidISO, todayISO } from "../engine/dates";
import { generateTimeline, type OrderItem } from "../engine/generate";
import { CANONICAL, parseOrderText, resolveRelative, type ParsedItem, type RelAnchor } from "../engine/parser";
import type { CaseInputs } from "../engine/types";
import { extractPdfText } from "../pdf";
import { blankCase, useCases } from "../store";
import { Checks, Docket } from "./Docket";
import { Button, Label, PageHeader } from "./ui";

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

export function ImportOrder({ go }: { go: (r: string) => void }) {
  const { cases, upsert } = useCases();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedItem[] | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [facts, setFacts] = useState<Pick<CaseInputs, "county" | "court" | "track" | "filingDate" | "serviceClientDate" | "serviceLastDate" | "name" | "caseNumber">>({ county: "", court: "circuit", track: "general", name: "" });
  const [target, setTarget] = useState<string>("new");

  const run = (t: string, src?: string) => {
    setText(t);
    setFileName(src);
    const parsed = parseOrderText(t);
    setRows(parsed);
    const cn = /\b(\d{2,4}[- ]?(?:CA|CC|SC|CACE|COCE)[- ]?\d{3,7}[\w-]*)\b/i.exec(t);
    if (cn && !facts.caseNumber) setFacts((f) => ({ ...f, caseNumber: cn[1] }));
    setErr(parsed.length ? undefined : "No dated deadlines found. If this is a scanned PDF, it has no text layer — copy the text from your PDF viewer's OCR and paste it here.");
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
    } finally {
      setBusy(false);
    }
  };

  const circuit = circuitForCounty(facts.county);
  const anchors: Partial<Record<RelAnchor, string>> = {
    filing: facts.filingDate,
    service: facts.serviceLastDate ?? facts.serviceClientDate,
    trial: rows?.find((r) => r.id === "trial")?.date,
    calendarCall: rows?.find((r) => r.id === "calendarCall")?.date,
    pretrial: rows?.find((r) => r.id === "pretrial")?.date,
  };

  const baseInputs: CaseInputs = { ...blankCase().inputs, ...facts };
  const calendar = useMemo(() => generateTimeline({ ...baseInputs, filingDate: facts.filingDate ?? todayISO() }).calendar, [facts.county, facts.filingDate]); // eslint-disable-line

  const resolved = (rows ?? []).map((r) => {
    let date = resolveRelative(r, anchors);
    if (date && !r.date) date = rollToCourtDay(date, (r.relative?.days ?? 1) < 0 ? -1 : 1, calendar).date;
    return { r, date };
  });
  const orderItems: OrderItem[] = resolved
    .filter(({ r, date }) => r.include && date && isValidISO(date))
    .map(({ r, date }, i, arr) => ({ id: arr.findIndex((x) => x.r.id === r.id) === i ? r.id : `${r.id}_${i}`, label: r.label, category: r.category, date: date! }));

  const preview = useMemo(() => (facts.county && facts.filingDate && orderItems.length ? generateTimeline({ ...baseInputs }, { orderItems }) : null), [JSON.stringify(orderItems), JSON.stringify(facts)]); // eslint-disable-line

  const patch = (key: string, p: Partial<ParsedItem>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const attach = () => {
    const src = fileName ? `“${fileName}”` : "pasted order text";
    if (target === "new") {
      const c = blankCase();
      c.inputs = { ...c.inputs, ...facts, name: facts.name || `Imported order ${fmt(todayISO())}`, trialDate: anchors.trial, calendarCallDate: anchors.calendarCall, pretrialDate: anchors.pretrial };
      c.orderItems = orderItems;
      c.orderSource = src;
      upsert(c);
      go(`/case/${c.id}`);
    } else {
      const c = cases.find((x) => x.id === target)!;
      upsert({ ...c, orderItems, orderSource: src, inputs: { ...c.inputs, trialDate: anchors.trial ?? c.inputs.trialDate, calendarCallDate: anchors.calendarCall ?? c.inputs.calendarCallDate, pretrialDate: anchors.pretrial ?? c.inputs.pretrialDate } });
      go(`/case/${c.id}`);
    }
  };

  const needsAnchor = (rows ?? []).some((r) => r.include && !r.date);

  return (
    <div className="max-w-[1180px]">
      <PageHeader title="Import an issued CMO" sub="Drop the order the court entered, or paste its text. Docket Clock pulls out every deadline, flags dates that fall on weekends or court holidays, catches sequencing problems, and turns it into a tracked timeline. The file is read in your browser and isn't uploaded." />

      {!rows && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
            className={`rounded-xl border-2 border-dashed ${drag ? "border-ink bg-white" : "border-rule bg-white/60"} grid place-items-center text-center px-6 py-12`}
          >
            <div>
              <Upload className="mx-auto text-ink-2" />
              <p className="font-semibold mt-3">{busy ? "Reading the order…" : "Drop the CMO or trial order here"}</p>
              <p className="text-sm text-muted mt-1">PDF with a text layer, or a .txt file</p>
              <div className="mt-4"><Button onClick={() => fileRef.current?.click()}><FileText size={16} /> Choose file</Button></div>
              <input ref={fileRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="paste">Or paste the order text</Label>
            <textarea id="paste" className="field flex-1 min-h-[220px] text-[13px] tabular" value={text} onChange={(e) => setText(e.target.value)} placeholder="Deadline for Fact Discovery Completion: 11/30/2026…" />
            <div className="flex gap-2 mt-3">
              <Button variant="primary" disabled={!text.trim()} onClick={() => run(text)}>Find deadlines</Button>
              <Button variant="ghost" onClick={() => run(SAMPLE, "sample 11th Circuit General Pathway order")}>Try a sample order</Button>
            </div>
          </div>
          {err && <p role="alert" className="lg:col-span-2 text-sm text-late">{err}</p>}
        </div>
      )}

      {rows && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
          <div className="min-w-0 space-y-5">
            <section className="rounded-xl border border-rule bg-white">
              <div className="flex flex-wrap items-center gap-3 justify-between px-4 py-3 border-b border-rule">
                <h2 className="font-bold">{rows.length} deadlines found{fileName ? ` in ${fileName}` : ""}</h2>
                <Button small variant="ghost" onClick={() => { setRows(null); setErr(undefined); }}>Start over</Button>
              </div>
              {err && <p className="px-4 py-3 text-sm text-late">{err}</p>}
              <ul className="divide-y divide-rule-2">
                {resolved.map(({ r, date }) => (
                  <li key={r.key} className={`px-4 py-3 grid gap-2 sm:grid-cols-[22px_1fr_170px] items-start ${r.include ? "" : "opacity-50"}`}>
                    <input type="checkbox" aria-label="Include this deadline" className="mt-2 accent-ink" checked={r.include} onChange={(e) => patch(r.key, { include: e.target.checked })} />
                    <div className="min-w-0 space-y-1.5">
                      <input aria-label="Deadline label" className="field !py-1.5 font-semibold" value={r.label} onChange={(e) => patch(r.key, { label: e.target.value })} />
                      <div className="flex flex-wrap gap-2 items-center">
                        <select aria-label="Deadline type" className="field !w-auto !py-1 text-[13px]" value={r.id.replace(/_\d+$/, "")} onChange={(e) => { const c = CANONICAL.find((x) => x.id === e.target.value)!; patch(r.key, { id: c.id, category: c.category }); }}>
                          {CANONICAL.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        {r.confidence !== "high" && <span className="text-[12px] text-[#6b5500]">Check this row</span>}
                      </div>
                      <p className="text-[12px] text-muted truncate" title={r.sourceLine}>From the order: {r.sourceLine}</p>
                    </div>
                    <div>
                      <input aria-label="Date" type="date" className="field tabular" value={r.date ?? (date ?? "")} onChange={(e) => patch(r.key, { date: e.target.value || undefined, relative: undefined, months: undefined })} />
                      {!r.date && r.relative && <p className="text-[12px] text-muted mt-1">{Math.abs(r.relative.days)} days {r.relative.days < 0 ? "before" : "after"} {r.relative.anchor === "calendarCall" ? "Calendar Call" : r.relative.anchor}{date ? "" : ", add that date below"}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            {preview && <><Checks result={preview} /><Docket result={preview} today={todayISO()} /></>}
          </div>

          <aside className="rounded-xl border border-rule bg-white p-4 sm:p-5 lg:sticky lg:top-6 space-y-3.5">
            <h2 className="font-bold">Case details</h2>
            <p className="text-[13px] text-ink-2 -mt-2">The county sets the holiday calendar used to check the order's dates. The filing and service dates add the rule-based defense deadlines{needsAnchor ? " and resolve the relative deadlines" : ""}.</p>
            <div>
              <Label htmlFor="icounty" hint={circuit ? `${ordinal(circuit.id)} Judicial Circuit` : undefined}>County</Label>
              <select id="icounty" className="field" value={facts.county} onChange={(e) => setFacts({ ...facts, county: e.target.value })}>
                <option value="">Choose a county…</option>
                {ALL_COUNTIES.map((c) => <option key={c.county} value={c.county}>{c.county}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="ifile">Complaint filed</Label><input id="ifile" type="date" className="field tabular" value={facts.filingDate ?? ""} onChange={(e) => setFacts({ ...facts, filingDate: e.target.value || undefined })} /></div>
              <div><Label htmlFor="isvc">Client served</Label><input id="isvc" type="date" className="field tabular" value={facts.serviceClientDate ?? ""} onChange={(e) => setFacts({ ...facts, serviceClientDate: e.target.value || undefined })} /></div>
            </div>
            <div><Label htmlFor="iname">Case name</Label><input id="iname" className="field" value={facts.name} onChange={(e) => setFacts({ ...facts, name: e.target.value })} /></div>
            <div><Label htmlFor="ino">Case number</Label><input id="ino" className="field tabular" value={facts.caseNumber ?? ""} onChange={(e) => setFacts({ ...facts, caseNumber: e.target.value })} /></div>
            <div>
              <Label htmlFor="itarget">Save to</Label>
              <select id="itarget" className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">A new case</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.inputs.name}</option>)}
              </select>
            </div>
            <Button variant="primary" disabled={!orderItems.length || (target === "new" && (!facts.county || !facts.filingDate))} onClick={attach}>
              Save {orderItems.length} deadlines
            </Button>
            {target === "new" && (!facts.county || !facts.filingDate) && <p className="text-[12.5px] text-muted">Add the county and filing date to save.</p>}
          </aside>
        </div>
      )}
      {!rows && <p className="mt-6 text-[13.5px] text-ink-2 max-w-[68ch]">Orders from the 9th (circuit civil), 11th and 15th Circuits print specific dates rather than day counts, so importing the entered order is the fastest way to an exact docket there.</p>}
    </div>
  );
}
