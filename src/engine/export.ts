import { addDays, fmtUS, type ISODate } from "./dates";
import type { TimelineEntry } from "./types";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fold(line: string): string {
  const out: string[] = [];
  let l = line;
  while (l.length > 74) {
    out.push(l.slice(0, 74));
    l = " " + l.slice(74);
  }
  out.push(l);
  return out.join("\r\n");
}

export interface IcsCase {
  name: string;
  caseNumber?: string;
  entries: TimelineEntry[];
}

/** All-day calendar events with a 7-day and a 1-day reminder. */
export function toICS(cases: IcsCase[], stamp = new Date()): string {
  const dt = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Docket Clock//CMO Timeline//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const c of cases) {
    for (const e of c.entries) {
      if (e.kind === "info" && e.id !== "sol") continue;
      const d = e.date.replace(/-/g, "");
      const end = addDays(e.date, 1).replace(/-/g, "");
      const title = `${e.kind === "task" ? `[${e.role}] ` : ""}${c.name}${c.caseNumber ? ` (${c.caseNumber})` : ""}: ${e.label}`;
      const desc = [e.basis, e.citation, e.note, e.rolled ? `Rolled from ${fmtUS(e.raw)} (${e.rollReason}) under Rule 2.514(a).` : ""].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${(c.caseNumber || c.name).replace(/\W+/g, "")}-${e.id}-${d}@docketclock`,
        `DTSTAMP:${dt}`,
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${end}`,
        fold(`SUMMARY:${esc(title)}`),
        fold(`DESCRIPTION:${esc(desc)}`),
        `CATEGORIES:${esc(e.category)}`,
        "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P7D", fold(`DESCRIPTION:${esc("7 days: " + title)}`), "END:VALARM",
        "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P1D", fold(`DESCRIPTION:${esc("Tomorrow: " + title)}`), "END:VALARM",
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function toCSV(name: string, entries: TimelineEntry[]): string {
  const q = (s: string | undefined) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const head = ["Case", "Type", "Item", "Date", "Weekday", "Assigned to", "Stage", "Basis", "Rolled from", "Authority", "Source", "Notes"];
  const rows = entries.map((e) => [
    name, e.kind === "task" ? "Task" : e.kind === "info" ? "Court checkpoint" : "Court deadline", e.label, fmtUS(e.date), new Date(e.date + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    e.role ?? "", e.phase ?? "", e.basis, e.rolled ? `${fmtUS(e.raw)} (${e.rollReason})` : "", e.citation, e.confidence, [e.note, ...(e.checklist ?? []).map((c) => `[ ] ${c}`)].filter(Boolean).join(" | "),
  ].map((v) => q(String(v ?? ""))).join(","));
  return [head.join(","), ...rows].join("\r\n");
}

export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { ISODate };
