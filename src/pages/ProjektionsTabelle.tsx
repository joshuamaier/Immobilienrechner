import { useState } from "react";
import type { Jahr, ObjektErgebnis } from "../domain/portfolio";
import { download } from "../ui/download";
import { csv, euro, minus, plus, tone } from "../ui/format";

type Zeile = {
  id?: string;
  label: string;
  /** Wert der Investitionsspalte (Jahr 0) */
  invest?: (r: ObjektErgebnis) => string;
  cell: (y: Jahr) => string;
  wert?: (y: Jahr) => number;
  sum: (ys: Jahr[], r: ObjektErgebnis) => string;
  cls?: (y: Jahr) => string;
  total?: boolean;
  bold?: boolean;
  show?: (r: ObjektErgebnis, ys: Jahr[]) => boolean;
  children?: Zeile[];
};

const summe = (ys: Jahr[], f: (y: Jahr) => number) => ys.reduce((s, y) => s + (f(y) || 0), 0);
const letztes = (ys: Jahr[]) => ys[ys.length - 1];
const neg = () => "neg";

function kostenZeile(label: string, f: (y: Jahr) => number, show?: Zeile["show"]): Zeile {
  return { label, cls: neg, cell: (y) => minus(f(y)), wert: (y) => -f(y), sum: (ys) => minus(summe(ys, f)), show };
}

function zeilen(r: ObjektErgebnis): Zeile[] {
  const darlehensplaene = r.kennzahlen.kapitaldienst.darlehensplaene;
  const mehrereDarlehen = darlehensplaene.length > 1;
  return [
    {
      id: "anfang",
      label: "Kapitaleinsatz beim Kauf",
      invest: (r) => euro(r.kennzahlen.nebenkosten.eigenkapitalEinsatz),
      cell: () => "–",
      sum: (_, r) => euro(r.kennzahlen.nebenkosten.eigenkapitalEinsatz),
      children: [
        { label: "Eigenkapital", invest: (r) => euro(r.kennzahlen.erwerb.eigenkapitalBetrag), cell: () => "–", sum: (_, r) => euro(r.kennzahlen.erwerb.eigenkapitalBetrag) },
        {
          label: "+ Ungedeckter Finanzierungsbedarf",
          show: (r) => r.kennzahlen.kapitaldienst.finanzierungsluecke > 1,
          invest: (r) => euro(r.kennzahlen.kapitaldienst.finanzierungsluecke),
          cell: () => "–",
          sum: (_, r) => euro(r.kennzahlen.kapitaldienst.finanzierungsluecke),
        },
        { label: "+ Maklerprovision", show: (r) => r.kennzahlen.nebenkosten.maklerprovision > 0, invest: (r) => euro(r.kennzahlen.nebenkosten.maklerprovision), cell: () => "–", sum: (_, r) => euro(r.kennzahlen.nebenkosten.maklerprovision) },
        { label: "+ Grunderwerbsteuer", invest: (r) => euro(r.kennzahlen.nebenkosten.grunderwerbsteuer), cell: () => "–", sum: (_, r) => euro(r.kennzahlen.nebenkosten.grunderwerbsteuer) },
        { label: "+ Notar & Grundbuch", invest: (r) => euro(r.kennzahlen.nebenkosten.notarUndGrundbuch), cell: () => "–", sum: (_, r) => euro(r.kennzahlen.nebenkosten.notarUndGrundbuch) },
        { label: "= Eingesetztes Kapital", bold: true, invest: (r) => euro(r.kennzahlen.nebenkosten.eigenkapitalEinsatz), cell: () => "–", sum: (_, r) => euro(r.kennzahlen.nebenkosten.eigenkapitalEinsatz) },
      ],
    },
    {
      id: "miete",
      label: "Mieteinnahmen",
      cell: (y) => euro(y.nettomiete),
      wert: (y) => y.nettomiete,
      sum: (ys) => euro(summe(ys, (y) => y.nettomiete)),
      children: [
        { label: "Bruttomiete", cell: (y) => euro(y.bruttomiete), sum: (ys) => euro(summe(ys, (y) => y.bruttomiete)) },
        { label: "Mietausfall", show: (_, ys) => ys.some((y) => y.mietausfall > 0), cls: neg, cell: (y) => minus(y.mietausfall), sum: (ys) => minus(summe(ys, (y) => y.mietausfall)) },
      ],
    },
    {
      ...kostenZeile("Bewirtschaftungskosten", (y) => y.bewirtschaftung),
      id: "bewirtschaftung",
      children: [
        kostenZeile("SEV (Mietverwaltung)", (y) => y.verwaltungskosten),
        kostenZeile("Instandhaltungsrücklage", (y) => y.ruecklagen),
        kostenZeile("Hausgeld (nicht umlagefähig)", (y) => y.hausgeldkosten),
        kostenZeile("Reparaturen & Sonstiges (Ist)", (y) => y.sonstigeAusgaben, (_, ys) => ys.some((y) => y.sonstigeAusgaben > 0)),
      ],
    },
    {
      label: "Cashflow vor Finanzierung",
      total: true,
      cls: (y) => tone(y.cashflowVorFinanzierung),
      cell: (y) => euro(y.cashflowVorFinanzierung),
      wert: (y) => y.cashflowVorFinanzierung,
      sum: (ys) => euro(summe(ys, (y) => y.cashflowVorFinanzierung)),
    },
    {
      ...kostenZeile("Finanzierung", (y) => y.kapitaldienst),
      id: "finanzierung",
      children: [
        kostenZeile("Zinsanteil", (y) => y.zinsaufwand),
        kostenZeile("Tilgungsanteil", (y) => y.tilgungsleistung),
        kostenZeile("Bereitstellungszinsen", (y) => y.bereitstellungszinsenJahr, (_, ys) => ys.some((y) => y.bereitstellungszinsenJahr > 0)),
        ...(mehrereDarlehen
          ? darlehensplaene.flatMap((l, i) => [
              kostenZeile(`· ${l.name}: Zins`, (y) => y.darlehen[i]?.zinsen ?? 0),
              kostenZeile(`· ${l.name}: Tilgung`, (y) => (y.darlehen[i]?.tilgung ?? 0) + (y.darlehen[i]?.sondertilgung ?? 0)),
            ])
          : []),
        { label: "Sollzins", cell: (y) => y.darlehen.map((d) => `${d.zinssatz.toLocaleString("de-DE")} %`).join(" / "), sum: () => "–" },
      ],
    },
    {
      label: "Cashflow vor Steuern",
      total: true,
      cls: (y) => tone(y.cashflowVorSteuern),
      cell: (y) => euro(y.cashflowVorSteuern),
      wert: (y) => y.cashflowVorSteuern,
      sum: (ys) => euro(summe(ys, (y) => y.cashflowVorSteuern)),
    },
    {
      id: "abschreibung",
      label: "Abschreibungen & Steuern",
      cls: (y) => tone(y.steuerlichesErgebnis),
      cell: (y) => euro(y.steuerlichesErgebnis),
      wert: (y) => y.steuerlichesErgebnis,
      sum: (ys) => euro(summe(ys, (y) => y.steuerlichesErgebnis)),
      children: [
        { label: "Cashflow vor Steuern", cell: (y) => euro(y.cashflowVorSteuern), sum: (ys) => euro(summe(ys, (y) => y.cashflowVorSteuern)) },
        {
          label: "+ Tilgungsanteil (nicht abzugsfähig)",
          cls: () => "pos",
          cell: (y) => `+${euro(y.tilgungsleistung)}`,
          sum: (ys) => `+${euro(summe(ys, (y) => y.tilgungsleistung))}`,
        },
        kostenZeile(r.kennzahlen.steuerbasis.denkmalBasis > 0 ? "- AfA Altbausubstanz" : "- AfA Gebäude", (y) => y.afaGebaeude),
        kostenZeile("- Denkmal-AfA (§7i/§7h)", (y) => y.afaDenkmal, (r) => r.kennzahlen.steuerbasis.denkmalBasis > 0),
        kostenZeile("- AfA Möbel", (y) => y.afaMoebel, (r) => r.kennzahlen.erwerb.moebel > 0),
        kostenZeile("- Grundschuldkosten", (y) => y.abzugGrundschuld, (r) => r.kennzahlen.nebenkosten.grundschuldkosten > 0),
      ],
    },
    {
      id: "steuer",
      label: "Steuerwirkung",
      cls: (y) => tone(y.steuerwirkung),
      invest: () => plus(0),
      cell: (y) => plus(y.steuerwirkung),
      wert: (y) => y.steuerwirkung,
      sum: (ys) => euro(summe(ys, (y) => y.steuerwirkung)),
      children: [
        {
          label: "Sofort (Lohnsteuerermäßigung)",
          cell: (y) => plus(y.steuerwirkungSofort),
          sum: (ys) => plus(summe(ys, (y) => y.steuerwirkungSofort)),
        },
        { label: "Steuererstattung für das Vorjahr", cell: (y) => plus(y.steuerwirkungVorjahr), sum: (ys) => plus(summe(ys, (y) => y.steuerwirkungVorjahr)) },
        {
          label: "Ist-Steuer statt Modell",
          show: (_, ys) => ys.some((y) => y.ist?.steuer != null),
          cell: (y) => (y.ist?.steuer != null ? `${plus(y.steuerwirkung)} (Modell ${plus(y.steuerwirkungModell)})` : "–"),
          sum: () => "–",
        },
        { label: "Reihenfolge in der Steuerverteilung", cell: (y) => `${y.steuerRang}.`, sum: () => "–" },
        { label: "Zu versteuerndes Einkommen (vorher)", cell: (y) => euro(y.zveOhneImmobilien), sum: () => "–" },
        { label: "Zu versteuerndes Einkommen (mit Objekt)", cell: (y) => euro(y.zveInklImmobilien), sum: () => "–" },
        { label: "Steuerlast inkl. Soli/KiSt (vorher)", cell: (y) => euro(y.steuerOhneImmobilien), sum: () => "–" },
        { label: "Steuerlast inkl. Soli/KiSt (mit Objekt)", cell: (y) => euro(y.steuerMitImmobilien), sum: () => "–" },
      ],
    },
    {
      label: "Cashflow nach Steuern",
      total: true,
      cls: (y) => tone(y.cashflowNachSteuern),
      cell: (y) => euro(y.cashflowNachSteuern),
      wert: (y) => y.cashflowNachSteuern,
      sum: (ys) => euro(summe(ys, (y) => y.cashflowNachSteuern)),
    },
    {
      id: "vermoegen",
      label: "Vermögen",
      cls: (y) => tone(y.eigenkapital),
      invest: () => euro(0),
      cell: (y) => euro(y.eigenkapital),
      wert: (y) => y.eigenkapital,
      sum: (ys) => euro(letztes(ys).eigenkapital),
      children: [
        { label: "Immobilienwert", invest: (r) => euro(r.kennzahlen.erwerb.kaufpreis), cell: (y) => euro(y.objektwert), sum: (ys) => euro(letztes(ys).objektwert) },
        {
          label: "Restschuld",
          cls: neg,
          invest: (r) => minus(r.kennzahlen.erwerb.darlehensbetrag),
          cell: (y) => minus(y.restschuld),
          sum: (ys) => minus(letztes(ys).restschuld),
        },
        ...(mehrereDarlehen
          ? darlehensplaene.map((l, i) => ({
              label: `· ${l.name}`,
              cls: neg,
              invest: () => minus(l.betrag),
              cell: (y: Jahr) => minus(y.darlehen[i]?.restschuld ?? 0),
              sum: (ys: Jahr[]) => minus(letztes(ys).darlehen[i]?.restschuld ?? 0),
            }))
          : []),
      ],
    },
    {
      label: "Aufgebautes Vermögen (Nettowert + Cashflows)",
      total: true,
      invest: () => "–",
      cls: (y) => tone(y.aufgebautesVermoegen),
      cell: (y) => euro(y.aufgebautesVermoegen),
      wert: (y) => y.aufgebautesVermoegen,
      sum: (ys) => euro(letztes(ys).aufgebautesVermoegen),
    },
  ];
}

export function ProjektionsTabelle({ r, jahre, titel }: { r: ObjektErgebnis; jahre: number; titel: string }) {
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const ys = r.jahre.slice(0, jahre);
  const rows = zeilen(r);
  const mitKindern = rows.filter((z) => z.children).map((z) => z.id!);
  const alleOffen = mitKindern.every((id) => offen.has(id));

  const toggle = (id: string) =>
    setOffen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const row = (z: Zeile, kind: boolean, key: string) => {
    if (z.show && !z.show(r, ys)) return null;
    const isOpen = z.id ? offen.has(z.id) : false;
    const cls = [kind ? "child" : z.children ? "section" : "", z.total ? "total" : "", z.bold ? "bold" : ""].join(" ");
    return (
      <tr key={key} className={cls}>
        <th scope="row">
          {z.children ? (
            <button type="button" className="toggle" aria-expanded={isOpen} onClick={() => toggle(z.id!)}>
              <i aria-hidden="true">{isOpen ? "▾" : "▸"}</i>
              {z.label}
            </button>
          ) : (
            z.label
          )}
        </th>
        <td className="invest">{z.invest ? z.invest(r) : euro(0)}</td>
        {ys.map((y) => (
          <td key={y.jahr} className={z.cls ? z.cls(y) : undefined}>
            {z.cell(y)}
          </td>
        ))}
        <td className="sum">{z.sum(ys, r)}</td>
      </tr>
    );
  };

  const exportCsv = () => {
    const kopf = ["Kennzahl", "Investition", ...ys.map((y) => String(y.jahr))];
    const daten = rows.flatMap((z) => [z, ...(z.children ?? [])]).filter((z) => z.wert);
    const text = csv([kopf, ...daten.map((z) => [z.label, "", ...ys.map((y) => z.wert!(y))])]);
    download(`${titel.replace(/[^\wäöüÄÖÜß-]+/g, "-")}-projektion.csv`, text, "text/csv");
  };

  return (
    <>
      <div className="table-actions">
        <button type="button" className="btn small" onClick={() => setOffen(alleOffen ? new Set() : new Set(mitKindern))}>
          {alleOffen ? "Alle zuklappen" : "Alle aufklappen"}
        </button>
        <button type="button" className="btn small" onClick={exportCsv}>
          Als CSV exportieren
        </button>
      </div>
      <div className="table-scroll">
        <table className="projection">
          <thead>
            <tr>
              <th scope="col">Kennzahl</th>
              <th scope="col" className="invest">
                Investition
              </th>
              {ys.map((y) => (
                <th scope="col" key={y.jahr}>
                  {y.jahr}
                  {y.ist && <span className={`ist-badge${y.ist.abgedeckteMonate < y.monate ? " teil" : ""}`}>{y.ist.abgedeckteMonate < y.monate ? "teils Ist" : "Ist"}</span>}
                </th>
              ))}
              <th scope="col" className="sum">
                Summe
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((z, i) => [
              row(z, false, `z${i}`),
              ...(z.children && offen.has(z.id!) ? z.children.map((c, j) => row(c, true, `z${i}-${j}`)) : []),
            ])}
          </tbody>
        </table>
      </div>
    </>
  );
}
