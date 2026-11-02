/** Monat im Format "YYYY-MM". */
export type Monat = string;


export interface Darlehen {
  id: string;
  name: string;
  /** null = deckt den restlichen Finanzierungsbedarf (nur beim ersten Darlehen). */
  betrag: number | null;
  /** Sollzins in % p.a. */
  zins: number;
  /** Anfängliche Tilgung in % p.a. */
  tilgung: number;
  /** 0 = Zins gilt für die gesamte Laufzeit. */
  zinsbindungJahre: number;
  anschlusszins: number;
  /** Nach Ende der Zinsbindung: Rate beibehalten oder mit neuer Tilgung neu berechnen. */
  anschluss: "rate" | "tilgung";
  anschlusstilgung: number;
  /** Sondertilgung in € pro Jahr, jeweils im Dezember (ab dem zweiten Kalenderjahr). */
  sondertilgung: number;
}

export interface ObjektDaten {
  name: string;
  ort: string;
  /** Freitext, z. B. Quelle und getroffene Annahmen */
  notiz: string;
  bundesland: string;
  wohnflaeche: number;
  baujahr: number | null;
  /** Übergang von Nutzen und Lasten. */
  kaufdatum: Monat;
  kauf: {
    kaufpreis: number;
    /** Separat ausgewiesene Möbel/Einbauküche: 10 % AfA p.a., kein Immobilienwert */
    moebel: number;
    /** % der Gesamtinvestition */
    makler: number;
    /** % des Kaufpreises */
    notarGrundbuch: number;
    /** % der Darlehenssumme */
    grundschuld: number;
  };
  miete: {
    /** Kaltmiete pro Monat */
    kaltmiete: number;
    /** Mietausfall in % */
    leerstand: number;
    /** % p.a. */
    steigerung: number;
  };
  kosten: {
    /** Nicht umlagefähiges Hausgeld pro Monat */
    hausgeld: number;
    ruecklage: number;
    verwaltung: number;
    /** % p.a. */
    steigerung: number;
  };
  /** Wertentwicklung % p.a. */
  wertsteigerung: number;
  finanzierung: {
    eigenkapitalProzent: number;
    /** Einmalige Bereitstellungszinsen im Kaufjahr (sofort abziehbar) */
    bereitstellungszinsen: number;
    darlehen: Darlehen[];
  };
  afa: {
    art: "linear" | "degressiv";
    /** % p.a. (degressiv: % vom Restbuchwert) */
    satz: number;
    grundstueck: "prozent" | "betrag";
    grundstuecksanteil: number;
    grundstueckswert: number;
    /**
     * Erhöhte AfA für Baudenkmale (§7i EStG) oder Sanierungsgebiete (§7h EStG):
     * 8 Jahre je 9 %, danach 4 Jahre je 7 % auf den begünstigten Sanierungsanteil.
     */
    denkmal: {
      aktiv: boolean;
      art: "7i" | "7h";
      /** Begünstigter Sanierungsanteil am Kaufpreis in € (laut Kaufvertrag und Bescheinigung) */
      sanierungsanteil: number;
      /** Jahr der Fertigstellung der Baumaßnahmen; null = Kaufjahr */
      abJahr: number | null;
    };
  };
}

export type IstKategorie =
  | "miete"
  | "sonstigeEinnahmen"
  | "hausgeld"
  | "ruecklage"
  | "verwaltung"
  | "instandhaltung"
  | "sonstigeKosten"
  | "zinsen"
  | "tilgung"
  | "sondertilgung"
  | "steuer";

export interface IstBuchung {
  id: string;
  /** "YYYY-MM" für einen Monat oder "YYYY" für eine Jahressumme. */
  datum: string;
  kategorie: IstKategorie;
  /** Positiv in Richtung der Kategorie; Steuer: + Erstattung, − Nachzahlung. */
  betrag: number;
  notiz: string;
}

export interface Stichtag {
  id: string;
  /** "YYYY-MM-DD" */
  datum: string;
  restschuld: number | null;
  marktwert: number | null;
  /** Aktuelle Kaltmiete pro Monat */
  miete: number | null;
  notiz: string;
}

export interface Objekt {
  id: string;
  status: "plan" | "bestand";
  daten: ObjektDaten;
  /** Beim Kauf eingefrorener Planstand für den Plan-Ist-Vergleich. */
  baseline: ObjektDaten | null;
  ist: { buchungen: IstBuchung[]; stichtage: Stichtag[] };
}

export interface Steuerprofil {
  einkommen: { abJahr: number; zve: number }[];
  /** % p.a., ab der jeweiligen Stufe */
  einkommenSteigerung: number;
  verheiratet: { abJahr: number; wert: boolean }[];
  kirchensteuer: boolean;
  kirchensteuerSatz: number;
  lohnsteuerermaessigung: boolean;
}

export const SCHEMA = "immobilienrechner/1";

export interface Portfolio {
  schema: typeof SCHEMA;
  steuerprofil: Steuerprofil;
  objekte: Objekt[];
}
