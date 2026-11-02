import type { Darlehen, Monat } from "./types";

export interface DarlehenMitBetrag extends Darlehen {
  betragEffektiv: number;
}

export interface DarlehenJahr {
  zinsen: number;
  tilgung: number;
  sondertilgung: number;
  restschuld: number;
  /** Sollzins am Jahresende */
  zinssatz: number;
}

export interface DarlehenUebersicht {
  id: string;
  name: string;
  betrag: number;
  zins: number;
  monatsrate: number;
  /** Ende der Zinsbindung als "YYYY-MM" (null bei durchgehendem Zins). */
  endeZinsbindung: Monat | null;
  restschuldEndeZinsbindung: number | null;
  anschlussrate: number | null;
  /** Kalenderjahr, in dem das Darlehen vollständig getilgt ist (null: nicht im Betrachtungszeitraum). */
  schuldenfreiJahr: number | null;
  /** Rate deckt nach dem Anschluss die Zinsen nicht. */
  rateZuNiedrig: boolean;
  jahre: Map<number, DarlehenJahr>;
}

export interface RestschuldAnker {
  /** Monat, nach dessen Rate die Restschuld gesetzt wird. */
  monat: Monat;
  betrag: number;
}

export function parseMonat(m: Monat): { jahr: number; monat: number } {
  const [j, mo] = m.split("-").map(Number);
  return { jahr: j || new Date().getFullYear(), monat: Math.min(12, Math.max(1, mo || 1)) };
}

export function formatMonat(jahr: number, monat: number): Monat {
  return `${jahr}-${String(monat).padStart(2, "0")}`;
}

/**
 * Tilgungsplan aller Darlehen eines Objekts, Monat für Monat ab dem Kaufmonat.
 * Zinsen fallen monatlich auf die aktuelle Restschuld an (wie ein Bank-Tilgungsplan).
 */
export function tilgungsplan(
  darlehen: DarlehenMitBetrag[],
  start: Monat,
  monate: number,
  anker?: RestschuldAnker,
): DarlehenUebersicht[] {
  const { jahr: startJahr, monat: startMonat } = parseMonat(start);
  const ankerIndex = anker
    ? (parseMonat(anker.monat).jahr - startJahr) * 12 + parseMonat(anker.monat).monat - startMonat
    : -1;

  const state = darlehen.map((d) => {
    const betrag = Math.max(0, d.betragEffektiv);
    return {
      d,
      saldo: betrag,
      zins: d.zins,
      rate: (betrag * (d.zins + d.tilgung)) / 1200,
      uebersicht: {
        id: d.id,
        name: d.name,
        betrag,
        zins: d.zins,
        monatsrate: (betrag * (d.zins + d.tilgung)) / 1200,
        endeZinsbindung: null,
        restschuldEndeZinsbindung: null,
        anschlussrate: null,
        schuldenfreiJahr: betrag > 0 ? null : startJahr,
        rateZuNiedrig: false,
        jahre: new Map(),
      } as DarlehenUebersicht,
    };
  });

  for (let k = 0; k < monate; k++) {
    const kalMonat = ((startMonat - 1 + k) % 12) + 1;
    const jahr = startJahr + Math.floor((startMonat - 1 + k) / 12);

    for (const s of state) {
      const bindung = s.d.zinsbindungJahre > 0 ? s.d.zinsbindungJahre * 12 : Infinity;
      if (k === bindung) {
        s.uebersicht.endeZinsbindung = formatMonat(jahr, kalMonat);
        s.uebersicht.restschuldEndeZinsbindung = s.saldo;
        s.zins = s.d.anschlusszins;
        if (s.d.anschluss === "tilgung") s.rate = (s.saldo * (s.d.anschlusszins + s.d.anschlusstilgung)) / 1200;
        s.uebersicht.anschlussrate = s.saldo > 0 ? s.rate : 0;
      }

      let y = s.uebersicht.jahre.get(jahr);
      if (!y) {
        y = { zinsen: 0, tilgung: 0, sondertilgung: 0, restschuld: s.saldo, zinssatz: s.zins };
        s.uebersicht.jahre.set(jahr, y);
      }

      if (s.saldo > 0) {
        const zinsen = (s.saldo * s.zins) / 1200;
        if (s.rate <= zinsen && s.rate > 0) s.uebersicht.rateZuNiedrig = true;
        const tilgung = Math.min(Math.max(0, s.rate - zinsen), s.saldo);
        s.saldo -= tilgung;
        y.zinsen += zinsen;
        y.tilgung += tilgung;
        if (kalMonat === 12 && k >= 11 && s.d.sondertilgung > 0) {
          const sonder = Math.min(s.d.sondertilgung, s.saldo);
          s.saldo -= sonder;
          y.sondertilgung += sonder;
        }
        if (s.saldo <= 0.005) {
          s.saldo = 0;
          if (s.uebersicht.schuldenfreiJahr === null) s.uebersicht.schuldenfreiJahr = jahr;
        }
      }
      y.restschuld = s.saldo;
      y.zinssatz = s.zins;
    }

    if (k === ankerIndex && anker) {
      const summe = state.reduce((a, s) => a + s.saldo, 0);
      for (const s of state) {
        const anteil = summe > 0 ? s.saldo / summe : 1 / state.length;
        s.saldo = Math.max(0, anker.betrag * anteil);
        const y = s.uebersicht.jahre.get(jahr);
        if (y) y.restschuld = s.saldo;
        if (s.saldo > 0) s.uebersicht.schuldenfreiJahr = null;
      }
    }
  }
  return state.map((s) => s.uebersicht);
}
