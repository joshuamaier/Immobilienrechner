import { projiziereObjekt, ableitungenNeuBerechnen, type Anker, type ObjektProjektion, type VorsteuerJahr } from "./property";
import type { IstBuchung, IstKategorie, Objekt } from "./types";

export const IST_KATEGORIEN: Record<IstKategorie, { label: string; art: "einnahme" | "ausgabe" | "finanzierung" | "steuer" }> = {
  miete: { label: "Mieteinnahmen", art: "einnahme" },
  sonstigeEinnahmen: { label: "Sonstige Einnahmen", art: "einnahme" },
  hausgeld: { label: "Hausgeld (nicht umlagefähig)", art: "ausgabe" },
  ruecklage: { label: "Instandhaltungsrücklage", art: "ausgabe" },
  verwaltung: { label: "Mietverwaltung (SEV)", art: "ausgabe" },
  instandhaltung: { label: "Reparaturen / Instandhaltung", art: "ausgabe" },
  sonstigeKosten: { label: "Sonstige Kosten", art: "ausgabe" },
  zinsen: { label: "Zinsen", art: "finanzierung" },
  tilgung: { label: "Tilgung", art: "finanzierung" },
  sondertilgung: { label: "Sondertilgung", art: "finanzierung" },
  steuer: { label: "Steuererstattung (+) / Nachzahlung (−)", art: "steuer" },
};

export interface IstJahr {
  jahr: number;
  /** Monate mit Ist-Daten (12 bei einer Jahressumme) */
  abgedeckteMonate: number;
  summen: Partial<Record<IstKategorie, number>>;
}

/** Ist-Buchungen je Kalenderjahr zusammenfassen. */
export function istJahre(buchungen: IstBuchung[], kaufdatum: string): Map<number, IstJahr> {
  const [kaufJahr, kaufMonat] = kaufdatum.split("-").map(Number);
  const result = new Map<number, IstJahr>();
  const monate = new Map<number, Set<number>>();
  const jahressumme = new Set<number>();
  for (const b of buchungen) {
    const jahr = Number(b.datum.slice(0, 4));
    if (!jahr) continue;
    const j = result.get(jahr) ?? { jahr, abgedeckteMonate: 0, summen: {} };
    j.summen[b.kategorie] = (j.summen[b.kategorie] ?? 0) + (Number(b.betrag) || 0);
    result.set(jahr, j);
    if (b.datum.length <= 4) jahressumme.add(jahr);
    else {
      const set = monate.get(jahr) ?? new Set<number>();
      set.add(Number(b.datum.slice(5, 7)));
      monate.set(jahr, set);
    }
  }
  for (const j of result.values()) {
    const besessen = j.jahr === kaufJahr ? 12 - (kaufMonat || 1) + 1 : 12;
    j.abgedeckteMonate = jahressumme.has(j.jahr) ? besessen : Math.min(besessen, monate.get(j.jahr)?.size ?? 0);
  }
  return result;
}

/** Startwerte der Hochrechnung aus den jüngsten Stichtagen. */
export function ankerAusStichtagen(objekt: Objekt): Anker {
  const anker: Anker = {};
  const sorted = [...objekt.ist.stichtage].sort((a, b) => a.datum.localeCompare(b.datum));
  for (const s of sorted) {
    const monat = s.datum.slice(0, 7);
    if (s.restschuld != null) anker.restschuld = { monat, betrag: s.restschuld };
    if (s.marktwert != null) anker.marktwert = { jahr: Number(s.datum.slice(0, 4)), betrag: s.marktwert };
    if (s.miete != null) anker.miete = { monat, betrag: s.miete };
  }
  return anker;
}

export function letztesIstJahr(objekt: Objekt): number | null {
  const jahre = objekt.ist.buchungen.map((b) => Number(b.datum.slice(0, 4))).filter(Boolean);
  return jahre.length ? Math.max(...jahre) : null;
}

/** Ursprünglicher Plan: eingefrorener Stand beim Kauf (sonst aktuelle Eingaben). */
export function planProjektion(objekt: Objekt): ObjektProjektion {
  return projiziereObjekt(objekt.baseline ?? objekt.daten);
}

/**
 * Aktuelle Sicht eines Objekts: Jahre mit Ist-Daten aus der Erfassung
 * (fehlende Monate und Kategorien aus dem Modell), danach Hochrechnung mit den
 * aktuellen Eingaben ab dem tatsächlichen Stand (Restschuld, Marktwert, Miete).
 */
export function aktuelleProjektion(objekt: Objekt): ObjektProjektion {
  if (objekt.status !== "bestand") return projiziereObjekt(objekt.daten);
  const anker = ankerAusStichtagen(objekt);
  const ist = istJahre(objekt.ist.buchungen, objekt.daten.kaufdatum);
  const letztes = letztesIstJahr(objekt);
  const s = letztes !== null ? ist.get(letztes) : undefined;
  if (s && s.abgedeckteMonate > 0) {
    // Kostenniveau des letzten Ist-Jahres fortschreiben.
    const level = (k: IstKategorie) => (s.summen[k] !== undefined ? s.summen[k]! / s.abgedeckteMonate : undefined);
    anker.kosten = { jahr: s.jahr, hausgeld: level("hausgeld"), ruecklage: level("ruecklage"), verwaltung: level("verwaltung") };
  }
  const modell = projiziereObjekt(objekt.daten, { anker });
  if (objekt.ist.buchungen.length === 0) return modell;
  return { ...modell, jahre: modell.jahre.map((y) => mitIst(y, ist.get(y.jahr))) };
}

function mitIst(y: VorsteuerJahr, ist: IstJahr | undefined): VorsteuerJahr {
  if (!ist) return y;
  const s = ist.summen;
  const rest = y.monate > 0 ? Math.max(0, y.monate - ist.abgedeckteMonate) / y.monate : 0;
  const wert = (k: IstKategorie[], modell: number) =>
    k.some((kat) => s[kat] !== undefined) ? k.reduce((a, kat) => a + (s[kat] ?? 0), 0) + modell * rest : modell;

  const nettomiete = wert(["miete", "sonstigeEinnahmen"], y.nettomiete);
  const zinsen = wert(["zinsen"], y.zinsaufwand);
  const sonder = s.sondertilgung !== undefined ? s.sondertilgung : y.sondertilgungen;
  const tilgung = wert(["tilgung"], y.tilgungsleistung - y.sondertilgungen) + sonder;
  const naechstes: VorsteuerJahr = {
    ...y,
    bruttomiete: nettomiete,
    mietausfall: 0,
    nettomiete,
    verwaltungskosten: wert(["verwaltung"], y.verwaltungskosten),
    ruecklagen: wert(["ruecklage"], y.ruecklagen),
    hausgeldkosten: wert(["hausgeld"], y.hausgeldkosten),
    sonstigeAusgaben: (s.instandhaltung ?? 0) + (s.sonstigeKosten ?? 0) + y.sonstigeAusgaben * rest,
    zinsaufwand: zinsen,
    tilgungsleistung: tilgung,
    sondertilgungen: sonder,
    ist: {
      abgedeckteMonate: ist.abgedeckteMonate,
      kategorien: Object.keys(s),
      steuer: s.steuer !== undefined ? s.steuer : null,
    },
  };
  return ableitungenNeuBerechnen(naechstes);
}

export interface VergleichsZeile {
  key: string;
  label: string;
  plan: number;
  ist: number | null;
}

/**
 * Plan-Ist-Vergleich eines Jahres. Planwerte werden auf die Monate mit Ist-Daten
 * anteilig gekürzt, damit ein laufendes Jahr fair verglichen wird.
 */
export function vergleichJahr(
  plan: { y: VorsteuerJahr; steuerwirkung: number },
  ist: IstJahr,
): VergleichsZeile[] {
  const y = plan.y;
  const f = y.monate > 0 ? ist.abgedeckteMonate / y.monate : 0;
  const s = ist.summen;
  const sum = (k: IstKategorie[]) => (k.some((kat) => s[kat] !== undefined) ? k.reduce((a, kat) => a + (s[kat] ?? 0), 0) : null);
  return [
    { key: "miete", label: "Mieteinnahmen", plan: y.nettomiete * f, ist: sum(["miete", "sonstigeEinnahmen"]) },
    { key: "hausgeld", label: "Hausgeld (nicht umlagefähig)", plan: y.hausgeldkosten * f, ist: sum(["hausgeld"]) },
    { key: "ruecklage", label: "Instandhaltungsrücklage", plan: y.ruecklagen * f, ist: sum(["ruecklage"]) },
    { key: "verwaltung", label: "Mietverwaltung (SEV)", plan: y.verwaltungskosten * f, ist: sum(["verwaltung"]) },
    { key: "instandhaltung", label: "Reparaturen & sonstige Kosten", plan: y.sonstigeAusgaben * f, ist: sum(["instandhaltung", "sonstigeKosten"]) },
    { key: "zinsen", label: "Zinsen", plan: y.zinsaufwand * f, ist: sum(["zinsen"]) },
    { key: "tilgung", label: "Tilgung inkl. Sondertilgung", plan: y.tilgungsleistung * f, ist: sum(["tilgung", "sondertilgung"]) },
    { key: "steuer", label: "Steuerwirkung (Jahr)", plan: plan.steuerwirkung, ist: sum(["steuer"]) },
  ];
}
