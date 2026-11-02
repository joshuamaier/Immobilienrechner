import { kirchensteuerSatz, steuerlast, verheiratetImJahr, zveFuerJahr } from "./tax";
import type { ObjektKennzahlen, VorsteuerJahr } from "./property";
import type { Steuerprofil } from "./types";

export interface Jahr extends VorsteuerJahr {
  steuerwirkung: number;
  /** Modellwert, falls steuerwirkung aus der Ist-Erfassung stammt */
  steuerwirkungModell: number;
  steuerwirkungSofort: number;
  steuerwirkungVorjahr: number;
  /** Position in der Steuerreihenfolge (1 = zuerst gekauft) */
  steuerRang: number;
  zveOhneImmobilien: number;
  zveInklImmobilien: number;
  steuerOhneImmobilien: number;
  steuerMitImmobilien: number;
  cashflowNachSteuern: number;
  kumulierterCashflow: number;
  aufgebautesVermoegen: number;
  monatlich: {
    mieteMonat: number;
    mietausfall: number;
    steuerwirkung: number;
    kapitaldienst: number;
    verwaltungskosten: number;
    ruecklagen: number;
    hausgeldkosten: number;
    sonstigeAusgaben: number;
    einnahmenGesamt: number;
    ausgabenGesamt: number;
    ueberschuss: number;
  };
}

export interface HorizontKennzahlen {
  objektwert: number;
  restschuld: number;
  verkaufserloes: number;
  nettoPosition: number;
  eingesetztesKapital: number;
  kapitalmultiplikator: number;
  ekRendite: number;
  kapitaleinsatzNachCashflow: number;
  wertzuwachsProzent: number;
  kumulierterCashflow: number;
}

export interface ObjektErgebnis {
  id: string;
  kennzahlen: ObjektKennzahlen;
  jahre: Jahr[];
  kennzahlenJeHorizont: Record<number, HorizontKennzahlen>;
}

export interface SteuerEingang {
  id: string;
  /** Sortierschlüssel, "YYYY-MM" */
  kaufdatum: string;
  kennzahlen: ObjektKennzahlen;
  jahre: VorsteuerJahr[];
}

export interface SteuerVerteilung {
  jahr: number;
  zveBasis: number;
  eintraege: { id: string; zveVorher: number; ergebnis: number; ersparnis: number }[];
}

/**
 * Steuerwirkung aller Objekte, Kalenderjahr für Kalenderjahr.
 *
 * Die Objekte werden in der Reihenfolge ihres Kaufdatums auf das zu versteuernde
 * Einkommen gerechnet: Das erste Objekt erhält die Ersparnis auf Basis des
 * Einkommens ohne Immobilien, jedes weitere auf Basis des bereits durch die
 * vorherigen Objekte veränderten Einkommens. Die Summe entspricht immer der
 * Gesamtwirkung aller Objekte zusammen.
 *
 * Mit Lohnsteuerermäßigung (§39a EStG) wirken die laufenden Abzüge sofort,
 * Einmalabzüge (Grundschuldkosten) erst mit der Erstattung im
 * Folgejahr. Ohne Lohnsteuerermäßigung kommt die gesamte Ersparnis eines Jahres
 * erst im Folgejahr an.
 */
export function berechneSteuer(profil: Steuerprofil, eingaenge: SteuerEingang[]): {
  ergebnisse: ObjektErgebnis[];
  verteilung: SteuerVerteilung[];
} {
  const order = eingaenge
    .map((e, index) => ({ e, index }))
    .sort((a, b) => (a.e.kaufdatum < b.e.kaufdatum ? -1 : a.e.kaufdatum > b.e.kaufdatum ? 1 : a.index - b.index))
    .map((x) => x.e);
  const rang = new Map(order.map((e, i) => [e.id, i + 1]));

  const jeJahr = new Map<string, Map<number, VorsteuerJahr>>();
  let minJahr = Infinity;
  let maxJahr = -Infinity;
  for (const e of order) {
    const m = new Map<number, VorsteuerJahr>();
    for (const y of e.jahre) {
      m.set(y.jahr, y);
      minJahr = Math.min(minJahr, y.jahr);
      maxJahr = Math.max(maxJahr, y.jahr);
    }
    jeJahr.set(e.id, m);
  }

  type Teil = Pick<
    Jahr,
    | "steuerwirkung"
    | "steuerwirkungSofort"
    | "steuerwirkungVorjahr"
    | "zveOhneImmobilien"
    | "zveInklImmobilien"
    | "steuerOhneImmobilien"
    | "steuerMitImmobilien"
  >;
  const teile = new Map<string, Map<number, Teil>>(order.map((e) => [e.id, new Map()]));
  const carry = new Map<string, number>();
  const verteilung: SteuerVerteilung[] = [];
  const church = kirchensteuerSatz(profil);
  const mitErmaessigung = profil.lohnsteuerermaessigung;

  for (let jahr = minJahr; jahr <= maxJahr; jahr++) {
    const verheiratet = verheiratetImJahr(profil, jahr);
    const T = (zve: number) => steuerlast(Math.max(0, zve), verheiratet, church);
    const z0 = zveFuerJahr(profil, jahr);
    let z = z0;
    const v: SteuerVerteilung = { jahr, zveBasis: z0, eintraege: [] };

    for (const e of order) {
      const y = jeJahr.get(e.id)!.get(jahr);
      if (!y) continue;
      const vorher = z;
      let teil: Teil;
      if (mitErmaessigung) {
        const delayedPrev = jeJahr.get(e.id)!.get(jahr - 1)?.einmalAbzuege ?? 0;
        const wirksam = y.laufendesErgebnis - delayedPrev;
        const total = T(z) - T(z + wirksam);
        const immediate = T(z) - T(z + y.laufendesErgebnis);
        teil = {
          steuerwirkung: total,
          steuerwirkungSofort: immediate,
          steuerwirkungVorjahr: total - immediate,
          zveOhneImmobilien: z,
          zveInklImmobilien: Math.max(0, z + y.steuerlichesErgebnis),
          steuerOhneImmobilien: T(z),
          steuerMitImmobilien: T(z + y.steuerlichesErgebnis),
        };
        z += wirksam;
      } else {
        const prev = carry.get(e.id) ?? 0;
        carry.set(e.id, T(z) - T(z + y.steuerlichesErgebnis));
        teil = {
          steuerwirkung: prev,
          steuerwirkungSofort: 0,
          steuerwirkungVorjahr: prev,
          zveOhneImmobilien: z,
          zveInklImmobilien: Math.max(0, z + y.steuerlichesErgebnis),
          steuerOhneImmobilien: T(z),
          steuerMitImmobilien: T(z + y.steuerlichesErgebnis),
        };
        z += y.steuerlichesErgebnis;
      }
      teile.get(e.id)!.set(jahr, teil);
      v.eintraege.push({ id: e.id, zveVorher: vorher, ergebnis: z - vorher, ersparnis: teil.steuerwirkung });
    }
    if (v.eintraege.length) verteilung.push(v);
  }

  const ergebnisse = eingaenge.map((e) => finalisiere(e, teile.get(e.id)!, rang.get(e.id)!));
  return { ergebnisse, verteilung };
}

function finalisiere(
  e: SteuerEingang,
  teile: Map<number, Omit<Jahr, keyof VorsteuerJahr | "cashflowNachSteuern" | "kumulierterCashflow" | "aufgebautesVermoegen" | "monatlich" | "steuerwirkungModell" | "steuerRang">>,
  steuerRang: number,
): ObjektErgebnis {
  const k = e.kennzahlen;
  let cumulative = 0;
  const jahre: Jahr[] = e.jahre.map((y) => {
    const t = teile.get(y.jahr)!;
    const steuerwirkungModell = t.steuerwirkung;
    const steuerwirkung = y.ist?.steuer ?? steuerwirkungModell;
    const cashflowNachSteuern = y.cashflowVorSteuern + steuerwirkung;
    cumulative += cashflowNachSteuern;
    const per = (v: number) => (y.monate > 0 ? v / y.monate : 0);
    return {
      ...y,
      ...t,
      steuerwirkung,
      steuerwirkungModell,
      steuerRang,
      cashflowNachSteuern,
      kumulierterCashflow: cumulative,
      aufgebautesVermoegen: y.eigenkapital + cumulative - k.nebenkosten.eigenkapitalEinsatz,
      monatlich: {
        mieteMonat: per(y.bruttomiete),
        mietausfall: per(y.mietausfall),
        steuerwirkung: per(steuerwirkung),
        kapitaldienst: per(y.kapitaldienst),
        verwaltungskosten: per(y.verwaltungskosten),
        ruecklagen: per(y.ruecklagen),
        hausgeldkosten: per(y.hausgeldkosten),
        sonstigeAusgaben: per(y.sonstigeAusgaben),
        einnahmenGesamt: per(y.nettomiete + steuerwirkung),
        ausgabenGesamt: per(y.kapitaldienst + y.bewirtschaftung),
        ueberschuss: per(cashflowNachSteuern),
      },
    };
  });

  const kennzahlenJeHorizont: Record<number, HorizontKennzahlen> = {};
  const eingesetztesKapital = k.nebenkosten.eigenkapitalEinsatz;
  for (const n of [10, 20, 30, 40]) {
    const y = jahre[n - 1];
    if (!y || eingesetztesKapital <= 0) continue;
    const verkaufserloes = y.objektwert - y.restschuld;
    const nettoPosition = verkaufserloes + y.kumulierterCashflow;
    kennzahlenJeHorizont[n] = {
      objektwert: y.objektwert,
      restschuld: y.restschuld,
      verkaufserloes,
      nettoPosition,
      eingesetztesKapital,
      kapitalmultiplikator: nettoPosition / eingesetztesKapital,
      ekRendite:
        nettoPosition > 0 ? (Math.pow(nettoPosition / eingesetztesKapital, 1 / n) - 1) * 100 : -100,
      kapitaleinsatzNachCashflow: k.nebenkosten.eigenkapitalEinsatz - y.kumulierterCashflow,
      wertzuwachsProzent: k.erwerb.immobilienwert > 0 ? (y.objektwert / k.erwerb.immobilienwert - 1) * 100 : 0,
      kumulierterCashflow: y.kumulierterCashflow,
    };
  }
  return { id: e.id, kennzahlen: k, jahre, kennzahlenJeHorizont };
}
