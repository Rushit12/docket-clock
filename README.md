# Docket Clock

Case management order (CMO) timelines for Florida insurance defense. Pick the county, track and filing date, and Docket Clock builds every deadline the way the court counts it, with the authority behind each date.

## What it does

- **Circuit-specific CMO schedules** transcribed from each circuit's 2025 administrative order (3rd, 6th, 7th partial, 9th county civil, 13th, 17th, 18th). Forward-counted deadlines (days after filing/service) and backward-counted ones (days before Calendar Call, pretrial conference or trial) are both supported.
- **Rule 2.514 time computation**: trigger day excluded, weekends and court holidays roll forward for "after" periods and backward for "before" periods, +5 days for mail service.
- **Court holiday calendars**: statewide core holidays computed for any year, plus Good Friday, Rosh Hashanah, Yom Kippur and discretionary days per circuit. Unconfirmed closure days are flagged instead of silently assumed. Hurricane/emergency closures can be added per case.
- **Statewide rule deadlines** for every case: answer (1.140), initial disclosures (1.280(a)), CMO issuance and track assignment (1.200), Rule 2.250 projected trial, trial order (1.440(c)), proposal-for-settlement windows (1.442), and the post-HB 837 negligence limitations check (§95.11(4)(a)).
- **Import an issued CMO** (PDF or pasted text, parsed in the browser): extracts dated and relative deadlines, then checks them — weekend/holiday dates, MSJ briefing squeeze under Rule 1.510(c)(5)–(6), out-of-order deadlines, and time-standard overruns.
- **Tracking**: saved cases, a "this week" view across all cases, mark-done, court-changed overrides, `.ics` calendar export with 7-day and 1-day reminders, CSV, print.
- **Rule calculator** for event-triggered deadlines (MSJ responses, discovery, PFS acceptance, §57.105 safe harbor, rehearing, fees, appeal).

Every date carries a confidence tag: **Circuit form**, **By rule**, **Your order**, **Estimate** (depends on a date not yet set) or **Set by you**.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests (holidays, Rule 2.514, circuit schedules, parser)
npm run build
```

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repo. The included `vercel.json` sets the Vite framework, runs the tests, then builds to `dist`.
3. Deploy. No environment variables are needed — everything runs in the browser.

Or from the command line: `npm i -g vercel && vercel --prod`.

## Where things live

| Path | Purpose |
| --- | --- |
| `src/engine/circuits.ts` | County → circuit map, per-circuit CMO schedules, holiday policies, track tables, sources |
| `src/engine/compute.ts` | Rule 2.514 date arithmetic |
| `src/engine/holidays.ts` | Florida court holiday calendar |
| `src/engine/generate.ts` | Builds a case timeline and runs the validation checks |
| `src/engine/parser.ts` | Extracts deadlines from CMO text |
| `src/engine/calculator.ts` | Event-triggered rule deadlines |

### Adding a circuit or updating a form

Each schedule is plain data: `after(id, label, category, days, anchor)` or `before(id, label, category, days, anchor)` with a `source` pointing to the administrative order. Add a test in `src/engine/engine.test.ts` that checks one or two dates against a real order before shipping.

## Roadmap to a paid product

- Accounts and a shared database (Vercel Postgres / Supabase) so a whole firm sees the same cases; auth with Clerk or Auth.js.
- Remaining circuits' forms (1st, 2nd, 4th, 5th, 8th, 10th, 12th, 14th, 16th, 19th, 20th) and county court forms; 11th/15th Circuit order templates for one-click import.
- OCR for scanned orders and an LLM fallback for unusual layouts, always shown as "Check this row" until confirmed.
- Email/Teams digests of the week's deadlines, Outlook/Google calendar sync, and docketing integrations (Clio, PracticePanther, Litify).
- Other states and practice areas, reusing the same engine with new schedule data.

## Disclaimer

A calculation aid, not legal advice. Judges modify forms and chief judges issue emergency orders; the order entered in the case always controls.
