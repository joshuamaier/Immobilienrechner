import { useRef, useState } from "react";
import { dateiname, exportiere, importiere, ImportFehler, type ImportErgebnis } from "../domain/io";
import { href } from "../state/route";
import { useStore } from "../state/store";
import { download } from "../ui/download";
import { CheckField, ConfirmButton } from "../ui/fields";
import { monatText } from "../ui/format";

type Aktion = "neu" | "ersetzen" | "ueberspringen";

export function Daten() {
  const { portfolio, letzterExport, exportiert, importiere: uebernehmen, allesLoeschen, beispieleLaden } = useStore();
  const [auswahl, setAuswahl] = useState<Set<string> | null>(null);
  const [mitSteuer, setMitSteuer] = useState(true);
  const gewaehlt = auswahl ?? new Set(portfolio.objekte.map((o) => o.id));

  const [vorschau, setVorschau] = useState<ImportErgebnis | null>(null);
  const [aktionen, setAktionen] = useState<Record<string, Aktion>>({});
  const [steuerUebernehmen, setSteuerUebernehmen] = useState(true);
  const [fehler, setFehler] = useState("");
  const [meldung, setMeldung] = useState("");
  const [drag, setDrag] = useState(false);
  const [exportInfo, setExportInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lies = async (file: File) => {
    setFehler("");
    setMeldung("");
    try {
      const r = importiere(await file.text());
      setVorschau(r);
      setSteuerUebernehmen(!!r.steuerprofil);
      setAktionen(Object.fromEntries(r.objekte.map((o) => [o.id, portfolio.objekte.some((x) => x.id === o.id) ? "ersetzen" : "neu"])));
    } catch (e) {
      setVorschau(null);
      setFehler(e instanceof ImportFehler ? e.message : "Die Datei konnte nicht gelesen werden.");
    }
  };

  const exportieren = () => {
    const ids = portfolio.objekte.filter((o) => gewaehlt.has(o.id)).map((o) => o.id);
    download(dateiname(ids.length), exportiere(portfolio, ids, mitSteuer));
    exportiert();
    setExportInfo({ ok: true, text: "Export erstellt." });
  };

  return (
    <>
      <div className="page-head">
        <h1>Daten</h1>
        <p className="muted">
          Deine Eingaben werden automatisch in diesem Browser gespeichert. Für eine Sicherung oder ein anderes Gerät exportierst du sie als
          JSON-Datei und importierst sie dort wieder.
        </p>
      </div>

      <section className="card" aria-labelledby="h-export">
        <h2 id="h-export">Exportieren</h2>
        <p className="muted small">
          {letzterExport ? `Letzter Export: ${new Date(letzterExport).toLocaleString("de-DE")}.` : "Noch nie exportiert."} Die Datei enthält
          Eingaben, eingefrorenen Plan, Ist-Buchungen und Stichtage.
        </p>
        {portfolio.objekte.length ? (
          <fieldset className="check-list">
            <legend>Objekte</legend>
            {portfolio.objekte.map((o) => (
              <CheckField
                key={o.id}
                label={
                  <>
                    {o.daten.name} <span className="muted small">· {o.status === "bestand" ? "Bestand" : "Planung"} · {monatText(o.daten.kaufdatum)}</span>
                  </>
                }
                checked={gewaehlt.has(o.id)}
                onChange={(c) => {
                  const n = new Set(gewaehlt);
                  if (c) n.add(o.id);
                  else n.delete(o.id);
                  setAuswahl(n);
                }}
              />
            ))}
            <CheckField label="Steuerprofil mit exportieren" checked={mitSteuer} onChange={setMitSteuer} />
          </fieldset>
        ) : (
          <p className="muted">Keine Objekte vorhanden. Exportiert wird nur das Steuerprofil.</p>
        )}
        <button type="button" className="btn primary" onClick={exportieren} disabled={gewaehlt.size === 0 && !mitSteuer}>
          {gewaehlt.size === 1 ? "Objekt als JSON herunterladen" : `${gewaehlt.size} Objekte als JSON herunterladen`}
        </button>
        {exportInfo && (
          <p className={exportInfo.ok ? "saved" : "warn"} role={exportInfo.ok ? "status" : "alert"}>
            {exportInfo.text}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="h-import">
        <h2 id="h-import">Importieren</h2>
        <div
          className={`dropzone${drag ? " drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) lies(f);
          }}
        >
          <p>JSON-Datei hierher ziehen oder</p>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Datei auswählen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Datei für den Import auswählen"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) lies(f);
              e.target.value = "";
            }}
          />
        </div>
        {fehler && (
          <p className="warn" role="alert">
            {fehler}
          </p>
        )}
        {meldung && (
          <p className="saved" role="status">
            {meldung}
          </p>
        )}
        {vorschau && (
          <div className="import-preview">
            <h3>Inhalt der Datei</h3>
            {vorschau.warnungen.map((w) => (
              <p className="note" key={w}>
                {w}
              </p>
            ))}
            {vorschau.objekte.length > 0 && (
              <div className="table-scroll compact">
                <table className="simple">
                  <thead>
                    <tr>
                      <th scope="col">Objekt</th>
                      <th scope="col">Status</th>
                      <th scope="col">Kauf</th>
                      <th scope="col">Ist-Buchungen</th>
                      <th scope="col">Übernehmen als</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vorschau.objekte.map((o) => {
                      const vorhanden = portfolio.objekte.some((x) => x.id === o.id);
                      return (
                        <tr key={o.id}>
                          <th scope="row">{o.daten.name}</th>
                          <td>{o.status === "bestand" ? "Bestand" : "Planung"}</td>
                          <td>{monatText(o.daten.kaufdatum)}</td>
                          <td>{o.ist.buchungen.length}</td>
                          <td>
                            <select
                              aria-label={`Aktion für ${o.daten.name}`}
                              value={aktionen[o.id]}
                              onChange={(e) => setAktionen((a) => ({ ...a, [o.id]: e.target.value as Aktion }))}
                            >
                              {vorhanden && <option value="ersetzen">Vorhandenes ersetzen</option>}
                              <option value="neu">{vorhanden ? "Als Kopie hinzufügen" : "Hinzufügen"}</option>
                              <option value="ueberspringen">Überspringen</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {vorschau.steuerprofil && (
              <CheckField label="Steuerprofil aus der Datei übernehmen (ersetzt das aktuelle)" checked={steuerUebernehmen} onChange={setSteuerUebernehmen} />
            )}
            <div className="row-gap">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  const liste = vorschau.objekte
                    .filter((o) => aktionen[o.id] !== "ueberspringen")
                    .map((o) => ({ objekt: o, aktion: aktionen[o.id] === "ersetzen" ? ("ersetzen" as const) : ("neu" as const) }));
                  uebernehmen(liste, steuerUebernehmen ? vorschau.steuerprofil : null);
                  setMeldung(
                    `${liste.length} ${liste.length === 1 ? "Objekt" : "Objekte"} importiert${steuerUebernehmen && vorschau.steuerprofil ? ", Steuerprofil übernommen" : ""}.`,
                  );
                  setVorschau(null);
                }}
              >
                Importieren
              </button>
              <button type="button" className="btn" onClick={() => setVorschau(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card danger-zone" aria-labelledby="h-reset">
        <h2 id="h-reset">Neu beginnen</h2>
        <p className="muted">
          „Alle Daten löschen“ entfernt alle Objekte inklusive der Beispielobjekte, alle Ist-Daten und setzt das Steuerprofil zurück. Danach
          kannst du deine eigenen Daten eingeben. Exportiere vorher, was du behalten willst.
        </p>
        <div className="row-gap">
          <ConfirmButton
            className="btn danger"
            confirmText="Wirklich alle Objekte, Ist-Daten und das Steuerprofil löschen?"
            confirmLabel="Ja, alles löschen"
            onConfirm={() => {
              allesLoeschen();
              setMeldung("Alle Daten gelöscht.");
            }}
          >
            Alle Daten löschen
          </ConfirmButton>
          <ConfirmButton
            confirmText="Alle aktuellen Daten durch die Vorlagen (ein Bestandsobjekt und zwei Objekte in Planung, alle erfunden) ersetzen?"
            confirmLabel="Vorlagen laden"
            onConfirm={() => {
              beispieleLaden();
              setMeldung("Vorlagen geladen.");
            }}
          >
            Vorlagen laden
          </ConfirmButton>
          <a className="btn" href={href.steuer()}>
            Zum Steuerprofil
          </a>
        </div>
      </section>
    </>
  );
}
