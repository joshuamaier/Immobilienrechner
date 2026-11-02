import { berechneSteuer, type ObjektErgebnis, type SteuerVerteilung } from "./portfolio";
import { aktuelleProjektion, planProjektion } from "./tracking";
import { kirchensteuerSatz, steuerlast, verheiratetImJahr } from "./tax";
import type { Objekt, Portfolio } from "./types";

export type Variante = "aktuell" | "plan";

export interface PortfolioJahr {
  jahr: number;
  objekte: number;
  nettomiete: number;
  bewirtschaftung: number;
  zinsaufwand: number;
  tilgungsleistung: number;
  kapitaldienst: number;
  cashflowVorSteuern: number;
  steuerwirkung: number;
  cashflowNachSteuern: number;
  kumulierterCashflow: number;
  objektwert: number;
  restschuld: number;
  eigenkapital: number;
  aufgebautesVermoegen: number;
  zveBasis: number;
  zveMitImmobilien: number;
  steuerOhne: number;
  steuerMit: number;
}

export interface PortfolioErgebnis {
  objekte: ObjektErgebnis[];
  jeId: Map<string, ObjektErgebnis>;
  verteilung: SteuerVerteilung[];
  jahre: PortfolioJahr[];
}

/**
 * Rechnet alle Objekte gemeinsam (Steuer chronologisch verteilt).
 * `varianten` wählt je Objekt die aktuelle Sicht (Ist + Hochrechnung) oder den ursprünglichen Plan.
 */
export function rechnePortfolio(p: Portfolio, varianten: Record<string, Variante> = {}): PortfolioErgebnis {
  const eingaenge = p.objekte.map((o) => {
    const proj = varianten[o.id] === "plan" ? planProjektion(o) : aktuelleProjektion(o);
    return { id: o.id, kaufdatum: (varianten[o.id] === "plan" ? o.baseline ?? o.daten : o.daten).kaufdatum, ...proj };
  });
  const { ergebnisse, verteilung } = berechneSteuer(p.steuerprofil, eingaenge);
  const jeId = new Map(ergebnisse.map((e) => [e.id, e]));

  const church = kirchensteuerSatz(p.steuerprofil);
  const jahre: PortfolioJahr[] = verteilung.map((v) => {
    const zeilen = ergebnisse.map((e) => e.jahre.find((y) => y.jahr === v.jahr)).filter((y) => y !== undefined);
    const sum = (f: (y: (typeof zeilen)[number]) => number) => zeilen.reduce((a, y) => a + f(y), 0);
    const verheiratet = verheiratetImJahr(p.steuerprofil, v.jahr);
    const zveMit = v.zveBasis + v.eintraege.reduce((a, e) => a + e.ergebnis, 0);
    return {
      jahr: v.jahr,
      objekte: zeilen.length,
      nettomiete: sum((y) => y.nettomiete),
      bewirtschaftung: sum((y) => y.bewirtschaftung),
      zinsaufwand: sum((y) => y.zinsaufwand),
      tilgungsleistung: sum((y) => y.tilgungsleistung),
      kapitaldienst: sum((y) => y.kapitaldienst),
      cashflowVorSteuern: sum((y) => y.cashflowVorSteuern),
      steuerwirkung: sum((y) => y.steuerwirkung),
      cashflowNachSteuern: sum((y) => y.cashflowNachSteuern),
      kumulierterCashflow: 0,
      objektwert: sum((y) => y.objektwert),
      restschuld: sum((y) => y.restschuld),
      eigenkapital: sum((y) => y.eigenkapital),
      aufgebautesVermoegen: sum((y) => y.aufgebautesVermoegen),
      zveBasis: v.zveBasis,
      zveMitImmobilien: Math.max(0, zveMit),
      steuerOhne: steuerlast(v.zveBasis, verheiratet, church),
      steuerMit: steuerlast(zveMit, verheiratet, church),
    };
  });
  let cumulative = 0;
  for (const j of jahre) {
    cumulative += j.cashflowNachSteuern;
    j.kumulierterCashflow = cumulative;
  }
  return { objekte: ergebnisse, jeId, verteilung, jahre };
}

/** Ein Objekt allein, ohne die übrigen Objekte im Steuerprofil. */
export function rechneIsoliert(p: Portfolio, objekt: Objekt, variante: Variante = "aktuell"): ObjektErgebnis {
  return rechnePortfolio({ ...p, objekte: [objekt] }, { [objekt.id]: variante }).objekte[0];
}
