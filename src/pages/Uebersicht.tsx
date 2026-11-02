import { useState } from "react";
import { href, navigate } from "../state/route";
import { useStore } from "../state/store";
import { Chart } from "../ui/Chart";
import { ConfirmButton, Segmented } from "../ui/fields";
import { euro, monatText, prozent, tone } from "../ui/format";

export const FARBEN = ["--c1", "--c2", "--c3", "--c4", "--c5", "--c6"];

export function Uebersicht() {
  const { portfolio, ergebnis, neuesObjekt, allesLoeschen, beispieleLaden } = useStore();
  const [horizont, setHorizont] = useState(20);
  const heute = new Date().getFullYear();
  const [steuerJahrWahl, setSteuerJahr] = useState(heute + 1);

  if (portfolio.objekte.length === 0) {
    return (
      <section className="card empty hero-empty">
        <h1>Dein Immobilien-Portfolio</h1>
        <p>
          Noch keine Objekte angelegt. Lege ein Objekt an, importiere eine gespeicherte Datei oder lade die Vorlagen (ein erfundenes Bestandsobjekt mit Ist-Daten und
          zwei Objekte in Planung).
        </p>
        <ol className="steps">
          <li>
            <a href={href.steuer()}>Steuerprofil</a> mit deinem zu versteuernden Einkommen ausfüllen
          </li>
          <li>Objekte anlegen: geplante Käufe und Wohnungen, die du schon besitzt</li>
          <li>Für Bestandsobjekte Ist-Werte erfassen und mit dem Plan vergleichen</li>
        </ol>
        <div className="row-gap">
          <button type="button" className="btn primary" onClick={() => navigate(href.objekt(neuesObjekt()))}>
            + Neues Objekt anlegen
          </button>
          <a className="btn" href={href.daten()}>
            Datei importieren
          </a>
          <button type="button" className="btn" onClick={beispieleLaden}>
            Vorlagen laden
          </button>
        </div>
      </section>
    );
  }

  const jahre = ergebnis.jahre;
  const ersteJahr = jahre[0]?.jahr ?? heute;
  const bis = Math.max(heute, ersteJahr) + horizont - 1;
  const sichtbar = jahre.filter((j) => j.jahr <= bis);
  const labels = sichtbar.map((j) => j.jahr);
  const jetzt = jahre.find((j) => j.jahr === heute);
  const in10 = jahre.find((j) => j.jahr === heute + 10);
  const steuerJahr = ergebnis.verteilung.some((v) => v.jahr === steuerJahrWahl)
    ? steuerJahrWahl
    : (ergebnis.verteilung.find((v) => v.jahr >= heute) ?? ergebnis.verteilung[0])?.jahr ?? heute;
  const verteilung = ergebnis.verteilung.find((v) => v.jahr === steuerJahr);
  const name = (id: string) => portfolio.objekte.find((o) => o.id === id)?.daten.name ?? id;
  const farbe = (id: string) => FARBEN[portfolio.objekte.findIndex((o) => o.id === id) % FARBEN.length];

  return (
    <>
      <div className="page-head">
        <div className="title-row">
          <h1>Portfolio</h1>
          <div className="row-gap">
            <button type="button" className="btn primary" onClick={() => navigate(href.objekt(neuesObjekt()))}>
              + Neues Objekt
            </button>
            <ConfirmButton
              className="btn danger-outline"
              confirmText="Alle Objekte, Ist-Daten und das Steuerprofil löschen, um mit eigenen Daten neu zu beginnen? Exportiere vorher unter „Daten“, wenn du etwas behalten willst."
              confirmLabel="Ja, alles löschen"
              onConfirm={allesLoeschen}
            >
              Alle Daten löschen
            </ConfirmButton>
          </div>
        </div>
        <p className="muted">
          {portfolio.objekte.length} Objekte · {portfolio.objekte.filter((o) => o.status === "bestand").length} im Bestand ·{" "}
          {portfolio.objekte.filter((o) => o.status === "plan").length} in Planung. Steuer chronologisch nach Kaufdatum verteilt.
        </p>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Immobilienwert {heute}</span>
          <strong>{euro(jetzt?.objektwert ?? 0)}</strong>
        </div>
        <div className="kpi">
          <span>Restschuld {heute}</span>
          <strong>{euro(jetzt?.restschuld ?? 0)}</strong>
        </div>
        <div className="kpi">
          <span>Eigenkapital in Immobilien {heute}</span>
          <strong>{euro(jetzt?.eigenkapital ?? 0)}</strong>
        </div>
        <div className="kpi">
          <span>Cashflow nach Steuern {heute}</span>
          <strong className={tone(jetzt?.cashflowNachSteuern ?? 0)}>{euro((jetzt?.cashflowNachSteuern ?? 0) / 12)} / Monat</strong>
        </div>
        <div className="kpi">
          <span>Eigenkapital in Immobilien {heute + 10}</span>
          <strong>{euro(in10?.eigenkapital ?? 0)}</strong>
        </div>
      </div>

      <section className="card" aria-labelledby="h-entwicklung">
        <div className="row-between">
          <h2 id="h-entwicklung">Vermögensentwicklung</h2>
          <Segmented label="Zeitraum" value={horizont} onChange={setHorizont} options={[10, 20, 30].map((n) => [n, `${n} Jahre`] as [number, string])} />
        </div>
        <p className="muted small">Eigenkapital je Objekt (Immobilienwert − Restschuld), gestapelt. Die gestrichelte Linie markiert {heute}.</p>
        <Chart
          titel="Eigenkapital je Objekt"
          labels={labels}
          stapeln
          markierung={labels.indexOf(heute)}
          serien={ergebnis.objekte.map((o) => ({
            name: name(o.id),
            farbe: farbe(o.id),
            art: "flaeche" as const,
            werte: labels.map((j) => o.jahre.find((y) => y.jahr === j)?.eigenkapital ?? null),
          }))}
        />
        <h3>Cashflow nach Steuern pro Jahr</h3>
        <Chart
          titel="Cashflow nach Steuern je Objekt"
          labels={labels}
          stapeln
          hoehe={220}
          markierung={labels.indexOf(heute)}
          serien={ergebnis.objekte.map((o) => ({
            name: name(o.id),
            farbe: farbe(o.id),
            art: "balken" as const,
            werte: labels.map((j) => o.jahre.find((y) => y.jahr === j)?.cashflowNachSteuern ?? null),
          }))}
        />
      </section>

      <section aria-labelledby="h-objekte">
        <h2 id="h-objekte" className="section-title">
          Objekte
        </h2>
        <div className="object-grid">
          {portfolio.objekte.map((o) => {
            const r = ergebnis.jeId.get(o.id)!;
            const y = r.jahre.find((x) => x.jahr === heute) ?? r.jahre.find((x) => x.monate === 12) ?? r.jahre[0];
            const hz = r.kennzahlenJeHorizont[10];
            return (
              <article className="object-card" key={o.id} style={{ borderTopColor: `var(${farbe(o.id)})` }}>
                <div className="title-row">
                  <h3>
                    <a href={href.objekt(o.id, "ergebnis")}>{o.daten.name || "Ohne Namen"}</a>
                  </h3>
                  <span className={`pill ${o.status}`}>{o.status === "bestand" ? "Bestand" : "Planung"}</span>
                </div>
                <p className="muted small">
                  {[o.daten.ort, `Kauf ${monatText(o.daten.kaufdatum)}`, `Steuer-Rang ${y.steuerRang}`].filter(Boolean).join(" · ")}
                </p>
                <dl>
                  <div>
                    <dt>Gesamtinvestition</dt>
                    <dd>{euro(r.kennzahlen.erwerb.gesamtinvestition)}</dd>
                  </div>
                  <div>
                    <dt>Mietrendite</dt>
                    <dd>{prozent(r.kennzahlen.kennwerte.bruttomietrendite, 2)}</dd>
                  </div>
                  <div>
                    <dt>Cashflow n. St. {y.jahr}</dt>
                    <dd className={tone(y.monatlich.ueberschuss)}>{euro(y.monatlich.ueberschuss)} / Mon.</dd>
                  </div>
                  <div>
                    <dt>Restschuld {y.jahr}</dt>
                    <dd>{euro(y.restschuld)}</dd>
                  </div>
                  {hz && (
                    <div>
                      <dt>EK-Rendite 10 J.</dt>
                      <dd className={tone(hz.ekRendite)}>{prozent(hz.ekRendite, 1)}</dd>
                    </div>
                  )}
                  {o.status === "bestand" && (
                    <div>
                      <dt>Ist-Buchungen</dt>
                      <dd>{o.ist.buchungen.length}</dd>
                    </div>
                  )}
                </dl>
                <div className="card-links">
                  <a href={href.objekt(o.id, "eingaben")}>Eingaben</a>
                  <a href={href.objekt(o.id, "ergebnis")}>Ergebnis</a>
                  <a href={href.objekt(o.id, "ist")}>{o.status === "bestand" ? "Ist & Vergleich" : "Ist-Tracking"}</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card" aria-labelledby="h-jahre">
        <h2 id="h-jahre">Portfolio nach Jahren</h2>
        <div className="table-scroll">
          <table className="simple years-table">
            <thead>
              <tr>
                <th scope="col">Jahr</th>
                <th scope="col">Objekte</th>
                <th scope="col">Mieteinnahmen</th>
                <th scope="col">Bewirtschaftung</th>
                <th scope="col">Zinsen</th>
                <th scope="col">Tilgung</th>
                <th scope="col">Cashflow v. St.</th>
                <th scope="col">Steuerwirkung</th>
                <th scope="col">Cashflow n. St.</th>
                <th scope="col">Immobilienwert</th>
                <th scope="col">Restschuld</th>
                <th scope="col">Eigenkapital</th>
                <th scope="col">zvE ohne → mit</th>
              </tr>
            </thead>
            <tbody>
              {sichtbar.map((j) => (
                <tr key={j.jahr} className={j.jahr === heute ? "current" : undefined}>
                  <th scope="row">{j.jahr}</th>
                  <td>{j.objekte}</td>
                  <td>{euro(j.nettomiete)}</td>
                  <td className="neg">{euro(-j.bewirtschaftung)}</td>
                  <td className="neg">{euro(-j.zinsaufwand)}</td>
                  <td>{euro(-j.tilgungsleistung)}</td>
                  <td className={tone(j.cashflowVorSteuern)}>{euro(j.cashflowVorSteuern)}</td>
                  <td className={tone(j.steuerwirkung)}>{euro(j.steuerwirkung)}</td>
                  <td className={tone(j.cashflowNachSteuern)}>
                    <strong>{euro(j.cashflowNachSteuern)}</strong>
                  </td>
                  <td>{euro(j.objektwert)}</td>
                  <td>{euro(j.restschuld)}</td>
                  <td>
                    <strong>{euro(j.eigenkapital)}</strong>
                  </td>
                  <td>
                    {euro(j.zveBasis)} → {euro(j.zveMitImmobilien)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="h-verteilung">
        <div className="row-between">
          <h2 id="h-verteilung">Steuerverteilung {steuerJahr}</h2>
          <label className="inline">
            Jahr
            <select value={steuerJahr} onChange={(e) => setSteuerJahr(Number(e.target.value))}>
              {ergebnis.verteilung.map((v) => (
                <option key={v.jahr} value={v.jahr}>
                  {v.jahr}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">
          Das zuerst gekaufte Objekt wird auf dein Einkommen ohne Immobilien gerechnet, jedes weitere auf das bereits veränderte Einkommen.
          So bekommt ein später gekauftes Objekt nur die verbleibende Ersparnis.
        </p>
        {verteilung ? (
          <div className="table-scroll compact">
            <table className="simple">
              <thead>
                <tr>
                  <th scope="col">Rang</th>
                  <th scope="col" className="text">
                    Objekt
                  </th>
                  <th scope="col">zvE vorher</th>
                  <th scope="col">Steuerlich wirksames Ergebnis</th>
                  <th scope="col">zvE danach</th>
                  <th scope="col">Steuerwirkung</th>
                </tr>
              </thead>
              <tbody>
                {verteilung.eintraege.map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}.</td>
                    <th scope="row">{name(e.id)}</th>
                    <td>{euro(e.zveVorher)}</td>
                    <td className={tone(e.ergebnis)}>{euro(e.ergebnis)}</td>
                    <td>{euro(Math.max(0, e.zveVorher + e.ergebnis))}</td>
                    <td className={tone(e.ersparnis)}>{euro(e.ersparnis)}</td>
                  </tr>
                ))}
                <tr className="total">
                  <td />
                  <th scope="row">Gesamt</th>
                  <td>{euro(verteilung.zveBasis)}</td>
                  <td>{euro(verteilung.eintraege.reduce((s, e) => s + e.ergebnis, 0))}</td>
                  <td>{euro(Math.max(0, verteilung.zveBasis + verteilung.eintraege.reduce((s, e) => s + e.ergebnis, 0)))}</td>
                  <td>{euro(verteilung.eintraege.reduce((s, e) => s + e.ersparnis, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">In {steuerJahr} gehört dir laut Planung noch kein Objekt.</p>
        )}
      </section>
    </>
  );
}
