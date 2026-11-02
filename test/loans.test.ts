import { describe, expect, it } from "vitest";
import { tilgungsplan } from "../src/domain/loans";
import { neuesDarlehen } from "../src/domain/presets";

const darlehen = (teil: Parameters<typeof neuesDarlehen>[0], betrag: number) => ({ ...neuesDarlehen(teil), betragEffektiv: betrag });

describe("Tilgungsplan", () => {
  it("rechnet monatsgenau wie ein Bank-Tilgungsplan", () => {
    const [l] = tilgungsplan([darlehen({ zins: 4, tilgung: 2, zinsbindungJahre: 0 }, 200000)], "2026-12", 109);
    expect(l.monatsrate).toBe(1000);
    // Restschuld nach n Monaten: B·qⁿ − R·(qⁿ − 1)/(q − 1) mit q = 1 + Zins/12
    const q = 1 + 0.04 / 12;
    const n = 109;
    const erwartet = 200000 * q ** n - (1000 * (q ** n - 1)) / (q - 1);
    expect(l.jahre.get(2035)!.restschuld).toBeCloseTo(erwartet, 4);
  });

  it("wechselt nach der Zinsbindung auf den Anschlusszins", () => {
    const [l] = tilgungsplan(
      [darlehen({ zins: 2, tilgung: 2, zinsbindungJahre: 10, anschlusszins: 5, anschluss: "tilgung", anschlusstilgung: 2 }, 100000)],
      "2026-01",
      12 * 15,
    );
    expect(l.endeZinsbindung).toBe("2036-01");
    const rest = l.restschuldEndeZinsbindung!;
    expect(l.anschlussrate).toBeCloseTo((rest * 7) / 1200, 6);
    expect(l.jahre.get(2035)!.zinssatz).toBe(2);
    expect(l.jahre.get(2036)!.zinssatz).toBe(5);
    // Erster Monat nach der Bindung: Zinsen zum Anschlusszins
    expect(l.jahre.get(2036)!.zinsen).toBeGreaterThan(l.jahre.get(2035)!.zinsen * 2);
  });

  it("behält bei 'Rate bleibt' die Rate und meldet eine zu niedrige Rate", () => {
    const [l] = tilgungsplan(
      [darlehen({ zins: 1, tilgung: 1, zinsbindungJahre: 5, anschlusszins: 6, anschluss: "rate" }, 100000)],
      "2026-01",
      12 * 8,
    );
    expect(l.anschlussrate).toBeCloseTo(l.monatsrate, 6);
    expect(l.rateZuNiedrig).toBe(true);
    expect(l.jahre.get(2032)!.tilgung).toBe(0);
  });

  it("berücksichtigt Sondertilgungen und volle Tilgung", () => {
    const [l] = tilgungsplan([darlehen({ zins: 3, tilgung: 10, zinsbindungJahre: 0, sondertilgung: 5000 }, 50000)], "2026-01", 12 * 10);
    expect(l.jahre.get(2026)!.sondertilgung).toBe(5000);
    expect(l.schuldenfreiJahr).not.toBeNull();
    expect(l.jahre.get(2035)!.restschuld).toBe(0);
  });

  it("setzt die Restschuld auf einen Stichtagswert", () => {
    const darlehensplaene = tilgungsplan(
      [darlehen({ zins: 3, tilgung: 2, zinsbindungJahre: 0 }, 60000), darlehen({ zins: 4, tilgung: 2, zinsbindungJahre: 0 }, 40000)],
      "2026-01",
      36,
      { monat: "2026-12", betrag: 90000 },
    );
    const summe = darlehensplaene.reduce((s, l) => s + l.jahre.get(2026)!.restschuld, 0);
    expect(summe).toBeCloseTo(90000, 6);
  });
});
