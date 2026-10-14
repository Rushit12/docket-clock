import { addDays, type ISODate, isWeekend, weekday } from "./dates";
import type { HolidayCalendar } from "./holidays";

/**
 * Fla. R. Gen. Prac. & Jud. Admin. 2.514(a):
 *  (1)(A) exclude the day of the event that triggers the period;
 *  (1)(B) count every day, including Saturdays, Sundays and legal holidays;
 *  (1)(C) include the last day, but if it is a Saturday, Sunday or legal holiday,
 *         the period continues to run until the next day that is not one of those.
 *  (a)(5) "next day" is determined by continuing to count forward when the period
 *         is measured after an event and backward when measured before an event.
 * 2.514(b): add 5 days when a party must act within a period after service and
 *         service was made by mail (no added days for e-mail / e-portal service).
 */

export interface Roll {
  date: ISODate;
  /** Raw arithmetic date before any weekend/holiday adjustment. */
  raw: ISODate;
  rolled: boolean;
  rollReason?: string;
  /** Final date falls on a day some circuits close but this one isn't confirmed. */
  possibleClosure?: string;
}

export function isClosed(iso: ISODate, cal: HolidayCalendar): string | null {
  if (isWeekend(iso)) return weekday(iso) === 0 ? "Sunday" : "Saturday";
  return cal.closed.get(iso) ?? null;
}

export function rollToCourtDay(iso: ISODate, direction: 1 | -1, cal: HolidayCalendar): Roll {
  let d = iso;
  const reasons: string[] = [];
  let guard = 0;
  let why = isClosed(d, cal);
  while (why && guard++ < 30) {
    reasons.push(why);
    d = addDays(d, direction);
    why = isClosed(d, cal);
  }
  return {
    date: d,
    raw: iso,
    rolled: d !== iso,
    rollReason: reasons.length ? reasons.join(", ") : undefined,
    possibleClosure: cal.possible.get(d),
  };
}

/** Counts `days` calendar days from `trigger` (negative = before) and applies Rule 2.514. */
export function computeDeadline(
  trigger: ISODate,
  days: number,
  cal: HolidayCalendar,
  opts: { mailService?: boolean; noRoll?: boolean } = {},
): Roll {
  const extra = opts.mailService && days > 0 ? 5 : 0;
  const raw = addDays(trigger, days + extra);
  if (opts.noRoll) return { date: raw, raw, rolled: false, possibleClosure: cal.possible.get(raw) };
  return rollToCourtDay(raw, days < 0 ? -1 : 1, cal);
}

/** Business-day counting (used where an order says "business days"). */
export function addCourtDays(trigger: ISODate, n: number, cal: HolidayCalendar): ISODate {
  let d = trigger;
  let count = 0;
  const step = n < 0 ? -1 : 1;
  while (count < Math.abs(n)) {
    d = addDays(d, step);
    if (!isClosed(d, cal)) count++;
  }
  return d;
}
