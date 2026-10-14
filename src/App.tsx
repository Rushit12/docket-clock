import { Calculator as CalcIcon, FileUp, FolderOpen, Home as HomeIcon, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Calculator } from "./components/Calculator";
import { CaseList } from "./components/CaseList";
import { CaseView } from "./components/CaseView";
import { Coverage } from "./components/Coverage";
import { Home } from "./components/Home";
import { ImportOrder } from "./components/ImportOrder";
import { NewCase } from "./components/NewCase";
import { Toaster } from "./components/ui";
import { useCases, useRoute } from "./store";

const NAV = [
  { to: "/", label: "Home", icon: HomeIcon },
  { to: "/cases", label: "Cases", icon: FolderOpen },
  { to: "/import", label: "Import order", icon: FileUp },
  { to: "/calculator", label: "Calculator", icon: CalcIcon },
];

export default function App() {
  const [route, go] = useRoute();
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route]);

  let page;
  const caseMatch = route.match(/^\/case\/([\w-]+)/);
  if (route === "/new") page = <NewCase go={go} />;
  else if (route === "/cases") page = <CaseList go={go} />;
  else if (route === "/import") page = <ImportOrder go={go} />;
  else if (route === "/calculator") page = <Calculator />;
  else if (route === "/sources") page = <Coverage />;
  else if (caseMatch) page = <CaseView key={caseMatch[1]} id={caseMatch[1]} go={go} />;
  else page = <Home go={go} />;

  const active = (to: string) => (to === "/" ? route === "/" : route.startsWith(to) || (to === "/cases" && route.startsWith("/case/")));
  const isWizard = route === "/new";

  return (
    <div className="min-h-screen flex flex-col">
      {!isWizard && (
        <header className="no-print sticky top-0 z-30 bg-canvas/85 backdrop-blur-md border-b border-line/70">
          <div className="mx-auto max-w-[1160px] px-4 sm:px-6 h-16 flex items-center gap-2 sm:gap-6">
            <a href="#/" className="flex items-center gap-2.5 shrink-0" aria-label="Docket Clock home">
              <img src="./favicon.svg" alt="" className="h-8 w-8" />
              <span className="display text-[19px] font-bold">Docket Clock</span>
            </a>
            <nav className="hidden md:flex items-center gap-1" aria-label="Main">
              {NAV.map((n) => (
                <a key={n.to} href={`#${n.to}`} aria-current={active(n.to) ? "page" : undefined}
                  className={`h-9 px-3.5 rounded-full inline-flex items-center text-[14.5px] font-semibold transition-colors ${active(n.to) ? "bg-ink text-white" : "text-ink-2 hover:bg-line-2 hover:text-ink"}`}>
                  {n.label}
                </a>
              ))}
            </nav>
            <span className="flex-1" />
            <button onClick={() => setPalette(true)} className="hidden sm:inline-flex items-center gap-2 h-10 pl-3 pr-2 rounded-xl border-[1.5px] border-line bg-surface text-[14px] text-muted hover:border-[#c9d3cf] w-[230px]">
              <Search size={16} /> <span className="flex-1 text-left">Find a case</span>
              <kbd className="text-[11.5px] font-semibold rounded-md bg-line-2 px-1.5 py-0.5 text-ink-2">⌘K</kbd>
            </button>
            <button onClick={() => setPalette(true)} aria-label="Find a case" className="sm:hidden h-10 w-10 grid place-items-center rounded-xl hover:bg-line-2"><Search size={19} /></button>
            <a href="#/new" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand text-white text-[14.5px] font-semibold hover:bg-brand-2">
              <Plus size={18} /> <span className="hidden sm:inline">New case</span>
            </a>
          </div>
        </header>
      )}

      <main className={`flex-1 w-full mx-auto ${isWizard ? "" : "max-w-[1160px] px-4 sm:px-6 pt-6 sm:pt-10 pb-28 md:pb-16"}`}>{page}</main>

      {!isWizard && (
        <>
          <footer className="no-print hidden md:block border-t border-line/70">
            <div className="mx-auto max-w-[1160px] px-6 py-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
              <span>Built for Florida insurance defense.</span>
              <a href="#/sources" className="hover:text-ink underline-offset-2 hover:underline">Circuits, rules and sources</a>
              <span>A calculation aid, not legal advice. The order entered in your case controls.</span>
            </div>
          </footer>
          <nav aria-label="Main" className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="grid grid-cols-4 h-16">
              {NAV.map((n) => (
                <a key={n.to} href={`#${n.to}`} aria-current={active(n.to) ? "page" : undefined}
                  className={`flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold ${active(n.to) ? "text-brand" : "text-muted"}`}>
                  <n.icon size={21} strokeWidth={active(n.to) ? 2.3 : 1.8} />{n.label}
                </a>
              ))}
            </div>
          </nav>
        </>
      )}
      {palette && <Palette onClose={() => setPalette(false)} go={go} />}
      <Toaster />
    </div>
  );
}

function Palette({ onClose, go }: { onClose: () => void; go: (r: string) => void }) {
  const { cases } = useCases();
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const items = useMemo(() => {
    const actions = [
      { label: "Start a new case timeline", to: "/new", hint: "Action" },
      { label: "Import an issued CMO", to: "/import", hint: "Action" },
      { label: "Open the rule calculator", to: "/calculator", hint: "Action" },
      { label: "Circuits, rules and sources", to: "/sources", hint: "Reference" },
    ];
    const cs = cases.map((c) => ({ label: c.inputs.name, to: `/case/${c.id}`, hint: [c.inputs.caseNumber, c.claimNumber, c.inputs.county].filter(Boolean).join(", ") }));
    const t = q.toLowerCase();
    return [...cs, ...actions].filter((i) => !t || `${i.label} ${i.hint}`.toLowerCase().includes(t)).slice(0, 9);
  }, [q, cases]);
  const run = (to: string) => { go(to); onClose(); };
  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label="Find a case">
      <div className="absolute inset-0 bg-ink/30 anim-fade" onClick={onClose} />
      <div className="relative mx-auto mt-[12vh] w-[min(560px,calc(100%-32px))] rounded-[20px] bg-surface shadow-lift anim-up overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search size={19} className="text-muted" />
          <input autoFocus className="h-14 flex-1 bg-transparent outline-none text-[16px]" placeholder="Case name, case number, claim number…" value={q}
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              if (e.key === "Enter" && items[hi]) run(items[hi].to);
            }} />
        </div>
        <ul className="p-2 max-h-[50vh] overflow-auto">
          {items.length === 0 && <li className="px-3 py-3 text-muted text-[14.5px]">Nothing matches “{q}”.</li>}
          {items.map((i, idx) => (
            <li key={i.to + idx}>
              <button onMouseEnter={() => setHi(idx)} onClick={() => run(i.to)} className={`w-full text-left flex items-center justify-between gap-4 rounded-[12px] px-3 py-2.5 ${idx === hi ? "bg-line-2" : ""}`}>
                <span className="font-semibold truncate">{i.label}</span>
                <span className="text-[13px] text-muted truncate">{i.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
