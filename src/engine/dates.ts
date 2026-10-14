// Date utilities. All dates are ISO "YYYY-MM-DD" strings handled in UTC so
// that time zones and daylight-saving changes can never shift a deadline.

export type ISODate = string;

export function toDate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Adds calendar months; clamps to the last day of the target month (e.g. Jan 31 + 1 mo = Feb 28/29). */
export function addMonths(iso: ISODate, n: number): ISODate {
  const d = toDate(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return toISO(target);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
}

export function weekday(iso: ISODate): number {
  return toDate(iso).getUTCDay(); // 0 = Sunday
}

export function isWeekend(iso: ISODate): boolean {
  const w = weekday(iso);
  return w === 0 || w === 6;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

export function isValidISO(s: string | undefined | null): s is ISODate {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(toDate(s)) === s;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function fmt(iso: ISODate, opts: { weekday?: boolean } = {}): string {
  const d = toDate(iso);
  const s = `${MO[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  return opts.weekday ? `${WD[d.getUTCDay()]}, ${s}` : s;
}

export function fmtMonth(iso: ISODate): string {
  const d = toDate(iso);
  return `${MONTH_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtUS(iso: ISODate): string {
  const d = toDate(iso);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function weekdayName(iso: ISODate): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday(iso)];
}

export function todayISO(): ISODate {
  const now = new Date();
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}
