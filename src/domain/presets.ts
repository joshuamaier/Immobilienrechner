import { SCHEMA, type Darlehen, type IstBuchung, type Objekt, type ObjektDaten, type Portfolio, type Steuerprofil } from "./types";

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function neuesDarlehen(teil: Partial<Darlehen> = {}): Darlehen {
  return {
    id: uid(),
    name: "Bankdarlehen",
    betrag: null,
    zins: 3.8,
    tilgung: 2,
    zinsbindungJahre: 10,
    anschlusszins: 4.5,
    anschluss: "tilgung",
    anschlusstilgung: 2,
    sondertilgung: 0,
    ...teil,
  };
}

function naechsterMonat(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Leere Objektdaten mit üblichen Annahmen, aber ohne Beträge. */
export function leereObjektDaten(): ObjektDaten {
  return {
    name: "Neues Objekt",
    ort: "",
    notiz: "",
    bundesland: "Bayern",
    wohnflaeche: 0,
    baujahr: null,
    kaufdatum: naechsterMonat(),
    kauf: { kaufpreis: 0, moebel: 0, makler: 0, notarGrundbuch: 1.5, grundschuld: 0.5 },
    miete: { kaltmiete: 0, leerstand: 2, steigerung: 2 },
    kosten: { hausgeld: 0, ruecklage: 0, verwaltung: 0, steigerung: 2 },
    wertsteigerung: 2,
    finanzierung: { eigenkapitalProzent: 10, bereitstellungszinsen: 0, darlehen: [neuesDarlehen()] },
    afa: { art: "linear", satz: 2, grundstueck: "prozent", grundstuecksanteil: 20, grundstueckswert: 0, denkmal: { aktiv: false, art: "7i", sanierungsanteil: 0, abJahr: null } },
  };
}

export function neuesObjekt(daten: Partial<ObjektDaten> = {}): Objekt {
  return {
    id: uid(),
    status: "plan",
    daten: { ...leereObjektDaten(), ...daten },
    baseline: null,
    ist: { buchungen: [], stichtage: [] },
  };
}

export function leeresSteuerprofil(): Steuerprofil {
  const jahr = new Date().getFullYear();
  return {
    einkommen: [{ abJahr: jahr, zve: 0 }],
    einkommenSteigerung: 0,
    verheiratet: [{ abJahr: jahr, wert: false }],
    kirchensteuer: false,
    kirchensteuerSatz: 9,
    lohnsteuerermaessigung: true,
  };
}

export function leeresPortfolio(): Portfolio {
  return { schema: SCHEMA, steuerprofil: leeresSteuerprofil(), objekte: [] };
}

// ---------------------------------------------------------------------------
// Vorlagen beim ersten Öffnen. Alle Objekte und Zahlen sind erfunden: ein
// Bestandsobjekt mit Ist-Daten seit 2022, dessen Entwicklung vom Kaufplan
// abweicht, und zwei Objekte in Planung.

/** Restschuld laut Jahreskontoauszug 31.12.2025 (entspricht dem Tilgungsplan). */
const RESTSCHULD_2025 = 202957;

const OHNE_DENKMAL = { aktiv: false, art: "7i" as const, sanierungsanteil: 0, abJahr: null };

/** Planstand beim Kauf im Mai 2022 (niedrige Zinsen, moderate Kosten). */
const BESTAND_KAUF: ObjektDaten = {
  name: "2-Zimmer-Wohnung Nordviertel",
  ort: "Musterstadt",
  notiz:
    "Erfundenes Beispiel. Gekauft im Mai 2022. Seitdem: Hausgeld nach Energiepreisen und neuer Gebäudeversicherung " +
    "deutlich gestiegen, Rücklage per Beschluss erhöht, Mieterwechsel 2024 mit Renovierung und drei Monaten Leerstand, " +
    "Sonderumlage Fassade 2025, Marktwert unter Plan. Die aktuellen Eingaben enthalten das neue Kostenniveau und einen " +
    "realistischeren Anschlusszins ab 2032 – der eingefrorene Kaufplan ist überholt und sollte neu festgelegt werden.",
  bundesland: "Bayern",
  wohnflaeche: 58,
  baujahr: 1974,
  kaufdatum: "2022-05",
  kauf: { kaufpreis: 249000, moebel: 0, makler: 3.57, notarGrundbuch: 1.5, grundschuld: 0.5 },
  miete: { kaltmiete: 790, leerstand: 2, steigerung: 1.5 },
  kosten: { hausgeld: 50, ruecklage: 45, verwaltung: 25, steigerung: 2 },
  wertsteigerung: 1.5,
  finanzierung: {
    eigenkapitalProzent: 10,
    bereitstellungszinsen: 0,
    darlehen: [
      {
        id: "vorlage-bestand-bank",
        name: "Annuitätendarlehen",
        betrag: null,
        zins: 1.6,
        tilgung: 2.5,
        zinsbindungJahre: 10,
        anschlusszins: 3,
        anschluss: "tilgung",
        anschlusstilgung: 2.5,
        sondertilgung: 0,
      },
    ],
  },
  afa: { art: "linear", satz: 2, grundstueck: "prozent", grundstuecksanteil: 25, grundstueckswert: 0, denkmal: OHNE_DENKMAL },
};

function bestandIst(): IstBuchung[] {
  const b: IstBuchung[] = [];
  const add = (datum: string, kategorie: IstBuchung["kategorie"], betrag: number, notiz = "") =>
    b.push({ id: `vorlage-bestand-${b.length + 1}`, datum, kategorie, betrag, notiz });

  add("2022", "miete", 6320, "Mai–Dez");
  add("2022", "hausgeld", 400);
  add("2022", "ruecklage", 360);
  add("2022", "verwaltung", 200);

  add("2023", "miete", 9480);
  add("2023", "hausgeld", 1020, "Abschlag ab Jan 85 € (Energie, Versicherung)");
  add("2023", "ruecklage", 540);
  add("2023", "verwaltung", 300);
  add("2023", "instandhaltung", 1850, "Durchlauferhitzer und Badarmatur");
  add("2023", "steuer", 620, "Erstattung für 2022");

  add("2024", "miete", 7230, "Auszug Ende Jul, Aug–Okt leer, ab Nov 850 €");
  add("2024", "hausgeld", 1080);
  add("2024", "ruecklage", 720, "Rücklage per Beschluss auf 60 € erhöht");
  add("2024", "verwaltung", 300);
  add("2024", "instandhaltung", 6400, "Boden, Maler und Elektrik vor Neuvermietung");
  add("2024", "sonstigeKosten", 950, "Inserate und Vermietungsprovision");
  add("2024", "steuer", 540, "Erstattung für 2023");

  add("2025", "miete", 10200);
  add("2025", "hausgeld", 1080);
  add("2025", "ruecklage", 720);
  add("2025", "verwaltung", 312);
  add("2025", "sonstigeKosten", 3200, "Sonderumlage Fassadensanierung");
  add("2025", "steuer", 2850, "Erstattung für 2024 (Renovierung, Leerstand)");

  for (let m = 1; m <= 10; m++) {
    const monat = `2026-${String(m).padStart(2, "0")}`;
    add(monat, "miete", 850);
    add(monat, "hausgeld", 92);
    add(monat, "ruecklage", 60);
    add(monat, "verwaltung", 26);
  }
  add("2026-07", "steuer", 1180, "Erstattung für 2025 (Sonderumlage)");
  return b;
}

const APARTMENT: ObjektDaten = {
  name: "1-Zimmer-Apartment, möbliert",
  ort: "Musterstadt",
  notiz:
    "Erfundenes Beispiel. Kleines Apartment in Bahnhofsnähe, möbliert vermietet. Kaufpreis fällig nach Abschluss der " +
    "WEG-Sanierung, daher Bereitstellungszinsen. Möbel separat mit 10 % AfA.",
  bundesland: "Baden-Württemberg",
  wohnflaeche: 24,
  baujahr: 1983,
  kaufdatum: "2027-04",
  kauf: { kaufpreis: 152000, moebel: 11000, makler: 0, notarGrundbuch: 1.5, grundschuld: 0.6 },
  miete: { kaltmiete: 610, leerstand: 1, steigerung: 2 },
  kosten: { hausgeld: 28, ruecklage: 22, verwaltung: 30, steigerung: 1.5 },
  wertsteigerung: 1.8,
  finanzierung: {
    eigenkapitalProzent: 5,
    bereitstellungszinsen: 380,
    darlehen: [
      {
        id: "vorlage-apartment-bank",
        name: "Bankdarlehen",
        betrag: null,
        zins: 3.9,
        tilgung: 1.5,
        zinsbindungJahre: 10,
        anschlusszins: 4.5,
        anschluss: "rate",
        anschlusstilgung: 1.5,
        sondertilgung: 0,
      },
    ],
  },
  afa: { art: "linear", satz: 2, grundstueck: "prozent", grundstuecksanteil: 25, grundstueckswert: 0, denkmal: OHNE_DENKMAL },
};

const ALTBAU: ObjektDaten = {
  name: "3-Zimmer-Altbau, Denkmal",
  ort: "Musterstadt",
  notiz:
    "Erfundenes Beispiel. Denkmalgeschützter Altbau, Sanierung nach Kaufvertrag mit Bescheinigung der Denkmalbehörde: " +
    "Für den Sanierungsanteil gilt die erhöhte AfA nach §7i ab Fertigstellung 2028. Finanzierung mit zwei Darlehen.",
  bundesland: "Baden-Württemberg",
  wohnflaeche: 72,
  baujahr: 1905,
  kaufdatum: "2027-10",
  kauf: { kaufpreis: 342000, moebel: 0, makler: 3.57, notarGrundbuch: 1.5, grundschuld: 0.5 },
  miete: { kaltmiete: 1180, leerstand: 2, steigerung: 2 },
  kosten: { hausgeld: 72, ruecklage: 58, verwaltung: 30, steigerung: 2 },
  wertsteigerung: 2,
  finanzierung: {
    eigenkapitalProzent: 15,
    bereitstellungszinsen: 0,
    darlehen: [
      {
        id: "vorlage-altbau-bank",
        name: "Hauptdarlehen",
        betrag: null,
        zins: 3.8,
        tilgung: 1.5,
        zinsbindungJahre: 15,
        anschlusszins: 4.5,
        anschluss: "rate",
        anschlusstilgung: 1.5,
        sondertilgung: 0,
      },
      {
        id: "vorlage-altbau-zweit",
        name: "Zweitdarlehen",
        betrag: 50000,
        zins: 4.4,
        tilgung: 3,
        zinsbindungJahre: 10,
        anschlusszins: 5,
        anschluss: "tilgung",
        anschlusstilgung: 3,
        sondertilgung: 0,
      },
    ],
  },
  afa: {
    art: "linear",
    satz: 2.5,
    grundstueck: "prozent",
    grundstuecksanteil: 28,
    grundstueckswert: 0,
    denkmal: { aktiv: true, art: "7i", sanierungsanteil: 150000, abJahr: 2028 },
  },
};

/** Standard beim ersten Öffnen: ein Bestandsobjekt mit Ist-Daten und zwei Objekte in Planung. */
export function beispielPortfolio(): Portfolio {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  const leer = { buchungen: [], stichtage: [] };
  const bestandAktuell: ObjektDaten = {
    ...clone(BESTAND_KAUF),
    miete: { ...BESTAND_KAUF.miete, kaltmiete: 850 },
    kosten: { hausgeld: 92, ruecklage: 60, verwaltung: 26, steigerung: 2.5 },
    finanzierung: {
      ...clone(BESTAND_KAUF.finanzierung),
      darlehen: [{ ...clone(BESTAND_KAUF.finanzierung.darlehen[0]), anschlusszins: 4.2 }],
    },
  };
  return {
    schema: SCHEMA,
    steuerprofil: {
      einkommen: [
        { abJahr: 2022, zve: 64000 },
        { abJahr: 2025, zve: 72000 },
        { abJahr: 2029, zve: 82000 },
      ],
      einkommenSteigerung: 1.5,
      verheiratet: [
        { abJahr: 2022, wert: false },
        { abJahr: 2029, wert: true },
      ],
      kirchensteuer: false,
      kirchensteuerSatz: 8,
      lohnsteuerermaessigung: true,
    },
    objekte: [
      {
        id: "vorlage-bestand",
        status: "bestand",
        daten: bestandAktuell,
        baseline: clone(BESTAND_KAUF),
        ist: {
          buchungen: bestandIst(),
          stichtage: [
            { id: "vorlage-bestand-s1", datum: "2024-11-01", restschuld: null, marktwert: null, miete: 850, notiz: "Neuvermietung" },
            {
              id: "vorlage-bestand-s2",
              datum: "2025-12-31",
              restschuld: RESTSCHULD_2025,
              marktwert: 238000,
              miete: null,
              notiz: "Jahreskontoauszug der Bank, Marktwert laut Vergleichsangeboten",
            },
          ],
        },
      },
      { id: "vorlage-apartment", status: "plan", daten: clone(APARTMENT), baseline: null, ist: clone(leer) },
      { id: "vorlage-altbau", status: "plan", daten: clone(ALTBAU), baseline: null, ist: clone(leer) },
    ],
  };
}
