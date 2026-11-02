const euroFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euroCentFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Ganze Euro, ohne "-0 €". */
export const euro = (v: number) => euroFmt.format(Math.round(v) === 0 ? 0 : v);
export const euroCent = (v: number) => euroCentFmt.format(v);
export const num = (v: number, digits = 1) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
export const prozent = (v: number, digits = 1) => `${num(v, digits)} %`;
/** Negativer Betrag mit Minus, z. B. für Kosten. */
export const minus = (v: number) => (Math.round(v) === 0 ? euro(0) : `-${euro(Math.abs(v))}`);
export const plus = (v: number) => `${Math.round(v) >= 0 ? "+" : ""}${euro(v)}`;
export const tone = (v: number) => (Math.round(v) >= 0 ? "pos" : "neg");

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONATE_KURZ = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
export const monatsname = (m: number) => MONATE[m - 1] ?? "";
export { MONATE };

/** "2027-03" → "März 2027", "2024" → "2024" */
export function monatText(datum: string): string {
  if (datum.length <= 4) return datum;
  const [j, m] = datum.split("-").map(Number);
  return `${monatsname(m)} ${j}`;
}

export function datumText(datum: string): string {
  const [j, m, t] = datum.split("-");
  return t ? `${t}.${m}.${j}` : monatText(datum);
}

/** Werte für CSV mit Semikolon und deutschem Dezimalkomma. */
export function csv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2).replace(".", ",") : "";
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\n");
}

/**
 * Eingabe in deutscher oder englischer Schreibweise lesen:
 * "1.234,5", "250.000", "3,85", "3.85" und "250000" sind erlaubt.
 */
export function parseZahl(text: string): number | null {
  const t = text.trim().replace(/\s|€|%/g, "");
  if (t === "" || t === "-") return null;
  let normalized: string;
  if (t.includes(",")) normalized = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, "");
  else normalized = t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
