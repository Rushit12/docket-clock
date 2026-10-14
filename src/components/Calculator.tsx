import { useMemo, useState } from "react";
import { CALC_RULES } from "../engine/calculator";
import { circuitForCounty, ordinal } from "../engine/circuits";
import { computeDeadline } from "../engine/compute";
import { fmt, isValidISO, todayISO, toDate } from "../engine/dates";
import { buildCalendar } from "../engine/holidays";
import { CountyPicker, DateInput, Field, relDays } from "./ui";

export function Calculator() {
  const [ruleId, setRuleId] = useState("msjResponse");
  const [date, setDate] = useState<string | undefined>(todayISO());
  const [mail, setMail] = useState(false);
  const [county, setCounty] = useState("Orange");
  const rule = CALC_RULES.find((r) => r.id === ruleId)!;
  const today = todayISO();
  const circuit = circuitForCounty(county);

  const result = useMemo(() => {
    if (!date || !isValidISO(date)) return null;
    const y = toDate(date).getUTCFullYear();
    const cal = buildCalendar(circuit?.holidays ?? { goodFriday: "unknown", roshHashanah: "unknown", yomKippur: "unknown" }, y - 1, y + 2);
    const days = mail && rule.afterService ? (rule.mailDaysOverride ?? rule.days + 5) : rule.days;
    const main = computeDeadline(date, days, cal);
    const follow = rule.followOn ? computeDeadline(main.date, rule.followOn.days, cal) : null;
    return { main, follow, days };
  }, [date, mail, circuit, rule]);

  return (
    <div>
      <h1 className="display text-[34px] sm:text-[44px] leading-none font-bold">Rule calculator</h1>
      <p className="mt-3 text-[16px] text-ink-2 max-w-[62ch] leading-relaxed">For deadlines that start when something happens mid-case: a motion served, a proposal received, a judgment filed. Counted under Rule 2.514 with the circuit's court holidays.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr] items-start">
        <section>
          <h2 className="text-[14px] font-semibold text-muted mb-2.5">What happened?</h2>
          <ul className="rounded-[18px] bg-surface shadow-soft p-1.5" role="radiogroup" aria-label="Deadline type">
            {CALC_RULES.map((r) => (
              <li key={r.id}>
                <button role="radio" aria-checked={r.id === ruleId} onClick={() => setRuleId(r.id)}
                  className={`w-full text-left flex items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 ${r.id === ruleId ? "bg-ink text-white" : "hover:bg-line-2"}`}>
                  <span className="font-semibold text-[14.5px] leading-snug">{r.label}</span>
                  <span className={`shrink-0 text-[13px] tabular ${r.id === ruleId ? "text-sun" : "text-muted"}`}>{r.days} days</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:sticky lg:top-24 space-y-5">
          <div className="rounded-[20px] bg-surface shadow-soft p-5 space-y-5">
            <Field label={rule.trigger} htmlFor="cdate"><DateInput id="cdate" value={date} onChange={setDate} /></Field>
            <Field label="County" htmlFor="ccounty" hint={circuit ? `Uses the ${ordinal(circuit.id)} Circuit's court holidays.` : undefined}><CountyPicker id="ccounty" value={county} onChange={setCounty} /></Field>
            {rule.afterService && (
              <label className="flex items-start gap-2.5 text-[14.5px]">
                <input type="checkbox" className="h-4 w-4 mt-0.5 accent-[var(--color-brand)]" checked={mail} onChange={(e) => setMail(e.target.checked)} />
                <span>Served by mail<span className="block text-[13px] text-muted">{rule.mailDaysOverride ? `${rule.mailDaysOverride} days instead of ${rule.days}.` : "Adds 5 days under Rule 2.514(b)."}</span></span>
              </label>
            )}
          </div>

          {result && (
            <div className="rounded-[22px] bg-ink text-white p-6 shadow-lift" aria-live="polite">
              <p className="text-[14px] text-white/65">{rule.label}</p>
              <p className="display text-[34px] sm:text-[40px] font-bold tabular leading-[1.25] mt-1"><span className="text-sun">{fmt(result.main.date, { weekday: true })}</span></p>
              <p className="mt-2 text-[14.5px] text-white/80">{relDays(result.main.date, today)}.</p>
              <p className="mt-4 text-[14.5px] text-white/80 leading-relaxed">
                {result.days} days after {fmt(date!)}.
                {result.main.rolled && ` Day ${result.days} is ${fmt(result.main.raw, { weekday: true })}, when the court is closed (${result.main.rollReason}), so it moves to the next open day.`}
                {result.main.possibleClosure && ` Some circuits close on ${result.main.possibleClosure}; confirm with yours.`}
              </p>
              <p className="mt-3 text-[13.5px] text-white/60 leading-relaxed">{rule.citation}{rule.note ? `. ${rule.note}` : ""}</p>
              {result.follow && (
                <div className="mt-5 pt-5 border-t border-white/15">
                  <p className="text-[14px] text-white/65">{rule.followOn!.label}</p>
                  <p className="display text-[24px] font-bold tabular mt-0.5">{fmt(result.follow.date, { weekday: true })}</p>
                  <p className="text-[13.5px] text-white/60 mt-1">{rule.followOn!.citation}, unless the parties stipulate or the court orders otherwise.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
