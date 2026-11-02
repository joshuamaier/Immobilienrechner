import { describe, expect, it } from "vitest";
import { grenzsteuersatz, steuerlast, verheiratetImJahr, zveFuerJahr } from "../src/domain/tax";
import { leeresSteuerprofil } from "../src/domain/presets";

describe("Einkommensteuer 2026", () => {
  it("bleibt bis zum Grundfreibetrag steuerfrei", () => {
    expect(steuerlast(0)).toBe(0);
    expect(steuerlast(12348)).toBe(0);
    expect(steuerlast(12500)).toBeGreaterThan(0);
    expect(steuerlast(-5000)).toBe(0);
  });

  it("rechnet die Progressionszone nach §32a", () => {
    // 50.000 €: z = (50.000 − 17.799) / 10.000 = 3,2201 → (173,10·z + 2.397)·z + 1.034,87 ≈ 10.548,34 €
    expect(steuerlast(50000)).toBeCloseTo(10548.34, 1);
  });

  it("hat keine Sprünge an den Zonengrenzen", () => {
    for (const grenze of [12348, 17799, 69878, 277825]) {
      const sprung = steuerlast(grenze + 1) - steuerlast(grenze);
      expect(sprung, `Grenze ${grenze}`).toBeGreaterThanOrEqual(0);
      expect(sprung, `Grenze ${grenze}`).toBeLessThan(0.5);
    }
  });

  it("Splitting: Ehepaar zahlt das Doppelte auf das halbe Einkommen", () => {
    // Bei 40.000 € liegt die Steuer unter der Soli-Freigrenze, es zählt nur die Einkommensteuer.
    expect(steuerlast(80000, true)).toBeCloseTo(2 * steuerlast(40000), 6);
    expect(steuerlast(80000, true)).toBeLessThan(steuerlast(80000));
  });

  it("Soli: Freigrenze ohne Sprung, darüber 5,5 %", () => {
    // Einkommensteuer erreicht die Freigrenze von 20.350 € bei (20.350 + 11.135,63) / 0,42 ≈ 74.965,8 €.
    const schwelle = (20350 + 11135.63) / 0.42;
    expect(steuerlast(schwelle + 1) - steuerlast(schwelle - 1)).toBeLessThan(1.5);
    // Weit über der Milderungszone: 42 % · 1,055 bzw. 45 % · 1,055
    expect(grenzsteuersatz(150000)).toBeCloseTo(42 * 1.055, 2);
    expect(grenzsteuersatz(400000)).toBeCloseTo(45 * 1.055, 2);
  });

  it("Kirchensteuer als Prozentsatz der Einkommensteuer", () => {
    const est = steuerlast(40000); // ohne Soli
    expect(steuerlast(40000, false, 9) - est).toBeCloseTo(0.09 * est, 6);
  });
});

describe("Steuerprofil im Zeitverlauf", () => {
  const profil = {
    ...leeresSteuerprofil(),
    einkommen: [
      { abJahr: 2030, zve: 60000 },
      { abJahr: 2026, zve: 50000 },
    ],
    einkommenSteigerung: 2,
    verheiratet: [
      { abJahr: 2026, wert: false },
      { abJahr: 2028, wert: true },
    ],
  };

  it("nimmt die passende Einkommensstufe und schreibt sie mit der Steigerung fort", () => {
    expect(zveFuerJahr(profil, 2026)).toBe(50000);
    expect(zveFuerJahr(profil, 2028)).toBeCloseTo(50000 * 1.02 ** 2, 6);
    expect(zveFuerJahr(profil, 2030)).toBe(60000);
    // Vor der ersten Stufe gilt deren Betrag.
    expect(zveFuerJahr(profil, 2024)).toBe(50000);
  });

  it("wechselt den Familienstand ab dem angegebenen Jahr", () => {
    expect(verheiratetImJahr(profil, 2027)).toBe(false);
    expect(verheiratetImJahr(profil, 2028)).toBe(true);
  });
});
