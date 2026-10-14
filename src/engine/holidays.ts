import { addDays, type ISODate, toISO, weekday } from "./dates";

/**
 * Florida court holidays.
 *
 * Core holidays come from the State Courts System Personnel Regulations and are
 * observed statewide. Good Friday, Rosh Hashanah and Yom Kippur may be designated
 * by each chief judge (§683.19, Fla. Stat.), and each circuit may add up to two
 * discretionary days (commonly Christmas Eve and New Year's Eve). Because those
 * vary by circuit and by year, the engine treats them in three tiers:
 *   - "closed":   confirmed court closure → deadlines roll past it (Rule 2.514(a)(1)(C)).
 *   - "possible": day a circuit *might* close that we could not confirm → flagged for review.
 */

export interface Holiday {
  date: ISODate;
  name: string;
}

function observed(iso: ISODate): ISODate {
  const w = weekday(iso);
  if (w === 6) return addDays(iso, -1); // Saturday → Friday
  if (w === 0) return addDays(iso, 1); // Sunday → Monday
  return iso;
}

function nthWeekday(year: number, month: number, dow: number, n: number): ISODate {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (dow - first.getUTCDay() + 7) % 7;
  return toISO(new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7)));
}

function lastWeekday(year: number, month: number, dow: number): ISODate {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - dow + 7) % 7;
  return toISO(new Date(Date.UTC(year, month + 1, -offset)));
}

/** Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easter(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toISO(new Date(Date.UTC(year, month - 1, day)));
}

const ROSH_HASHANAH: Record<number, ISODate> = {
  2024: "2024-10-03", 2025: "2025-09-23", 2026: "2026-09-12", 2027: "2027-10-02",
  2028: "2028-09-21", 2029: "2029-09-10", 2030: "2030-09-28",
};
const YOM_KIPPUR: Record<number, ISODate> = {
  2024: "2024-10-12", 2025: "2025-10-02", 2026: "2026-09-21", 2027: "2027-10-11",
  2028: "2028-09-30", 2029: "2029-09-19", 2030: "2030-10-07",
};

export function coreHolidays(year: number): Holiday[] {
  const list: Holiday[] = [
    { date: observed(`${year}-01-01`), name: "New Year's Day" },
    { date: nthWeekday(year, 0, 1, 3), name: "Martin Luther King Jr. Day" },
    { date: lastWeekday(year, 4, 1), name: "Memorial Day" },
    { date: observed(`${year}-07-04`), name: "Independence Day" },
    { date: nthWeekday(year, 8, 1, 1), name: "Labor Day" },
    { date: observed(`${year}-11-11`), name: "Veterans Day" },
    { date: nthWeekday(year, 10, 4, 4), name: "Thanksgiving Day" },
    { date: addDays(nthWeekday(year, 10, 4, 4), 1), name: "Friday after Thanksgiving" },
    { date: observed(`${year}-12-25`), name: "Christmas Day" },
  ];
  // New Year's Day of the following year can be observed on Dec 31 of this year.
  const nextNY = observed(`${year + 1}-01-01`);
  if (nextNY.startsWith(String(year))) list.push({ date: nextNY, name: "New Year's Day (observed)" });
  return list;
}

export function goodFriday(year: number): Holiday {
  return { date: addDays(easter(year), -2), name: "Good Friday" };
}

export function jewishHolidays(year: number): Holiday[] {
  const out: Holiday[] = [];
  if (ROSH_HASHANAH[year]) out.push({ date: observed(ROSH_HASHANAH[year]), name: "Rosh Hashanah" });
  if (YOM_KIPPUR[year]) out.push({ date: observed(YOM_KIPPUR[year]), name: "Yom Kippur" });
  return out;
}

/** Commonly chosen discretionary days that circuits may (or may not) close. */
export function discretionaryCandidates(year: number): Holiday[] {
  const out: Holiday[] = [
    { date: `${year}-12-24`, name: "Christmas Eve (discretionary)" },
    { date: `${year}-12-31`, name: "New Year's Eve (discretionary)" },
    { date: `${year}-12-26`, name: "Day after Christmas (discretionary)" },
  ];
  return out.filter((h) => weekday(h.date) !== 0 && weekday(h.date) !== 6);
}

export interface CircuitHolidayPolicy {
  goodFriday: boolean | "unknown";
  roshHashanah: boolean | "unknown";
  yomKippur: boolean | "unknown";
  /** Confirmed discretionary closures by year, from the circuit's holiday AO. */
  confirmed?: Record<number, Holiday[]>;
  source?: string;
}

export interface HolidayCalendar {
  closed: Map<ISODate, string>;
  possible: Map<ISODate, string>;
}

export function buildCalendar(
  policy: CircuitHolidayPolicy,
  fromYear: number,
  toYear: number,
  extraClosures: Holiday[] = [],
): HolidayCalendar {
  const closed = new Map<ISODate, string>();
  const possible = new Map<ISODate, string>();
  for (let y = fromYear; y <= toYear; y++) {
    coreHolidays(y).forEach((h) => closed.set(h.date, h.name));
    const gf = goodFriday(y);
    (policy.goodFriday === true ? closed : policy.goodFriday === "unknown" ? possible : null)?.set(gf.date, gf.name);
    for (const h of jewishHolidays(y)) {
      const flag = h.name === "Rosh Hashanah" ? policy.roshHashanah : policy.yomKippur;
      (flag === true ? closed : flag === "unknown" ? possible : null)?.set(h.date, h.name);
    }
    const confirmed = policy.confirmed?.[y];
    if (confirmed) {
      confirmed.forEach((h) => closed.set(h.date, h.name));
    } else {
      discretionaryCandidates(y).forEach((h) => {
        if (!closed.has(h.date)) possible.set(h.date, h.name);
      });
    }
  }
  extraClosures.forEach((h) => {
    closed.set(h.date, h.name);
    possible.delete(h.date);
  });
  for (const d of closed.keys()) possible.delete(d);
  return { closed, possible };
}
