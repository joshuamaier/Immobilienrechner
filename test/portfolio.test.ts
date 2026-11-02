import { describe, expect, it } from "vitest";
import { rechnePortfolio, rechneIsoliert } from "../src/domain/calc";
import { beispielPortfolio, neuesObjekt } from "../src/domain/presets";
import { steuerlast } from "../src/domain/tax";
import type { Portfolio } from "../src/domain/types";

function zweiObjekte(): Portfolio {
  const p = beispielPortfolio();
  return {
    ...p,
    steuerprofil: {
      ...p.steuerprofil,
      einkommen: [{ abJahr: 2020, zve: 90000 }],
      einkommenSteigerung: 0,
      verheiratet: [{ abJahr: 2020, wert: false }],
    },
    objekte: [p.objekte[2], p.objekte[1]], // Altbau (2027-10) vor Apartment (2027-04) in der Liste
  };
}

describe("Steuer im Portfolio", () => {
  it("verteilt chronologisch nach Kaufdatum", () => {
    const r = rechnePortfolio(zweiObjekte());
    expect(r.jeId.get("vorlage-apartment")!.jahre[0].steuerRang).toBe(1);
    expect(r.jeId.get("vorlage-altbau")!.jahre[0].steuerRang).toBe(2);
  });

  it("Summe der Ersparnisse entspricht der Gesamtwirkung", () => {
    const r = rechnePortfolio(zweiObjekte());
    for (const v of r.verteilung) {
      const summe = v.eintraege.reduce((s, e) => s + e.ersparnis, 0);
      const zveNachher = v.zveBasis + v.eintraege.reduce((s, e) => s + e.ergebnis, 0);
      expect(summe).toBeCloseTo(steuerlast(v.zveBasis) - steuerlast(zveNachher), 6);
    }
  });

  it("das spätere Objekt erhält weniger Ersparnis als allein gerechnet", () => {
    const p = zweiObjekte();
    const r = rechnePortfolio(p);
    const altbau = p.objekte[0];
    const allein = rechneIsoliert(p, altbau);
    const imPortfolio = r.jeId.get(altbau.id)!;
    const jahr = 2029;
    const a = allein.jahre.find((y) => y.jahr === jahr)!.steuerwirkung;
    const b = imPortfolio.jahre.find((y) => y.jahr === jahr)!.steuerwirkung;
    expect(b).toBeLessThan(a);
    // Das zuerst gekaufte Objekt ist vom zweiten unabhängig.
    const apartment = p.objekte[1];
    expect(r.jeId.get(apartment.id)!.jahre[2].steuerwirkung).toBeCloseTo(rechneIsoliert(p, apartment).jahre[2].steuerwirkung, 6);
  });

  it("nutzt den Einkommensverlauf", () => {
    const p = zweiObjekte();
    p.steuerprofil.einkommen = [
      { abJahr: 2020, zve: 90000 },
      { abJahr: 2030, zve: 30000 },
    ];
    const r = rechnePortfolio(p);
    const j2029 = r.jahre.find((j) => j.jahr === 2029)!;
    const j2030 = r.jahre.find((j) => j.jahr === 2030)!;
    expect(j2029.zveBasis).toBe(90000);
    expect(j2030.zveBasis).toBe(30000);
    expect(j2030.steuerwirkung).toBeLessThan(j2029.steuerwirkung);
  });

  it("rechnet leere Objekte ohne Fehler", () => {
    const p = beispielPortfolio();
    p.objekte = [neuesObjekt()];
    const r = rechnePortfolio(p);
    const y = r.objekte[0].jahre[0];
    expect(Number.isFinite(y.cashflowNachSteuern)).toBe(true);
    expect(y.cashflowNachSteuern).toBe(0);
  });

  it("Gesamtübersicht summiert alle Objekte", () => {
    const p = beispielPortfolio();
    const r = rechnePortfolio(p);
    const j = r.jahre.find((x) => x.jahr === 2030)!;
    const summe = r.objekte.reduce((s, o) => s + (o.jahre.find((y) => y.jahr === 2030)?.eigenkapital ?? 0), 0);
    expect(j.eigenkapital).toBeCloseTo(summe, 6);
    expect(j.objekte).toBe(3);
  });
});
