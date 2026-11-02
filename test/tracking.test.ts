import { describe, expect, it } from "vitest";
import { beispielPortfolio } from "../src/domain/presets";
import { aktuelleProjektion, istJahre, planProjektion, vergleichJahr } from "../src/domain/tracking";
import { rechnePortfolio } from "../src/domain/calc";

// Bestandsobjekt der Vorlagen: gekauft 05/2022, Ist-Daten bis 10/2026.
const bestand = () => beispielPortfolio().objekte[0];

describe("Ist-Tracking", () => {
  it("fasst Jahressummen und Monatswerte zusammen", () => {
    const o = bestand();
    const ist = istJahre(o.ist.buchungen, o.daten.kaufdatum);
    expect(ist.get(2022)!.abgedeckteMonate).toBe(8);
    expect(ist.get(2024)!.summen.miete).toBe(7 * 790 + 2 * 850);
    expect(ist.get(2026)!.abgedeckteMonate).toBe(10);
    expect(ist.get(2026)!.summen.miete).toBe(10 * 850);
  });

  it("übernimmt Ist-Werte und füllt fehlende Monate aus dem Modell", () => {
    const aktuell = aktuelleProjektion(bestand()).jahre;
    const y2024 = aktuell.find((y) => y.jahr === 2024)!;
    expect(y2024.nettomiete).toBe(7230);
    expect(y2024.sonstigeAusgaben).toBe(6400 + 950);
    const y2026 = aktuell.find((y) => y.jahr === 2026)!;
    expect(y2026.nettomiete).toBeGreaterThan(10 * 850);
    expect(y2026.nettomiete).toBeLessThan(12 * 900);
  });

  it("startet die Hochrechnung bei Restschuld und Marktwert laut Stichtag", () => {
    const o = bestand();
    const aktuell = aktuelleProjektion(o).jahre.find((y) => y.jahr === 2025)!;
    expect(aktuell.restschuld).toBeCloseTo(202957, 0);
    expect(aktuell.objektwert).toBe(238000);
    // Der Stichtag passt zum Tilgungsplan des Kaufplans.
    const plan = planProjektion(o).jahre.find((y) => y.jahr === 2025)!;
    expect(Math.abs(plan.restschuld - 202957)).toBeLessThan(1);
  });

  it("schreibt das Kostenniveau des letzten Ist-Jahres fort", () => {
    const y2027 = aktuelleProjektion(bestand()).jahre.find((y) => y.jahr === 2027)!;
    expect(y2027.hausgeldkosten).toBeCloseTo(92 * 12 * 1.025, 6);
  });

  it("verwendet die Ist-Steuer als Zahlungsfluss", () => {
    const r = rechnePortfolio(beispielPortfolio());
    const y = r.jeId.get("vorlage-bestand")!.jahre.find((x) => x.jahr === 2024)!;
    expect(y.steuerwirkung).toBe(540);
  });

  it("vergleicht laufende Jahre anteilig", () => {
    const o = bestand();
    const plan = planProjektion(o).jahre.find((y) => y.jahr === 2026)!;
    const ist = istJahre(o.ist.buchungen, o.daten.kaufdatum).get(2026)!;
    const zeilen = vergleichJahr({ y: plan, steuerwirkung: 0 }, ist);
    const miete = zeilen.find((z) => z.key === "miete")!;
    expect(miete.plan).toBeCloseTo((plan.nettomiete * 10) / 12, 6);
    expect(miete.ist).toBe(10 * 850);
  });

  it("die Hochrechnung liegt unter dem Kaufplan", () => {
    const o = bestand();
    const plan = planProjektion(o).jahre;
    const aktuell = aktuelleProjektion(o).jahre;
    for (const jahr of [2026, 2032, 2040]) {
      const p = plan.find((y) => y.jahr === jahr)!;
      const a = aktuell.find((y) => y.jahr === jahr)!;
      expect(a.eigenkapital, `Eigenkapital ${jahr}`).toBeLessThan(p.eigenkapital);
    }
  });
});
