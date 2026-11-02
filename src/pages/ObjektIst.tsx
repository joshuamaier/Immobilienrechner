import { useMemo, useState } from "react";
import { rechnePortfolio } from "../domain/calc";
import { uid } from "../domain/presets";
import { IST_KATEGORIEN, istJahre, letztesIstJahr, vergleichJahr, type IstJahr } from "../domain/tracking";
import type { Jahr } from "../domain/portfolio";
import type { IstBuchung, IstKategorie, Objekt, Stichtag } from "../domain/types";
import { href, navigate } from "../state/route";
import { useStore } from "../state/store";
import { Chart } from "../ui/Chart";
import { download } from "../ui/download";
import { ConfirmButton, MonthField, NumberField, Segmented, SelectField, TextField } from "../ui/fields";
import { csv, datumText, euro, monatText, prozent, tone } from "../ui/format";

const KATEGORIE_OPTIONEN = (Object.keys(IST_KATEGORIEN) as IstKategorie[]).map((k) => [k, IST_KATEGORIEN[k].label] as [IstKategorie, string]);

function folgeMonat(objekt: Objekt): string {
  const monate = objekt.ist.buchungen.map((b) => b.datum).filter((d) => d.length === 7).sort();
  const last = monate[monate.length - 1];
  if (!last) return objekt.daten.kaufdatum;
  const [j, m] = last.split("-").map(Number);
  return m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, "0")}`;
}

export function ObjektIst({ objekt }: { objekt: Objekt }) {
  const { alsGekauft } = useStore();
  if (objekt.status !== "bestand") {
    return (
      <section className="card empty">
        <h2>Ist-Tracking startet nach dem Kauf</h2>
        <p>
          Markiere das Objekt als gekauft, sobald es dir gehört. Die aktuellen Eingaben werden dann als Plan eingefroren. Danach kannst du
          echte Mieten, Kosten, Steuererstattungen und Kontostände erfassen, mit dem Plan vergleichen und die Prognose ab dem tatsächlichen
          Stand neu hochrechnen.
        </p>
        <ConfirmButton
          className="btn primary"
          confirmText="Aktuelle Eingaben als Plan einfrieren und Objekt als Bestand führen?"
          confirmLabel="Als gekauft markieren"
          onConfirm={() => alsGekauft(objekt.id)}
        >
          Als gekauft markieren
        </ConfirmButton>
      </section>
    );
  }
  return <IstBestand objekt={objekt} />;
}

function IstBestand({ objekt }: { objekt: Objekt }) {
  const { portfolio, ergebnis, updateObjekt, planNeuFestlegen } = useStore();
  const aktuell = ergebnis.jeId.get(objekt.id)!;
  const plan = useMemo(() => rechnePortfolio(portfolio, { [objekt.id]: "plan" }).jeId.get(objekt.id)!, [portfolio, objekt.id]);
  const ist = useMemo(() => istJahre(objekt.ist.buchungen, objekt.daten.kaufdatum), [objekt]);
  const istJahreListe = [...ist.keys()].sort((a, b) => b - a);
  const letztes = letztesIstJahr(objekt);
  const [horizont, setHorizont] = useState(20);
  const [vergleichsJahr, setVergleichsJahr] = useState<number | null>(null);
  const vj = vergleichsJahr ?? istJahreListe[0] ?? null;

  const setIst = (fn: (b: { buchungen: IstBuchung[]; stichtage: Stichtag[] }) => { buchungen: IstBuchung[]; stichtage: Stichtag[] }) =>
    updateObjekt(objekt.id, (o) => ({ ...o, ist: fn(o.ist) }));

  const n = Math.min(horizont, aktuell.jahre.length, plan.jahre.length);
  const labels = aktuell.jahre.slice(0, n).map((y) => y.jahr);
  const letzterIndex = letztes !== null ? labels.indexOf(letztes) : -1;
  const pAt = plan.jahre[n - 1];
  const aAt = aktuell.jahre[n - 1];

  return (
    <>
      <section className="card" aria-labelledby="h-hoch">
        <div className="row-between">
          <h2 id="h-hoch">Plan und neue Hochrechnung</h2>
          <Segmented
            label="Zeitraum"
            value={horizont}
            onChange={setHorizont}
            options={[10, 20, 30].map((x) => [x, `${x} Jahre`] as [number, string])}
          />
        </div>
        <p className="muted">
          {letztes !== null
            ? `Bis ${letztes} aus Ist-Daten, danach hochgerechnet ab dem letzten bekannten Stand (Restschuld, Marktwert, Miete, Kostenniveau).`
            : "Noch keine Ist-Daten erfasst: Die Hochrechnung entspricht den aktuellen Eingaben."}
        </p>
        <div className="compare-kpis">
          {[
            ["Aufgebautes Vermögen", pAt.aufgebautesVermoegen, aAt.aufgebautesVermoegen],
            ["Restschuld", pAt.restschuld, aAt.restschuld],
            ["Kumulierter Cashflow nach Steuern", pAt.kumulierterCashflow, aAt.kumulierterCashflow],
            ["Immobilienwert", pAt.objektwert, aAt.objektwert],
          ].map(([label, p, a]) => {
            const diff = (a as number) - (p as number);
            const besser = label === "Restschuld" ? diff <= 0 : diff >= 0;
            return (
              <div className="compare" key={label as string}>
                <span>
                  {label} {aAt.jahr}
                </span>
                <strong>{euro(a as number)}</strong>
                <em>
                  Plan {euro(p as number)} · <b className={besser ? "pos" : "neg"}>{`${diff >= 0 ? "+" : ""}${euro(diff)}`}</b>
                </em>
              </div>
            );
          })}
        </div>
        <Chart
          titel="Aufgebautes Vermögen: Plan und Hochrechnung"
          labels={labels}
          markierung={letzterIndex}
          serien={[
            { name: "Ursprünglicher Plan", farbe: "--c5", art: "linie", gestrichelt: true, werte: plan.jahre.slice(0, n).map((y) => y.aufgebautesVermoegen) },
            { name: "Ist + Hochrechnung", farbe: "--c1", art: "linie", werte: aktuell.jahre.slice(0, n).map((y) => y.aufgebautesVermoegen) },
          ]}
        />
        <h3>Cashflow nach Steuern pro Jahr</h3>
        <Chart
          titel="Cashflow nach Steuern: Plan und Ist"
          labels={labels}
          markierung={letzterIndex}
          hoehe={220}
          serien={[
            { name: "Plan", farbe: "--c5", art: "balken", werte: plan.jahre.slice(0, n).map((y) => y.cashflowNachSteuern) },
            { name: "Ist + Hochrechnung", farbe: "--c1", art: "balken", werte: aktuell.jahre.slice(0, n).map((y) => y.cashflowNachSteuern) },
          ]}
        />
      </section>

      {vj !== null && ist.get(vj) && (
        <section className="card" aria-labelledby="h-vergleich">
          <div className="row-between">
            <h2 id="h-vergleich">Plan-Ist-Vergleich {vj}</h2>
            <label className="inline">
              Jahr
              <select value={vj} onChange={(e) => setVergleichsJahr(Number(e.target.value))}>
                {istJahreListe.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <VergleichsTabelle objekt={objekt} jahr={vj} planJahre={plan.jahre} ist={ist.get(vj)!} />
        </section>
      )}

      <section className="card" aria-labelledby="h-erfassung">
        <h2 id="h-erfassung">Ist-Werte erfassen</h2>
        <MonatErfassen objekt={objekt} onSave={(neu) => setIst((i) => ({ ...i, buchungen: [...i.buchungen, ...neu] }))} />
        <EinzelBuchung onSave={(b) => setIst((i) => ({ ...i, buchungen: [...i.buchungen, b] }))} />
        <BuchungsListe
          objekt={objekt}
          onDelete={(id) => setIst((i) => ({ ...i, buchungen: i.buchungen.filter((b) => b.id !== id) }))}
          onChange={(id, betrag) => setIst((i) => ({ ...i, buchungen: i.buchungen.map((b) => (b.id === id ? { ...b, betrag } : b)) }))}
        />
      </section>

      <section className="card" aria-labelledby="h-stichtage">
        <h2 id="h-stichtage">Stichtage</h2>
        <p className="muted">
          Restschuld laut Bank, geschätzter Marktwert und aktuelle Kaltmiete. Die Hochrechnung startet ab dem jüngsten Wert jeder Angabe.
        </p>
        <StichtagFormular onSave={(s) => setIst((i) => ({ ...i, stichtage: [...i.stichtage, s] }))} />
        {objekt.ist.stichtage.length > 0 && (
          <div className="table-scroll compact">
            <table className="simple">
              <thead>
                <tr>
                  <th scope="col">Datum</th>
                  <th scope="col">Restschuld</th>
                  <th scope="col">Marktwert</th>
                  <th scope="col">Kaltmiete</th>
                  <th scope="col" className="text">
                      Notiz
                    </th>
                  <th scope="col">
                    <span className="sr-only">Aktion</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...objekt.ist.stichtage]
                  .sort((a, b) => b.datum.localeCompare(a.datum))
                  .map((s) => (
                    <tr key={s.id}>
                      <th scope="row">{datumText(s.datum)}</th>
                      <td>{s.restschuld !== null ? euro(s.restschuld) : "–"}</td>
                      <td>{s.marktwert !== null ? euro(s.marktwert) : "–"}</td>
                      <td>{s.miete !== null ? euro(s.miete) : "–"}</td>
                      <td className="note-cell">{s.notiz}</td>
                      <td>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => setIst((i) => ({ ...i, stichtage: i.stichtage.filter((x) => x.id !== s.id) }))}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="h-plan">
        <h2 id="h-plan">Plan-Stand</h2>
        <p className="muted">
          Der Vergleich nutzt die beim Kauf eingefrorenen Eingaben. Wenn du den Plan bewusst neu aufsetzen willst (z. B. nach einer
          Anschlussfinanzierung), übernimm die aktuellen Eingaben als neuen Plan.
        </p>
        <div className="row-gap">
          <a className="btn" href={href.objekt(objekt.id, "eingaben")}>
            Annahmen der Hochrechnung bearbeiten
          </a>
          <ConfirmButton
            confirmText="Aktuelle Eingaben als neuen Plan übernehmen? Der bisherige Plan-Stand wird überschrieben."
            confirmLabel="Plan neu festlegen"
            onConfirm={() => {
              planNeuFestlegen(objekt.id);
              navigate(href.objekt(objekt.id, "ist"));
            }}
          >
            Plan neu festlegen
          </ConfirmButton>
        </div>
      </section>
    </>
  );
}

function VergleichsTabelle({
  objekt,
  jahr,
  planJahre,
  ist,
}: {
  objekt: Objekt;
  jahr: number;
  planJahre: Jahr[];
  ist: IstJahr;
}) {
  const py = planJahre.find((y) => y.jahr === jahr);
  if (!py) return <p className="muted">Für {jahr} gibt es keinen Planwert.</p>;
  const zeilen = vergleichJahr({ y: py, steuerwirkung: py.steuerwirkung }, ist);
  const vorzeichen: Record<string, number> = { miete: 1, steuer: 1 };
  const cfPlan = zeilen.reduce((s, z) => s + (vorzeichen[z.key] ?? -1) * z.plan, 0);
  const cfIst = zeilen.reduce((s, z) => s + (vorzeichen[z.key] ?? -1) * (z.ist ?? z.plan), 0);
  const teil = ist.abgedeckteMonate < py.monate;
  return (
    <>
      {teil && (
        <p className="note">
          {ist.abgedeckteMonate} von {py.monate} Monaten erfasst. Planwerte sind anteilig auf diese Monate gerechnet; die Steuer ist der
          Jahreswert.
        </p>
      )}
      <div className="table-scroll compact">
        <table className="simple compare-table">
          <thead>
            <tr>
              <th scope="col">Position</th>
              <th scope="col">Plan</th>
              <th scope="col">Ist</th>
              <th scope="col">Abweichung</th>
              <th scope="col">in %</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => {
              const sign = vorzeichen[z.key] ?? -1;
              const diff = z.ist !== null ? z.ist - z.plan : null;
              const gut = diff === null ? null : sign * diff >= 0;
              return (
                <tr key={z.key}>
                  <th scope="row">{z.label}</th>
                  <td>{euro(z.plan)}</td>
                  <td>{z.ist !== null ? euro(z.ist) : <span className="muted">nicht erfasst</span>}</td>
                  <td className={gut === null ? "" : gut ? "pos" : "neg"}>{diff !== null ? `${diff >= 0 ? "+" : ""}${euro(diff)}` : "–"}</td>
                  <td>{diff !== null && Math.abs(z.plan) > 1 ? prozent((diff / Math.abs(z.plan)) * 100, 0) : "–"}</td>
                </tr>
              );
            })}
            <tr className="total">
              <th scope="row">Cashflow nach Steuern</th>
              <td>{euro(cfPlan)}</td>
              <td>{euro(cfIst)}</td>
              <td className={tone(cfIst - cfPlan)}>{`${cfIst - cfPlan >= 0 ? "+" : ""}${euro(cfIst - cfPlan)}`}</td>
              <td>{Math.abs(cfPlan) > 1 ? prozent(((cfIst - cfPlan) / Math.abs(cfPlan)) * 100, 0) : "–"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Nicht erfasste Positionen gehen mit dem Planwert in den Ist-Cashflow ein. Grün: besser als geplant. Objekt: {objekt.daten.name}.
      </p>
    </>
  );
}

function MonatErfassen({ objekt, onSave }: { objekt: Objekt; onSave: (b: IstBuchung[]) => void }) {
  const letzte = (k: IstKategorie, fallback: number) => {
    const b = [...objekt.ist.buchungen].filter((x) => x.kategorie === k && x.datum.length === 7).sort((a, c) => c.datum.localeCompare(a.datum))[0];
    return b ? b.betrag : Math.round(fallback * 100) / 100;
  };
  const d = objekt.daten;
  const [monat, setMonat] = useState(() => folgeMonat(objekt));
  const [werte, setWerte] = useState<Record<string, number | null>>(() => ({
    miete: letzte("miete", d.miete.kaltmiete),
    hausgeld: letzte("hausgeld", d.kosten.hausgeld),
    ruecklage: letzte("ruecklage", d.kosten.ruecklage),
    verwaltung: letzte("verwaltung", d.kosten.verwaltung),
  }));
  const [meldung, setMeldung] = useState("");
  const felder: [IstKategorie, string][] = [
    ["miete", "Mieteingang"],
    ["hausgeld", "Hausgeld (nicht uml.)"],
    ["ruecklage", "Rücklage"],
    ["verwaltung", "Verwaltung"],
  ];
  return (
    <form
      className="subcard"
      onSubmit={(e) => {
        e.preventDefault();
        const neu = felder
          .filter(([k]) => werte[k] !== null && werte[k] !== undefined)
          .map(([k]) => ({ id: uid(), datum: monat, kategorie: k, betrag: werte[k] as number, notiz: "" }));
        if (!neu.length) return;
        onSave(neu);
        setMeldung(`${monatText(monat)} gespeichert.`);
        const [j, m] = monat.split("-").map(Number);
        setMonat(m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, "0")}`);
      }}
    >
      <h3>Monat erfassen</h3>
      <p className="muted small">Vorbelegt mit den zuletzt erfassten Werten. Leere Felder werden nicht gespeichert.</p>
      <div className="grid inputs">
        <MonthField label="Monat" value={monat} onChange={setMonat} />
        {felder.map(([k, label]) => (
          <NumberField key={k} label={label} unit="€" nullable value={werte[k] ?? null} onChange={(v) => setWerte((w) => ({ ...w, [k]: v }))} />
        ))}
      </div>
      <div className="row-gap">
        <button type="submit" className="btn primary">
          Monat speichern
        </button>
        {meldung && (
          <span className="saved" role="status">
            {meldung}
          </span>
        )}
      </div>
    </form>
  );
}

function EinzelBuchung({ onSave }: { onSave: (b: IstBuchung) => void }) {
  const [art, setArt] = useState<"monat" | "jahr">("jahr");
  const jetzt = new Date();
  const [monat, setMonat] = useState(`${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}`);
  const [jahr, setJahr] = useState<number | null>(jetzt.getFullYear() - 1);
  const [kategorie, setKategorie] = useState<IstKategorie>("instandhaltung");
  const [betrag, setBetrag] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  const [meldung, setMeldung] = useState("");
  return (
    <form
      className="subcard"
      onSubmit={(e) => {
        e.preventDefault();
        if (betrag === null || (art === "jahr" && !jahr)) {
          setMeldung("Bitte Betrag und Zeitraum angeben.");
          return;
        }
        onSave({ id: uid(), datum: art === "jahr" ? String(jahr) : monat, kategorie, betrag, notiz });
        setBetrag(null);
        setNotiz("");
        setMeldung(`${IST_KATEGORIEN[kategorie].label} gespeichert.`);
      }}
    >
      <h3>Einzelne Buchung oder Jahressumme</h3>
      <p className="muted small">Für Reparaturen, Sonderumlagen, Steuererstattungen, Sondertilgungen oder ganze Jahre aus der Abrechnung.</p>
      <div className="grid inputs">
        <SelectField
          label="Zeitraum"
          value={art}
          options={[
            ["jahr", "Jahressumme"],
            ["monat", "Einzelner Monat"],
          ]}
          onChange={setArt}
        />
        {art === "jahr" ? (
          <NumberField label="Jahr" value={jahr} nullable onChange={(v) => setJahr(v === null ? null : Math.round(v))} />
        ) : (
          <MonthField label="Monat" value={monat} onChange={setMonat} />
        )}
        <SelectField label="Kategorie" value={kategorie} options={KATEGORIE_OPTIONEN} onChange={setKategorie} />
        <NumberField
          label="Betrag"
          unit="€"
          nullable
          value={betrag}
          onChange={setBetrag}
          hint={kategorie === "steuer" ? "Erstattung positiv, Nachzahlung negativ" : "Positiv eingeben"}
        />
        <TextField label="Notiz" value={notiz} onChange={setNotiz} wide />
      </div>
      <div className="row-gap">
        <button type="submit" className="btn primary">
          Buchung hinzufügen
        </button>
        {meldung && (
          <span className="saved" role="status">
            {meldung}
          </span>
        )}
      </div>
    </form>
  );
}

function BuchungsListe({ objekt, onDelete, onChange }: { objekt: Objekt; onDelete: (id: string) => void; onChange: (id: string, betrag: number) => void }) {
  const nachJahr = new Map<string, IstBuchung[]>();
  for (const b of objekt.ist.buchungen) {
    const j = b.datum.slice(0, 4);
    nachJahr.set(j, [...(nachJahr.get(j) ?? []), b]);
  }
  const jahre = [...nachJahr.keys()].sort((a, b) => b.localeCompare(a));
  if (!jahre.length) return <p className="muted">Noch keine Buchungen erfasst.</p>;
  const exportCsv = () => {
    const rows = [...objekt.ist.buchungen]
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map((b) => [b.datum, IST_KATEGORIEN[b.kategorie].label, b.betrag, b.notiz]);
    download(`${objekt.daten.name.replace(/[^\wäöüÄÖÜß-]+/g, "-")}-ist.csv`, csv([["Datum", "Kategorie", "Betrag", "Notiz"], ...rows]), "text/csv");
  };
  return (
    <div className="buchungen">
      <div className="row-between">
        <h3>Erfasste Buchungen</h3>
        <button type="button" className="btn small" onClick={exportCsv}>
          Als CSV exportieren
        </button>
      </div>
      {jahre.map((j, idx) => {
        const liste = nachJahr.get(j)!.sort((a, b) => a.datum.localeCompare(b.datum) || a.kategorie.localeCompare(b.kategorie));
        return (
          <details key={j} open={idx === 0}>
            <summary>
              {j} <span className="muted">· {liste.length} Buchungen</span>
            </summary>
            <div className="table-scroll compact">
              <table className="simple">
                <thead>
                  <tr>
                    <th scope="col">Zeitraum</th>
                    <th scope="col" className="text">
                      Kategorie
                    </th>
                    <th scope="col">Betrag</th>
                    <th scope="col" className="text">
                      Notiz
                    </th>
                    <th scope="col">
                      <span className="sr-only">Aktion</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((b) => (
                    <tr key={b.id}>
                      <th scope="row">{b.datum.length === 4 ? `Jahr ${b.datum}` : monatText(b.datum)}</th>
                      <td className="text">{IST_KATEGORIEN[b.kategorie].label}</td>
                      <td>
                        <InlineBetrag value={b.betrag} label={`Betrag ${IST_KATEGORIEN[b.kategorie].label} ${b.datum}`} onChange={(v) => onChange(b.id, v)} />
                      </td>
                      <td className="note-cell">{b.notiz}</td>
                      <td>
                        <button type="button" className="btn small" onClick={() => onDelete(b.id)}>
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function InlineBetrag({ value, label, onChange }: { value: number; label: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value).replace(".", ","));
  return (
    <input
      className="inline-number"
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = Number(text.replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(n) && text.trim() !== "") onChange(n);
        else setText(String(value).replace(".", ","));
      }}
    />
  );
}

function StichtagFormular({ onSave }: { onSave: (s: Stichtag) => void }) {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [restschuld, setRestschuld] = useState<number | null>(null);
  const [marktwert, setMarktwert] = useState<number | null>(null);
  const [miete, setMiete] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  const [meldung, setMeldung] = useState("");
  return (
    <form
      className="subcard"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || (restschuld === null && marktwert === null && miete === null)) {
          setMeldung("Bitte ein Datum und mindestens einen Wert angeben.");
          return;
        }
        onSave({ id: uid(), datum, restschuld, marktwert, miete, notiz });
        setRestschuld(null);
        setMarktwert(null);
        setMiete(null);
        setNotiz("");
        setMeldung(`Stichtag ${datumText(datum)} gespeichert.`);
      }}
    >
      <div className="grid inputs">
        <div className="field">
          <label className="field-label" htmlFor="stichtag-datum">
            Datum
          </label>
          <input id="stichtag-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <NumberField label="Restschuld laut Bank" unit="€" nullable value={restschuld} onChange={setRestschuld} />
        <NumberField label="Marktwert (Schätzung)" unit="€" nullable value={marktwert} onChange={setMarktwert} />
        <NumberField label="Aktuelle Kaltmiete" unit="€/Monat" nullable value={miete} onChange={setMiete} />
        <TextField label="Notiz" value={notiz} onChange={setNotiz} wide />
      </div>
      <div className="row-gap">
        <button type="submit" className="btn primary">
          Stichtag speichern
        </button>
        {meldung && (
          <span className="saved" role="status">
            {meldung}
          </span>
        )}
      </div>
    </form>
  );
}
