import { ExternalLink } from "lucide-react";
import { CIRCUITS, ordinal } from "../engine/circuits";

function status(c: (typeof CIRCUITS)[number]) {
  const tracks = Object.entries(c.schedules).flatMap(([court, t]) => Object.entries(t ?? {}).map(([track, s]) => ({ court, track, s: s! })));
  if (!tracks.length) return { label: "Import the order", cls: "bg-line-2 text-ink-2", detail: "Rule-based deadlines until you import the entered CMO." };
  const partial = tracks.some((t) => t.s.status === "partial");
  return { label: partial ? "Partial form" : "Circuit form", cls: partial ? "bg-sun-soft text-sun-ink" : "bg-brand-soft text-brand-2", detail: tracks.map((t) => `${t.court} ${t.track}`).join(", ") };
}

const RULES = [
  ["Rule 1.200 (2025)", "Every case gets a streamlined, general or complex track within 120 days. Streamlined and general cases get a CMO with strictly enforced deadlines, issued by the earlier of 120 days after filing or 30 days after service on the last defendant."],
  ["Rule 2.250(a)(1)(B)", "Time standards: streamlined 12 months, general 18 months, complex 30 months, from the earlier of service on the last defendant or 120 days after filing."],
  ["Rule 2.514(a)", "Skip the trigger day, count every calendar day, and if the last day is a weekend or court holiday keep going: forward for periods after an event, backward for periods before one."],
  ["Rule 2.514(b)", "Add 5 days when a response period runs from service by mail. E-mail and e-portal service add nothing."],
  ["Rule 1.280(a)", "Initial disclosures are due 60 days after service of the complaint. No discovery from any source until your own disclosures are served."],
  ["Rule 1.510(c)(5)–(6)", "The MSJ response is due 40 days after service, and any hearing must be at least 10 days after the response deadline."],
  ["Rule 1.442(b)", "Proposals for settlement: to a plaintiff no earlier than 90 days after filing, to a defendant no earlier than 90 days after service on that defendant, and none later than 45 days before trial or the first day of the trial docket."],
  ["Rule 1.440(c)", "The court must enter an order fixing the trial period at least 45 days before the projected trial period."],
  ["§95.11(4)(a), HB 837", "Negligence actions accruing after March 24, 2023 must be filed within 2 years. Earlier claims keep the 4-year period."],
];

export function Coverage() {
  return (
    <div>
      <h1 className="display text-[34px] sm:text-[44px] leading-none font-bold">Circuits, rules and sources</h1>
      <p className="mt-3 text-[16px] text-ink-2 max-w-[66ch] leading-relaxed">Where each date comes from. Circuit forms are transcribed from the administrative orders linked below. Judges can modify them, so the order entered in your case always controls.</p>

      <ul className="mt-8 grid gap-3 md:grid-cols-2">
        {CIRCUITS.map((c) => {
          const s = status(c);
          return (
            <li key={c.id} className="rounded-[18px] bg-surface shadow-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="display text-[18px] font-bold">{ordinal(c.id)} Circuit</p>
                  <p className="text-[13.5px] text-muted">{c.counties.join(", ")}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.cls}`}>{s.label}</span>
              </div>
              <p className="mt-3 text-[14px] text-ink-2 leading-relaxed">{c.howIssued.circuit ?? "CMOs are issued under the circuit's case management administrative order."}</p>
              <p className="mt-1.5 text-[13px] text-muted capitalize">{s.detail}</p>
              <p className="mt-1.5 text-[13px] text-muted">Holidays: {c.holidays.source ?? "core state holidays; Good Friday, Rosh Hashanah, Yom Kippur and discretionary days are flagged for review"}.</p>
              {c.ao && <a className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand hover:underline underline-offset-2" href={c.ao.url} target="_blank" rel="noreferrer">{c.ao.title} <ExternalLink size={13} /></a>}
            </li>
          );
        })}
      </ul>

      <h2 className="display text-[26px] font-bold mt-12 mb-4">The rules behind the math</h2>
      <dl className="rounded-[20px] bg-surface shadow-soft divide-y divide-line-2">
        {RULES.map(([k, v]) => (
          <div key={k} className="grid sm:grid-cols-[210px_1fr] gap-1 sm:gap-5 px-5 py-4">
            <dt className="font-semibold">{k}</dt>
            <dd className="text-ink-2 leading-relaxed max-w-[70ch]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[13.5px] text-muted max-w-[72ch] leading-relaxed">Docket Clock is a calculation aid, not legal advice. Check each deadline against the order entered in your case, the current rules, and any emergency orders from the chief judge.</p>
    </div>
  );
}
