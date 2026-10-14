import { computeDeadline, rollToCourtDay } from "./compute";
import { circuitForCounty, ordinal, type Circuit } from "./circuits";
import { addDays, addMonths, diffDays, fmt, type ISODate, isValidISO, minDate, toDate } from "./dates";
import { buildCalendar, type HolidayCalendar } from "./holidays";
import type { Anchor, CaseInputs, Category, Confidence, RuleItem, TimelineEntry, TrackSchedule, Warning } from "./types";

export interface OrderItem {
  id: string;
  label: string;
  category: Category;
  date: ISODate;
}

export interface GenerateOptions {
  overrides?: Record<string, ISODate>;
  orderItems?: OrderItem[];
  today?: ISODate;
}

export interface GenerateResult {
  circuit?: Circuit;
  schedule?: TrackSchedule;
  calendar: HolidayCalendar;
  entries: TimelineEntry[];
  warnings: Warning[];
  anchors: Partial<Record<Anchor, { date: ISODate; estimated: boolean; label: string }>>;
  projectedTrial?: ISODate;
  standardDate?: ISODate;
}

const TRACK_MONTHS = { streamlined: 12, general: 18, complex: 30 } as const;
const ANCHOR_LABEL: Record<Anchor, string> = {
  filing: "filing of the complaint",
  serviceLast: "service on the last defendant",
  serviceClient: "service on our client",
  dol: "the date of loss",
  calendarCall: "Calendar Call",
  pretrial: "the pretrial conference",
  trial: "trial",
};

function basisText(item: RuleItem): string {
  const a = ANCHOR_LABEL[item.anchor];
  if (item.months) return `${item.months} months after ${a}`;
  const d = item.days ?? 0;
  if (d === 0) return `On ${a}`;
  return d > 0 ? `${d} days after ${a}` : `${-d} days before ${a}`;
}

export function generateTimeline(input: CaseInputs, opts: GenerateOptions = {}): GenerateResult {
  const warnings: Warning[] = [];
  const entries: TimelineEntry[] = [];
  const circuit = circuitForCounty(input.county);
  const filing = isValidISO(input.filingDate) ? input.filingDate : undefined;
  const startYear = filing ? toDate(filing).getUTCFullYear() - 1 : new Date().getUTCFullYear() - 1;
  const calendar = buildCalendar(
    circuit?.holidays ?? { goodFriday: "unknown", roshHashanah: "unknown", yomKippur: "unknown" },
    startYear,
    startYear + 6,
    input.extraClosures ?? [],
  );

  if (!circuit) {
    warnings.push({ level: "info", message: "Choose a Florida county to load its circuit's rules." });
    return { calendar, entries, warnings, anchors: {} };
  }
  if (!filing) {
    warnings.push({ level: "info", message: "Enter the date the complaint was filed — every CMO deadline counts from it or from service." });
    return { circuit, calendar, entries, warnings, anchors: {} };
  }

  const schedule = circuit.schedules[input.court]?.[input.track];
  const useOrder = (opts.orderItems?.length ?? 0) > 0;

  // ---------- anchors ----------
  const anchors: GenerateResult["anchors"] = {};
  anchors.filing = { date: filing, estimated: false, label: "Complaint filed" };
  if (isValidISO(input.serviceClientDate)) anchors.serviceClient = { date: input.serviceClientDate, estimated: false, label: "Client served" };
  if (isValidISO(input.serviceLastDate)) anchors.serviceLast = { date: input.serviceLastDate, estimated: false, label: "Last defendant served" };
  if (!anchors.serviceLast && anchors.serviceClient) anchors.serviceLast = { ...anchors.serviceClient, estimated: true, label: "Last defendant served (assumed = client)" };
  if (!anchors.serviceClient && anchors.serviceLast) anchors.serviceClient = { ...anchors.serviceLast, estimated: true, label: "Client served (assumed)" };
  if (isValidISO(input.dateOfLoss)) anchors.dol = { date: input.dateOfLoss, estimated: false, label: "Date of loss" };

  // Rule 2.250(a)(1)(B) time standard: months from the earlier of service on the last defendant or 120 days after commencement.
  const months = schedule?.projection.months ?? TRACK_MONTHS[input.track];
  const standardBase = anchors.serviceLast && !anchors.serviceLast.estimated
    ? minDate(anchors.serviceLast.date, addDays(filing, 120))
    : addDays(filing, 120);
  const standardDate = addMonths(standardBase, months);
  let projectedTrial = standardDate;
  if (schedule?.projection.base === "filing") projectedTrial = addMonths(filing, months);
  if (schedule?.projection.base === "filingPlus120") projectedTrial = addMonths(addDays(filing, 120), months);

  // Dates printed in an imported order fix the trial-side anchors when the user hasn't entered them.
  const fromOrder = (id: string) => opts.orderItems?.find((o) => o.id === id)?.date;
  const given = (k: "calendarCallDate" | "pretrialDate" | "trialDate") =>
    isValidISO(input[k]) ? input[k] : useOrder ? fromOrder(k === "trialDate" ? "trial" : k === "pretrialDate" ? "pretrial" : "calendarCall") : undefined;
  const trialGiven = given("trialDate");
  const ccGiven = given("calendarCallDate");
  const ptcGiven = given("pretrialDate");
  anchors.trial = trialGiven
    ? { date: trialGiven, estimated: false, label: "Trial period begins" }
    : { date: rollToCourtDay(projectedTrial, 1, calendar).date, estimated: true, label: "Projected trial (estimate)" };
  anchors.calendarCall = ccGiven
    ? { date: ccGiven, estimated: false, label: "Calendar Call" }
    : { date: trialGiven ?? anchors.trial.date, estimated: true, label: "Calendar Call (estimated at projected trial)" };
  anchors.pretrial = ptcGiven
    ? { date: ptcGiven, estimated: false, label: "Pretrial conference" }
    : { date: trialGiven ?? anchors.trial.date, estimated: true, label: "Pretrial conference (estimated at projected trial)" };

  const push = (item: RuleItem, confidence: Confidence, source = schedule?.source) => {
    const anchor = anchors[item.anchor];
    if (!anchor) return;
    if (item.when && !item.when(input)) return;
    let roll;
    if (item.months) {
      const raw = addMonths(anchor.date, item.months);
      roll = item.noRoll ? { date: raw, raw, rolled: false } : rollToCourtDay(raw, 1, calendar);
    } else {
      roll = computeDeadline(anchor.date, item.days ?? 0, calendar, {
        mailService: item.afterService && input.mailService,
        noRoll: item.noRoll,
      });
    }
    const conf: Confidence = anchor.estimated ? "estimate" : confidence;
    entries.push({
      id: item.id,
      label: item.label,
      category: item.category,
      date: roll.date,
      raw: roll.raw,
      rolled: roll.rolled,
      rollReason: roll.rollReason,
      possibleClosure: roll.possibleClosure,
      kind: item.kind ?? "deadline",
      confidence: conf,
      basis: basisText(item) + (item.afterService && input.mailService ? " (+5 days, mail service)" : ""),
      citation: item.citation ?? (confidence === "verified" ? source?.title : undefined),
      note: item.note,
      source: confidence === "verified" ? source : undefined,
      anchorDate: anchor.date,
      anchorLabel: anchor.label,
    });
  };

  // ---------- CMO deadlines ----------
  if (useOrder) {
    for (const o of opts.orderItems!) {
      entries.push({
        id: o.id, label: o.label, category: o.category, date: o.date, raw: o.date, rolled: false,
        possibleClosure: calendar.possible.get(o.date),
        kind: ["trial", "calendarCall", "pretrial", "cmc"].includes(o.id) ? "event" : "deadline",
        confidence: "order", basis: "Date printed in your case management order",
      });
    }
  } else if (schedule) {
    schedule.items.forEach((i) => push(i, "verified"));
    if (schedule.status === "partial") {
      warnings.push({ level: "info", message: `The ${ordinal(circuit.id)} Circuit's published order only confirmed some deadlines. Import your issued CMO to complete the timeline.` });
    }
  } else {
    warnings.push({
      level: "info",
      message: `No uniform day-count schedule is published for ${ordinal(circuit.id)} Circuit ${input.court} court (${input.track} track) — dates are set in each issued order. Showing deadlines fixed by rule; import your CMO for the rest.`,
    });
  }

  // ---------- Rule-based deadlines (statewide) ----------
  const has = (id: string) => entries.some((e) => e.id === id);
  if (!has("service")) push({ id: "service", label: "Serve complaint on all defendants", category: "service", anchor: "filing", days: 120, citation: "Fla. R. Civ. P. 1.070(j)" }, "rule");
  push({ id: "trackAssigned", label: "Court must assign case track", category: "trial", anchor: "filing", days: 120, kind: "info", citation: "Fla. R. Civ. P. 1.200(b)" }, "rule");
  if (input.track !== "complex" && !useOrder) {
    const cmoBy = anchors.serviceLast && !anchors.serviceLast.estimated ? minDate(addDays(filing, 120), addDays(anchors.serviceLast.date, 30)) : addDays(filing, 120);
    entries.push({
      id: "cmoIssued", label: "Case management order must be issued by", category: "trial", date: cmoBy, raw: cmoBy, rolled: false,
      kind: "info", confidence: "rule", basis: "Earlier of 120 days after filing or 30 days after service on the last defendant",
      citation: "Fla. R. Civ. P. 1.200(d)",
      note: "If no CMO has been entered by this date, raise it with the court — Rule 1.200 makes issuance mandatory.",
    });
  }

  if (anchors.serviceClient) {
    push({ id: "answer", label: "Answer / responsive pleading due", category: "defense", anchor: "serviceClient", days: 20, citation: "Fla. R. Civ. P. 1.140(a)(1)", note: "A Rule 1.140(b) motion tolls the time to answer until 10 days after the court rules on it." }, "rule");
    if (!has("initialDisclosures")) push({ id: "initialDisclosures", label: "Initial discovery disclosures due", category: "discovery", anchor: "serviceClient", days: 60, citation: "Fla. R. Civ. P. 1.280(a)", note: "A party may not seek discovery from any source before its own initial disclosures are served (Rule 1.280(f)(1))." }, "rule");
    if (input.discoveryWithComplaint) {
      push({ id: "discWithComplaint", label: "Responses to discovery served with the complaint", category: "defense", anchor: "serviceClient", days: 45, citation: "Fla. R. Civ. P. 1.340(a), 1.350(b), 1.370(a)" }, "rule");
    }
    push({ id: "pfsPlaintiffOpens", label: "Earliest date plaintiff may serve a proposal for settlement on our client", category: "settlement", anchor: "serviceClient", days: 90, kind: "earliest", citation: "Fla. R. Civ. P. 1.442(b); §768.79, Fla. Stat." }, "rule");
  } else {
    warnings.push({ level: "info", message: "Add the date our client was served to calculate the answer, initial disclosures and PFS windows." });
  }
  push({ id: "pfsDefenseOpens", label: "Earliest date defense may serve a proposal for settlement on plaintiff", category: "settlement", anchor: "filing", days: 90, kind: "earliest", citation: "Fla. R. Civ. P. 1.442(b)", note: "A proposal to a plaintiff may be served no earlier than 90 days after the action commenced." }, "rule");

  // Latest PFS: 45 days before the trial date or first day of the trial docket, whichever is earlier.
  const pfsAnchor: Anchor = trialGiven ? "trial" : ccGiven ? "calendarCall" : "trial";
  push({ id: "pfsLast", label: "Last day to serve a proposal for settlement", category: "settlement", anchor: pfsAnchor, days: -45, citation: "Fla. R. Civ. P. 1.442(b)", note: "Measured from the date set for trial or the first day of the trial docket, whichever is earlier. If your docket starts before the trial date shown, use the docket start." }, "rule");

  if (!has("trial") && !has("trialTerm")) {
    entries.push({
      id: "projectedTrial", label: trialGiven ? "Trial period begins" : "Projected trial period", category: "trial",
      date: anchors.trial.date, raw: projectedTrial, rolled: anchors.trial.date !== projectedTrial, kind: "event",
      confidence: trialGiven ? "manual" : schedule?.projection.base === "standard" || !schedule ? "rule" : "verified",
      basis: trialGiven ? "Entered from the trial order" : schedule?.projection.base === "filing" ? `${months} months after filing` : schedule?.projection.base === "filingPlus120" ? `${months} months after the 120-day service period` : `${months} months after the earlier of service on the last defendant or 120 days after filing`,
      citation: "Fla. R. Gen. Prac. & Jud. Admin. 2.250(a)(1)(B)",
    });
  }
  if (!trialGiven) {
    push({ id: "trialOrderBy", label: "Court must enter order fixing the trial period", category: "trial", anchor: "trial", days: -45, kind: "info", citation: "Fla. R. Civ. P. 1.440(c)", note: "If no trial order issues by this date, notify the court and request a case management conference." }, "rule");
  }
  if (ccGiven && !has("calendarCall")) entries.push({ id: "calendarCall", label: "Calendar Call", category: "trial", date: ccGiven, raw: ccGiven, rolled: false, kind: "event", confidence: "manual", basis: "Entered from the Uniform Trial Order" });
  if (ptcGiven && !has("pretrial")) entries.push({ id: "pretrial", label: "Pretrial conference", category: "trial", date: ptcGiven, raw: ptcGiven, rolled: false, kind: "event", confidence: "manual", basis: "Entered from the trial order" });

  // ---------- Statute of limitations check (HB 837, ch. 2023-15) ----------
  if (anchors.dol && ["auto", "premises", "negligentSecurity", "otherNegligence"].includes(input.caseType)) {
    const dol = anchors.dol.date;
    const twoYear = dol > "2023-03-24";
    const sol = addMonths(dol, twoYear ? 24 : 48);
    const solRoll = rollToCourtDay(sol, 1, calendar);
    entries.push({
      id: "sol", label: `Negligence statute of limitations (${twoYear ? "2" : "4"} years)`, category: "defense",
      date: solRoll.date, raw: sol, rolled: solRoll.rolled, rollReason: solRoll.rollReason, kind: "info", confidence: "rule",
      basis: `${twoYear ? 2 : 4} years after the date of loss`,
      citation: twoYear ? "§95.11(4)(a), Fla. Stat. (as amended by ch. 2023-15, Laws of Fla.)" : "§95.11(3), Fla. Stat. (pre-2023 version)",
      note: dol === "2023-03-24" ? "Loss occurred on HB 837's effective date — confirm which limitations period applies." : "Confirm accrual, tolling and any savings provisions before relying on this date.",
    });
    if (filing > solRoll.date) {
      warnings.push({ level: "warn", itemId: "sol", message: `Complaint was filed ${diffDays(solRoll.date, filing)} days after the computed limitations date (${fmt(solRoll.date)}). Evaluate a statute-of-limitations defense.` });
    }
  }

  // ---------- Overrides ----------
  for (const [id, date] of Object.entries(opts.overrides ?? {})) {
    const e = entries.find((x) => x.id === id);
    if (e && isValidISO(date)) {
      e.date = date; e.raw = date; e.rolled = false; e.rollReason = undefined;
      e.confidence = "manual"; e.basis = "Manually set"; e.possibleClosure = calendar.possible.get(date);
    }
  }

  // Service is satisfied once the last defendant has been served on or before the deadline.
  const svcEntry = entries.find((e) => e.id === "service");
  if (svcEntry && anchors.serviceLast && !anchors.serviceLast.estimated && anchors.serviceLast.date <= svcEntry.date) svcEntry.satisfied = true;

  entries.sort((a, b) => (a.date === b.date ? a.label.localeCompare(b.label) : a.date < b.date ? -1 : 1));
  warnings.push(...validate(entries, calendar, { input, anchors, schedule, standardDate, useOrder }));

  return { circuit, schedule, calendar, entries, warnings, anchors, projectedTrial, standardDate };
}

// ---------- Validation: the "correct the timeline" pass ----------
export function validate(
  entries: TimelineEntry[],
  calendar: HolidayCalendar,
  ctx: { input: CaseInputs; anchors: GenerateResult["anchors"]; schedule?: TrackSchedule; standardDate?: ISODate; useOrder: boolean },
): Warning[] {
  const w: Warning[] = [];
  const by = (id: string) => entries.find((e) => e.id === id);

  for (const e of entries) {
    if (e.possibleClosure && e.kind !== "info") {
      w.push({ level: "warn", itemId: e.id, message: `“${e.label}” lands on ${fmt(e.date, { weekday: true })} — ${e.possibleClosure}. Some circuits close that day; confirm with your circuit's holiday order before relying on it.` });
    }
    if (e.confidence === "order" || e.confidence === "manual") {
      const day = new Date(e.date + "T00:00:00Z").getUTCDay();
      const closed = calendar.closed.get(e.date);
      if (day === 0 || day === 6 || closed) {
        const why = closed ?? (day === 0 ? "a Sunday" : "a Saturday");
        const isBefore = /before|no later|complete|heard|resolve/i.test(e.label);
        const fwd = rollToCourtDay(e.date, 1, calendar).date;
        const back = rollToCourtDay(e.date, -1, calendar).date;
        w.push({
          level: "warn", itemId: e.id,
          message: `“${e.label}” is set on ${fmt(e.date, { weekday: true })} (${why}). Under Rule 2.514(a), a period counted forward runs to ${fmt(fwd)}; one counted backward from trial runs to ${fmt(back)}. ${isBefore ? `Safest to calendar ${fmt(back)}.` : "Calendar the earlier date to be safe."}`,
        });
      }
    }
  }

  // MSJ squeeze: response is due 40 days after service; hearing ≥10 days after the response deadline (Rule 1.510(c)(5)-(6)).
  const msj = by("msjFile");
  const hearBy = by("msjHeard") ?? by("msjResolve") ?? by("pretrialMotionsResolve") ?? by("pretrial") ?? by("calendarCall");
  if (msj && hearBy && diffDays(msj.date, hearBy.date) < 50) {
    const latest = rollToCourtDay(addDays(hearBy.date, -50), -1, calendar).date;
    w.push({
      level: "warn", itemId: "msjFile",
      message: `An MSJ served on the filing deadline (${fmt(msj.date)}) can't be fully briefed and heard by “${hearBy.label}” (${fmt(hearBy.date)}): the response is due 40 days after service and the hearing must be ≥10 days later (Rule 1.510(c)(5)–(6)). To be heard in time without a stipulation, serve by ${fmt(latest)}.`,
    });
  }

  // Sequence sanity checks.
  const order: [string, string, string][] = [
    ["factDiscovery", "expertDiscovery", "Fact discovery closes after expert discovery"],
    ["expertP", "expertD", "Defense expert disclosure falls before plaintiff's"],
    ["mediation", "trial", "Mediation deadline falls after trial"],
    ["msjFile", "trial", "MSJ deadline falls after trial"],
  ];
  for (const [a, b, msg] of order) {
    const A = by(a), B = by(b) ?? (b === "trial" ? by("projectedTrial") ?? by("trialTerm") : undefined);
    if (A && B && A.date > B.date) w.push({ level: "warn", itemId: a, message: `${msg} (${fmt(A.date)} vs ${fmt(B.date)}). Check the order for a typo.` });
  }

  // Time standard check.
  const trial = ctx.anchors.trial;
  if (trial && !trial.estimated && ctx.standardDate) {
    const over = diffDays(ctx.standardDate, trial.date);
    if (over > 31) w.push({ level: "info", message: `Trial is set ${over} days beyond the Rule 2.250 time standard for this track (${fmt(ctx.standardDate)}). Continuances are disfavored under Rule 1.460 — expect little flexibility.` });
  }

  const est = (["calendarCall", "pretrial"] as const).find((k) => ctx.schedule?.backAnchor === k && ctx.anchors[k]?.estimated);
  if (!ctx.useOrder && est) {
    w.push({ level: "warn", message: `Deadlines counted back from the ${est === "calendarCall" ? "Calendar Call" : "pretrial conference"} are estimates until that date is set. Enter it from your trial order to lock them in.` });
  } else if (!ctx.useOrder && ctx.schedule?.backAnchor === "trial" && trial?.estimated && ctx.schedule.items.some((i) => i.anchor === "trial")) {
    w.push({ level: "info", message: "Deadlines counted back from trial use the projected trial date until the firm trial date is entered." });
  }
  return w;
}
