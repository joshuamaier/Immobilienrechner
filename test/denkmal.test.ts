import { describe, expect, it } from "vitest";
import { projiziereObjekt } from "../src/domain/property";
import { beispielPortfolio } from "../src/domain/presets";
import { rechneIsoliert } from "../src/domain/calc";
import { importiere } from "../src/domain/io";
import type { ObjektDaten } from "../src/domain/types";

/** Altbau-Vorlage mit gewählter Denkmal-AfA; ohne Angabe ist sie ausgeschaltet. */
function altbau(denkmal: Partial<ObjektDaten["afa"]["denkmal"]> | null): ObjektDaten {
  const d = structuredClone(beispielPortfolio().objekte[2].daten);
  d.afa.denkmal = denkmal ? { ...d.afa.denkmal, aktiv: true, abJahr: null, ...denkmal } : { ...d.afa.denkmal, aktiv: false };
  return d;
}

describe("Denkmal-AfA §7i/§7h", () => {
  it("teilt die AfA-Basis in Altbausubstanz und Sanierungsanteil", () => {
    const ohne = projiziereObjekt(altbau(null)).kennzahlen.steuerbasis;
    const mit = projiziereObjekt(altbau({ sanierungsanteil: 200000 })).kennzahlen.steuerbasis;
    // Summe der Bemessungsgrundlagen bleibt gleich
    expect(mit.afaBasis + mit.denkmalBasis).toBeCloseTo(ohne.afaBasis, 6);
    // Nebenkosten anteilig: 5 % GrESt + 3,57 % Provision + 1,5 % Notar
    expect(mit.denkmalBasis).toBeCloseTo(200000 * (1 + 0.05 + 0.0357 + 0.015), 6);
  });

  it("schreibt 8 Jahre je 9 % und 4 Jahre je 7 % ab, ab dem Kaufjahr", () => {
    const { kennzahlen, jahre } = projiziereObjekt(altbau({ sanierungsanteil: 200000 }));
    const basis = kennzahlen.steuerbasis.denkmalBasis;
    const werte = jahre.slice(0, 14).map((y) => y.afaDenkmal / basis);
    expect(werte.slice(0, 8).every((w) => Math.abs(w - 0.09) < 1e-12)).toBe(true);
    expect(werte.slice(8, 12).every((w) => Math.abs(w - 0.07) < 1e-12)).toBe(true);
    expect(werte.slice(12)).toEqual([0, 0]);
    const summe = jahre.reduce((s, y) => s + y.afaDenkmal, 0);
    expect(summe).toBeCloseTo(basis, 6);
  });

  it("beginnt im Jahr der Fertigstellung", () => {
    const { jahre } = projiziereObjekt(altbau({ sanierungsanteil: 100000, abJahr: 2028 }));
    expect(jahre.find((y) => y.jahr === 2027)!.afaDenkmal).toBe(0);
    expect(jahre.find((y) => y.jahr === 2028)!.afaDenkmal).toBeGreaterThan(0);
    expect(jahre.find((y) => y.jahr === 2040)!.afaDenkmal).toBe(0);
  });

  it("begrenzt den Sanierungsanteil auf den Gebäudeanteil", () => {
    const steuerbasis = projiziereObjekt(altbau({ sanierungsanteil: 10_000_000 })).kennzahlen.steuerbasis;
    expect(steuerbasis.afaBasis).toBeCloseTo(0, 6);
  });

  it("erhöht die Steuerersparnis in den ersten Jahren", () => {
    const p = beispielPortfolio();
    const ohne = rechneIsoliert(p, { ...p.objekte[2], daten: altbau(null) }).jahre[2].steuerwirkung;
    const objekt = { ...p.objekte[2], daten: altbau({ sanierungsanteil: 200000 }) };
    const mit = rechneIsoliert(p, objekt).jahre[2].steuerwirkung;
    expect(mit).toBeGreaterThan(ohne + 3000);
  });

  it("ergänzt die Angabe beim Import älterer Dateien", () => {
    const r = importiere(JSON.stringify({ schema: "immobilienrechner/1", objekte: [{ daten: { afa: { satz: 2 } } }] }));
    expect(r.objekte[0].daten.afa.denkmal).toEqual({ aktiv: false, art: "7i", sanierungsanteil: 0, abJahr: null });
  });
});
