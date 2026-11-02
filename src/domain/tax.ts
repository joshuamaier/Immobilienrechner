import type { Steuerprofil } from "./types";

// Einkommensteuer nach Grundtarif 2026 (§32a EStG) inkl. Solidaritätszuschlag
// (mit Freigrenze und Milderungszone) und optionaler Kirchensteuer.
// Für künftige Jahre wird der Tarif 2026 unverändert fortgeschrieben.

function einkommensteuer(zve: number, verheiratet: boolean): number {
  const x = verheiratet ? zve / 2 : zve;
  let steuer: number;
  if (x <= 12348) {
    steuer = 0;
  } else if (x <= 17799) {
    const y = (x - 12348) / 10000;
    steuer = (914.51 * y + 1400) * y;
  } else if (x <= 69878) {
    const z = (x - 17799) / 10000;
    steuer = (173.1 * z + 2397) * z + 1034.87;
  } else if (x <= 277825) {
    steuer = 0.42 * x - 11135.63;
  } else {
    steuer = 0.45 * x - 19470.38;
  }
  return verheiratet ? 2 * steuer : steuer;
}

function solidaritaetszuschlag(steuer: number, verheiratet: boolean): number {
  const freigrenze = verheiratet ? 40700 : 20350;
  if (steuer <= freigrenze) return 0;
  return Math.min(0.055 * steuer, 0.119 * (steuer - freigrenze));
}

/** Gesamte Steuerlast (ESt + Soli + KiSt) für ein zu versteuerndes Einkommen. */
export function steuerlast(zve: number, verheiratet = false, kirchensteuerProzent = 0): number {
  const steuer = einkommensteuer(Math.max(0, zve), verheiratet);
  return steuer + solidaritaetszuschlag(steuer, verheiratet) + (kirchensteuerProzent / 100) * steuer;
}

/** Grenzsteuersatz inkl. Soli/KiSt in % (numerisch über 100 €). */
export function grenzsteuersatz(zve: number, verheiratet = false, kirchensteuerProzent = 0): number {
  return (steuerlast(zve + 100, verheiratet, kirchensteuerProzent) - steuerlast(zve, verheiratet, kirchensteuerProzent));
}

function stufeFuer<T extends { abJahr: number }>(stufen: T[], jahr: number): T | undefined {
  const sorted = [...stufen].sort((a, b) => a.abJahr - b.abJahr);
  let found: T | undefined = sorted[0];
  for (const s of sorted) if (s.abJahr <= jahr) found = s;
  return found;
}

/** Zu versteuerndes Einkommen (ohne Immobilien) in einem Kalenderjahr. */
export function zveFuerJahr(profil: Steuerprofil, jahr: number): number {
  const stufe = stufeFuer(profil.einkommen, jahr);
  if (!stufe) return 0;
  const jahre = Math.max(0, jahr - stufe.abJahr);
  return stufe.zve * Math.pow(1 + (profil.einkommenSteigerung || 0) / 100, jahre);
}

export function verheiratetImJahr(profil: Steuerprofil, jahr: number): boolean {
  return stufeFuer(profil.verheiratet, jahr)?.wert ?? false;
}

export function kirchensteuerSatz(profil: Steuerprofil): number {
  return profil.kirchensteuer ? profil.kirchensteuerSatz : 0;
}
