import { useMemo, useState } from "react";
import { rechneIsoliert, rechnePortfolio } from "../domain/calc";
import type { Objekt } from "../domain/types";
import { useStore } from "../state/store";
import { Chart } from "../ui/Chart";
import { Segmented } from "../ui/fields";
import { euro, euroCent, monatsname, monatText, num, prozent, tone } from "../ui/format";
import { ProjektionsTabelle } from "./ProjektionsTabelle";

export function ObjektErgebnisSeite({ objekt }: { objekt: Objekt }) {
  const { portfolio, ergebnis } = useStore();
  const [steuerModus, setSteuerModus] = useState<"portfolio" | "isoliert">("portfolio");
  const [variante, setVariante] = useState<"aktuell" | "plan">("aktuell");
  const [horizont, setHorizont] = useState(10);
  const [tabellenJahre, setTabellenJahre] = useState(10);

  const r = useMemo(() => {
    if (steuerModus === "isoliert") return rechneIsoliert(portfolio, objekt, variante);
    if (variante === "plan") return rechnePortfolio(portfolio, { [objekt.id]: "plan" }).jeId.get(objekt.id)!;
    return ergebnis.jeId.get(objekt.id)!;
  }, [steuerModus, variante, portfolio, ergebnis, objekt]);

  const heute = new Date().getFullYear();
  const startIndex = Math.max(0, r.jahre.findIndex((y) => y.jahr === heute));
  const [jahrIndex, setJahrIndex] = useState(startIndex);
  const k = r.kennzahlen;
  const y = r.jahre[Math.min(jahrIndex, r.jahre.length - 1)];
  const m = y.monatlich;
  const ersteVolle = r.jahre.find((x) => x.jahr === heute) ?? r.jahre.find((x) => x.monate === 12) ?? r.jahre[0];
  const hz = r.kennzahlenJeHorizont[horizont];
  const anzahlObjekte = portfolio.objekte.length;

  return (
    <>
      <div className="toolbar">
        {anzahlObjekte > 1 && (
          <Segmented
            label="Steuerberechnung"
            value={steuerModus}
            onChange={setSteuerModus}
            options={[
              ["portfolio", `Steuer im Portfolio (${y.steuerRang}. von ${anzahlObjekte})`],
              ["isoliert", "Objekt allein"],
            ]}
          />
        )}
        {objekt.status === "bestand" && objekt.baseline && (
          <Segmented
            label="Ansicht"
            value={variante}
            onChange={setVariante}
            options={[
              ["aktuell", "Ist + Hochrechnung"],
              ["plan", "Ursprünglicher Plan"],
            ]}
          />
        )}
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Gesamtinvestition</span>
          <strong>{euro(k.erwerb.gesamtinvestition)}</strong>
        </div>
        <div className="kpi">
          <span>Mietrendite brutto</span>
          <strong>{prozent(k.kennwerte.bruttomietrendite, 2)}</strong>
        </div>
        <div className="kpi">
          <span>Cashflow nach Steuern {ersteVolle.jahr}</span>
          <strong className={tone(ersteVolle.monatlich.ueberschuss)}>{euro(ersteVolle.monatlich.ueberschuss)} / Monat</strong>
        </div>
        {r.kennzahlenJeHorizont[10] && (
          <div className="kpi">
            <span>EK-Rendite p.a. (10 Jahre)</span>
            <strong className={tone(r.kennzahlenJeHorizont[10].ekRendite)}>{prozent(r.kennzahlenJeHorizont[10].ekRendite, 2)}</strong>
          </div>
        )}
        <div className="kpi">
          <span>Monatsrate Darlehen</span>
          <strong>{euroCent(k.kapitaldienst.monatsrate)}</strong>
        </div>
      </div>

      <section className="card" aria-labelledby="h-finanz">
        <h2 id="h-finanz">Finanzierung – {num(Math.max(0, 100 - k.erwerb.eigenkapitalQuote))} % fremdfinanziert</h2>
        <div className="two-col-inner">
          <dl className="breakdown">
            <div>
              <dt>Kaufpreis</dt>
              <dd>{euro(k.erwerb.kaufpreis)}</dd>
            </div>
            {k.erwerb.moebel > 0 && (
              <div>
                <dt>Möbel</dt>
                <dd>{euro(k.erwerb.moebel)}</dd>
              </div>
            )}
            <div className="strong">
              <dt>Gesamtinvestition</dt>
              <dd>{euro(k.erwerb.gesamtinvestition)}</dd>
            </div>
            <div>
              <dt>Kaufnebenkosten</dt>
              <dd>{euro(k.nebenkosten.nebenkostenGesamt)}</dd>
            </div>
            <div>
              <dt>Eigenkapitaleinsatz</dt>
              <dd>{euro(k.erwerb.eigenkapitalBetrag + Math.max(0, k.kapitaldienst.finanzierungsluecke))}</dd>
            </div>
            <div className="strong">
              <dt>Eingesetztes Kapital</dt>
              <dd>{euro(k.nebenkosten.eigenkapitalEinsatz)}</dd>
            </div>
          </dl>
          <div className="table-scroll compact">
            <table className="simple">
              <thead>
                <tr>
                  <th scope="col">Darlehen</th>
                  <th scope="col">Betrag</th>
                  <th scope="col">Zins</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Zinsbindung bis</th>
                  <th scope="col">Restschuld dann</th>
                  <th scope="col">Rate danach</th>
                  <th scope="col">Schuldenfrei</th>
                </tr>
              </thead>
              <tbody>
                {k.kapitaldienst.darlehensplaene.map((l) => (
                  <tr key={l.id}>
                    <th scope="row">{l.name}</th>
                    <td>{euro(l.betrag)}</td>
                    <td>{prozent(l.zins, 2)}</td>
                    <td>{euroCent(l.monatsrate)}</td>
                    <td>{l.endeZinsbindung ? monatText(l.endeZinsbindung) : "gesamte Laufzeit"}</td>
                    <td>{l.restschuldEndeZinsbindung !== null ? euro(l.restschuldEndeZinsbindung) : "–"}</td>
                    <td>{l.anschlussrate !== null ? euroCent(l.anschlussrate) : "–"}</td>
                    <td>{l.schuldenfreiJahr ?? "> 40 J."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="h-monat">
        <div className="row-between">
          <h2 id="h-monat">Monatsübersicht {y.jahr}</h2>
          <p className="muted">
            {y.jahrNr === 1 ? `Werte ab ${monatsname(k.kaufMonat)} ${y.jahr}` : `Durchschnitt ${y.jahr}`}
            {y.ist && " · enthält Ist-Werte"}
          </p>
        </div>
        <label className="slider-label" htmlFor="betrachtungsjahr">
          Betrachtungsjahr <strong>{y.jahr}</strong>
        </label>
        <input
          id="betrachtungsjahr"
          type="range"
          min={0}
          max={Math.min(r.jahre.length, 40) - 1}
          value={jahrIndex}
          onChange={(e) => setJahrIndex(Number(e.target.value))}
        />
        <div className="range-ends">
          <span>{r.jahre[0].jahr}</span>
          <span>{r.jahre[Math.min(r.jahre.length, 40) - 1].jahr}</span>
        </div>
        <div className="tiles">
          <div className="tile in">
            <span>Miete</span>
            <strong>{euro(m.mieteMonat - m.mietausfall)}</strong>
          </div>
          <div className="tile in">
            <span>Steuerwirkung</span>
            <strong>{euro(m.steuerwirkung)}</strong>
          </div>
          <div className="tile out">
            <span>Finanzierung</span>
            <strong>{euro(m.kapitaldienst)}</strong>
          </div>
          <div className="tile out">
            <span>Rücklagen</span>
            <strong>{euro(m.ruecklagen)}</strong>
          </div>
          <div className="tile out">
            <span>Hausgeld</span>
            <strong>{euro(m.hausgeldkosten)}</strong>
          </div>
          <div className="tile out">
            <span>Mietverwaltung</span>
            <strong>{euro(m.verwaltungskosten)}</strong>
          </div>
          {m.sonstigeAusgaben > 0 && (
            <div className="tile out">
              <span>Reparaturen & Sonstiges</span>
              <strong>{euro(m.sonstigeAusgaben)}</strong>
            </div>
          )}
          <div className="tile total">
            <span>Einnahmen</span>
            <strong>{euro(m.einnahmenGesamt)}</strong>
          </div>
          <div className="tile total">
            <span>Ausgaben</span>
            <strong>{euro(m.ausgabenGesamt)}</strong>
          </div>
          <div className={`tile result ${tone(m.ueberschuss)}`}>
            <span>Monatlicher Überschuss</span>
            <strong>{euro(m.ueberschuss)}</strong>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="h-vermoegen">
        <div className="row-between">
          <h2 id="h-vermoegen">Vermögensaufbau</h2>
          <Segmented
            label="Zeitraum"
            value={horizont}
            onChange={setHorizont}
            options={[10, 20, 30, 40].filter((n) => r.kennzahlenJeHorizont[n]).map((n) => [n, `${n} Jahre`] as [number, string])}
          />
        </div>
        <Chart
          titel={`Vermögensentwicklung über ${horizont} Jahre`}
          labels={r.jahre.slice(0, horizont).map((x) => x.jahr)}
          markierung={r.jahre.findIndex((x) => x.jahr === heute)}
          serien={[
            { name: "Aufgebautes Vermögen", farbe: "--c2", art: "flaeche", werte: r.jahre.slice(0, horizont).map((x) => x.aufgebautesVermoegen) },
            { name: "Immobilienwert", farbe: "--c1", art: "linie", werte: r.jahre.slice(0, horizont).map((x) => x.objektwert) },
            { name: "Restschuld", farbe: "--c4", art: "linie", gestrichelt: true, werte: r.jahre.slice(0, horizont).map((x) => x.restschuld) },
          ]}
        />
        {hz && (
          <div className="roe">
            <div>
              <h3>Jährliche Eigenkapitalrendite</h3>
              <ul className="formula">
                <li>
                  <b>Aufgebautes Vermögen</b> = Nettowert der Immobilie (Immobilienwert − Restschuld) + kumulierte Cashflows
                </li>
                <li>
                  <b>Eingesetztes Kapital</b> = Eigenkapital und Kaufnebenkosten
                </li>
                <li>
                  <b>EK-Rendite p.a.</b> = (Aufgebautes Vermögen ÷ eingesetztes Kapital) annualisiert
                </li>
              </ul>
            </div>
            <div className="roe-figures">
              <div>
                <span>Immobilienwert</span>
                <strong>{euro(hz.objektwert)}</strong>
              </div>
              <div>
                <span>Restschuld</span>
                <strong>{euro(hz.restschuld)}</strong>
              </div>
              <div>
                <span>Nettowert der Immobilie</span>
                <strong>{euro(hz.verkaufserloes)}</strong>
              </div>
              <div className={`big ${tone(hz.ekRendite)}`}>
                <strong>{prozent(hz.ekRendite, 2)}</strong>
                <span>p.a. über {horizont} Jahre</span>
              </div>
              <div>
                <span>Eingesetztes Kapital</span>
                <strong>{euro(hz.eingesetztesKapital)}</strong>
              </div>
              <div>
                <span>Aufgebautes Vermögen</span>
                <strong>{euro(hz.nettoPosition)}</strong>
              </div>
              <div>
                <span>Für jeden eingesetzten 1 €</span>
                <strong>≈ {num(hz.kapitalmultiplikator, 2)} €</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="h-projektion">
        <div className="row-between">
          <h2 id="h-projektion">{tabellenJahre}-Jahres-Finanzprojektion</h2>
          <label className="inline">
            Zeitraum
            <select value={tabellenJahre} onChange={(e) => setTabellenJahre(Number(e.target.value))}>
              {[10, 15, 20, 30, 40].map((n) => (
                <option key={n} value={n}>
                  {n} Jahre
                </option>
              ))}
            </select>
          </label>
        </div>
        <ProjektionsTabelle r={r} jahre={tabellenJahre} titel={objekt.daten.name} />
        <p className="muted small">
          Mietsteigerung {prozent(objekt.daten.miete.steigerung)}, Kostensteigerung {prozent(objekt.daten.kosten.steigerung)}, Wertentwicklung{" "}
          {prozent(objekt.daten.wertsteigerung)} p.a.
          {steuerModus === "portfolio" && anzahlObjekte > 1 && " Steuerwirkung nach chronologischer Verteilung im Portfolio."}
        </p>
        {(() => {
          const last = r.jahre[Math.min(tabellenJahre, r.jahre.length) - 1];
          return (
            <div className="summary-cards">
              <div className="summary">
                <span>Gesamtinvestition ({tabellenJahre} Jahre)</span>
                <strong>{euro(k.nebenkosten.eigenkapitalEinsatz - last.kumulierterCashflow)}</strong>
                <em>Nach Steuervorteilen &amp; Cashflows</em>
              </div>
              <div className="summary">
                <span>Immobilienwert ({tabellenJahre} Jahre)</span>
                <strong>{euro(last.objektwert)}</strong>
                <em>{prozent((last.objektwert / (k.erwerb.immobilienwert || 1) - 1) * 100)} Wertsteigerung</em>
              </div>
              <div className="summary">
                <span>Gesamtvermögenswert</span>
                <strong>{euro(last.eigenkapital)}</strong>
                <em>Immobilienwert − Restschuld</em>
              </div>
            </div>
          );
        })()}
      </section>
    </>
  );
}
