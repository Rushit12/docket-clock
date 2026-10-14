import type { ISODate } from "./dates";

export type Track = "streamlined" | "general" | "complex";
export type Court = "circuit" | "county";

export type CaseType =
  | "auto"
  | "premises"
  | "negligentSecurity"
  | "otherNegligence"
  | "propertyInsurance"
  | "umUim"
  | "pip"
  | "badFaith"
  | "contract";

export const CASE_TYPES: { id: CaseType; label: string; hint: string }[] = [
  { id: "auto", label: "Auto negligence", hint: "BI / motor vehicle tort" },
  { id: "premises", label: "Premises liability", hint: "Slip / trip and fall, commercial or residential" },
  { id: "negligentSecurity", label: "Negligent security", hint: "§768.0701 claims" },
  { id: "otherNegligence", label: "Other negligence", hint: "General liability torts" },
  { id: "propertyInsurance", label: "First-party property", hint: "Homeowners / commercial property claim" },
  { id: "umUim", label: "UM / UIM", hint: "Uninsured / underinsured motorist" },
  { id: "pip", label: "PIP", hint: "Personal injury protection (often county court)" },
  { id: "badFaith", label: "Bad faith", hint: "§624.155 extra-contractual" },
  { id: "contract", label: "Contract / coverage", hint: "Declaratory or contract dispute" },
];

export type Category =
  | "service"
  | "pleadings"
  | "discovery"
  | "experts"
  | "motions"
  | "adr"
  | "trial"
  | "settlement"
  | "defense";

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  service: { label: "Service", color: "slate" },
  pleadings: { label: "Pleadings & parties", color: "violet" },
  discovery: { label: "Discovery", color: "sky" },
  experts: { label: "Experts", color: "teal" },
  motions: { label: "Motions", color: "amber" },
  adr: { label: "Mediation / ADR", color: "emerald" },
  trial: { label: "Trial", color: "rose" },
  settlement: { label: "Proposals for settlement", color: "lime" },
  defense: { label: "Defense response", color: "indigo" },
};

/** What a deadline is counted from. */
export type Anchor =
  | "filing" // complaint filed (commencement, Rule 1.050)
  | "serviceLast" // service of process on the last defendant
  | "serviceClient" // service of process on our client
  | "dol" // date of loss
  | "calendarCall"
  | "pretrial"
  | "trial";

export interface RuleItem {
  id: string;
  label: string;
  category: Category;
  anchor: Anchor;
  /** Calendar days from the anchor; negative = before. */
  days?: number;
  /** Calendar months from the anchor (used by time standards). */
  months?: number;
  /** "earliest" items are the first day an act is permitted (e.g. PFS window opens). */
  kind?: "deadline" | "earliest" | "event" | "info";
  citation?: string;
  note?: string;
  /** Do not roll for weekends/holidays (e.g. projected trial month). */
  noRoll?: boolean;
  /** Mail service adds 5 days (Rule 2.514(b)). */
  afterService?: boolean;
  /** Only include when this predicate holds. */
  when?: (c: CaseInputs) => boolean;
}

export type Confidence = "verified" | "rule" | "estimate" | "order" | "manual";

export interface ScheduleSource {
  title: string;
  url?: string;
  effective?: string;
}

export interface TrackSchedule {
  status: "verified" | "partial";
  source: ScheduleSource;
  /** Which anchor the backward-counted items use. */
  backAnchor?: "calendarCall" | "pretrial" | "trial";
  /** How the projected trial is set. */
  projection: { base: "filing" | "standard" | "filingPlus120"; months: number };
  items: RuleItem[];
  notes?: string[];
}

export interface CaseInputs {
  name: string;
  caseNumber?: string;
  county: string;
  court: Court;
  caseType: CaseType;
  track: Track;
  jury: boolean;
  filingDate?: ISODate;
  serviceClientDate?: ISODate;
  serviceLastDate?: ISODate;
  dateOfLoss?: ISODate;
  calendarCallDate?: ISODate;
  pretrialDate?: ISODate;
  trialDate?: ISODate;
  mailService?: boolean;
  discoveryWithComplaint?: boolean;
  extraClosures?: { date: ISODate; name: string }[];
}

export interface TimelineEntry {
  id: string;
  label: string;
  category: Category;
  date: ISODate;
  raw: ISODate;
  rolled: boolean;
  rollReason?: string;
  possibleClosure?: string;
  kind: "deadline" | "earliest" | "event" | "info";
  confidence: Confidence;
  basis: string; // human readable "420 days after filing"
  citation?: string;
  note?: string;
  source?: ScheduleSource;
  /** Already met based on the dates entered (e.g. service completed). */
  satisfied?: boolean;
}

export interface Warning {
  level: "error" | "warn" | "info";
  message: string;
  itemId?: string;
}
