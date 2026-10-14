import { CalendarClock, Calculator as CalcIcon, FileInput, FolderOpen, LayoutList, Library, Plus } from "lucide-react";
import { useState } from "react";
import { Calculator } from "./components/Calculator";
import { CaseList } from "./components/CaseList";
import { CaseView } from "./components/CaseView";
import { Coverage } from "./components/Coverage";
import { Dashboard } from "./components/Dashboard";
import { ImportOrder } from "./components/ImportOrder";
import { useCases, useRoute } from "./store";

const NAV = [
  { to: "/", label: "This week", icon: CalendarClock },
  { to: "/cases", label: "Cases", icon: FolderOpen },
  { to: "/import", label: "Import a CMO", icon: FileInput },
  { to: "/calculator", label: "Rule calculator", icon: CalcIcon },
  { to: "/coverage", label: "Circuits & sources", icon: Library },
];

export default function App() {
  const [route, go] = useRoute();
  const { cases } = useCases();
  const [menu, setMenu] = useState(false);

  let page;
  const caseMatch = route.match(/^\/case\/([\w-]+)/);
  if (route === "/" ) page = <Dashboard go={go} />;
  else if (route === "/cases") page = <CaseList go={go} />;
  else if (route === "/import") page = <ImportOrder go={go} />;
  else if (route === "/calculator") page = <Calculator />;
  else if (route === "/coverage") page = <Coverage />;
  else if (caseMatch) page = <CaseView key={caseMatch[1]} id={caseMatch[1]} go={go} />;
  else page = <Dashboard go={go} />;

  const active = (to: string) => (to === "/" ? route === "/" : route.startsWith(to) || (to === "/cases" && route.startsWith("/case/")));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="no-print bg-ink text-white md:sticky md:top-0 md:h-screen flex md:flex-col">
        <div className="flex items-center justify-between w-full md:block px-4 md:px-5 py-3 md:py-6">
          <a href="#/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
            <img src="./favicon.svg" alt="" className="h-7 w-7" />
            Docket Clock
          </a>
          <button className="md:hidden p-2 rounded-md hover:bg-white/10" aria-label="Menu" onClick={() => setMenu(!menu)}>
            <LayoutList size={20} />
          </button>
        </div>
        <nav className={`${menu ? "block" : "hidden"} md:block absolute md:static top-14 inset-x-0 z-30 bg-ink md:bg-transparent px-3 pb-3 md:pb-0`}>
          <button
            onClick={() => { go("/case/new"); setMenu(false); }}
            className="w-full mb-4 flex items-center justify-center gap-2 rounded-lg bg-highlight text-ink font-semibold py-2.5 hover:brightness-95"
          >
            <Plus size={18} /> New case timeline
          </button>
          {NAV.map((n) => (
            <a
              key={n.to}
              href={`#${n.to}`}
              onClick={() => setMenu(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] mb-0.5 ${active(n.to) ? "bg-white/12 text-white font-semibold" : "text-white/75 hover:text-white hover:bg-white/6"}`}
            >
              <n.icon size={18} strokeWidth={1.8} />
              <span className="flex-1">{n.label}</span>
              {n.to === "/cases" && cases.length > 0 && <span className="text-xs text-white/60 tabular">{cases.length}</span>}
            </a>
          ))}
        </nav>
        <p className="hidden md:block mt-auto px-5 pb-5 text-xs leading-relaxed text-white/55">
          Built for Florida insurance defense. Every date shows the rule or order it comes from. Verify against the order entered in your case.
        </p>
      </aside>
      <main className="min-w-0 px-4 sm:px-8 py-6 sm:py-10 print-full">{page}</main>
    </div>
  );
}
