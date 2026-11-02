import { tilgungsplan, parseMonat, type DarlehenMitBetrag, type DarlehenUebersicht, type RestschuldAnker } from "./loans";
import type { ObjektDaten } from "./types";

export const GRUNDERWERBSTEUER: Record<string, number> = {
  "Baden-Württemberg": 5,
  Bayern: 3.5,
  Berlin: 6,
  Brandenburg: 6.5,
  Bremen: 5.5,
  Hamburg: 5.5,
  Hessen: 6,
  "Mecklenburg-Vorpommern": 6,
  Niedersachsen: 5,
  "Nordrhein-Westfalen": 6.5,
  "Rheinland-Pfalz": 5,
  Saarland: 6.5,
  Sachsen: 5.5,
  "Sachsen-Anhalt": 5,
  "Schleswig-Holstein": 6.5,
  Thüringen: 5,
};

export const PROJEKTIONSJAHRE = 40;

/** Startwerte, die eine Hochrechnung auf den tatsächlichen Stand setzen. */
export interface Anker {
  restschuld?: RestschuldAnker;
  /** Marktwert am Ende des Jahres `jahr`. */
  marktwert?: { jahr: number; betrag: number };
  /** Kaltmiete ab dem angegebenen Monat. */
  miete?: { monat: string; betrag: number };
  /** Tatsächliches monatliches Kostenniveau im Jahr `jahr`; gilt fortgeschrieben ab dem Folgejahr. */
  kosten?: { jahr: number; hausgeld?: number; ruecklage?: number; verwaltung?: number };
}

/** Ein Kalenderjahr eines Objekts vor Steuern. */
export interface VorsteuerJahr {
  jahr: number;
  /** Jahr seit Kauf, 1 = Kaufjahr */
  jahrNr: number;
  monate: number;
  bruttomiete: number;
  mietausfall: number;
  nettomiete: number;
  verwaltungskosten: number;
  ruecklagen: number;
  hausgeldkosten: number;
  /** Reparaturen und sonstige Kosten (nur aus Ist-Daten) */
  sonstigeAusgaben: number;
  bewirtschaftung: number;
  cashflowVorFinanzierung: number;
  zinsaufwand: number;
  tilgungsleistung: number;
  sondertilgungen: number;
  /** Einmalige Bereitstellungszinsen (Kaufjahr) */
  bereitstellungszinsenJahr: number;
  kapitaldienst: number;
  cashflowVorSteuern: number;
  afaGebaeude: number;
  /** Erhöhte AfA auf den Sanierungsanteil (§7i/§7h) */
  afaDenkmal: number;
  afaMoebel: number;
  abzugGrundschuld: number;
  /** Sofort wirksame Abzüge: AfA, Zinsen, Bewirtschaftung */
  sofortAbzuege: number;
  /** Einmalabzüge: Grundschuldkosten */
  einmalAbzuege: number;
  /** Mieteinnahmen − sofort wirksame Abzüge */
  laufendesErgebnis: number;
  /** Steuerliches Ergebnis aus Vermietung */
  steuerlichesErgebnis: number;
  objektwert: number;
  restschuld: number;
  eigenkapital: number;
  darlehen: { id: string; name: string; zinsen: number; tilgung: number; sondertilgung: number; restschuld: number; zinssatz: number }[];
  /** Gesetzt, wenn Werte aus der Ist-Erfassung stammen. */
  ist?: { abgedeckteMonate: number; kategorien: string[]; steuer: number | null };
}

export interface ObjektKennzahlen {
  kaufJahr: number;
  kaufMonat: number;
  erwerb: {
    kaufpreis: number;
    moebel: number;
    gesamtinvestition: number;
    /** Gesamtinvestition ohne Möbel: Ausgangswert der Wertentwicklung */
    immobilienwert: number;
    eigenkapitalBetrag: number;
    eigenkapitalQuote: number;
    darlehensbetrag: number;
  };
  nebenkosten: {
    maklerprovision: number;
    grunderwerbsteuer: number;
    grunderwerbsteuerSatz: number;
    notarKauf: number;
    grundschuldkosten: number;
    notarUndGrundbuch: number;
    nebenkostenGesamt: number;
    eigenkapitalEinsatz: number;
  };
  steuerbasis: {
    bodenwert: number;
    /** AfA-Basis der Altbausubstanz bzw. des Gebäudes (linear/degressiv) */
    afaBasis: number;
    /** AfA-Basis des Sanierungsanteils inkl. anteiliger Nebenkosten (§7i/§7h) */
    denkmalBasis: number;
    /** Erstes Jahr der Denkmal-AfA (null: keine) */
    denkmalAbJahr: number | null;
    afaSatz: number;
    afaJaehrlich: number;
  };
  kapitaldienst: {
    monatsrate: number;
    darlehensplaene: DarlehenUebersicht[];
    /** Finanzierungsbedarf, der durch Darlehen nicht gedeckt ist (negativ: überfinanziert) */
    finanzierungsluecke: number;
  };
  kennwerte: { bruttomietrendite: number };
}

export interface ObjektProjektion {
  kennzahlen: ObjektKennzahlen;
  jahre: VorsteuerJahr[];
}

const pct = (v: number) => (Number(v) || 0) / 100;

export function darlehenAufloesen(d: ObjektDaten): { darlehen: DarlehenMitBetrag[]; bedarf: number; finanzierungsluecke: number } {
  const gesamt = d.kauf.kaufpreis + d.kauf.moebel;
  const bedarf = Math.max(0, gesamt - pct(d.finanzierung.eigenkapitalProzent) * gesamt);
  const festeBetraege = d.finanzierung.darlehen.reduce((s, l) => s + (l.betrag ?? 0), 0);
  const darlehen = d.finanzierung.darlehen.map((l) => ({
    ...l,
    betragEffektiv: l.betrag ?? Math.max(0, bedarf - festeBetraege),
  }));
  const summe = darlehen.reduce((s, l) => s + l.betragEffektiv, 0);
  return { darlehen, bedarf, finanzierungsluecke: bedarf - summe };
}

export function projiziereObjekt(d: ObjektDaten, opts: { jahre?: number; anker?: Anker } = {}): ObjektProjektion {
  const horizont = opts.jahre ?? PROJEKTIONSJAHRE;
  const anker = opts.anker ?? {};
  const { jahr: kaufJahr, monat: kaufMonat } = parseMonat(d.kaufdatum);

  // Kauf & Nebenkosten
  const kaufpreis = Math.max(0, d.kauf.kaufpreis);
  const moebel = Math.max(0, d.kauf.moebel);
  const gesamtinvestition = kaufpreis + moebel;
  const immobilienwert = kaufpreis;
  const eigenkapitalBetrag = pct(d.finanzierung.eigenkapitalProzent) * gesamtinvestition;
  const { darlehen, finanzierungsluecke } = darlehenAufloesen(d);
  const darlehensbetrag = darlehen.reduce((s, l) => s + l.betragEffektiv, 0);

  const grunderwerbsteuerSatz = GRUNDERWERBSTEUER[d.bundesland] ?? 5;
  const maklerprovision = pct(d.kauf.makler) * gesamtinvestition;
  const grunderwerbsteuer = (grunderwerbsteuerSatz / 100) * kaufpreis;
  const notarKauf = pct(d.kauf.notarGrundbuch) * kaufpreis;
  const grundschuldkosten = pct(d.kauf.grundschuld) * darlehensbetrag;
  const notarUndGrundbuch = notarKauf + grundschuldkosten;
  const nebenkostenGesamt = maklerprovision + grunderwerbsteuer + notarUndGrundbuch;
  // Nicht durch Darlehen gedeckter Finanzierungsbedarf kommt zusätzlich aus Eigenkapital.
  const eigenkapitalEinsatz = eigenkapitalBetrag + Math.max(0, finanzierungsluecke) + nebenkostenGesamt;

  // AfA: Gebäudeanteil plus anteilige (aktivierungspflichtige) Nebenkosten.
  // Grundschuldkosten sind Finanzierungskosten und sofort abziehbar.
  const aktivierteNebenkosten = maklerprovision + grunderwerbsteuer + notarKauf;
  const bodenanteil =
    d.afa.grundstueck === "betrag"
      ? kaufpreis > 0
        ? Math.min(1, Math.max(0, d.afa.grundstueckswert / kaufpreis))
        : 0
      : Math.min(1, Math.max(0, pct(d.afa.grundstuecksanteil)));
  const bodenwert = bodenanteil * kaufpreis;
  // Denkmal-/Sanierungs-AfA: begünstigter Sanierungsanteil inkl. anteiliger Nebenkosten,
  // die Altbausubstanz wird weiter mit dem normalen Satz abgeschrieben.
  const denkmal = d.afa.denkmal;
  const sanierungsanteil = denkmal?.aktiv ? Math.min(Math.max(0, denkmal.sanierungsanteil), kaufpreis - bodenwert) : 0;
  const nebenkostenFaktor = kaufpreis > 0 ? aktivierteNebenkosten / kaufpreis : 0;
  const denkmalBasis = sanierungsanteil * (1 + nebenkostenFaktor);
  const denkmalAbJahr = denkmalBasis > 0 ? Math.max(kaufJahr, denkmal.abJahr ?? kaufJahr) : null;
  const afaBasis = (1 - bodenanteil) * (kaufpreis + aktivierteNebenkosten) - denkmalBasis;
  const afaSatz = pct(d.afa.satz);

  const monateKaufjahr = 12 - kaufMonat + 1;
  const monateGesamt = monateKaufjahr + (horizont - 1) * 12;
  const darlehensplaene = tilgungsplan(darlehen, d.kaufdatum, monateGesamt, anker.restschuld);

  const mietsteigerung = pct(d.miete.steigerung);
  const kostensteigerung = pct(d.kosten.steigerung);
  const wertsteigerungRate = pct(d.wertsteigerung);
  const leerstandsquote = pct(d.miete.leerstand);
  const mieteAnker = anker.miete ? parseMonat(anker.miete.monat) : null;

  const jahre: VorsteuerJahr[] = [];
  let abgeschrieben = 0;
  let restbuchwert = afaBasis;
  let moebelMonate = 0;

  for (let t = 1; t <= horizont; t++) {
    const jahr = kaufJahr + t - 1;
    const ersterMonat = t === 1 ? kaufMonat : 1;
    const monateImJahr = 12 - ersterMonat + 1;
    const jahresanteil = monateImJahr / 12;

    let bruttomiete = 0;
    for (let m = ersterMonat; m <= 12; m++) {
      if (mieteAnker && anker.miete && (jahr > mieteAnker.jahr || (jahr === mieteAnker.jahr && m >= mieteAnker.monat))) {
        bruttomiete += anker.miete.betrag * Math.pow(1 + mietsteigerung, jahr - mieteAnker.jahr);
      } else {
        bruttomiete += d.miete.kaltmiete * Math.pow(1 + mietsteigerung, t - 1);
      }
    }
    const mietausfall = bruttomiete * leerstandsquote;
    const nettomiete = bruttomiete - mietausfall;

    const kostenfaktor = Math.pow(1 + kostensteigerung, t - 1);
    const kostenAnker = anker.kosten && jahr > anker.kosten.jahr ? anker.kosten : null;
    const kosten = (key: "hausgeld" | "ruecklage" | "verwaltung") => {
      const level = kostenAnker?.[key];
      return level !== undefined && kostenAnker
        ? level * monateImJahr * Math.pow(1 + kostensteigerung, jahr - kostenAnker.jahr)
        : d.kosten[key] * monateImJahr * kostenfaktor;
    };
    const verwaltungskosten = kosten("verwaltung");
    const ruecklagen = kosten("ruecklage");
    const hausgeldkosten = kosten("hausgeld");
    const bewirtschaftung = verwaltungskosten + ruecklagen + hausgeldkosten;

    const darlehenJahr = darlehensplaene.map((l) => {
      const y = l.jahre.get(jahr) ?? { zinsen: 0, tilgung: 0, sondertilgung: 0, restschuld: 0, zinssatz: l.zins };
      return { id: l.id, name: l.name, ...y };
    });
    const zinsaufwand = darlehenJahr.reduce((s, l) => s + l.zinsen, 0);
    const sondertilgungen = darlehenJahr.reduce((s, l) => s + l.sondertilgung, 0);
    const tilgungsleistung = darlehenJahr.reduce((s, l) => s + l.tilgung, 0) + sondertilgungen;
    const restschuld = darlehenJahr.reduce((s, l) => s + l.restschuld, 0);
    const bereitstellungszinsenJahr = t === 1 ? Math.max(0, d.finanzierung.bereitstellungszinsen) : 0;
    const kapitaldienst = zinsaufwand + tilgungsleistung + bereitstellungszinsenJahr;

    let afaGebaeude: number;
    if (d.afa.art === "degressiv") {
      afaGebaeude = restbuchwert * afaSatz * jahresanteil;
      restbuchwert -= afaGebaeude;
    } else {
      afaGebaeude = Math.min(afaBasis * afaSatz * jahresanteil, afaBasis - abgeschrieben);
    }
    abgeschrieben += afaGebaeude;
    // Im Jahr der Fertigstellung und den 7 Folgejahren je 9 %, danach 4 Jahre je 7 % (volle Jahresbeträge).
    const denkmalJahr = denkmalAbJahr !== null ? jahr - denkmalAbJahr : -1;
    const afaDenkmal = denkmalJahr >= 0 && denkmalJahr < 12 ? denkmalBasis * (denkmalJahr < 8 ? 0.09 : 0.07) : 0;

    // Möbel: 10 Jahre linear
    const moebelMonateJahr = Math.max(0, Math.min(monateImJahr, 120 - moebelMonate));
    moebelMonate += moebelMonateJahr;
    const afaMoebel = moebel * 0.1 * (moebelMonateJahr / 12);

    const abzugGrundschuld = t === 1 ? grundschuldkosten : 0;
    const sofortAbzuege =
      afaGebaeude + afaDenkmal + afaMoebel + zinsaufwand + bereitstellungszinsenJahr + bewirtschaftung;
    const einmalAbzuege = abzugGrundschuld;

    let objektwert = immobilienwert * Math.pow(1 + wertsteigerungRate, t - 1);
    if (anker.marktwert && jahr >= anker.marktwert.jahr) {
      objektwert = anker.marktwert.betrag * Math.pow(1 + wertsteigerungRate, jahr - anker.marktwert.jahr);
    }

    const cashflowVorFinanzierung = nettomiete - bewirtschaftung;
    jahre.push({
      jahr,
      jahrNr: t,
      monate: monateImJahr,
      bruttomiete,
      mietausfall,
      nettomiete,
      verwaltungskosten,
      ruecklagen,
      hausgeldkosten,
      sonstigeAusgaben: 0,
      bewirtschaftung,
      cashflowVorFinanzierung,
      zinsaufwand,
      tilgungsleistung,
      sondertilgungen,
      bereitstellungszinsenJahr,
      kapitaldienst,
      cashflowVorSteuern: cashflowVorFinanzierung - kapitaldienst,
      afaGebaeude,
      afaDenkmal,
      afaMoebel,
      abzugGrundschuld,
      sofortAbzuege,
      einmalAbzuege,
      laufendesErgebnis: nettomiete - sofortAbzuege,
      steuerlichesErgebnis: nettomiete - sofortAbzuege - einmalAbzuege,
      objektwert,
      restschuld,
      eigenkapital: objektwert - restschuld,
      darlehen: darlehenJahr,
    });
  }

  return {
    kennzahlen: {
      kaufJahr,
      kaufMonat,
      erwerb: {
        kaufpreis,
        moebel,
        gesamtinvestition,
        immobilienwert,
        eigenkapitalBetrag,
        eigenkapitalQuote: d.finanzierung.eigenkapitalProzent,
        darlehensbetrag,
      },
      nebenkosten: {
        maklerprovision,
        grunderwerbsteuer,
        grunderwerbsteuerSatz,
        notarKauf,
        grundschuldkosten,
        notarUndGrundbuch,
        nebenkostenGesamt,
        eigenkapitalEinsatz,
      },
      steuerbasis: {
        bodenwert,
        afaBasis,
        denkmalBasis,
        denkmalAbJahr,
        afaSatz,
        afaJaehrlich: afaBasis * afaSatz,
      },
      kapitaldienst: {
        monatsrate: darlehensplaene.reduce((s, l) => s + l.monatsrate, 0),
        darlehensplaene,
        finanzierungsluecke,
      },
      kennwerte: {
        bruttomietrendite: gesamtinvestition > 0 ? ((12 * d.miete.kaltmiete) / gesamtinvestition) * 100 : 0,
      },
    },
    jahre,
  };
}

/** Werte nach Änderung einzelner Felder (z. B. aus Ist-Daten) konsistent neu ableiten. */
export function ableitungenNeuBerechnen(y: VorsteuerJahr): VorsteuerJahr {
  const bewirtschaftung = y.verwaltungskosten + y.ruecklagen + y.hausgeldkosten + y.sonstigeAusgaben;
  const kapitaldienst = y.zinsaufwand + y.tilgungsleistung + y.bereitstellungszinsenJahr;
  const cashflowVorFinanzierung = y.nettomiete - bewirtschaftung;
  const sofortAbzuege =
    y.afaGebaeude + y.afaDenkmal + y.afaMoebel + y.zinsaufwand + y.bereitstellungszinsenJahr + bewirtschaftung;
  return {
    ...y,
    bewirtschaftung,
    kapitaldienst,
    cashflowVorFinanzierung,
    cashflowVorSteuern: cashflowVorFinanzierung - kapitaldienst,
    sofortAbzuege,
    laufendesErgebnis: y.nettomiete - sofortAbzuege,
    steuerlichesErgebnis: y.nettomiete - sofortAbzuege - y.einmalAbzuege,
    eigenkapital: y.objektwert - y.restschuld,
  };
}
