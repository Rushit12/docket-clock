import { diffDays, type ISODate } from "./engine/dates";
import { generateTimeline, type GenerateResult } from "./engine/generate";
import type { TimelineEntry } from "./engine/types";
import { getSettings, type SavedCase } from "./store";
import type { TaskSettings } from "./engine/tasks";

export interface CaseSummary {
  c: SavedCase;
  result: GenerateResult;
  isDone: (e: TimelineEntry) => boolean;
  open: TimelineEntry[]; // actionable, not done
  next?: TimelineEntry;
  overdue: TimelineEntry[];
  progress: number; // 0..1 from filing to trial
  daysToTrial?: number;
}

export function summarize(c: SavedCase, today: ISODate, settings: TaskSettings = getSettings()): CaseSummary {
  const result = generateTimeline(c.inputs, { overrides: c.overrides, orderItems: c.orderItems, settings });
  const isDone = (e: TimelineEntry) => c.done[e.id] ?? !!e.satisfied;
  const open = result.entries.filter((e) => e.kind !== "info" && !isDone(e));
  const next = open.find((e) => e.kind === "deadline" && e.date >= today);
  const overdue = open.filter((e) => (e.kind === "deadline" || e.kind === "task") && e.date < today);
  const filing = c.inputs.filingDate;
  const trial = result.anchors.trial?.date;
  let progress = 0;
  if (filing && trial) progress = Math.min(1, Math.max(0, diffDays(filing, today) / Math.max(1, diffDays(filing, trial))));
  return { c, result, isDone, open, next, overdue, progress, daysToTrial: trial ? diffDays(today, trial) : undefined };
}

/** Plain-language phase the case is in, based on which milestones have passed. */
export function phaseOf(s: CaseSummary, today: ISODate): string {
  const e = s.result.entries;
  const passed = (ids: string[]) => ids.some((id) => { const x = e.find((y) => y.id === id); return x && x.date < today; });
  if (s.daysToTrial !== undefined && s.daysToTrial < 0) return "Trial";
  if (passed(["mediation"])) return "Trial prep";
  if (passed(["msjFile", "expertDiscovery", "discoveryComplete"])) return "Pretrial motions";
  if (passed(["factDiscovery", "expertDisclosure", "expertP"])) return "Expert discovery";
  if (passed(["answer", "initialDisclosures"])) return "Discovery";
  return "Pleadings";
}
