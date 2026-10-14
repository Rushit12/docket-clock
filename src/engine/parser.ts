import { addDays, type ISODate, isValidISO, toISO } from "./dates";
import type { Category } from "./types";

/**
 * Pulls deadlines out of the text of an issued case management order / trial order.
 * Handles absolute dates (03/14/2026, 3/14/26, March 14, 2026, 14 March 2026) and
 * relative phrasing ("420 days after the complaint is filed", "90 days before Calendar Call").
 * PDF text often splits a table row across lines, so a label line without a date is
 * joined to the following line when that line is mostly a date.
 */

export interface ParsedItem {
  key: string; // stable row key
  id: string; // canonical deadline id (e.g. "factDiscovery")
  label: string; // label as written in the order
  category: Category;
  date?: ISODate;
  relative?: { days: number; anchor: RelAnchor };
  months?: { n: number; anchor: "filing" | "service" };
  sourceLine: string;
  confidence: "high" | "medium" | "low";
  include: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const DATE_NUM = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
const DATE_MDY = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i;
const DATE_DMY = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+(\d{4})\b/i;
const REL = /(\d{1,3})\s*(?:\(\d+\)\s*)?(calendar\s+|court\s+|business\s+)?days?\s+(after|from|following|before|prior\s+to)\s+(?:the\s+)?(?:date\s+(?:of|the)\s+)?(?:the\s+)?([a-z\- ]{3,40})/i;
const REL_MONTHS = /(\d{1,2})\s+months?\s+(after|from)\s+(?:the\s+)?(?:date\s+(?:of\s+)?)?(?:the\s+)?([a-z ]{3,30})/i;

function mkISO(y: number, m: number, d: number): ISODate | undefined {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const iso = toISO(new Date(Date.UTC(y, m - 1, d)));
  return isValidISO(iso) && Number(iso.slice(8)) === d ? iso : undefined;
}

export function findDate(line: string): { date: ISODate; index: number; length: number } | undefined {
  let m = DATE_NUM.exec(line);
  if (m) {
    const d = mkISO(Number(m[3]), Number(m[1]), Number(m[2]));
    if (d) return { date: d, index: m.index, length: m[0].length };
  }
  m = DATE_MDY.exec(line);
  if (m) {
    const d = mkISO(Number(m[3]), MONTHS[m[1].toLowerCase().replace(".", "")], Number(m[2]));
    if (d) return { date: d, index: m.index, length: m[0].length };
  }
  m = DATE_DMY.exec(line);
  if (m) {
    const d = mkISO(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
    if (d) return { date: d, index: m.index, length: m[0].length };
  }
  return undefined;
}

export type RelAnchor = "filing" | "service" | "calendarCall" | "pretrial" | "trial";

function anchorOf(text: string): RelAnchor {
  const t = text.toLowerCase();
  if (/calendar\s*call|docket\s*sounding/.test(t)) return "calendarCall";
  if (/pre-?\s*trial|ptc/.test(t)) return "pretrial";
  if (/trial|docket/.test(t)) return "trial";
  if (/serv/.test(t)) return "service";
  return "filing";
}

interface Pattern { id: string; category: Category; re: RegExp; label: string }
// Order matters: more specific patterns first.
const PATTERNS: Pattern[] = [
  { id: "serviceExt", category: "service", re: /service\s+(?:of\s+process\s+)?(?:under|pursuant\s+to)?\s*(?:an\s+)?extension|extended\s+service|service\s+.*extended/i, label: "Service under extension" },
  { id: "service", category: "service", re: /(?:service\s+of\s+(?:the\s+)?(?:complaint|process)|serve\s+(?:the\s+)?complaint|perfect\s+service|deadline\s+for\s+service)/i, label: "Service of complaint" },
  { id: "initialDisclosures", category: "discovery", re: /initial\s+(?:discovery\s+)?disclosure/i, label: "Initial disclosures" },
  { id: "fabre", category: "pleadings", re: /fabre/i, label: "Fabre defendants identified" },
  { id: "addParties", category: "pleadings", re: /add(?:ing|ition\s+of)?\s+(?:new\s+)?part(?:y|ies)|join(?:der)?\s+(?:of\s+)?(?:additional\s+)?part|amend(?:ments?|ing)?\s+(?:to\s+)?(?:the\s+)?pleading|pleading\s+amendments?/i, label: "Add parties / amend pleadings" },
  { id: "objections", category: "pleadings", re: /objections?\s+(?:directed\s+)?to\s+(?:the\s+)?pleadings|motions?\/objections?\s+directed|motions?\s+to\s+dismiss|preliminary\s+motions/i, label: "Objections to pleadings" },
  { id: "expertRebuttal", category: "experts", re: /rebuttal\s+(?:expert|witness)/i, label: "Rebuttal witness disclosure" },
  { id: "expertP", category: "experts", re: /plaintiff'?s?'?\s+expert/i, label: "Plaintiff expert disclosure" },
  { id: "expertD", category: "experts", re: /defendant'?s?'?\s+expert/i, label: "Defendant expert disclosure" },
  { id: "daubert", category: "motions", re: /daubert|expert\s+challenges?|motions?\s+challenging\s+(?:an\s+)?expert/i, label: "Daubert / expert challenges" },
  { id: "expertDiscovery", category: "experts", re: /expert\s+discovery|expert\s+depositions?/i, label: "Expert discovery complete" },
  { id: "expertDisclosure", category: "experts", re: /(?:disclos\w*|list|identif\w*|name)\s+(?:of\s+)?(?:all\s+)?expert|expert\s+(?:witness(?:es)?\s+)?(?:disclosure|lists?)/i, label: "Expert disclosure" },
  { id: "cme", category: "discovery", re: /compulsory\s+(?:medical\s+)?exam|\bcme\b|\bime\b|rule\s+1\.360|inspections?\/examinations?/i, label: "CME / examinations" },
  { id: "compel", category: "discovery", re: /motions?\s+to\s+compel/i, label: "Motions to compel" },
  { id: "writtenDiscovery", category: "discovery", re: /propound|written\s+discovery|requests?\s+for\s+production|interrogatories/i, label: "Written discovery served" },
  { id: "factDiscovery", category: "discovery", re: /fact\s+discovery|non-?expert\s+discovery/i, label: "Fact discovery complete" },
  { id: "discoveryComplete", category: "discovery", re: /(?:completion\s+of|complete)\s+(?:all\s+)?discovery|discovery\s+(?:cut-?off|completion|deadline)/i, label: "All discovery complete" },
  { id: "factWitness", category: "discovery", re: /fact\s+witness|witness\s+(?:and|&)\s+exhibit\s+lists?|witness\s+lists?/i, label: "Witness / exhibit lists" },
  { id: "msjHeard", category: "motions", re: /summary\s+judgment.*(?:heard|hearing|resolved?)|(?:heard|resolved?).*summary\s+judgment/i, label: "MSJ heard / resolved" },
  { id: "msjFile", category: "motions", re: /summary\s+judgment|dispositive\s+motions?/i, label: "MSJ / dispositive motions filed" },
  { id: "mil", category: "motions", re: /motions?\s+in\s+limine/i, label: "Motions in limine" },
  { id: "pretrialMotions", category: "motions", re: /pre-?\s*trial\s+motions|all\s+(?:other\s+)?motions/i, label: "Pretrial motions" },
  { id: "mediation", category: "adr", re: /mediat|alternative\s+dispute|\badr\b|arbitration/i, label: "Mediation / ADR" },
  { id: "depoDesignations", category: "trial", re: /deposition\s+designations?|depo\s+designations?/i, label: "Deposition designations" },
  { id: "pretrialStip", category: "trial", re: /pre-?\s*trial\s+(?:stipulation|statement)|joint\s+pretrial/i, label: "Pretrial stipulation" },
  { id: "cmc", category: "trial", re: /case\s+management\s+conference/i, label: "Case management conference" },
  { id: "calendarCall", category: "trial", re: /calendar\s+call|docket\s+sounding/i, label: "Calendar Call" },
  { id: "pretrial", category: "trial", re: /pre-?\s*trial\s+conference/i, label: "Pretrial conference" },
  { id: "trial", category: "trial", re: /(?:projected\s+|actual\s+)?trial\s+(?:date|period|term|week|docket)|trial\s+(?:is\s+)?set|month\s+and\s+year\s+of\s+the\s+projected\s+trial/i, label: "Trial" },
];

function classify(text: string): Pattern | undefined {
  return PATTERNS.find((p) => p.re.test(text));
}

function cleanLabel(s: string): string {
  return s
    .replace(DATE_NUM, "").replace(DATE_MDY, "").replace(DATE_DMY, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/^\s*(?:the\s+)?deadline\s+(?:for|to)\s+(?:the\s+)?/i, "")
    .replace(/[_.:•\-–—\t]{2,}/g, " ")
    .replace(/^[\s\d.)(a-z]{0,4}[.)]\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[:\s]+$/, "")
    .trim()
    .slice(0, 140)
    .replace(/^./, (c) => c.toUpperCase());
}

export function parseOrderText(text: string): ParsedItem[] {
  const raw = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  // Join label-only lines with a following date-only / relative-only line.
  const lines: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    const next = raw[i + 1];
    const curHasDate = !!findDate(cur) || REL.test(cur);
    if (!curHasDate && next && classify(cur)) {
      const nd = findDate(next);
      const nextMostlyDate = (nd && next.length - nd.length < 25) || (REL.test(next) && !classify(next));
      if (nextMostlyDate) {
        lines.push(`${cur} ${next}`);
        i++;
        continue;
      }
    }
    lines.push(cur);
  }

  const items: ParsedItem[] = [];
  let n = 0;
  for (const line of lines) {
    const pat = classify(line);
    if (!pat) continue;
    const d = findDate(line);
    const rel = REL.exec(line);
    const relM = REL_MONTHS.exec(line);
    if (!d && !rel && !relM) continue;
    // Skip boilerplate sentences that merely mention a date (e.g. "DONE AND ORDERED ... this 3rd day of March, 2025").
    if (/done\s+and\s+ordered|entered\s+(?:on|this)|dated|signed|filed\s+\d/i.test(line)) continue;

    const label = cleanLabel(line) || pat.label;
    const item: ParsedItem = {
      key: `p${n++}`, id: pat.id, label: label.length > 4 ? label : pat.label, category: pat.category,
      sourceLine: line, confidence: "medium", include: true,
    };
    if (d) {
      item.date = d.date;
      item.confidence = line.length < 160 ? "high" : "medium";
    } else if (rel) {
      const days = Number(rel[1]);
      const dir = /before|prior/i.test(rel[3]) ? -1 : 1;
      item.relative = { days: dir * days, anchor: anchorOf(rel[4]) };
      if (/business|court/i.test(rel[2] ?? "")) item.confidence = "low";
    } else if (relM) {
      item.months = { n: Number(relM[1]), anchor: /serv/i.test(relM[3]) ? "service" : "filing" };
    }
    items.push(item);
  }

  // De-duplicate identical id+date rows (tables often repeat in the narrative).
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    const k = `${it.id}|${it.date ?? JSON.stringify(it.relative ?? it.months)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // If the same canonical id appears more than once with different values, disambiguate ids.
  const counts: Record<string, number> = {};
  for (const it of unique) {
    counts[it.id] = (counts[it.id] ?? 0) + 1;
    if (counts[it.id] > 1) it.id = `${it.id}_${counts[it.id]}`;
  }
  return unique;
}

/** Converts relative parsed items into dates once anchors are known (calendar arithmetic only; rolling happens later). */
export function resolveRelative(it: ParsedItem, anchors: Partial<Record<RelAnchor, ISODate>>): ISODate | undefined {
  if (it.date) return it.date;
  if (it.relative) {
    const a = anchors[it.relative.anchor];
    return a ? addDays(a, it.relative.days) : undefined;
  }
  if (it.months) {
    const a = anchors[it.months.anchor];
    if (!a) return undefined;
    const d = new Date(a + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + it.months.n);
    return toISO(d);
  }
  return undefined;
}

/** Deadline types a parsed row can be assigned to (for the review table). */
export const CANONICAL: { id: string; label: string; category: Category }[] = [
  ...PATTERNS.map((p) => ({ id: p.id, label: p.label, category: p.category })),
  { id: "other", label: "Other deadline", category: "motions" },
];
