import { ExternalLink } from "lucide-react";
import { CIRCUITS, ordinal } from "../engine/circuits";
import { PageHeader } from "./ui";

function status(c: (typeof CIRCUITS)[number]) {
  const tracks = Object.entries(c.schedules).flatMap(([court, t]) => Object.entries(t ?? {}).map(([track, s]) => ({ court, track, s: s! })));
  if (!tracks.length) return { label: "Import your order", cls: "bg-rule-2 text-ink-2", detail: "Rule-based deadlines only until you import the entered CMO." };
  const partial = tracks.some((t) => t.s.status === "partial");
  return {
    label: partial ? "Partial form" : "Circuit form",
    cls: partial ? "bg-highlight-soft text-[#6b5500]" : "bg-done-soft text-done",
    detail: tracks.map((t) => `${t.court} ${t.track}`).join(", "),
  };
}

const RULES = [
  ["Rule 1.200 (2025)", "Every case gets a streamlined, general or complex track within 120 days; streamlined and general cases get a CMO with strictly enforced deadlines, issued by the earlier of 120 days after filing or 30 days after service on the last defendant."],
  ["Rule 2.250(a)(1)(B)", "Time standards: streamlined 12 months, general 18 months, complex 30 months from the earlier of service on the last defendant or 120 days after filing."],
  ["Rule 2.514(a)", "Exclude the trigger day, count every calendar day, and if the last day is a weekend or court holiday, keep going — forward for periods after an event, backward for periods before one."],
  ["Rule 2.514(b)", "Add 5 days when a response period runs from service by mail. E-mail and e-portal service add nothing."],
  ["Rule 1.280(a)", "Initial disclosures 60 days after service of the complaint; no discovery from any source before your own disclosures are served."],
  ["Rule 1.510(c)(5)–(6)", "MSJ response due 40 days after service; any hearing at least 10 days after the response deadline."],
  ["Rule 1.442(b)", "Proposals for settlement: to a plaintiff no earlier than 90 days after filing; to a defendant no earlier than 90 days after service on that defendant; none later than 45 days before trial or the first day of the trial docket."],
  ["Rule 1.440(c)", "The court must enter an order fixing the trial period at least 45 days before the projected trial period."],
  ["§95.11(4)(a) (HB 837)", "Negligence actions accruing after March 24, 2023 must be filed within 2 years; earlier claims keep the 4-year period."],
];

export function Coverage() {
  return (
    <div className="max-w-[1080px]">
      <PageHeader title="Circuits & sources" sub="Where each date comes from. Circuit forms are transcribed from the administrative orders below; judges can and do modify them, so the order entered in your case always controls." />
      <div className="rounded-xl border border-rule bg-white overflow-x-auto mb-10">
        <table className="w-full text-[14px]">
          <thead className="text-left text-[12.5px] text-muted bg-rule-2/60">
            <tr><th className="px-4 py-2 font-semibold">Circuit</th><th className="px-3 py-2 font-semibold">Schedule</th><th className="px-3 py-2 font-semibold">How the CMO is issued</th><th className="px-3 py-2 font-semibold">Court holidays</th></tr>
          </thead>
          <tbody className="divide-y divide-rule-2 align-top">
            {CIRCUITS.map((c) => {
              const s = status(c);
              const h = c.holidays;
              const hol = h.source ? `${h.source}` : "Core state holidays. Good Friday, Rosh Hashanah, Yom Kippur and discretionary days are flagged for review.";
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{ordinal(c.id)}</p>
                    <p className="text-[12.5px] text-muted max-w-[200px]">{c.counties.join(", ")}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${s.cls}`}>{s.label}</span>
                    <p className="text-[12.5px] text-muted mt-1 capitalize">{s.detail}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-2 text-[13px] max-w-[340px]">
                    {c.howIssued.circuit ?? "Per the circuit's case management administrative order."}
                    {c.ao && <a className="mt-1 flex items-center gap-1 text-link underline underline-offset-2" href={c.ao.url} target="_blank" rel="noreferrer">{c.ao.title} <ExternalLink size={12} /></a>}
                  </td>
                  <td className="px-3 py-3 text-[12.5px] text-ink-2 max-w-[240px]">{hol}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-[22px] font-extrabold tracking-tight mb-3">The rules behind the math</h2>
      <dl className="rounded-xl border border-rule bg-white divide-y divide-rule-2">
        {RULES.map(([k, v]) => (
          <div key={k} className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-4 py-3">
            <dt className="font-semibold text-[14px]">{k}</dt>
            <dd className="text-[14px] text-ink-2 leading-relaxed max-w-[70ch]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[13px] text-muted max-w-[72ch] leading-relaxed">Docket Clock is a calculation aid, not legal advice. Confirm each deadline against the order entered in your case, the current rules, and any chief judge emergency orders before relying on it.</p>
    </div>
  );
}
