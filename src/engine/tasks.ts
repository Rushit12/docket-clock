import { computeDeadline, rollToCourtDay } from "./compute";
import { addDays, fmt, type ISODate, isValidISO } from "./dates";
import type { HolidayCalendar } from "./holidays";
import type { CaseInputs, Confidence, Phase, Role, TimelineEntry } from "./types";

/**
 * The work-back task library: everything a defense team does to meet each court
 * deadline. Two kinds of tasks:
 *
 *  - "rule"     — the timing is forced by a rule (e.g. written discovery must be served
 *                 30 days before the cutoff so responses come due in time, Rule 1.340/1.350/1.370).
 *                 These are computed exactly, including Rule 2.514 rolling and mail days.
 *  - "practice" — firm / carrier-guideline lead times (e.g. retain experts 90 days before
 *                 disclosure). Shown as "Firm practice" and editable in Settings.
 */

export const INJURY_TYPES = ["auto", "premises", "negligentSecurity", "otherNegligence", "umUim"] as const;

type Ctx = {
  input: CaseInputs;
  find: (ids: string[]) => TimelineEntry | undefined;
};

export interface TaskTemplate {
  id: string;
  title: string;
  phase: Phase;
  role: Role;
  /** Parent deadline ids, first match wins; "@assigned" | "@serviceClient" | "@trial" are anchors; "#taskId" chains to another task. */
  parent: string[];
  parentName: string;
  /** Used when no parent exists yet (no CMO date): days relative to the projected trial; result is an estimate. */
  fallbackTrialDays?: number;
  days: number;
  basis: "rule" | "practice";
  /** Rule work-back: latest date to act so a response period of N days ends on or before the parent. */
  fit?: { responseDays: number; mailAdds: boolean; cushion?: number };
  /** Forward counting from the parent (response periods), rolled forward. Otherwise work-back rolls backward. */
  forward?: boolean;
  citation?: string;
  why: string;
  checklist?: string[];
  when?: (c: Ctx) => boolean;
  /** Used when none of `parent` exists yet (e.g. no service date entered). */
  alt?: { parent: string[]; days: number; name: string };
  /** Never later than this many days from another deadline (first found). */
  notLaterThan?: { parent: string[]; days: number; why: string };
  /** For rule work-back items: if the CMO sets an earlier deadline for the same act, use that one. */
  clampTo?: { ids: string[]; why: string };
  /** Skip the task when one of these deadlines already comes first (the CMO is stricter). */
  skipIfEarlier?: string[];
  /** Repeat every N days after the first occurrence until N days before trial. */
  repeat?: { every: number; stopBeforeTrial: number; max: number };
}

const FACT = ["factDiscovery", "discoveryComplete", "discovery", "expertDiscovery"];
const EXP_DEF = ["expertD", "expertDisclosure", "expertP"];
const EXP_P = ["expertP", "expertDisclosure"];
const EXP_CUT = ["expertDiscovery", "discoveryComplete", "discovery"];
const MSJ_HEAR = ["msjHeard", "msjResolve", "pretrialMotionsResolve", "calendarCall", "pretrial", "@trial"];
const MED = ["mediation"];
const TRIAL = ["@trial"];
const injury = (c: Ctx) => (INJURY_TYPES as readonly string[]).includes(c.input.caseType);
const circuitCourt = (c: Ctx) => c.input.court === "circuit";

export const TASKS: TaskTemplate[] = [
  // ---------------- Intake & pleadings ----------------
  { id: "t_ack", title: "Acknowledge the assignment to the carrier; open the file and run conflicts", phase: "Intake & pleadings", role: "Legal assistant", parent: ["@assigned"], parentName: "file assignment", days: 1, basis: "practice", why: "Most carrier litigation guidelines require acknowledgment within 24–48 hours of assignment." },
  { id: "t_appearance", title: "File notice of appearance and designate e-mail addresses for service", phase: "Intake & pleadings", role: "Legal assistant", parent: ["@assigned"], parentName: "file assignment", days: 2, basis: "practice", citation: "Fla. R. Gen. Prac. & Jud. Admin. 2.516", why: "Puts you on the e-service list so no order or motion is missed." },
  { id: "t_hold", title: "Send litigation-hold / preservation letter to the insured", phase: "Intake & pleadings", role: "Paralegal", parent: ["@assigned"], parentName: "file assignment", days: 3, basis: "practice", why: "Preserves vehicle data, photos, video, maintenance and incident records before they're lost.",
    checklist: ["Vehicle / EDR data and repair records", "Phones, texts and photos from the scene", "Surveillance video and incident reports (premises)", "Maintenance, inspection and policy documents"] },
  { id: "t_claimfile", title: "Request the claim file, policy and declarations, recorded statements and photos", phase: "Intake & pleadings", role: "Paralegal", parent: ["@assigned"], parentName: "file assignment", days: 3, basis: "practice", why: "You need the policy for initial disclosures (Rule 1.280(a)(1)(D)) and the file to answer." },
  { id: "t_priorclaims", title: "Run prior-claims, background and social media searches on the plaintiff", phase: "Intake & pleadings", role: "Paralegal", parent: ["@assigned"], parentName: "file assignment", days: 7, basis: "practice", why: "Prior injuries and claims drive causation and damages defenses.", when: injury,
    checklist: ["ISO ClaimSearch / prior claims", "Prior lawsuits (clerk search)", "Public social media", "Prior medical providers"] },
  { id: "t_interview", title: "Interview the insured / client", phase: "Intake & pleadings", role: "Attorney", parent: ["@assigned"], parentName: "file assignment", days: 7, basis: "practice", why: "Facts for the answer, affirmative defenses and Fabre nonparties." },
  { id: "t_removal", title: "Last day to remove to federal court (if diversity jurisdiction exists)", phase: "Intake & pleadings", role: "Attorney", parent: ["@serviceClient"], parentName: "service on our client", days: 30, forward: true, basis: "rule", citation: "28 U.S.C. §1446(b)(1); §1332(a)", why: "A notice of removal must be filed within 30 days after the defendant receives the initial pleading. Diversity removal also requires complete diversity and more than $75,000 in controversy, and is barred more than 1 year after commencement (§1446(c)(1)).", when: circuitCourt },
  { id: "t_defenses", title: "Evaluate defenses and draft the answer and affirmative defenses", phase: "Intake & pleadings", role: "Attorney", parent: ["answer"], parentName: "answer deadline", days: -7, basis: "practice", citation: "Fla. R. Civ. P. 1.140; §768.81, Fla. Stat.", why: "Defenses not raised can be waived; Fabre nonparties must be pled to go on the verdict form.",
    checklist: ["Statute of limitations (2 years for negligence after HB 837)", "Comparative fault — plaintiff more than 50% at fault is barred (§768.81(6))", "Fabre nonparties identified (§768.81(3))", "Set-off / collateral source (§768.76)", "PIP permanency threshold (§627.737(2)) for auto", "Rule 1.140(b) motion grounds"] },
  { id: "t_presuit", title: "Check the §627.70152 notice of intent to litigate (10 business days before suit)", phase: "Intake & pleadings", role: "Attorney", parent: ["answer"], parentName: "answer deadline", days: -7, basis: "rule", citation: "§627.70152(3), (5), Fla. Stat.", why: "Residential and commercial property suits must be preceded by the statutory notice; if it wasn't given, the court must dismiss without prejudice.", when: (c) => c.input.caseType === "propertyInsurance" },
  { id: "t_crn", title: "Check the civil remedy notice and the 60-day cure period", phase: "Intake & pleadings", role: "Attorney", parent: ["answer"], parentName: "answer deadline", days: -7, basis: "rule", citation: "§624.155(3), Fla. Stat.", why: "A bad-faith action requires 60 days' written notice to the Department of Financial Services and the insurer before suit.", when: (c) => c.input.caseType === "badFaith" },
  { id: "t_extension", title: "If more time is needed, confer and file for an extension to respond", phase: "Intake & pleadings", role: "Legal assistant", parent: ["answer"], parentName: "answer deadline", days: -7, basis: "practice", citation: "Fla. R. Civ. P. 1.090(b); 1.202", why: "An extension must be requested before the deadline expires; non-dispositive motions need a conferral certificate." },
  { id: "t_initialreport", title: "Initial case evaluation report and litigation budget to the carrier", phase: "Carrier reporting", role: "Attorney", parent: ["@assigned"], parentName: "file assignment", days: 30, basis: "practice", why: "Most carrier guidelines require an initial evaluation within 30 days of assignment.",
    checklist: ["Liability analysis", "Damages and medical specials to date", "Coverage notes (report to the carrier only)", "Recommended plan and budget", "Early settlement value range"] },
  { id: "t_status", title: "Status report to the carrier", phase: "Carrier reporting", role: "Attorney", parent: ["#t_initialreport"], parentName: "initial report", days: 90, forward: true, basis: "practice", why: "Periodic status reports, typically every 90 days, keep reserves and authority current.", repeat: { every: 90, stopBeforeTrial: 75, max: 12 } },

  // ---------------- Disclosures & written discovery ----------------
  { id: "t_disc_prep", title: "Gather initial-disclosure materials", phase: "Disclosures & written discovery", role: "Paralegal", parent: ["initialDisclosures"], parentName: "initial disclosures", days: -14, basis: "practice", citation: "Fla. R. Civ. P. 1.280(a)(1)",
    why: "Initial disclosures must be based on information reasonably available; incomplete investigation is not an excuse.",
    checklist: ["Witnesses with knowledge and subjects", "Documents and ESI you may use (copies or descriptions)", "Damages computation (for any counterclaim)", "Copy of the insurance policy"] },
  { id: "t_serve_disc", title: "Serve first interrogatories, requests for production and requests for admission", phase: "Disclosures & written discovery", role: "Paralegal", parent: ["initialDisclosures"], parentName: "initial disclosures", days: 1, forward: true, basis: "practice", citation: "Fla. R. Civ. P. 1.280(f)(1); 1.340; 1.350; 1.370",
    why: "You can't seek discovery until your own initial disclosures are served. Serve right after, so plaintiff's answers arrive early.",
    checklist: ["Standard interrogatories adjusted for proportionality (Rule 1.340 commentary)", "RFPs: medical records, bills, LOP agreements (§768.0427), prior claims", "RFAs on liability facts and authenticity"] },
  { id: "t_disc_resp", title: "Plaintiff's answers to our first discovery are due", phase: "Disclosures & written discovery", role: "Paralegal", parent: ["#t_serve_disc"], parentName: "service of our first discovery", days: 30, forward: true, basis: "rule", citation: "Fla. R. Civ. P. 1.340(a), 1.350(b), 1.370(a); 2.514", why: "30 days after service (plus 5 if served by mail). Unanswered requests for admission are deemed admitted." },
  { id: "t_deficiency", title: "Send Rule 1.202 conferral letter on deficient or missing responses", phase: "Disclosures & written discovery", role: "Paralegal", parent: ["#t_disc_resp"], parentName: "plaintiff's responses", days: 10, forward: true, basis: "practice", citation: "Fla. R. Civ. P. 1.202; 1.380", why: "Conferral is required before a motion to compel; objections must be specific (Rules 1.340, 1.350)." },
  { id: "t_last_written", title: "Last day to serve written discovery so answers come due before the fact-discovery cutoff", phase: "Disclosures & written discovery", role: "Paralegal", parent: FACT, parentName: "fact-discovery cutoff", fallbackTrialDays: -120, days: 0, fit: { responseDays: 30, mailAdds: true }, clampTo: { ids: ["discoveryInitiated", "writtenDiscovery"], why: "your CMO requires written discovery to be served by then" }, basis: "rule", citation: "Fla. R. Civ. P. 1.340(a), 1.350(b), 1.370(a); 2.514(a)–(b)", why: "Responses are due 30 days after service (35 by mail). Anything served later can't be answered before the cutoff." },
  { id: "t_supplement", title: "Supplement initial disclosures and discovery responses", phase: "Disclosures & written discovery", role: "Paralegal", parent: FACT, parentName: "fact-discovery cutoff", fallbackTrialDays: -120, days: -30, basis: "practice", citation: "Fla. R. Civ. P. 1.280(g); 1.380(d)", why: "There's a continuing duty to supplement; undisclosed information can be excluded." },

  // ---------------- Records & subpoenas ----------------
  { id: "t_records", title: "Request medical, employment and billing records; serve notices of intent to subpoena", phase: "Records & subpoenas", role: "Paralegal", parent: ["initialDisclosures"], parentName: "initial disclosures", days: 7, forward: true, basis: "practice", citation: "Fla. R. Civ. P. 1.351(b)", why: "Each non-party subpoena needs 10 days' notice (15 by mail) before it issues, then time for the provider to produce.", when: injury,
    checklist: ["Treating providers (5–10 years prior)", "Pharmacy and PIP / health insurer payment ledgers", "Employer and wage records (lost wages claim)", "Letter-of-protection and factoring documents (§768.0427)"] },
  { id: "t_last_subpoena", title: "Last day to serve notice of intent to subpoena records and still receive them before the cutoff", phase: "Records & subpoenas", role: "Paralegal", parent: FACT, parentName: "fact-discovery cutoff", fallbackTrialDays: -120, days: 0, fit: { responseDays: 10, mailAdds: true, cushion: 30 }, clampTo: { ids: ["discoveryInitiated"], why: "your CMO requires all discovery to be initiated by then" }, basis: "rule", citation: "Fla. R. Civ. P. 1.351(b)", why: "10 days' notice before the subpoena issues (15 by mail), plus a 30-day production cushion." },

  // ---------------- Depositions ----------------
  { id: "t_depo_pl", title: "Take plaintiff's deposition", phase: "Depositions", role: "Attorney", parent: ["#t_disc_resp"], parentName: "plaintiff's discovery answers", alt: { parent: FACT, days: -90, name: "fact-discovery cutoff" }, fallbackTrialDays: -120, days: 30, forward: true, notLaterThan: { parent: FACT, days: -90, why: "no later than 90 days before the fact-discovery cutoff" }, basis: "practice", why: "About a month after plaintiff's discovery answers come in, leaving time to follow up on new providers and witnesses before the cutoff.",
    checklist: ["Discovery answers and records reviewed", "Prior claims and social media", "Surveillance coordinated (if used)"] },
  { id: "t_notice_pl", title: "Notice plaintiff's deposition", phase: "Depositions", role: "Legal assistant", parent: ["#t_depo_pl"], parentName: "plaintiff's deposition", days: -15, basis: "practice", citation: "Fla. R. Civ. P. 1.310(b)(1)", why: "Rule 1.310 requires reasonable written notice; coordinate dates with opposing counsel first." },
  { id: "t_depo_summary", title: "Deposition summary to the carrier", phase: "Carrier reporting", role: "Paralegal", parent: ["#t_depo_pl"], parentName: "plaintiff's deposition", days: 7, forward: true, basis: "practice", why: "Most carriers expect a summary and updated evaluation after key depositions." },
  { id: "t_prep_insured", title: "Prepare the insured / client for deposition", phase: "Depositions", role: "Attorney", parent: ["#t_depo_pl"], parentName: "plaintiff's deposition", alt: { parent: FACT, days: -75, name: "fact-discovery cutoff" }, fallbackTrialDays: -120, days: 14, forward: true, notLaterThan: { parent: FACT, days: -45, why: "no later than 45 days before the fact-discovery cutoff" }, basis: "practice", why: "Defense witness depositions are usually requested soon after plaintiff's." },
  { id: "t_corp_rep", title: "Designate and prepare the corporate representative (Rule 1.310(b)(6))", phase: "Depositions", role: "Attorney", parent: FACT, parentName: "fact-discovery cutoff", fallbackTrialDays: -120, days: -60, basis: "practice", citation: "Fla. R. Civ. P. 1.310(b)(6)", why: "The entity must designate and prepare a witness on each listed topic.", when: (c) => ["premises", "negligentSecurity", "propertyInsurance", "badFaith"].includes(c.input.caseType) },
  { id: "t_last_depo_notice", title: "Last day to notice fact-witness depositions", phase: "Depositions", role: "Legal assistant", parent: FACT, parentName: "fact-discovery cutoff", fallbackTrialDays: -120, days: -10, clampTo: { ids: ["discoveryInitiated"], why: "your CMO requires all discovery to be initiated by then" }, basis: "practice", citation: "Fla. R. Civ. P. 1.310(b)(1)", why: "Leaves reasonable notice before the cutoff. Depositions after the cutoff need a court order." },
  { id: "t_fact_depos", title: "Complete treating-provider and fact-witness depositions", phase: "Depositions", role: "Attorney", parent: FACT, parentName: "fact-discovery cutoff", fallbackTrialDays: -120, days: -7, basis: "practice", why: "Buffer before the cutoff for rescheduled depositions." },

  // ---------------- Medical exam ----------------
  { id: "t_cme_retain", title: "Retain the CME physician and send the medical records", phase: "Medical exam", role: "Paralegal", parent: ["cme"], parentName: "CME deadline", fallbackTrialDays: -120, days: -75, basis: "practice", why: "Examiners book out weeks ahead and need records before the exam.", when: injury },
  { id: "t_cme_request", title: "Serve the Rule 1.360 request for examination", phase: "Medical exam", role: "Paralegal", parent: ["cme"], parentName: "CME deadline", fallbackTrialDays: -120, days: -60, basis: "practice", citation: "Fla. R. Civ. P. 1.360(a)(1)", why: "Leaves the 30-day response period plus time to reschedule before the deadline.", when: injury,
    checklist: ["Time, place, manner, conditions and scope", "Name of the examiner", "Who may attend / recording terms"] },
  { id: "t_cme_last", title: "Last day to serve the Rule 1.360 request so the response period runs before the CME deadline", phase: "Medical exam", role: "Paralegal", parent: ["cme"], parentName: "CME deadline", fallbackTrialDays: -120, days: 0, fit: { responseDays: 30, mailAdds: true }, basis: "rule", citation: "Fla. R. Civ. P. 1.360(a)(1); 2.514", why: "The plaintiff has 30 days to respond to the request.", when: injury },
  { id: "t_cme_report", title: "Obtain the CME report", phase: "Medical exam", role: "Paralegal", parent: ["cme"], parentName: "CME deadline", fallbackTrialDays: -120, days: 14, forward: true, basis: "practice", citation: "Fla. R. Civ. P. 1.360(b)", why: "The examined party can request the report; it also feeds your expert disclosure.", when: injury },

  // ---------------- Experts ----------------
  { id: "t_exp_identify", title: "Identify the defense experts the case needs", phase: "Experts", role: "Attorney", parent: EXP_DEF, parentName: "defense expert disclosure", fallbackTrialDays: -150, days: -120, basis: "practice", why: "Specialty matches the plaintiff's injury and damages theory.",
    checklist: ["Orthopedic / neurosurgery / radiology", "Biomechanical or accident reconstruction", "Billing / reasonable-value expert (§768.0427)", "Life-care planner and economist (if future damages)", "Engineer / estimator (property)"] },
  { id: "t_exp_retain", title: "Retain experts (with carrier approval)", phase: "Experts", role: "Attorney", parent: EXP_DEF, parentName: "defense expert disclosure", fallbackTrialDays: -150, days: -90, basis: "practice", why: "Carrier approval for expert spend usually comes first." },
  { id: "t_exp_records", title: "Send records and materials to the experts", phase: "Experts", role: "Paralegal", parent: EXP_DEF, parentName: "defense expert disclosure", fallbackTrialDays: -150, days: -60, basis: "practice", why: "Experts need the complete record to form opinions before disclosure." },
  { id: "t_exp_opinions", title: "Receive expert opinions; prepare Rule 1.280(c)(5) disclosure and CVs", phase: "Experts", role: "Paralegal", parent: EXP_DEF, parentName: "defense expert disclosure", fallbackTrialDays: -150, days: -14, basis: "practice", citation: "Fla. R. Civ. P. 1.280(c)(5)", why: "Opinions not disclosed can be excluded at trial.",
    checklist: ["Subject matter and substance of opinions", "Summary of grounds", "Current CV and fee schedule", "Available deposition dates"] },
  { id: "t_exp_p_dates", title: "Request deposition dates for plaintiff's experts", phase: "Experts", role: "Legal assistant", parent: EXP_P, parentName: "plaintiff expert disclosure", fallbackTrialDays: -150, days: 7, forward: true, basis: "practice", why: "Expert calendars fill quickly; book early to finish before the expert cutoff." },
  { id: "t_exp_last_notice", title: "Last day to notice expert depositions", phase: "Experts", role: "Legal assistant", parent: EXP_CUT, parentName: "expert-discovery cutoff", fallbackTrialDays: -60, days: -10, clampTo: { ids: ["discoveryInitiated"], why: "your CMO requires all discovery to be initiated by then" }, basis: "practice", citation: "Fla. R. Civ. P. 1.310(b)(1)", why: "Reasonable notice before the expert cutoff." },
  { id: "t_daubert", title: "Draft Daubert / §90.702 challenges to plaintiff's experts", phase: "Experts", role: "Attorney", parent: ["daubertFile", "daubert", "daubertHeard", "pretrialMotionsResolve", "pretrialMotions"], parentName: "expert-challenge deadline", fallbackTrialDays: -45, days: -14, basis: "practice", citation: "§90.702, Fla. Stat.", why: "Many circuits treat an unheard challenge as waived." },

  // ---------------- Dispositive motions ----------------
  { id: "t_msj_eval", title: "Evaluate summary-judgment grounds", phase: "Dispositive motions", role: "Attorney", parent: ["msjFile"], parentName: "MSJ filing deadline", fallbackTrialDays: -90, days: -60, basis: "practice", citation: "Fla. R. Civ. P. 1.510(a)", why: "Florida uses the federal (Celotex) standard; target the record you need while discovery is open.",
    checklist: ["Liability / no duty / open-and-obvious", "Plaintiff more than 50% at fault (§768.81(6))", "Permanency threshold (§627.737(2)) for auto", "Statute of limitations", "Coverage or contract defenses"] },
  { id: "t_msj_hearing", title: "Reserve MSJ hearing time", phase: "Dispositive motions", role: "Legal assistant", parent: ["msjFile"], parentName: "MSJ filing deadline", fallbackTrialDays: -90, days: -14, basis: "practice", citation: "Fla. R. Civ. P. 1.510(c)(6)", why: "The hearing must be at least 10 days after the 40-day response deadline; hearing time is often scarce." },
  { id: "t_msj_last", title: "Last day to serve an MSJ that can be fully briefed and heard in time", phase: "Dispositive motions", role: "Attorney", parent: MSJ_HEAR, parentName: "MSJ hearing deadline", days: -10, fit: { responseDays: 40, mailAdds: true }, skipIfEarlier: ["msjFile"], basis: "rule", citation: "Fla. R. Civ. P. 1.510(c)(5)–(6)", why: "The response is due 40 days after service and the hearing must be at least 10 days later, unless the parties stipulate or the court orders otherwise." },

  // ---------------- Mediation & settlement ----------------
  { id: "t_med_select", title: "Select the mediator and reserve the mediation date", phase: "Mediation & settlement", role: "Legal assistant", parent: MED, parentName: "mediation deadline", fallbackTrialDays: -60, days: -90, basis: "practice", citation: "Fla. R. Civ. P. 1.720", why: "Experienced mediators book months ahead; the deadline is when mediation must be completed." },
  { id: "t_pfs_eval", title: "Evaluate serving a proposal for settlement", phase: "Mediation & settlement", role: "Attorney", parent: MED, parentName: "mediation deadline", fallbackTrialDays: -60, days: -45, basis: "practice", citation: "§768.79; Fla. R. Civ. P. 1.442", why: "A well-timed proposal shifts fee exposure; the window closes 45 days before trial." },
  { id: "t_premed", title: "Pre-mediation report and settlement-authority request to the carrier", phase: "Carrier reporting", role: "Attorney", parent: MED, parentName: "mediation deadline", fallbackTrialDays: -60, days: -30, basis: "practice", why: "Carriers typically need 30 days to review and set authority." },
  { id: "t_med_cert", title: "File and serve the certification of authority for mediation", phase: "Mediation & settlement", role: "Legal assistant", parent: MED, parentName: "mediation deadline", fallbackTrialDays: -60, days: -10, basis: "rule", citation: "Fla. R. Civ. P. 1.720(e)", why: "Due 10 days before the mediation conference. Shown against the mediation deadline; move it to 10 days before the date you actually set." },
  { id: "t_med_summary", title: "Send the mediation summary to the mediator", phase: "Mediation & settlement", role: "Attorney", parent: MED, parentName: "mediation deadline", fallbackTrialDays: -60, days: -7, basis: "practice", why: "Most mediators ask for a confidential summary a week ahead." },
  { id: "t_med_report", title: "Report the mediation result to the carrier", phase: "Carrier reporting", role: "Attorney", parent: MED, parentName: "mediation deadline", fallbackTrialDays: -60, days: 1, forward: true, basis: "practice", why: "Same-day or next-day report is standard." },

  // ---------------- Trial preparation ----------------
  { id: "t_pretrial_report", title: "Pretrial report and trial budget to the carrier", phase: "Carrier reporting", role: "Attorney", parent: TRIAL, parentName: "trial", days: -60, basis: "practice", why: "Carriers need time for final authority and trial approval." },
  { id: "t_witness_avail", title: "Confirm witness availability; preserve testimony of anyone unavailable", phase: "Trial preparation", role: "Paralegal", parent: TRIAL, parentName: "trial", days: -45, basis: "practice", citation: "Fla. R. Civ. P. 1.330(a)(3)", why: "Unavailable-witness testimony is preserved by deposition; expert unavailability rarely supports a continuance." },
  { id: "t_mil_draft", title: "Draft motions in limine", phase: "Trial preparation", role: "Attorney", parent: ["milFile", "pretrialMotions", "pretrialMotionsFile"], parentName: "motion in limine deadline", fallbackTrialDays: -30, days: -14, basis: "practice", why: "Collateral source, LOPs and medical-expense evidence (§768.0427), prior claims, and undisclosed opinions." },
  { id: "t_jury", title: "Prepare jury instructions and verdict form", phase: "Trial preparation", role: "Attorney", parent: ["pretrialStip", "pretrialMeet", "@trial"], parentName: "pretrial stipulation", days: -14, basis: "practice", citation: "Fla. Std. Jury Instr. (Civ.)", why: "Agreed and disputed instructions usually attach to the pretrial stipulation.", when: (c) => c.input.jury },
  { id: "t_exhibits", title: "Prepare exhibit list and exhibits; exchange as the trial order requires", phase: "Trial preparation", role: "Paralegal", parent: ["pretrialStip", "pretrialMeet", "@trial"], parentName: "pretrial stipulation", days: -10, basis: "practice", why: "Generic exhibit descriptions are often stricken." },
  { id: "t_stip_draft", title: "Draft the joint pretrial stipulation", phase: "Trial preparation", role: "Attorney", parent: ["pretrialStip", "pretrialMeet", "@trial"], parentName: "pretrial stipulation", days: -7, basis: "practice", why: "Joint stipulations require exchanging drafts with opposing counsel." },
  { id: "t_subpoenas", title: "Serve trial subpoenas", phase: "Trial preparation", role: "Legal assistant", parent: TRIAL, parentName: "trial", days: -21, basis: "practice", citation: "Fla. R. Civ. P. 1.410", why: "Allows time for service and witness fees; on-call agreements reduce no-shows." },
  { id: "t_reporter", title: "Arrange court reporter, interpreter and courtroom technology", phase: "Trial preparation", role: "Legal assistant", parent: TRIAL, parentName: "trial", days: -14, basis: "practice", why: "Check the trial order for who must arrange the reporter." },
  { id: "t_notebook", title: "Trial notebook, witness outlines and exhibits complete", phase: "Trial preparation", role: "Paralegal", parent: TRIAL, parentName: "trial", days: -7, basis: "practice", why: "Final prep window before the trial period." },
];

export interface TaskSettings {
  disabled: Record<string, boolean>;
  days: Record<string, number>;
  carrierReports: boolean;
}
export const DEFAULT_SETTINGS: TaskSettings = { disabled: {}, days: {}, carrierReports: true };

/** Latest date to act so that a response period ends on or before `cutoff` (Rule 2.514 forward rolling, mail days). */
export function latestTrigger(cutoff: ISODate, responseDays: number, cal: HolidayCalendar, mail: boolean): ISODate {
  let x = addDays(cutoff, -responseDays - (mail ? 5 : 0));
  let guard = 0;
  while (computeDeadline(x, responseDays, cal, { mailService: mail }).date > cutoff && guard++ < 20) x = addDays(x, -1);
  return rollToCourtDay(x, -1, cal).date;
}

export function buildTasks(args: {
  input: CaseInputs;
  entries: TimelineEntry[];
  anchors: Partial<Record<string, { date: ISODate; estimated: boolean; label: string }>>;
  calendar: HolidayCalendar;
  settings?: TaskSettings;
  overrides?: Record<string, ISODate>;
}): TimelineEntry[] {
  const { input, entries, anchors, calendar } = args;
  const settings = args.settings ?? DEFAULT_SETTINGS;
  const find = (ids: string[]) => {
    for (const id of ids) {
      const e = entries.find((x) => x.id === id || x.id.startsWith(`${id}_`));
      if (e) return e;
    }
    return undefined;
  };
  const ctx: Ctx = { input, find };
  const out: TimelineEntry[] = [];
  const made = new Map<string, TimelineEntry>();
  const assigned = isValidISO(input.assignedDate) ? input.assignedDate : anchors.serviceClient?.date;
  const trial = anchors.trial;

  for (const t of TASKS) {
    if (settings.disabled[t.id]) continue;
    if (!settings.carrierReports && t.phase === "Carrier reporting") continue;
    if (t.when && !t.when(ctx)) continue;
    let days = t.basis === "practice" && settings.days[t.id] !== undefined ? settings.days[t.id] : t.days;

    // Resolve the parent.
    let base: ISODate | undefined;
    let parentId: string | undefined;
    let parentLabel = t.parentName;
    let estimated = false;
    let shortName = t.parentName;
    for (const p of t.parent) {
      if (p === "@assigned" && assigned) { base = assigned; parentLabel = isValidISO(input.assignedDate) ? "file assignment" : "service on our client (assignment date not entered)"; estimated = !isValidISO(input.assignedDate) && !!anchors.serviceClient?.estimated; break; }
      if (p === "@serviceClient" && anchors.serviceClient) { base = anchors.serviceClient.date; estimated = anchors.serviceClient.estimated; break; }
      if (p === "@trial" && trial) {
        // Trial prep counts from the start of the trial period, or Calendar Call when that comes first.
        const cc = anchors.calendarCall;
        const useCc = cc && !cc.estimated && cc.date < trial.date;
        base = useCc ? cc!.date : trial.date;
        parentId = entries.find((e) => (useCc ? ["calendarCall"] : ["trial", "projectedTrial", "trialTerm"]).includes(e.id))?.id;
        parentLabel = useCc ? "Calendar Call" : trial.estimated ? "projected trial" : "trial";
        shortName = parentLabel;
        estimated = useCc ? false : trial.estimated;
        break;
      }
      if (p.startsWith("#")) { const m = made.get(p.slice(1)); if (m) { base = m.date; parentId = m.id; estimated = m.confidence === "estimate"; break; } continue; }
      const e = find([p]);
      if (e) { base = e.date; parentId = e.id; parentLabel = `${t.parentName}: ${e.label}`; estimated = e.confidence === "estimate"; break; }
    }
    if (!base && t.alt) {
      const e = find(t.alt.parent);
      if (e) { base = e.date; parentId = e.id; parentLabel = `${t.alt.name}: ${e.label}`; shortName = t.alt.name; days = t.alt.days; estimated = e.confidence === "estimate"; }
    }
    if (!base && t.fallbackTrialDays !== undefined && trial) {
      base = addDays(trial.date, t.fallbackTrialDays);
      estimated = true;
      if (t.alt) { days = t.alt.days; shortName = t.alt.name; }
      parentLabel = `${t.alt?.name ?? t.parentName}, not set by your order yet (estimated ${-t.fallbackTrialDays} days before trial)`;
    }
    if (!base) continue;

    const mail = !!input.mailService;
    const push = (id: string, date: ISODate, raw: ISODate, rollReason: string | undefined, basisText: string, title = t.title) => {
      const conf: Confidence = estimated ? "estimate" : t.basis === "rule" ? "rule" : "practice";
      const e: TimelineEntry = {
        id, label: title, category: "defense", date, raw, rolled: date !== raw, rollReason,
        possibleClosure: calendar.possible.get(date), kind: "task", confidence: conf, basis: basisText,
        citation: t.citation, note: t.why, role: t.role, phase: t.phase, parentId, parentLabel, checklist: t.checklist,
        anchorDate: base, anchorLabel: parentLabel.charAt(0).toUpperCase() + parentLabel.slice(1),
      };
      const ov = args.overrides?.[id];
      if (ov && isValidISO(ov)) { e.date = ov; e.raw = ov; e.rolled = false; e.rollReason = undefined; e.confidence = "manual"; e.basis = "Manually set"; }
      out.push(e);
      made.set(id, e);
      return e;
    };

    if (t.fit) {
      const cutoff = addDays(base, days);
      let d = latestTrigger(cutoff, t.fit.responseDays, calendar, t.fit.mailAdds && mail);
      if (t.fit.cushion) d = rollToCourtDay(addDays(d, -t.fit.cushion), -1, calendar).date;
      const extra = t.fit.mailAdds && mail ? " (+5 days for mail service)" : "";
      let basisText = `Latest date so the ${t.fit.responseDays}-day period${extra} ends by ${fmt(cutoff)}${t.fit.cushion ? `, less a ${t.fit.cushion}-day production cushion` : ""}`;
      if (t.skipIfEarlier) { const s2 = find(t.skipIfEarlier); if (s2 && s2.date <= d) continue; }
      if (t.clampTo) {
        const c2 = find(t.clampTo.ids);
        if (c2 && c2.date < d) { d = c2.date; basisText = `${basisText}. Moved earlier to ${fmt(c2.date)} because ${t.clampTo.why} (“${c2.label}”)`; }
      }
      push(t.id, d, d, undefined, basisText);
      continue;
    }

    const isRuleResponse = t.basis === "rule" && t.forward;
    let r = isRuleResponse
      ? computeDeadline(base, days, calendar, { mailService: mail && t.id === "t_disc_resp" })
      : rollToCourtDay(addDays(base, days), days >= 0 ? 1 : -1, calendar);
    const unit = Math.abs(days) === 1 ? "day" : "days";
    let basisText = days === 0 ? `On the ${shortName}` : `${Math.abs(days)} ${unit} ${days < 0 ? "before" : "after"} ${shortName.startsWith("the ") ? "" : "the "}${shortName}${isRuleResponse && mail && t.id === "t_disc_resp" ? " (+5 days, mail service)" : ""}`;
    if (t.notLaterThan) {
      const lim = find(t.notLaterThan.parent);
      const limBase = lim?.date ?? (t.fallbackTrialDays !== undefined && trial ? addDays(trial.date, t.fallbackTrialDays) : undefined);
      if (limBase) {
        const cap = rollToCourtDay(addDays(limBase, t.notLaterThan.days), -1, calendar);
        if (cap.date < r.date) { r = cap; basisText = `${basisText}, capped at ${t.notLaterThan.why}`; }
      }
    }
    if (t.clampTo) {
      const c2 = find(t.clampTo.ids);
      if (c2 && c2.date < r.date) { r = { ...r, date: c2.date, raw: c2.date, rolled: false, rollReason: undefined }; basisText = `${basisText}. Moved earlier to ${fmt(c2.date)} because ${t.clampTo.why} (“${c2.label}”)`; }
    }
    const first = push(t.id, r.date, r.raw, r.rollReason, basisText);

    if (t.repeat && trial) {
      const stop = addDays(trial.date, -t.repeat.stopBeforeTrial);
      let prev = first.date;
      for (let n = 2; n <= t.repeat.max + 1; n++) {
        const next = rollToCourtDay(addDays(prev, t.repeat.every), 1, calendar);
        if (next.date > stop) break;
        push(`${t.id}_${n}`, next.date, next.raw, next.rollReason, `${t.repeat.every} days after the previous report`, `${t.title} (#${n})`);
        prev = next.date;
      }
      // the first one is #1
      first.label = `${t.title} (#1)`;
    }
  }
  return out;
}
