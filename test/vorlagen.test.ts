import { describe, expect, it } from "vitest";
import { rechneIsoliert, rechnePortfolio } from "../src/domain/calc";
import { beispielPortfolio } from "../src/domain/presets";

const close = (actual: number, expected: number, label: string) =>
  expect(Math.abs(actual - expected), `${label}: ${actual.toFixed(2)} ≠ ${expected}`).toBeLessThanOrEqual(0.01);

// Kauf, Finanzierung und AfA des möblierten Apartments, unabhängig vom Rechenkern nachgerechnet.
describe("Apartment: Kauf, Finanzierung und AfA", () => {
  const p = beispielPortfolio();
  const o = p.objekte[1];
  const { kennzahlen: k, jahre } = rechneIsoliert(p, o);
  const kaufpreis = 152000;
  const moebel = 11000;
  const gesamt = kaufpreis + moebel;
  const darlehen = gesamt * 0.95;

  it("Kaufnebenkosten in Baden-Württemberg ohne Makler", () => {
    close(k.nebenkosten.grunderwerbsteuer, kaufpreis * 0.05, "Grunderwerbsteuer 5 %");
    close(k.nebenkosten.notarKauf, kaufpreis * 0.015, "Notar und Grundbuch 1,5 %");
    close(k.nebenkosten.grundschuldkosten, darlehen * 0.006, "Grundschuld 0,6 % des Darlehens");
    close(k.nebenkosten.maklerprovision, 0, "keine Provision");
    close(k.erwerb.eigenkapitalBetrag, gesamt * 0.05, "Eigenkapital 5 %");
    close(k.erwerb.darlehensbetrag, darlehen, "Darlehen");
  });

  it("Monatsrate, Bereitstellungszinsen und Mietrendite", () => {
    close(k.kapitaldienst.monatsrate, (darlehen * (3.9 + 1.5)) / 1200, "Monatsrate");
    close(jahre[0].bereitstellungszinsenJahr, 380, "Bereitstellungszinsen im Kaufjahr");
    close(jahre[1].bereitstellungszinsenJahr, 0, "danach keine");
    close(k.kennwerte.bruttomietrendite, ((12 * 610) / gesamt) * 100, "Mietrendite brutto");
  });

  it("Gebäude-AfA aus Kaufpreis und anteiligen Nebenkosten, Möbel über 10 Jahre", () => {
    const basis = 0.75 * (kaufpreis + kaufpreis * (0.05 + 0.015));
    close(k.steuerbasis.afaBasis, basis, "AfA-Basis");
    // Kauf im April: 9 von 12 Monaten im ersten Jahr
    close(jahre[0].afaGebaeude, basis * 0.02 * (9 / 12), "AfA Kaufjahr");
    close(jahre[1].afaGebaeude, basis * 0.02, "AfA volles Jahr");
    close(jahre[1].afaMoebel, moebel * 0.1, "Möbel-AfA");
    close(jahre.reduce((s, y) => s + y.afaMoebel, 0), moebel, "Möbel vollständig abgeschrieben");
  });

  it("Möbel zählen zur Investition, aber nicht zum Immobilienwert", () => {
    expect(k.erwerb.gesamtinvestition).toBe(gesamt);
    expect(k.erwerb.immobilienwert).toBe(kaufpreis);
    expect(jahre[0].objektwert).toBe(kaufpreis);
  });
});

describe("Vorlagen", () => {
  it("ein Bestandsobjekt und zwei Objekte in Planung, chronologisch besteuert", () => {
    const p = beispielPortfolio();
    expect(p.objekte.map((o) => [o.id, o.status])).toEqual([
      ["vorlage-bestand", "bestand"],
      ["vorlage-apartment", "plan"],
      ["vorlage-altbau", "plan"],
    ]);
    const r = rechnePortfolio(p);
    expect(r.objekte.map((o) => o.jahre.find((y) => y.jahr === 2028)!.steuerRang)).toEqual([1, 2, 3]);
    const j2028 = r.jahre.find((j) => j.jahr === 2028)!;
    expect(j2028.objekte).toBe(3);
  });
});
