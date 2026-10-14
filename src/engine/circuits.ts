import type { CircuitHolidayPolicy } from "./holidays";
import type { CaseType, Court, RuleItem, Track, TrackSchedule } from "./types";

export interface Circuit {
  id: number;
  name: string;
  counties: string[];
  holidays: CircuitHolidayPolicy;
  /** Presumptive track by case type, where the circuit publishes one. */
  trackMap?: Partial<Record<CaseType, Track>>;
  trackMapSource?: string;
  schedules: Partial<Record<Court, Partial<Record<Track, TrackSchedule>>>>;
  /** How CMOs are issued in this circuit (shown to users). */
  howIssued: Partial<Record<Court, string>>;
  ao?: { title: string; url: string };
}

// ---------- reusable fragments ----------
const svc = (days = 120): RuleItem => ({
  id: "service", label: "Serve complaint on all defendants", category: "service",
  anchor: "filing", days, citation: "Fla. R. Civ. P. 1.070(j)",
});
const before = (id: string, label: string, category: RuleItem["category"], days: number, anchor: RuleItem["anchor"], extra: Partial<RuleItem> = {}): RuleItem => ({
  id, label, category, anchor, days: -days, ...extra,
});
const after = (id: string, label: string, category: RuleItem["category"], days: number, anchor: RuleItem["anchor"] = "filing", extra: Partial<RuleItem> = {}): RuleItem => ({
  id, label, category, anchor, days, ...extra,
});

// ---------- 3rd Circuit (AO 2025-001) — counted from filing ----------
const third: Circuit["schedules"] = (() => {
  const src = { title: "3rd Cir. AO 2025-001, Appendix A/B", url: "https://thirdcircuitfl.org/wp-content/uploads/AO-2025-001-CASEMANAGEMENT.pdf", effective: "Feb 26, 2025" };
  const general: TrackSchedule = {
    status: "verified", source: src, backAnchor: "trial",
    projection: { base: "filing", months: 18 },
    items: [
      svc(),
      after("serviceExt", "Service under extensions", "service", 180),
      after("addParties", "Add new parties", "pleadings", 210),
      after("factDiscovery", "Complete fact discovery", "discovery", 420),
      after("expertDiscovery", "Complete expert discovery", "experts", 450),
      after("mediation", "Complete ADR / mediation", "adr", 450),
      before("msjFile", "File & serve motions for summary judgment", "motions", 120, "trial"),
      before("msjResolve", "Summary judgment motions resolved", "motions", 30, "trial"),
    ],
    notes: [
      "Objections to pleadings must be resolved within 75 days after filed and no later than 45 days before the pretrial conference.",
      "Pretrial motions (other than MSJ) must be resolved within 60 days after filed and no later than the Friday before the trial week.",
      "Moving party must contact the judge's office within 20 days of filing any motion requiring a hearing.",
    ],
  };
  const streamlined: TrackSchedule = {
    status: "verified", source: src, backAnchor: "trial",
    projection: { base: "filing", months: 12 },
    items: [
      svc(),
      after("serviceExt", "Service under extensions", "service", 150),
      after("addParties", "Add new parties", "pleadings", 180),
      after("factDiscovery", "Complete fact discovery", "discovery", 240),
      after("expertDiscovery", "Complete expert discovery", "experts", 270),
      after("mediation", "Complete ADR / mediation", "adr", 270),
      before("msjFile", "File & serve motions for summary judgment", "motions", 90, "trial"),
      before("msjResolve", "Summary judgment motions resolved", "motions", 15, "trial"),
    ],
    notes: [
      "Objections to pleadings must be resolved within 60 days after filed and no later than 30 days before the pretrial conference.",
      "Pretrial motions (other than MSJ) must be resolved within 30 days after filed and no later than the Friday before the trial week.",
    ],
  };
  return { circuit: { general, streamlined }, county: { general, streamlined } };
})();

// ---------- 6th Circuit (AO 2025-006) — relative to pretrial conference ----------
const sixth: Circuit["schedules"] = (() => {
  const src = { title: "6th Cir. AO 2025-006 PA/PI-CIR, Exhibits A/B", url: "https://www.jud6.org/LegalCommunity/PracticeRequirements/Circuit/Muscarella/2025-006.pdf", effective: "Feb 18, 2025" };
  const general: TrackSchedule = {
    status: "verified", source: src, backAnchor: "pretrial",
    projection: { base: "filing", months: 18 },
    items: [
      svc(),
      after("scheduleTrial", "Schedule a trial date with the court", "trial", 0, "filing", { months: 8, days: undefined, citation: "6th Cir. General Standing Order; Rule 1.440" }),
      before("factDiscovery", "Complete fact discovery", "discovery", 30, "pretrial"),
      before("expertDiscovery", "Complete expert discovery", "experts", 30, "pretrial"),
      before("msjFile", "File & serve motions for summary judgment (must be heard before PTC)", "motions", 60, "pretrial"),
      before("objections", "Objections to pleadings, pretrial motions & ADR complete", "motions", 1, "pretrial", { note: "Order says “before the pre-trial conference.” Shown as the court day before the PTC." }),
    ],
    notes: ["Service-under-extension and add-party deadlines are at the trial judge's discretion.", "The pretrial conference is set under each judge's practice preferences — enter it once set."],
  };
  const streamlined: TrackSchedule = {
    status: "verified", source: src, backAnchor: "pretrial",
    projection: { base: "filing", months: 12 },
    items: [
      svc(),
      after("scheduleTrial", "Schedule a trial date with the court", "trial", 0, "filing", { months: 8, days: undefined }),
      before("discovery", "Complete fact & expert discovery", "discovery", 1, "pretrial", { note: "Order says “before the pre-trial conference.”" }),
      before("msjFile", "File & serve motions for summary judgment (must be heard before PTC)", "motions", 60, "pretrial"),
      before("pretrialMotions", "Filing & resolution of all pretrial motions", "motions", 1, "pretrial"),
      before("mediation", "Complete ADR / mediation and resolve objections to pleadings", "adr", 1, "trial", { note: "Order says “before the actual trial date.”" }),
    ],
  };
  return { circuit: { general, streamlined }, county: { general, streamlined } };
})();

// ---------- 7th Circuit (Uniform CMO eff. Jan 1, 2025) — partial ----------
const seventh: Circuit["schedules"] = (() => {
  const src = { title: "7th Cir. Uniform Case Management Order", url: "https://circuit7.org/wp-content/uploads/cmc-order.pdf", effective: "Jan 1, 2025" };
  const mk = (track: "general" | "streamlined"): TrackSchedule => ({
    status: "partial", source: src, backAnchor: "trial",
    projection: { base: "filing", months: track === "general" ? 18 : 12 },
    items: [
      svc(),
      after("addParties", "Add new parties", "pleadings", track === "general" ? 120 : 90, "serviceLast"),
      before("expertDisclosure", "Disclose expert witnesses", "experts", track === "general" ? 120 : 90, "trial", { note: "Counted from the trial docket." }),
      before("factWitness", "Disclose fact witnesses", "discovery", 60, "trial"),
      before("writtenDiscovery", "Last day to serve written discovery", "discovery", 45, "trial"),
      before("discoveryComplete", "Complete all discovery", "discovery", 10, "trial"),
    ],
    notes: ["Only the deadlines confirmed from the published order are shown — paste your issued order on the Import tab to add the rest (MSJ, mediation, pretrial motions)."],
  });
  return { circuit: { general: mk("general"), streamlined: mk("streamlined") }, county: { general: mk("general"), streamlined: mk("streamlined") } };
})();

// ---------- 9th Circuit County Civil (Standing CMO, rev. 7/2025) ----------
const ninth: Circuit["schedules"] = (() => {
  const src = { title: "9th Cir. County Civil Standing Case Management Plan/Order (General), rev. 7/2025", url: "https://ninthcircuit.org/sites/default/files/2025-01/CountyCivil-General-CMO.pdf" };
  const general: TrackSchedule = {
    status: "verified", source: src, backAnchor: "trial",
    projection: { base: "filing", months: 18 },
    items: [
      svc(),
      after("serviceExt", "Service under extension (unserved defendants dismissed after)", "service", 150),
      after("addParties", "Motions to add parties / amend heard (else deemed abandoned)", "pleadings", 90, "serviceLast"),
      after("discovery", "Complete fact & expert discovery", "discovery", 450),
      after("pretrialMotions", "File pretrial, dispositive & Daubert motions", "motions", 465, "filing", { note: "15 days after completion of discovery; must be heard no later than 7 days before the pretrial conference." }),
      after("mediation", "Final mediation", "adr", 480, "filing", { note: "No later than 30 days after completion of all discovery. Confer about early mediation within 30 days after all party depositions." }),
      after("noticeForTrial", "File Notice for Trial if no Trial Order entered", "trial", 240),
      after("pretrialApprox", "Approximate pretrial conference", "trial", 0, "filing", { months: 17, days: undefined, kind: "event", noRoll: true }),
    ],
    notes: ["Preliminary motions (dismiss, strike, more definite statement, compel appraisal) must be set and heard within 60 days of filing the motion or are deemed abandoned."],
  };
  return { county: { general } };
})();

// ---------- 13th Circuit (Circuit Civil DCM Orders, AO S-2024-085) ----------
const thirteenth: Circuit["schedules"] = (() => {
  const gsrc = { title: "13th Cir. DCM Order & Notice of Hearing (General Circuit Civil, filed on/after 1/1/2025)", url: "https://www.fljud13.org/Portals/0/Forms/pdfs/genciv/CircuitCivilDCMOrderNoticeofHearing.pdf" };
  const ssrc = { title: "13th Cir. DCM Order (Streamlined Circuit Civil, filed after 1/1/2025)", url: "https://www.fljud13.org/Portals/0/Forms/pdfs/genciv/CircuitCivilDCMOrderStreamlined.pdf" };
  const general: TrackSchedule = {
    status: "verified", source: gsrc, projection: { base: "filing", months: 18 },
    items: [
      svc(),
      after("addParties", "Add parties", "pleadings", 150, "filing", { citation: "subject to Rule 1.210" }),
      after("serviceExt", "Service under extensions", "service", 180),
      after("objectionsFile", "File all objections to pleadings", "pleadings", 180),
      after("objectionsResolve", "Resolve all objections to pleadings", "pleadings", 200),
      after("cmc", "Court-ordered case management conference", "trial", 210, "filing", { kind: "event", note: "Set by the order itself — check the exact date and time printed on your DCM Order." }),
      after("factDiscovery", "Complete fact discovery", "discovery", 270),
      after("compel", "File motions to compel discovery", "discovery", 284),
      after("expertP", "Plaintiff's expert disclosure", "experts", 300),
      after("expertD", "Defendant's expert disclosure", "experts", 330),
      after("expertRebuttal", "Rebuttal expert disclosure", "experts", 344),
      after("cme", "Complete compulsory medical exam (CME)", "discovery", 390, "filing", { citation: "Rule 1.360(a)(1)(A)" }),
      after("msjFile", "File & serve motions for summary judgment", "motions", 400),
      after("mediation", "Complete ADR / mediation", "adr", 420),
      after("expertDiscovery", "Complete expert discovery", "experts", 420),
      after("pretrialMotionsFile", "File all pretrial motions (excluding MILs)", "motions", 450),
      after("pretrialMotionsResolve", "Resolve pretrial motions incl. MSJ & Daubert", "motions", 500),
      after("milFile", "File motions in limine", "motions", 520),
      after("milResolve", "Resolve motions in limine", "motions", 539),
      after("trialTerm", "Projected trial term", "trial", 540, "filing", { kind: "event", noRoll: true, note: "Firm trial date set by Uniform Order Setting Trial and Pretrial." }),
    ],
  };
  const streamlined: TrackSchedule = {
    status: "verified", source: ssrc, projection: { base: "filing", months: 12 },
    items: [
      svc(),
      after("addParties", "Add parties", "pleadings", 150),
      after("serviceExt", "Service under extensions", "service", 180),
      after("objectionsFile", "File all objections to pleadings", "pleadings", 180),
      after("objectionsResolve", "Resolve all objections to pleadings", "pleadings", 200),
      after("discovery", "Complete fact & expert discovery", "discovery", 240),
      after("compel", "File motions to compel discovery", "discovery", 254),
      after("msjFile", "File & serve motions for summary judgment", "motions", 280),
      after("pretrialMotionsFile", "File all pretrial motions (excluding MILs)", "motions", 300),
      after("mediation", "Complete ADR / mediation", "adr", 300),
      after("milFile", "File motions in limine", "motions", 340),
      after("pretrialMotionsResolve", "Resolve pretrial motions incl. MSJ & Daubert", "motions", 350),
      after("milResolve", "Resolve motions in limine", "motions", 359),
      after("trialTerm", "Projected trial term", "trial", 360, "filing", { kind: "event", noRoll: true }),
    ],
  };
  return { circuit: { general, streamlined } };
})();

// ---------- 17th Circuit (AO 2025-24-Civ) — backward from Calendar Call ----------
const seventeenth: Circuit["schedules"] = (() => {
  const src = { title: "17th Cir. AO 2025-24-Civ, Exhibit B (Uniform CMO, Circuit Civil General Track)", url: "https://www.17th.flcourts.org/wp-content/uploads/2025/07/2025-24-Civ-Combined.pdf", effective: "Jul 24, 2025" };
  const cc = "calendarCall" as const;
  const general: TrackSchedule = {
    status: "verified", source: src, backAnchor: "calendarCall",
    projection: { base: "standard", months: 18 },
    items: [
      svc(),
      after("mediatorSelect", "Select substitute mediator (else court's appointee stands)", "adr", 30, "serviceLast"),
      before("factWitness", "File fact witness lists", "discovery", 150, cc),
      before("objections", "Resolve all motions/objections directed to pleadings", "pleadings", 120, cc, { note: "Must be set within 10 days of filing to be heard within 60 days." }),
      before("addParties", "Motions to amend pleadings / add parties filed & set", "pleadings", 120, cc),
      before("expertDisclosure", "Disclose expert witnesses (with 1.280(c)(5) info)", "experts", 120, cc),
      before("cme", "Complete compulsory examinations (Rule 1.360)", "discovery", 120, cc),
      before("rebuttal", "Disclose rebuttal witnesses", "experts", 100, cc),
      before("discoveryInitiated", "All final discovery initiated", "discovery", 90, cc),
      before("msjFile", "File MSJ & all dispositive motions", "motions", 90, cc),
      before("mediation", "Mediation completed", "adr", 60, cc),
      before("daubert", "Expert challenges & deposition objections filed and heard", "motions", 45, cc),
      before("discoveryComplete", "Complete all discovery (incl. expert)", "discovery", 30, cc),
      before("pretrialMotions", "File pretrial motions & motions in limine", "motions", 30, cc, { note: "Pretrial motions other than MILs must also be heard by this date or are deemed abandoned." }),
      before("depoDesignations", "Serve deposition designations", "trial", 20, cc),
      before("pretrialStip", "File Joint Pretrial Stipulation; exhibits available", "trial", 10, cc),
    ],
    notes: [
      "Plaintiff must file a Notice of Service upon service on the last defendant.",
      "Notice of Related Case(s) due within 30 days of the CMO.",
      "Calendar Call and Trial Period are set by a separate Uniform Trial Order — enter the Calendar Call date to lock these deadlines.",
    ],
  };
  const complex: TrackSchedule = {
    ...general,
    source: { ...src, title: "17th Cir. AO 2025-24-Civ, Exhibit G (Complex Tort UTO)" },
    projection: { base: "standard", months: 30 },
    items: general.items.map((i) =>
      i.id === "addParties" || i.id === "expertDisclosure" ? { ...i, days: -150 } : i,
    ),
  };
  return { circuit: { general, complex } };
})();

// ---------- 18th Circuit (AO 25-08) — backward from Pretrial Conference ----------
const eighteenth: Circuit["schedules"] = (() => {
  const src = { title: "18th Cir. AO 25-08, Exhibits B/C", url: "https://flcourts18.org/wp-content/uploads/2025/01/25-08.pdf", effective: "Feb 1, 2025" };
  const p = "pretrial" as const;
  const general: TrackSchedule = {
    status: "verified", source: src, backAnchor: "pretrial",
    projection: { base: "filingPlus120", months: 18 },
    items: [
      svc(),
      before("factWitnessPrelim", "Disclose potential fact witnesses (exchange)", "discovery", 180, p),
      before("expertP", "Plaintiff expert witness list", "experts", 180, p),
      before("expertD", "Defendant expert witness list", "experts", 150, p),
      before("addParties", "Motions to amend / add parties filed", "pleadings", 120, p),
      before("fabre", "Formal identification of Fabre defendants", "pleadings", 120, p, { citation: "§768.81(3), Fla. Stat." }),
      before("expertRebuttal", "Plaintiff rebuttal experts", "experts", 120, p),
      before("mediatorAgreed", "Mediator and mediation date agreed", "adr", 120, p),
      before("cme", "All CME (Rule 1.360) exams completed", "discovery", 120, p),
      before("cmeReport", "CME report provided to plaintiff", "discovery", 90, p),
      before("witnessExhibitList", "File fact witness & exhibit lists", "trial", 90, p),
      before("surveillance", "Disclose post-accident surveillance for trial", "discovery", 90, p),
      before("msjFile", "File & serve MSJ / dispositive motions", "motions", 80, p),
      before("expertDiscovery", "Complete expert discovery", "experts", 70, p),
      before("daubertFile", "File & serve Daubert motions", "motions", 60, p),
      before("factDiscovery", "Complete fact discovery (incl. depositions)", "discovery", 30, p),
      before("daubertHeard", "Daubert motions / expert objections noticed and heard", "motions", 30, p, { note: "Failure constitutes waiver at trial absent court order." }),
      before("northrup", "Disclose Northrup impeachment materials", "discovery", 30, p),
      before("finalWitnesses", "Final disclosure of trial witnesses & exhibits", "trial", 20, p),
      before("motionsHeard", "All motions heard (except Daubert, MSJ, MIL)", "motions", 15, p),
      before("depoDesignations", "Exchange & file deposition designations", "trial", 15, p),
      before("msjHeard", "All MSJs heard", "motions", 10, p),
      before("depoCounter", "Objections & counter-designations", "trial", 10, p),
      before("mediation", "ADR completed", "adr", 10, p),
      before("pretrialMeet", "Attorney meet / exchange / pretrial stipulation", "trial", 7, p),
      before("milHeard", "Motions in limine & depo objections heard", "motions", 5, "trial"),
    ],
    notes: ["A Trial Order is issued 120 days before the projected trial date and sets the actual trial period and pretrial conference.", "Per the AO, a pretrial-based deadline that lands on a weekend or holiday moves to the prior business day."],
  };
  const streamlined: TrackSchedule = {
    status: "verified", source: src, backAnchor: "pretrial",
    projection: { base: "filingPlus120", months: 12 },
    items: [
      svc(),
      before("factWitnessPrelim", "Disclose potential fact witnesses (exchange)", "discovery", 120, p),
      before("expertP", "Plaintiff expert witness list", "experts", 120, p),
      before("expertD", "Defendant expert witness list", "experts", 100, p),
      before("addParties", "Motions to amend / add parties filed", "pleadings", 80, p),
      before("fabre", "Formal identification of Fabre defendants", "pleadings", 80, p),
      before("expertRebuttal", "Plaintiff rebuttal experts", "experts", 80, p),
      before("mediatorAgreed", "Mediator and mediation date agreed", "adr", 80, p),
      before("cme", "All CME (Rule 1.360) exams completed", "discovery", 80, p),
      before("witnessExhibitList", "File fact witness & exhibit lists", "trial", 60, p),
      before("surveillance", "Disclose post-accident surveillance for trial", "discovery", 60, p),
      before("msjFile", "File & serve MSJ / dispositive motions", "motions", 55, p),
      before("cmeReport", "CME report provided to plaintiff", "discovery", 50, p),
      before("expertDiscovery", "Complete expert discovery", "experts", 45, p),
      before("daubertFile", "File & serve Daubert motions", "motions", 40, p),
      before("factDiscovery", "Complete fact discovery (incl. depositions)", "discovery", 20, p),
      before("daubertHeard", "Daubert motions / expert objections noticed and heard", "motions", 20, p),
      before("northrup", "Disclose Northrup impeachment materials", "discovery", 20, p),
      before("finalWitnesses", "Final disclosure of trial witnesses & exhibits", "trial", 15, p),
      before("motionsHeard", "All motions heard (except Daubert, MSJ, MIL)", "motions", 10, p),
      before("depoDesignations", "Exchange & file deposition designations", "trial", 10, p),
      before("msjHeard", "All MSJs heard", "motions", 7, p),
      before("depoCounter", "Objections & counter-designations", "trial", 7, p),
      before("mediation", "ADR completed", "adr", 7, p),
      before("pretrialMeet", "Attorney meet / exchange / pretrial stipulation", "trial", 5, p),
      before("milHeard", "Motions in limine & depo objections heard", "motions", 5, "trial"),
    ],
  };
  return { circuit: { general, streamlined }, county: { streamlined } };
})();

const C = (id: number, name: string, counties: string[], extra: Partial<Circuit> = {}): Circuit => ({
  id, name, counties,
  holidays: { goodFriday: "unknown", roshHashanah: "unknown", yomKippur: "unknown" },
  schedules: {},
  howIssued: {},
  ...extra,
});

export const CIRCUITS: Circuit[] = [
  C(1, "First", ["Escambia", "Okaloosa", "Santa Rosa", "Walton"]),
  C(2, "Second", ["Franklin", "Gadsden", "Jefferson", "Leon", "Liberty", "Wakulla"], {
    holidays: {
      goodFriday: true, roshHashanah: false, yomKippur: true,
      confirmed: { 2026: [{ date: "2026-12-24", name: "Christmas Eve (discretionary)" }, { date: "2026-12-31", name: "New Year's Eve (discretionary)" }] },
      source: "2nd Cir. 2026 court holiday memo",
    },
  }),
  C(3, "Third", ["Columbia", "Dixie", "Hamilton", "Lafayette", "Madison", "Suwannee", "Taylor"], {
    schedules: third,
    howIssued: { circuit: "Presiding judge issues the standardized CMO within 120 days of filing.", county: "Presiding judge issues the standardized CMO within 120 days of filing." },
    ao: { title: "AO 2025-001", url: "https://thirdcircuitfl.org/orders/ao-2025-001/" },
  }),
  C(4, "Fourth", ["Clay", "Duval", "Nassau"]),
  C(5, "Fifth", ["Citrus", "Hernando", "Lake", "Marion", "Sumter"]),
  C(6, "Sixth", ["Pasco", "Pinellas"], {
    schedules: sixth,
    howIssued: { circuit: "Plaintiff designates the track and files/serves the Standing Order with the summons and complaint.", county: "Plaintiff designates the track and files/serves the Standing Order with the summons and complaint." },
    holidays: {
      goodFriday: true, roshHashanah: true, yomKippur: true,
      confirmed: {
        2026: [{ date: "2026-12-24", name: "Christmas Eve (discretionary)" }, { date: "2026-12-31", name: "New Year's Eve (discretionary)" }],
        2027: [{ date: "2027-07-02", name: "Day before Independence Day (discretionary)" }, { date: "2027-12-23", name: "Day before Christmas holiday (discretionary)" }, { date: "2027-12-24", name: "Christmas Eve holiday" }, { date: "2027-12-31", name: "New Year's holiday" }],
      },
      source: "6th Cir. AO 2025-030 (2026) and AO 2026-030 (2027)",
    },
    ao: { title: "AO 2025-006 PA/PI-CIR", url: "https://www.jud6.org/LegalCommunity/PracticeRequirements/Circuit/Muscarella/2025-006.pdf" },
  }),
  C(7, "Seventh", ["Flagler", "Putnam", "St. Johns", "Volusia"], {
    schedules: seventh,
    howIssued: { circuit: "Uniform Case Management Order issued under Rule 1.200.", county: "Uniform Case Management Order issued under Rule 1.200." },
  }),
  C(8, "Eighth", ["Alachua", "Baker", "Bradford", "Gilchrist", "Levy", "Union"]),
  C(9, "Ninth", ["Orange", "Osceola"], {
    schedules: ninth,
    howIssued: {
      circuit: "The court enters a Uniform Trial and Case Management Order (UTCMO) within 3 business days of filing. Its printed dates govern — import it on the Import tab.",
      county: "Plaintiff files the Standing Case Management Plan/Order with the complaint and summons.",
    },
    ao: { title: "AO 2021-04-07 (Amended Order Governing Civil Case Management)", url: "https://ninthcircuit.org/civil-case-management" },
  }),
  C(10, "Tenth", ["Hardee", "Highlands", "Polk"]),
  C(11, "Eleventh", ["Miami-Dade"], {
    trackMap: { auto: "general", premises: "general", negligentSecurity: "general", otherNegligence: "streamlined", propertyInsurance: "streamlined", pip: "streamlined", umUim: "streamlined", badFaith: "streamlined", contract: "streamlined" },
    trackMapSource: "11th Cir. AO 24-20, Exhibit A (presumptive track assignments). UM/UIM and bad faith are filed as “Insurance Claim.”",
    howIssued: { circuit: "Judge issues a General or Streamlined Pathway CMO with specific dates within 120 days of filing. Import it on the Import tab." },
    ao: { title: "AO 24-20", url: "https://www.jud11.flcourts.org/About-the-Court/Court-Divisions/Circuit-Civil" },
  }),
  C(12, "Twelfth", ["DeSoto", "Manatee", "Sarasota"], {
    howIssued: { circuit: "CMO substantially in the form attached to AO 2025-1.1 (general/streamlined, jury/non-jury)." },
    ao: { title: "AO 2025-1.1", url: "https://www.jud12.flcourts.org/Portals/0/AdminOrders/Section01/2025-1.1.pdf" },
  }),
  C(13, "Thirteenth", ["Hillsborough"], {
    schedules: thirteenth,
    holidays: { goodFriday: true, roshHashanah: true, yomKippur: true, source: "13th Cir. AO S-2025-034" },
    howIssued: { circuit: "DCM Order is generated automatically at filing and must be served with the summons." },
    ao: { title: "AO S-2024-085", url: "https://www.fljud13.org" },
  }),
  C(14, "Fourteenth", ["Bay", "Calhoun", "Gulf", "Holmes", "Jackson", "Washington"]),
  C(15, "Fifteenth", ["Palm Beach"], {
    howIssued: { circuit: "A Differentiated Case Management Order (DCMO) with a Calendar Call is generated automatically at filing. Circuit jury cases → General; non-jury → Streamlined. Import it on the Import tab." },
    ao: { title: "AO 3.110-12/24", url: "https://www.15thcircuit.com/sites/default/files/administrative-orders/3.110.pdf" },
  }),
  C(16, "Sixteenth", ["Monroe"], { ao: { title: "AO 3.010", url: "https://www.monroe-clerk.com/uploads/documents/3.010.PDF" } }),
  C(17, "Seventeenth", ["Broward"], {
    schedules: seventeenth,
    trackMap: { auto: "general", premises: "general", negligentSecurity: "general", otherNegligence: "general", propertyInsurance: "general", umUim: "general", badFaith: "general", pip: "general", contract: "general" },
    trackMapSource: "17th Cir. AO 2025-24-Civ, Exhibit A (Auto Negligence, Premises Liability, Negligent Security, Other Negligence and Insurance Claim are General).",
    howIssued: { circuit: "Uniform CMO issued within the earlier of 120 days after filing or 30 days after service on the last defendant; Calendar Call is set by a separate Uniform Trial Order." },
    ao: { title: "AO 2025-24-Civ", url: "https://www.17th.flcourts.org/wp-content/uploads/2025/07/2025-24-Civ-Combined.pdf" },
  }),
  C(18, "Eighteenth", ["Brevard", "Seminole"], {
    schedules: eighteenth,
    howIssued: { circuit: "Plaintiff files the Track Designation Form with the complaint; the court issues the Initial CMO. Trial Order issued 120 days before the projected trial.", county: "Plaintiff files the Track Designation Form; county civil cases are Streamlined." },
    ao: { title: "AO 25-08", url: "https://flcourts18.org/wp-content/uploads/2025/01/25-08.pdf" },
  }),
  C(19, "Nineteenth", ["Indian River", "Martin", "Okeechobee", "St. Lucie"], {
    holidays: {
      goodFriday: true, roshHashanah: false, yomKippur: true,
      confirmed: { 2026: [{ date: "2026-12-24", name: "Christmas Eve (discretionary)" }, { date: "2026-12-31", name: "New Year's Eve (discretionary)" }] },
      source: "19th Cir. 2026 court holiday order",
    },
    howIssued: { circuit: "Case management plan and order filed by the parties (Attachment A to AO 2025-01)." },
    ao: { title: "AO 2025-01", url: "https://circuit19.org/wp-content/uploads/2025/04/2025-01.pdf" },
  }),
  C(20, "Twentieth", ["Charlotte", "Collier", "Glades", "Hendry", "Lee"]),
];

export const ALL_COUNTIES = CIRCUITS.flatMap((c) => c.counties.map((county) => ({ county, circuit: c.id }))).sort((a, b) => a.county.localeCompare(b.county));

export function circuitForCounty(county: string): Circuit | undefined {
  return CIRCUITS.find((c) => c.counties.includes(county));
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function suggestTrack(circuit: Circuit, caseType: CaseType, court: Court, jury: boolean): { track: Track; why: string } {
  if (circuit.trackMap?.[caseType]) return { track: circuit.trackMap[caseType]!, why: circuit.trackMapSource ?? "Circuit track table" };
  if (circuit.id === 15 && court === "circuit") return { track: jury ? "general" : "streamlined", why: "15th Cir. AO 3.110: circuit jury → General, non-jury → Streamlined." };
  if (circuit.id === 18 && court === "county") return { track: "streamlined", why: "18th Cir. AO 25-08: county civil cases are Streamlined." };
  if (caseType === "pip") return { track: "streamlined", why: "PIP suits are typically Streamlined (limited discovery, short trial)." };
  return { track: "general", why: "Rule 1.200(b)(3): cases that aren't streamlined or complex are General. Most contested insurance-defense tort cases land here." };
}
