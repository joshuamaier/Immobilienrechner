import type { Steuerprofil } from "../domain/types";
import { kirchensteuerSatz, grenzsteuersatz, steuerlast, verheiratetImJahr, zveFuerJahr } from "../domain/tax";
import { useStore } from "../state/store";
import { Chart } from "../ui/Chart";
import { CheckField, NumberField, SelectField } from "../ui/fields";
import { euro, monatText, prozent } from "../ui/format";
import { href } from "../state/route";

export function SteuerprofilSeite() {
  const { portfolio, ergebnis, setSteuerprofil } = useStore();
  const p = portfolio.steuerprofil;
  const upd = (fn: (s: Steuerprofil) => void) => {
    const s = structuredClone(p);
    fn(s);
    setSteuerprofil(s);
  };
  const heute = new Date().getFullYear();
  const jahre = Array.from({ length: 30 }, (_, i) => heute + i);
  const church = kirchensteuerSatz(p);
  const zveHeute = zveFuerJahr(p, heute);
  const verheiratetHeute = verheiratetImJahr(p, heute);
  const reihenfolge = [...portfolio.objekte].sort((a, b) => a.daten.kaufdatum.localeCompare(b.daten.kaufdatum));
  const leer = p.einkommen.every((e) => !e.zve);

  return (
    <>
      <div className="page-head">
        <h1>Steuerprofil</h1>
        <p className="muted">Gilt für alle Objekte. Die Steuerwirkung wird Jahr für Jahr chronologisch auf die Objekte verteilt.</p>
      </div>
      {leer && <p className="note">Trage dein zu versteuerndes Einkommen ein, sonst rechnet der Rechner ohne Steuerersparnis.</p>}

      <div className="inputs-layout">
        <div className="inputs-main">
          <section className="card" aria-labelledby="h-einkommen">
            <h2 id="h-einkommen">Zu versteuerndes Einkommen ohne Immobilien</h2>
            <p className="muted small">
              Lege Stufen an, z. B. für eine Gehaltserhöhung, Elternzeit oder den Ruhestand. Jede Stufe gilt ab ihrem Jahr und wächst mit der
              jährlichen Steigerung. Vor der ersten Stufe gilt deren Betrag.
            </p>
            <div className="stufen">
              {p.einkommen.map((e, i) => (
                <div className="stufe" key={i}>
                  <NumberField label="Ab Jahr" value={e.abJahr} onChange={(v) => upd((s) => void (s.einkommen[i].abJahr = Math.round(v ?? heute)))} />
                  <NumberField label="Zu versteuerndes Einkommen" unit="€/Jahr" value={e.zve} min={0} onChange={(v) => upd((s) => void (s.einkommen[i].zve = v ?? 0))} />
                  {p.einkommen.length > 1 && (
                    <button type="button" className="btn small" onClick={() => upd((s) => void s.einkommen.splice(i, 1))}>
                      Entfernen
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="row-gap">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  upd((s) => {
                    const last = [...s.einkommen].sort((a, b) => a.abJahr - b.abJahr).pop();
                    s.einkommen.push({ abJahr: (last?.abJahr ?? heute) + 5, zve: last?.zve ?? 0 });
                  })
                }
              >
                + Stufe hinzufügen
              </button>
            </div>
            <div className="grid inputs">
              <NumberField
                label="Jährliche Steigerung"
                unit="% p.a."
                value={p.einkommenSteigerung}
                onChange={(v) => upd((s) => void (s.einkommenSteigerung = v ?? 0))}
                hint="Ab Beginn jeder Stufe"
              />
            </div>
          </section>

          <section className="card" aria-labelledby="h-familie">
            <h2 id="h-familie">Familienstand &amp; Kirchensteuer</h2>
            <div className="stufen">
              {p.verheiratet.map((e, i) => (
                <div className="stufe" key={i}>
                  <NumberField label="Ab Jahr" value={e.abJahr} onChange={(v) => upd((s) => void (s.verheiratet[i].abJahr = Math.round(v ?? heute)))} />
                  <SelectField
                    label="Veranlagung"
                    value={e.wert ? "ja" : "nein"}
                    options={[
                      ["nein", "Einzelveranlagung (Grundtarif)"],
                      ["ja", "Zusammenveranlagung (Splitting)"],
                    ]}
                    onChange={(v) => upd((s) => void (s.verheiratet[i].wert = v === "ja"))}
                  />
                  {p.verheiratet.length > 1 && (
                    <button type="button" className="btn small" onClick={() => upd((s) => void s.verheiratet.splice(i, 1))}>
                      Entfernen
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => upd((s) => void s.verheiratet.push({ abJahr: heute + 1, wert: !s.verheiratet[s.verheiratet.length - 1]?.wert }))}
            >
              + Änderung hinzufügen
            </button>
            <div className="grid inputs">
              <CheckField label="Kirchensteuerpflichtig" checked={p.kirchensteuer} onChange={(v) => upd((s) => void (s.kirchensteuer = v))} />
              {p.kirchensteuer && (
                <SelectField
                  label="Kirchensteuersatz"
                  value={p.kirchensteuerSatz}
                  options={[
                    [8, "8 % (Bayern, Baden-Württemberg)"],
                    [9, "9 % (übrige Länder)"],
                  ]}
                  onChange={(v) => upd((s) => void (s.kirchensteuerSatz = v))}
                />
              )}
              <CheckField
                wide
                label="Lohnsteuerermäßigung (§39a EStG) beantragt"
                hint="Laufende Verluste mindern sofort die Lohnsteuer; Einmalabzüge kommen mit der Steuererklärung im Folgejahr. Ohne Antrag fließt die ganze Ersparnis erst im Folgejahr."
                checked={p.lohnsteuerermaessigung}
                onChange={(v) => upd((s) => void (s.lohnsteuerermaessigung = v))}
              />
            </div>
          </section>

          <section className="card" aria-labelledby="h-verlauf">
            <h2 id="h-verlauf">Einkommen und Wirkung der Immobilien</h2>
            <Chart
              titel="Zu versteuerndes Einkommen"
              labels={jahre}
              serien={[
                { name: "Ohne Immobilien", farbe: "--c5", art: "linie", werte: jahre.map((j) => zveFuerJahr(p, j)) },
                {
                  name: "Mit allen Objekten",
                  farbe: "--c1",
                  art: "linie",
                  werte: jahre.map((j) => ergebnis.jahre.find((x) => x.jahr === j)?.zveMitImmobilien ?? zveFuerJahr(p, j)),
                },
              ]}
            />
          </section>
        </div>

        <aside className="summary-panel" aria-label="Steuer heute">
          <h2>Steuer {heute}</h2>
          <dl>
            <div>
              <dt>Zu versteuerndes Einkommen</dt>
              <dd>{euro(zveHeute)}</dd>
            </div>
            <div>
              <dt>Steuerlast inkl. Soli/KiSt</dt>
              <dd>{euro(steuerlast(zveHeute, verheiratetHeute, church))}</dd>
            </div>
            <div>
              <dt>Grenzsteuersatz</dt>
              <dd>{prozent(grenzsteuersatz(zveHeute, verheiratetHeute, church))}</dd>
            </div>
          </dl>
          <h3>Reihenfolge der Steuerverteilung</h3>
          {reihenfolge.length ? (
            <ol className="rank-list">
              {reihenfolge.map((o) => (
                <li key={o.id}>
                  <a href={href.objekt(o.id, "ergebnis")}>{o.daten.name}</a>
                  <span className="muted small"> · {monatText(o.daten.kaufdatum)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">Noch keine Objekte.</p>
          )}
        </aside>
      </div>
    </>
  );
}
