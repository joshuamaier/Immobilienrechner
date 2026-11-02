import { href, useRoute } from "./state/route";
import { useStore } from "./state/store";
import { Uebersicht } from "./pages/Uebersicht";
import { SteuerprofilSeite } from "./pages/Steuerprofil";
import { Daten } from "./pages/Daten";
import { ObjektSeite } from "./pages/ObjektSeite";

export function App() {
  const route = useRoute();
  const { portfolio, letzterExport } = useStore();
  const aktiv = (s: string) => (route.seite === s ? "page" : undefined);
  const tageSeitExport = letzterExport ? Math.floor((Date.now() - Date.parse(letzterExport)) / 86400000) : null;
  const exportHinweis = portfolio.objekte.length > 0 && (tageSeitExport === null || tageSeitExport > 30);

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="brand" href={href.uebersicht()}>
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 15 16 5l12 10v12H4z" />
              <path className="door" d="M13 27v-7h6v7" />
            </svg>
            Immobilienrechner
          </a>
          <nav aria-label="Hauptnavigation">
            <a href={href.uebersicht()} aria-current={aktiv("uebersicht") ?? (route.seite === "objekt" ? "page" : undefined)}>
              Portfolio
            </a>
            <a href={href.steuer()} aria-current={aktiv("steuer")}>
              Steuerprofil
            </a>
            <a href={href.daten()} aria-current={aktiv("daten")}>
              Daten
              {exportHinweis && <span className="dot-badge" title="Noch nicht gesichert" />}
            </a>
          </nav>
        </div>
      </header>
      <main className="wrap">
        {route.seite === "uebersicht" && <Uebersicht />}
        {route.seite === "steuer" && <SteuerprofilSeite />}
        {route.seite === "daten" && <Daten />}
        {route.seite === "objekt" && <ObjektSeite id={route.id} tab={route.tab} />}
      </main>
      <footer className="wrap disclaimer">
        Unverbindliche Modellrechnung, keine Steuer- oder Finanzierungsberatung. Einkommensteuer nach Grundtarif 2026 inkl.
        Solidaritätszuschlag und optionaler Kirchensteuer, für spätere Jahre unverändert fortgeschrieben. Alle Daten bleiben in
        diesem Browser; zum Sichern unter „Daten“ exportieren.
      </footer>
    </>
  );
}
