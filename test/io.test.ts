import { describe, expect, it } from "vitest";
import { exportiere, importiere, ImportFehler } from "../src/domain/io";
import { beispielPortfolio } from "../src/domain/presets";
import { rechnePortfolio } from "../src/domain/calc";
import { SCHEMA } from "../src/domain/types";

describe("Export und Import", () => {
  it("überträgt ein Portfolio ohne Verlust", () => {
    const p = beispielPortfolio();
    const r = importiere(exportiere(p));
    expect(r.objekte).toEqual(p.objekte);
    expect(r.steuerprofil).toEqual(p.steuerprofil);
    expect(r.warnungen).toEqual([]);
    const vorher = rechnePortfolio(p).jahre;
    const nachher = rechnePortfolio({ schema: SCHEMA, steuerprofil: r.steuerprofil!, objekte: r.objekte }).jahre;
    expect(nachher).toEqual(vorher);
  });

  it("exportiert ausgewählte Objekte ohne Steuerprofil", () => {
    const p = beispielPortfolio();
    const r = importiere(exportiere(p, [p.objekte[1].id], false));
    expect(r.objekte.map((o) => o.id)).toEqual([p.objekte[1].id]);
    expect(r.steuerprofil).toBeNull();
  });

  it("ergänzt fehlende Felder und verwirft ungültige Buchungen", () => {
    const r = importiere(
      JSON.stringify({
        schema: SCHEMA,
        objekte: [
          {
            daten: { name: "Alt", kauf: { kaufpreis: "150000" } },
            ist: { buchungen: [{ datum: "2024", kategorie: "miete", betrag: 6000 }, { datum: "x", kategorie: "miete", betrag: 1 }] },
          },
        ],
      }),
    );
    const o = r.objekte[0];
    expect(o.daten.kauf.kaufpreis).toBe(150000);
    expect(o.daten.finanzierung.darlehen).toHaveLength(1);
    expect(o.ist.buchungen).toHaveLength(1);
  });

  it("meldet fremde Dateien verständlich", () => {
    expect(() => importiere("kein json")).toThrow(ImportFehler);
    expect(() => importiere(JSON.stringify({ foo: 1 }))).toThrow(/nicht aus dem Immobilienrechner/);
  });
});
