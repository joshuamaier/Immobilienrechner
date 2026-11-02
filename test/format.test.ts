import { describe, expect, it } from "vitest";
import { parseZahl } from "../src/ui/format";

describe("Zahleneingabe", () => {
  it.each([
    ["250.000", 250000],
    ["1.234.567", 1234567],
    ["1.234,5", 1234.5],
    ["3,85", 3.85],
    ["3.85", 3.85],
    ["250000", 250000],
    ["-480", -480],
    ["12 000 €", 12000],
    ["4,5 %", 4.5],
  ])("%s → %d", (text, wert) => expect(parseZahl(text)).toBe(wert));

  it("leere oder ungültige Eingaben", () => {
    expect(parseZahl("")).toBeNull();
    expect(parseZahl("-")).toBeNull();
    expect(parseZahl("abc")).toBeNull();
  });
});
