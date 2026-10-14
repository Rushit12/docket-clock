import { describe, expect, it } from "vitest";
import { computeDeadline } from "./compute";
import { addMonths } from "./dates";
import { buildCalendar, coreHolidays, goodFriday } from "./holidays";
import { generateTimeline } from "./generate";
import { parseOrderText } from "./parser";
import { CIRCUITS } from "./circuits";

const cal = buildCalendar({ goodFriday: true, roshHashanah: true, yomKippur: true }, 2025, 2028);

describe("Florida court holidays", () => {
  it("matches the 6th Circuit's published 2026 core holidays", () => {
    expect(coreHolidays(2026).map((h) => h.date)).toEqual([
      "2026-01-01", "2026-01-19", "2026-05-25", "2026-07-03", "2026-09-07", "2026-11-11", "2026-11-26", "2026-11-27", "2026-12-25",
    ]);
  });
  it("handles weekend observance in 2027 (July 4 Sun → Mon, Christmas Sat → Fri, New Year's 2028 → Dec 31)", () => {
    const d = coreHolidays(2027).map((h) => h.date);
    expect(d).toContain("2027-07-05");
    expect(d).toContain("2027-12-24");
    expect(d).toContain("2027-12-31");
  });
  it("computes Good Friday", () => {
    expect(goodFriday(2025).date).toBe("2025-04-18");
    expect(goodFriday(2026).date).toBe("2026-04-03");
    expect(goodFriday(2027).date).toBe("2027-03-26");
  });
});

describe("Rule 2.514 computation", () => {
  it("excludes the trigger day and keeps a weekday result", () => {
    expect(computeDeadline("2026-01-02", 20, cal).date).toBe("2026-01-22");
  });
  it("rolls a Saturday forward to Monday", () => {
    const r = computeDeadline("2026-10-13", 4, cal);
    expect(r.raw).toBe("2026-10-17");
    expect(r.date).toBe("2026-10-19");
    expect(r.rolled).toBe(true);
  });
  it("rolls past Thanksgiving, the Friday after, and the weekend", () => {
    expect(computeDeadline("2026-11-16", 10, cal).date).toBe("2026-11-30");
  });
  it("rolls backward for periods measured before an event (2.514(a)(5))", () => {
    expect(computeDeadline("2027-06-07", -30, cal).date).toBe("2027-05-07");
  });
  it("adds 5 days for mail service only", () => {
    expect(computeDeadline("2026-03-02", 30, cal, { mailService: true }).date).toBe("2026-04-06");
  });
  it("clamps month math to month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("Timeline generation", () => {
  const base = {
    name: "Test v. Insured", court: "circuit" as const, caseType: "auto" as const, jury: true,
    filingDate: "2026-01-05", serviceClientDate: "2026-01-20", serviceLastDate: "2026-02-02",
  };
  it("13th Circuit general: projected trial term 540 days after filing", () => {
    const r = generateTimeline({ ...base, county: "Hillsborough", track: "general" });
    const t = r.entries.find((e) => e.id === "trialTerm")!;
    expect(t.date).toBe("2027-06-29");
    const fact = r.entries.find((e) => e.id === "factDiscovery")!;
    expect(fact.raw).toBe("2026-10-02");
  });
  it("17th Circuit general counts back from an entered Calendar Call", () => {
    const r = generateTimeline({ ...base, county: "Broward", track: "general", calendarCallDate: "2027-06-07" });
    expect(r.entries.find((e) => e.id === "discoveryComplete")!.date).toBe("2027-05-07");
    expect(r.entries.find((e) => e.id === "msjFile")!.date).toBe("2027-03-09");
    expect(r.entries.find((e) => e.id === "msjFile")!.confidence).toBe("verified");
  });
  it("marks backward deadlines as estimates when the Calendar Call isn't set", () => {
    const r = generateTimeline({ ...base, county: "Broward", track: "general" });
    expect(r.entries.find((e) => e.id === "msjFile")!.confidence).toBe("estimate");
    expect(r.warnings.some((w) => /estimates until/.test(w.message))).toBe(true);
  });
  it("answer is due 20 days after service on the client", () => {
    const r = generateTimeline({ ...base, county: "Orange", track: "general" });
    expect(r.entries.find((e) => e.id === "answer")!.date).toBe("2026-02-09");
  });
  it("flags a filing after the 2-year negligence SOL", () => {
    const r = generateTimeline({ ...base, county: "Orange", track: "general", dateOfLoss: "2023-12-01" });
    expect(r.entries.find((e) => e.id === "sol")!.date).toBe("2025-12-01");
    expect(r.warnings.some((w) => w.itemId === "sol")).toBe(true);
  });
  it("covers all 67 counties", () => {
    expect(CIRCUITS.flatMap((c) => c.counties)).toHaveLength(67);
  });
});

describe("CMO text parser", () => {
  const sample = `CASE MANAGEMENT DEADLINES
Deadline for Service of Complaint: 05/04/2026
Deadline for Adding Parties:
07/06/2026
Deadline for Fact Discovery Completion (Including Depositions): November 2, 2026
Deadline for Expert Disclosure: 9/14/26
Deadline for Filing and Service of Motions for Summary Judgment: 120 days before trial
Deadline for ADR/Mediation: March 1, 2027
Projected Trial Date: 06/07/2027
DONE AND ORDERED in Chambers this 5th day of January, 2026.`;
  const items = parseOrderText(sample);
  it("extracts dated rows, including split lines", () => {
    const get = (id: string) => items.find((i) => i.id === id);
    expect(get("service")?.date).toBe("2026-05-04");
    expect(get("addParties")?.date).toBe("2026-07-06");
    expect(get("factDiscovery")?.date).toBe("2026-11-02");
    expect(get("expertDisclosure")?.date).toBe("2026-09-14");
    expect(get("mediation")?.date).toBe("2027-03-01");
    expect(get("trial")?.date).toBe("2027-06-07");
  });
  it("captures relative deadlines", () => {
    const msj = items.find((i) => i.id === "msjFile");
    expect(msj?.relative).toEqual({ days: -120, anchor: "trial" });
  });
  it("ignores the signature line", () => {
    expect(items.some((i) => /DONE AND ORDERED/i.test(i.sourceLine))).toBe(false);
  });
});

describe("Imported orders", () => {
  it("uses the order's trial date for the PFS cutoff", () => {
    const r = generateTimeline(
      { name: "x", county: "Miami-Dade", court: "circuit", caseType: "auto", track: "general", jury: true, filingDate: "2025-12-08" },
      { orderItems: [{ id: "trial", label: "Projected Trial Date", category: "trial", date: "2027-06-07" }] },
    );
    expect(r.entries.find((e) => e.id === "pfsLast")!.date).toBe("2027-04-23");
    expect(r.entries.filter((e) => e.id === "projectedTrial")).toHaveLength(0);
  });
});

import { latestTrigger, TASKS } from "./tasks";

describe("Work-back tasks", () => {
  const broward = {
    name: "x", county: "Broward", court: "circuit" as const, caseType: "auto" as const, track: "general" as const, jury: true,
    filingDate: "2026-07-10", serviceClientDate: "2026-08-03", serviceLastDate: "2026-08-10", calendarCallDate: "2027-12-06", trialDate: "2027-12-13",
  };
  const r = generateTimeline(broward);
  const get = (id: string) => r.entries.find((e) => e.id === id);

  it("latestTrigger keeps the 30-day response inside the cutoff, even across a weekend", () => {
    // Cutoff Mon 2027-11-08. Serving 2027-10-09 (Sat) is not a court day; the latest court day is Fri 2027-10-08.
    expect(latestTrigger("2027-11-08", 30, cal, false)).toBe("2027-10-08");
    // By mail: 35 days → 2027-10-04 (Mon).
    expect(latestTrigger("2027-11-08", 30, cal, true)).toBe("2027-10-04");
  });
  it("removal deadline is 30 days after service on our client", () => {
    expect(get("t_removal")!.date).toBe("2026-09-02");
  });
  it("plaintiff's answers come due 30 days after our discovery is served", () => {
    expect(get("t_serve_disc")!.date).toBe("2026-10-05");
    expect(get("t_disc_resp")!.date).toBe("2026-11-04");
  });
  it("mediation certification of authority is 10 days before mediation (Rule 1.720(e))", () => {
    expect(get("mediation")!.date).toBe("2027-10-07");
    expect(get("t_med_cert")!.date).toBe("2027-09-27");
  });
  it("rule work-back tasks never land after a stricter CMO deadline", () => {
    const init = get("discoveryInitiated")!.date;
    expect(get("t_last_written")!.date <= init).toBe(true);
    expect(get("t_last_depo_notice")!.date <= init).toBe(true);
  });
  it("skips the MSJ briefing task when the CMO's filing deadline is earlier", () => {
    expect(get("t_msj_last")).toBeUndefined();
  });
  it("only adds CME tasks for injury cases and property tasks for property cases", () => {
    const prop = generateTimeline({ ...broward, caseType: "propertyInsurance" });
    expect(prop.entries.some((e) => e.id === "t_cme_request")).toBe(false);
    expect(prop.entries.some((e) => e.id === "t_presuit")).toBe(true);
    expect(get("t_cme_request")).toBeDefined();
  });
  it("every task lands on an open court day", () => {
    for (const e of r.entries.filter((x) => x.kind === "task")) {
      const day = new Date(e.date + "T00:00:00Z").getUTCDay();
      expect(day === 0 || day === 6 || cal.closed.has(e.date), `${e.id} on ${e.date}`).toBe(false);
    }
  });
  it("task ids are unique", () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    const ids = r.entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("respects firm settings", () => {
    const off = generateTimeline(broward, { settings: { disabled: { t_hold: true }, days: { t_exp_retain: -120 }, carrierReports: false } });
    expect(off.entries.some((e) => e.id === "t_hold")).toBe(false);
    expect(off.entries.some((e) => e.phase === "Carrier reporting")).toBe(false);
    expect(off.entries.find((e) => e.id === "t_exp_retain")!.date < get("t_exp_retain")!.date).toBe(true);
  });
  it("estimates tasks from the projected trial when a circuit has no CMO form", () => {
    const orange = generateTimeline({ ...broward, county: "Orange", calendarCallDate: undefined, trialDate: undefined });
    const t = orange.entries.find((e) => e.id === "t_exp_retain")!;
    expect(t.confidence).toBe("estimate");
  });
});
