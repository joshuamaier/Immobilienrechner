import { leereObjektDaten, leeresSteuerprofil, neuesDarlehen, uid } from "./presets";
import { SCHEMA, type Darlehen, type IstBuchung, type IstKategorie, type Objekt, type ObjektDaten, type Portfolio, type Stichtag, type Steuerprofil } from "./types";
import { IST_KATEGORIEN } from "./tracking";

export interface ImportErgebnis {
  steuerprofil: Steuerprofil | null;
  objekte: Objekt[];
  warnungen: string[];
}

export class ImportFehler extends Error {}

export function exportiere(p: Portfolio, objektIds?: string[], mitSteuerprofil = true): string {
  const objekte = objektIds ? p.objekte.filter((o) => objektIds.includes(o.id)) : p.objekte;
  const data: Record<string, unknown> = {
    schema: SCHEMA,
    exportiertAm: new Date().toISOString(),
    ...(mitSteuerprofil ? { steuerprofil: p.steuerprofil } : {}),
    objekte,
  };
  return JSON.stringify(data, null, 2);
}

export function dateiname(anzahl: number): string {
  const d = new Date().toISOString().slice(0, 10);
  return anzahl === 1 ? `immobilie-${d}.json` : `immobilien-portfolio-${d}.json`;
}

type Roh = Record<string, unknown>;
const isObj = (v: unknown): v is Roh => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return v === null || v === undefined || v === "" || !Number.isFinite(n) ? fallback : n;
};
const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

/** Zahlen und Pflichtfelder auffüllen, damit auch ältere oder unvollständige Dateien rechnen. */
function normalisiereDaten(raw: unknown): ObjektDaten {
  const t = leereObjektDaten();
  if (!isObj(raw)) return t;
  const kauf = isObj(raw.kauf) ? raw.kauf : {};
  const miete = isObj(raw.miete) ? raw.miete : {};
  const kosten = isObj(raw.kosten) ? raw.kosten : {};
  const fin = isObj(raw.finanzierung) ? raw.finanzierung : {};
  const afa = isObj(raw.afa) ? raw.afa : {};
  const darlehen = Array.isArray(fin.darlehen) ? fin.darlehen.filter(isObj).map(normalisiereDarlehen) : t.finanzierung.darlehen;
  const kaufdatum = str(raw.kaufdatum, t.kaufdatum);
  return {
    name: str(raw.name, t.name),
    ort: str(raw.ort, ""),
    notiz: str(raw.notiz, ""),
    bundesland: str(raw.bundesland, t.bundesland),
    wohnflaeche: num(raw.wohnflaeche, 0),
    baujahr: raw.baujahr == null || raw.baujahr === "" ? null : num(raw.baujahr, 0),
    kaufdatum: /^\d{4}-\d{2}$/.test(kaufdatum) ? kaufdatum : t.kaufdatum,
    kauf: {
      kaufpreis: num(kauf.kaufpreis, 0),
      moebel: num(kauf.moebel, 0),
      makler: num(kauf.makler, t.kauf.makler),
      notarGrundbuch: num(kauf.notarGrundbuch, t.kauf.notarGrundbuch),
      grundschuld: num(kauf.grundschuld, t.kauf.grundschuld),
    },
    miete: {
      kaltmiete: num(miete.kaltmiete, 0),
      leerstand: num(miete.leerstand, t.miete.leerstand),
      steigerung: num(miete.steigerung, t.miete.steigerung),
    },
    kosten: {
      hausgeld: num(kosten.hausgeld, 0),
      ruecklage: num(kosten.ruecklage, 0),
      verwaltung: num(kosten.verwaltung, 0),
      steigerung: num(kosten.steigerung, t.kosten.steigerung),
    },
    wertsteigerung: num(raw.wertsteigerung, t.wertsteigerung),
    finanzierung: {
      eigenkapitalProzent: num(fin.eigenkapitalProzent, t.finanzierung.eigenkapitalProzent),
      bereitstellungszinsen: num(fin.bereitstellungszinsen, 0),
      darlehen,
    },
    afa: {
      art: afa.art === "degressiv" ? "degressiv" : "linear",
      satz: num(afa.satz, t.afa.satz),
      grundstueck: afa.grundstueck === "betrag" ? "betrag" : "prozent",
      grundstuecksanteil: num(afa.grundstuecksanteil, t.afa.grundstuecksanteil),
      grundstueckswert: num(afa.grundstueckswert, 0),
      denkmal: normalisiereDenkmal(afa.denkmal),
    },
  };
}

function normalisiereDenkmal(raw: unknown): ObjektDaten["afa"]["denkmal"] {
  const d = isObj(raw) ? raw : {};
  return {
    aktiv: bool(d.aktiv, false),
    art: d.art === "7h" ? "7h" : "7i",
    sanierungsanteil: num(d.sanierungsanteil, 0),
    abJahr: d.abJahr == null || d.abJahr === "" ? null : Math.round(num(d.abJahr, 0)) || null,
  };
}

function normalisiereDarlehen(raw: Roh, index: number): Darlehen {
  const t = neuesDarlehen();
  return {
    id: str(raw.id, uid()),
    name: str(raw.name, index === 0 ? t.name : `Darlehen ${index + 1}`),
    betrag: raw.betrag == null || raw.betrag === "" ? (index === 0 ? null : 0) : num(raw.betrag, 0),
    zins: num(raw.zins, t.zins),
    tilgung: num(raw.tilgung, t.tilgung),
    zinsbindungJahre: num(raw.zinsbindungJahre, t.zinsbindungJahre),
    anschlusszins: num(raw.anschlusszins, t.anschlusszins),
    anschluss: raw.anschluss === "rate" ? "rate" : "tilgung",
    anschlusstilgung: num(raw.anschlusstilgung, t.anschlusstilgung),
    sondertilgung: num(raw.sondertilgung, 0),
  };
}

function normalisiereObjekt(raw: unknown, warnungen: string[], i: number): Objekt | null {
  if (!isObj(raw)) {
    warnungen.push(`Eintrag ${i + 1} ist kein Objekt und wurde übersprungen.`);
    return null;
  }
  const ist = isObj(raw.ist) ? raw.ist : {};
  const buchungen: IstBuchung[] = (Array.isArray(ist.buchungen) ? ist.buchungen : [])
    .filter(isObj)
    .filter((b) => typeof b.kategorie === "string" && b.kategorie in IST_KATEGORIEN && /^\d{4}(-\d{2})?$/.test(str(b.datum, "")))
    .map((b) => ({
      id: str(b.id, uid()),
      datum: str(b.datum, ""),
      kategorie: b.kategorie as IstKategorie,
      betrag: num(b.betrag, 0),
      notiz: str(b.notiz, ""),
    }));
  const stichtage: Stichtag[] = (Array.isArray(ist.stichtage) ? ist.stichtage : [])
    .filter(isObj)
    .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(str(s.datum, "")))
    .map((s) => ({
      id: str(s.id, uid()),
      datum: str(s.datum, ""),
      restschuld: s.restschuld == null || s.restschuld === "" ? null : num(s.restschuld, 0),
      marktwert: s.marktwert == null || s.marktwert === "" ? null : num(s.marktwert, 0),
      miete: s.miete == null || s.miete === "" ? null : num(s.miete, 0),
      notiz: str(s.notiz, ""),
    }));
  return {
    id: str(raw.id, uid()),
    status: raw.status === "bestand" ? "bestand" : "plan",
    daten: normalisiereDaten(raw.daten),
    baseline: raw.baseline ? normalisiereDaten(raw.baseline) : null,
    ist: { buchungen, stichtage },
  };
}

function normalisiereSteuerprofil(raw: unknown): Steuerprofil {
  const t = leeresSteuerprofil();
  if (!isObj(raw)) return t;
  const einkommen = (Array.isArray(raw.einkommen) ? raw.einkommen : [])
    .filter(isObj)
    .map((e) => ({ abJahr: num(e.abJahr, t.einkommen[0].abJahr), zve: num(e.zve, 0) }));
  const verheiratet = (Array.isArray(raw.verheiratet) ? raw.verheiratet : [])
    .filter(isObj)
    .map((e) => ({ abJahr: num(e.abJahr, t.verheiratet[0].abJahr), wert: bool(e.wert, false) }));
  return {
    einkommen: einkommen.length ? einkommen : t.einkommen,
    einkommenSteigerung: num(raw.einkommenSteigerung, 0),
    verheiratet: verheiratet.length ? verheiratet : t.verheiratet,
    kirchensteuer: bool(raw.kirchensteuer, false),
    kirchensteuerSatz: num(raw.kirchensteuerSatz, 9),
    lohnsteuerermaessigung: bool(raw.lohnsteuerermaessigung, true),
  };
}

/** JSON-Text einer Export-Datei prüfen und in Objekte umwandeln. */
export function importiere(text: string): ImportErgebnis {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportFehler("Die Datei ist kein gültiges JSON. Bitte eine Datei wählen, die mit „Exportieren“ erstellt wurde.");
  }
  if (!isObj(data)) throw new ImportFehler("Die Datei enthält keine Immobiliendaten.");
  const warnungen: string[] = [];
  if (data.schema !== SCHEMA) {
    if (typeof data.schema === "string" && data.schema.startsWith("immobilienrechner/")) {
      warnungen.push(`Datei stammt aus Version „${data.schema}“ und wurde angepasst.`);
    } else if (!Array.isArray(data.objekte)) {
      throw new ImportFehler("Die Datei stammt nicht aus dem Immobilienrechner (Feld „objekte“ fehlt).");
    }
  }
  const objekte = (Array.isArray(data.objekte) ? data.objekte : [])
    .map((o, i) => normalisiereObjekt(o, warnungen, i))
    .filter((o): o is Objekt => o !== null);
  const steuerprofil = data.steuerprofil ? normalisiereSteuerprofil(data.steuerprofil) : null;
  if (!objekte.length && !steuerprofil) throw new ImportFehler("Die Datei enthält weder Objekte noch ein Steuerprofil.");
  return { steuerprofil, objekte, warnungen };
}

/** Gespeicherten Stand aus dem Browser laden (oder null). */
export function ladePortfolio(text: string | null): Portfolio | null {
  if (!text) return null;
  try {
    const r = importiere(text);
    return { schema: SCHEMA, steuerprofil: r.steuerprofil ?? leeresSteuerprofil(), objekte: r.objekte };
  } catch {
    return null;
  }
}
