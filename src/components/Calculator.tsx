import { useMemo, useState } from "react";
import { CALC_RULES } from "../engine/calculator";
import { ALL_COUNTIES, circuitForCounty } from "../engine/circuits";
import { computeDeadline } from "../engine/compute";
import { fmt, isValidISO, todayISO, toDate } from "../engine/dates";
import { buildCalendar } from "../engine/holidays";
import { Label, PageHeader } from "./ui";

export function Calculator() {
  const [ruleId, setRuleId] = useState(CALC_RULES[0].id);
  const [date, setDate] = useState(todayISO());
  const [mail, setMail] = useState(false);
  const [county, setCounty] = useState("Orange");
  const rule = CALC_RULES.find((r) => r.id === ruleId)!;

  const result = useMemo(() => {
    if (!isValidISO(date)) return null;
    const y = toDate(date).getUTCFullYear();
    const cal = buildCalendar(circuitForCounty(county)?.holidays ?? { goodFriday: "unknown", roshHashanah: "unknown", yomKippur: "unknown" }, y - 1, y + 2);
    const days = mail && rule.afterService ? (rule.mailDaysOverride ?? rule.days + 5) : rule.days;
    const main = computeDeadline(date, days, cal);
    const follow = rule.followOn ? computeDeadline(main.date, rule.followOn.days, cal) : null;
    return { main, follow, days };
  }, [date, mail, county, rule]);

  return (
    <div className="max-w-[760px]">
      <PageHeader title="Rule calculator" sub="For deadlines triggered by something that happens during the case — a motion served, a proposal received, a judgment filed. Counted under Rule 2.514 with the circuit's court holidays." />
      <div className="rounded-xl border border-rule bg-white p-5 space-y-4">
        <div>
          <Label htmlFor="crule">What's due?</Label>
          <select id="crule" className="field" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            {CALC_RULES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cdate">{rule.trigger}</Label>
            <input id="cdate" type="date" className="field tabular" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ccounty" hint="Sets the court holiday calendar.">County</Label>
            <select id="ccounty" className="field" value={county} onChange={(e) => setCounty(e.target.value)}>
              {ALL_COUNTIES.map((c) => <option key={c.county} value={c.county}>{c.county}</option>)}
            </select>
          </div>
        </div>
        {rule.afterService && (
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="accent-ink" checked={mail} onChange={(e) => setMail(e.target.checked)} /> Served by mail (Rule 2.514(b))</label>
        )}
      </div>

      {result && (
        <div className="mt-5 rounded-xl bg-ink text-white p-5 sm:p-6">
          <p className="text-white/70 text-sm">{rule.label}</p>
          <p className="text-[30px] sm:text-[36px] font-extrabold tracking-tight tabular mt-1"><span className="hl text-ink">{fmt(result.main.date, { weekday: true })}</span></p>
          <p className="text-[14px] text-white/80 mt-2 leading-relaxed">
            {result.days} days after {fmt(date)}{result.main.rolled ? `. The raw date, ${fmt(result.main.raw, { weekday: true })}, falls on ${result.main.rollReason}, so it moves to the next open court day.` : "."}
            {result.main.possibleClosure && ` Heads up: some circuits close for ${result.main.possibleClosure}.`}
          </p>
          <p className="text-[13px] text-white/60 mt-2">{rule.citation}{rule.note ? `. ${rule.note}` : ""}</p>
          {result.follow && (
            <div className="mt-4 pt-4 border-t border-white/15">
              <p className="text-white/70 text-sm">{rule.followOn!.label}</p>
              <p className="text-[22px] font-bold tabular">{fmt(result.follow.date, { weekday: true })}</p>
              <p className="text-[13px] text-white/60">{rule.followOn!.citation}, unless the parties stipulate or the court orders otherwise.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
