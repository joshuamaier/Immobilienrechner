import { href } from "../state/route";
import { useStore } from "../state/store";
import { monatText } from "../ui/format";
import { ObjektEingaben } from "./ObjektEingaben";
import { ObjektErgebnisSeite } from "./ObjektErgebnis";
import { ObjektIst } from "./ObjektIst";

export function ObjektSeite({ id, tab }: { id: string; tab: "eingaben" | "ergebnis" | "ist" }) {
  const { portfolio } = useStore();
  const objekt = portfolio.objekte.find((o) => o.id === id);
  if (!objekt) {
    return (
      <section className="card empty">
        <h1>Objekt nicht gefunden</h1>
        <p>Das Objekt wurde gelöscht oder stammt aus einem anderen Browser.</p>
        <a className="btn primary" href={href.uebersicht()}>
          Zur Übersicht
        </a>
      </section>
    );
  }
  const d = objekt.daten;
  const tabs: [typeof tab, string][] = [
    ["eingaben", "Eingaben"],
    ["ergebnis", "Ergebnis"],
    ["ist", objekt.status === "bestand" ? "Ist & Vergleich" : "Ist-Tracking"],
  ];
  return (
    <>
      <div className="page-head">
        <a className="back" href={href.uebersicht()}>
          ← Portfolio
        </a>
        <div className="title-row">
          <h1>{d.name || "Ohne Namen"}</h1>
          <span className={`pill ${objekt.status}`}>{objekt.status === "bestand" ? "Bestand" : "Planung"}</span>
        </div>
        <p className="muted">
          {[d.ort, d.wohnflaeche ? `${d.wohnflaeche.toLocaleString("de-DE")} m²` : "", `Kauf ${monatText(d.kaufdatum)}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <nav className="tabs" aria-label="Objektbereiche">
          {tabs.map(([t, label]) => (
            <a key={t} href={href.objekt(id, t)} aria-current={t === tab ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
      </div>
      {tab === "eingaben" && <ObjektEingaben objekt={objekt} />}
      {tab === "ergebnis" && <ObjektErgebnisSeite objekt={objekt} />}
      {tab === "ist" && <ObjektIst objekt={objekt} />}
    </>
  );
}
