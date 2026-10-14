import { Lock, RotateCcw } from "lucide-react";
import { DEFAULT_SETTINGS, TASKS, type TaskTemplate } from "../engine/tasks";
import type { Phase } from "../engine/types";
import { useSettings } from "../store";
import { Button, toast } from "./ui";

const PHASES: Phase[] = ["Intake & pleadings", "Disclosures & written discovery", "Records & subpoenas", "Depositions", "Medical exam", "Experts", "Dispositive motions", "Mediation & settlement", "Trial preparation", "Carrier reporting"];

export function Settings() {
  const [settings, save] = useSettings();

  const daysFor = (t: TaskTemplate) => settings.days[t.id] ?? t.days;
  const setDays = (t: TaskTemplate, abs: number, dir: "before" | "after") => {
    const v = dir === "before" ? -Math.abs(abs) : Math.abs(abs);
    const days = { ...settings.days };
    if (v === t.days) delete days[t.id]; else days[t.id] = v;
    save({ ...settings, days });
  };
  const toggle = (t: TaskTemplate, on: boolean) => {
    const disabled = { ...settings.disabled };
    if (on) delete disabled[t.id]; else disabled[t.id] = true;
    save({ ...settings, disabled });
  };
  const changed = Object.keys(settings.days).length + Object.keys(settings.disabled).length + (settings.carrierReports ? 0 : 1);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[34px] sm:text-[44px] leading-none font-bold">Firm settings</h1>
          <p className="mt-3 text-[16px] text-ink-2 max-w-[66ch] leading-relaxed">Set the lead times your firm and your carriers expect. These apply to every case. Rule-driven timing can't be changed here because it comes from the rules themselves.</p>
        </div>
        <Button disabled={!changed} onClick={() => { save(DEFAULT_SETTINGS); toast("Settings reset to defaults"); }}><RotateCcw size={16} /> Reset to defaults</Button>
      </div>

      <section className="mt-8 rounded-[20px] bg-surface shadow-soft p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[60ch]">
          <p className="font-semibold">Carrier reporting tasks</p>
          <p className="text-[14px] text-ink-2 mt-0.5">Initial evaluation, status reports every 90 days, deposition summaries, pre-mediation and pretrial reports. Turn off for non-carrier clients.</p>
        </div>
        <Switch on={settings.carrierReports} onChange={(v) => save({ ...settings, carrierReports: v })} label="Carrier reporting tasks" />
      </section>

      {PHASES.map((p) => {
        const items = TASKS.filter((t) => t.phase === p);
        if (!items.length) return null;
        const muted = p === "Carrier reporting" && !settings.carrierReports;
        return (
          <section key={p} className={`mt-8 ${muted ? "opacity-50" : ""}`}>
            <h2 className="display text-[20px] font-bold mb-3">{p}</h2>
            <ul className="rounded-[18px] bg-surface shadow-soft divide-y divide-line-2">
              {items.map((t) => {
                const on = !settings.disabled[t.id];
                const d = daysFor(t);
                const edited = settings.days[t.id] !== undefined;
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <Switch on={on} onChange={(v) => toggle(t, v)} label={t.title} />
                    <div className={`min-w-[220px] flex-1 ${on ? "" : "opacity-50"}`}>
                      <p className="font-medium leading-snug">{t.title}</p>
                      <p className="text-[13px] text-muted">{t.role}{t.citation ? `, ${t.citation}` : ""}</p>
                    </div>
                    {t.basis === "rule" || t.fit ? (
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2"><Lock size={14} /> Set by rule</span>
                    ) : (
                      <div className={`flex items-center gap-2 text-[13.5px] ${on ? "" : "opacity-50"}`}>
                        <input aria-label={`Days for ${t.title}`} type="number" min={0} max={365} className="input tabular !w-[76px] !py-1.5 text-right" value={Math.abs(d)}
                          onChange={(e) => setDays(t, Number(e.target.value || 0), d < 0 ? "before" : "after")} />
                        <span className="text-ink-2 whitespace-nowrap">days {d < 0 ? "before" : "after"} the {t.parentName}</span>
                        {edited && <button className="text-[13px] font-semibold text-brand" onClick={() => setDays(t, Math.abs(t.days), t.days < 0 ? "before" : "after")}>Default ({Math.abs(t.days)})</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-[#cfd8d4]"}`}>
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}
