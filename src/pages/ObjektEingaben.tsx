import { GRUNDERWERBSTEUER, darlehenAufloesen } from "../domain/property";
import { neuesDarlehen } from "../domain/presets";
import type { Darlehen, Objekt, ObjektDaten } from "../domain/types";
import { href, navigate } from "../state/route";
import { useStore } from "../state/store";
import { CheckField, ConfirmButton, MonthField, NumberField, SelectField, TextArea, TextField } from "../ui/fields";
import { euro, euroCent, monatText, prozent, tone } from "../ui/format";

const BUNDESLAENDER = Object.keys(GRUNDERWERBSTEUER).map((b) => [b, `${b} (${String(GRUNDERWERBSTEUER[b]).replace(".", ",")} %)`] as [string, string]);

export function ObjektEingaben({ objekt }: { objekt: Objekt }) {
  const { updateObjekt, ergebnis, dupliziere, entferne, alsGekauft } = useStore();
  const d = objekt.daten;
  const res = ergebnis.jeId.get(objekt.id);
  const k = res?.kennzahlen;
  const upd = (fn: (d: ObjektDaten) => void) =>
    updateObjekt(objekt.id, (o) => {
      const daten = structuredClone(o.daten);
      fn(daten);
      return { ...o, daten };
    });
  const updDarlehen = (i: number, teil: Partial<Darlehen>) =>
    upd((x) => {
      x.finanzierung.darlehen[i] = { ...x.finanzierung.darlehen[i], ...teil };
    });
  const { bedarf } = darlehenAufloesen(d);
  const ersteVolleJahr = res?.jahre.find((y) => y.monate === 12) ?? res?.jahre[0];

  return (
    <div className="inputs-layout">
      <div className="inputs-main">
        {objekt.status === "bestand" && (
          <p className="note">
            Bestandsobjekt: Änderungen hier fließen in die Hochrechnung ab dem letzten Ist-Stand ein. Der ursprüngliche Plan für den
            Plan-Ist-Vergleich bleibt eingefroren.
          </p>
        )}

        <section className="card" aria-labelledby="sec-stamm">
          <h2 id="sec-stamm">Objekt</h2>
          <div className="grid inputs">
            <TextField label="Bezeichnung" value={d.name} onChange={(v) => upd((x) => void (x.name = v))} wide />
            <TextField label="Ort / Adresse" value={d.ort} onChange={(v) => upd((x) => void (x.ort = v))} />
            <SelectField label="Bundesland" value={d.bundesland} options={BUNDESLAENDER} onChange={(v) => upd((x) => void (x.bundesland = v))} />
            <NumberField label="Wohnfläche" unit="m²" value={d.wohnflaeche} min={0} onChange={(v) => upd((x) => void (x.wohnflaeche = v ?? 0))} />
            <NumberField label="Baujahr" value={d.baujahr} nullable onChange={(v) => upd((x) => void (x.baujahr = v))} />
            <MonthField
              label="Kauf (Übergang Nutzen/Lasten)"
              value={d.kaufdatum}
              onChange={(v) => upd((x) => void (x.kaufdatum = v))}
              hint="Bestimmt die Reihenfolge bei der Steuerverteilung."
            />
            <TextArea
              label="Notiz"
              value={d.notiz}
              onChange={(v) => upd((x) => void (x.notiz = v))}
              hint="Quelle, Annahmen, offene Fragen"
              wide
            />
          </div>
        </section>

        <section className="card" aria-labelledby="sec-kauf">
          <h2 id="sec-kauf">Kauf &amp; Nebenkosten</h2>
          <div className="grid inputs">
            <NumberField label="Kaufpreis" unit="€" value={d.kauf.kaufpreis} min={0} onChange={(v) => upd((x) => void (x.kauf.kaufpreis = v ?? 0))} />
            <NumberField
              label="Möbel / Einbauküche"
              unit="€"
              value={d.kauf.moebel}
              min={0}
              onChange={(v) => upd((x) => void (x.kauf.moebel = v ?? 0))}
              hint="Separat ausgewiesen: 10 % AfA p.a., zählt nicht zum Immobilienwert"
            />
            <NumberField label="Maklerprovision" unit="%" value={d.kauf.makler} min={0} onChange={(v) => upd((x) => void (x.kauf.makler = v ?? 0))} />
            <NumberField
              label="Notar & Grundbuch (Kauf)"
              unit="% v. Kaufpreis"
              value={d.kauf.notarGrundbuch}
              min={0}
              onChange={(v) => upd((x) => void (x.kauf.notarGrundbuch = v ?? 0))}
              hint="Üblich 1,5–2 %"
            />
            <NumberField
              label="Grundschuldbestellung"
              unit="% v. Darlehen"
              value={d.kauf.grundschuld}
              min={0}
              onChange={(v) => upd((x) => void (x.kauf.grundschuld = v ?? 0))}
              hint="Sofort abziehbar"
            />
          </div>
          {k && (
            <dl className="mini-breakdown">
              <div>
                <dt>Grunderwerbsteuer {prozent(k.nebenkosten.grunderwerbsteuerSatz)}</dt>
                <dd>{euro(k.nebenkosten.grunderwerbsteuer)}</dd>
              </div>
              <div>
                <dt>Notar, Grundbuch &amp; Grundschuld</dt>
                <dd>{euro(k.nebenkosten.notarUndGrundbuch)}</dd>
              </div>
              {k.nebenkosten.maklerprovision > 0 && (
                <div>
                  <dt>Makler</dt>
                  <dd>{euro(k.nebenkosten.maklerprovision)}</dd>
                </div>
              )}
              <div className="strong">
                <dt>Kaufnebenkosten</dt>
                <dd>{euro(k.nebenkosten.nebenkostenGesamt)}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="card" aria-labelledby="sec-miete">
          <h2 id="sec-miete">Miete, Kosten &amp; Annahmen</h2>
          <div className="grid inputs">
            <NumberField
              label={objekt.status === "bestand" ? "Kaltmiete beim Kauf" : "Kaltmiete"}
              unit="€/Monat"
              value={d.miete.kaltmiete}
              min={0}
              onChange={(v) => upd((x) => void (x.miete.kaltmiete = v ?? 0))}
              hint={objekt.status === "bestand" ? "Aktuelle Miete als Stichtag unter „Ist & Vergleich“ eintragen" : undefined}
            />
            <NumberField label="Mietausfall / Leerstand" unit="%" value={d.miete.leerstand} min={0} max={100} onChange={(v) => upd((x) => void (x.miete.leerstand = v ?? 0))} />
            <NumberField label="Mietsteigerung" unit="% p.a." value={d.miete.steigerung} onChange={(v) => upd((x) => void (x.miete.steigerung = v ?? 0))} />
            <NumberField label="Hausgeld (nicht umlagefähig)" unit="€/Monat" value={d.kosten.hausgeld} min={0} onChange={(v) => upd((x) => void (x.kosten.hausgeld = v ?? 0))} />
            <NumberField label="Instandhaltungsrücklage" unit="€/Monat" value={d.kosten.ruecklage} min={0} onChange={(v) => upd((x) => void (x.kosten.ruecklage = v ?? 0))} />
            <NumberField label="Mietverwaltung (SEV)" unit="€/Monat" value={d.kosten.verwaltung} min={0} onChange={(v) => upd((x) => void (x.kosten.verwaltung = v ?? 0))} />
            <NumberField label="Kostensteigerung" unit="% p.a." value={d.kosten.steigerung} onChange={(v) => upd((x) => void (x.kosten.steigerung = v ?? 0))} />
            <NumberField label="Wertentwicklung" unit="% p.a." value={d.wertsteigerung} onChange={(v) => upd((x) => void (x.wertsteigerung = v ?? 0))} />
          </div>
        </section>

        <section className="card" aria-labelledby="sec-fin">
          <h2 id="sec-fin">Finanzierung</h2>
          <div className="grid inputs">
            <NumberField
              label="Eigenkapital"
              unit="% der Investition"
              value={d.finanzierung.eigenkapitalProzent}
              min={0}
              max={100}
              onChange={(v) => upd((x) => void (x.finanzierung.eigenkapitalProzent = v ?? 0))}
              hint={k ? `${euro(k.erwerb.eigenkapitalBetrag)} zzgl. Kaufnebenkosten` : undefined}
            />
            <NumberField
              label="Bereitstellungszinsen (einmalig)"
              unit="€"
              value={d.finanzierung.bereitstellungszinsen}
              min={0}
              onChange={(v) => upd((x) => void (x.finanzierung.bereitstellungszinsen = v ?? 0))}
              hint="Im Kaufjahr, sofort abziehbar"
            />
            <div className="field">
              <span className="field-label">Finanzierungsbedarf</span>
              <strong className="field-value">{euro(bedarf)}</strong>
            </div>
          </div>

          <div className="darlehensplaene">
            {d.finanzierung.darlehen.map((l, i) => {
              const info = k?.kapitaldienst.darlehensplaene[i];
              return (
                <article className="loan" key={l.id} aria-label={l.name}>
                  <div className="loan-head">
                    <TextField label="Darlehen" value={l.name} onChange={(v) => updDarlehen(i, { name: v })} />
                    {d.finanzierung.darlehen.length > 1 && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => upd((x) => void x.finanzierung.darlehen.splice(i, 1))}
                        aria-label={`${l.name} entfernen`}
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                  <div className="grid inputs">
                    {i === 0 ? (
                      <div className="field">
                        <CheckField
                          label="Betrag = restlicher Bedarf"
                          checked={l.betrag === null}
                          onChange={(c) => updDarlehen(i, { betrag: c ? null : Math.round(info?.betrag ?? 0) })}
                        />
                        {l.betrag === null ? (
                          <strong className="field-value">{euro(info?.betrag ?? 0)}</strong>
                        ) : (
                          <NumberField label="Betrag" unit="€" value={l.betrag} min={0} onChange={(v) => updDarlehen(i, { betrag: v ?? 0 })} />
                        )}
                      </div>
                    ) : (
                      <NumberField label="Betrag" unit="€" value={l.betrag ?? 0} min={0} onChange={(v) => updDarlehen(i, { betrag: v ?? 0 })} />
                    )}
                    <NumberField label="Sollzins" unit="% p.a." value={l.zins} min={0} onChange={(v) => updDarlehen(i, { zins: v ?? 0 })} />
                    <NumberField label="Anfängliche Tilgung" unit="% p.a." value={l.tilgung} min={0} onChange={(v) => updDarlehen(i, { tilgung: v ?? 0 })} />
                    <NumberField
                      label="Zinsbindung"
                      unit="Jahre"
                      value={l.zinsbindungJahre}
                      min={0}
                      max={40}
                      onChange={(v) => updDarlehen(i, { zinsbindungJahre: Math.round(v ?? 0) })}
                      hint="0 = Zins gilt bis zum Ende"
                    />
                    {l.zinsbindungJahre > 0 && (
                      <>
                        <NumberField label="Anschlusszins" unit="% p.a." value={l.anschlusszins} min={0} onChange={(v) => updDarlehen(i, { anschlusszins: v ?? 0 })} />
                        <SelectField
                          label="Nach der Zinsbindung"
                          value={l.anschluss}
                          options={[
                            ["tilgung", "Rate neu mit Tilgung"],
                            ["rate", "Rate bleibt gleich"],
                          ]}
                          onChange={(v) => updDarlehen(i, { anschluss: v })}
                        />
                        {l.anschluss === "tilgung" && (
                          <NumberField
                            label="Tilgung nach Anschluss"
                            unit="% p.a."
                            value={l.anschlusstilgung}
                            min={0}
                            onChange={(v) => updDarlehen(i, { anschlusstilgung: v ?? 0 })}
                          />
                        )}
                      </>
                    )}
                    <NumberField
                      label="Sondertilgung"
                      unit="€ pro Jahr"
                      value={l.sondertilgung}
                      min={0}
                      onChange={(v) => updDarlehen(i, { sondertilgung: v ?? 0 })}
                      hint="Jeweils im Dezember, ab dem 2. Jahr"
                    />
                  </div>
                  {info && (
                    <dl className="loan-facts">
                      <div>
                        <dt>Monatsrate</dt>
                        <dd>{euroCent(info.monatsrate)}</dd>
                      </div>
                      {info.endeZinsbindung && (
                        <>
                          <div>
                            <dt>Ende Zinsbindung</dt>
                            <dd>{monatText(info.endeZinsbindung)}</dd>
                          </div>
                          <div>
                            <dt>Restschuld dann</dt>
                            <dd>{euro(info.restschuldEndeZinsbindung ?? 0)}</dd>
                          </div>
                          <div>
                            <dt>Rate danach</dt>
                            <dd>{euroCent(info.anschlussrate ?? 0)}</dd>
                          </div>
                        </>
                      )}
                      <div>
                        <dt>Schuldenfrei</dt>
                        <dd>{info.schuldenfreiJahr ?? "nach 40 Jahren"}</dd>
                      </div>
                    </dl>
                  )}
                  {info?.rateZuNiedrig && (
                    <p className="warn">Die Rate deckt nach dem Anschluss die Zinsen nicht. Bitte Tilgung oder Rate anpassen.</p>
                  )}
                </article>
              );
            })}
          </div>
          {k && Math.abs(k.kapitaldienst.finanzierungsluecke) > 1 && (
            <p className="warn">
              {k.kapitaldienst.finanzierungsluecke > 0
                ? `Die Darlehen decken ${euro(k.kapitaldienst.finanzierungsluecke)} des Bedarfs nicht. Dieser Betrag wird zusätzlich als Eigenkapital gerechnet.`
                : `Die Darlehen übersteigen den Bedarf um ${euro(-k.kapitaldienst.finanzierungsluecke)}.`}
            </p>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => upd((x) => void x.finanzierung.darlehen.push(neuesDarlehen({ name: `Darlehen ${x.finanzierung.darlehen.length + 1}`, betrag: 0 })))}
          >
            + Darlehen hinzufügen
          </button>
        </section>

        <section className="card" aria-labelledby="sec-afa">
          <h2 id="sec-afa">Abschreibung (AfA)</h2>
          <div className="grid inputs">
            <SelectField
              label="AfA-Art"
              value={d.afa.art}
              options={[
                ["linear", "Linear"],
                ["degressiv", "Degressiv (vom Restbuchwert)"],
              ]}
              onChange={(v) => upd((x) => {
                x.afa.art = v;
                if (v === "degressiv" && x.afa.satz < 5) x.afa.satz = 5;
              })}
            />
            <NumberField
              label="AfA-Satz"
              unit="% p.a."
              value={d.afa.satz}
              min={0}
              max={100}
              onChange={(v) => upd((x) => void (x.afa.satz = v ?? 0))}
              hint={
                d.afa.art === "linear"
                  ? "2 % ab Baujahr 1925, 2,5 % davor, 3 % Neubau ab 2023; höher mit Restnutzungsdauer-Gutachten"
                  : "5 % für Neubauten mit Baubeginn 10/2023 bis 09/2029"
              }
            />
            <SelectField
              label="Grundstücksanteil angeben als"
              value={d.afa.grundstueck}
              options={[
                ["prozent", "Prozent vom Kaufpreis"],
                ["betrag", "Betrag in €"],
              ]}
              onChange={(v) => upd((x) => void (x.afa.grundstueck = v))}
            />
            {d.afa.grundstueck === "prozent" ? (
              <NumberField label="Grundstücksanteil" unit="%" value={d.afa.grundstuecksanteil} min={0} max={100} onChange={(v) => upd((x) => void (x.afa.grundstuecksanteil = v ?? 0))} />
            ) : (
              <NumberField label="Grundstückswert" unit="€" value={d.afa.grundstueckswert} min={0} onChange={(v) => upd((x) => void (x.afa.grundstueckswert = v ?? 0))} />
            )}
          </div>

          <div className="subcard">
            <CheckField
              label="Denkmal-AfA (§7i) bzw. Sanierungsgebiet (§7h)"
              hint="Erhöhte AfA auf den Sanierungsanteil: 8 Jahre je 9 %, danach 4 Jahre je 7 %. Die Altbausubstanz wird weiter mit dem Satz oben abgeschrieben."
              checked={d.afa.denkmal.aktiv}
              onChange={(v) => upd((x) => void (x.afa.denkmal.aktiv = v))}
            />
            {d.afa.denkmal.aktiv && (
              <>
                <div className="grid inputs">
                  <SelectField
                    label="Grundlage"
                    value={d.afa.denkmal.art}
                    options={[
                      ["7i", "§7i Baudenkmal"],
                      ["7h", "§7h Sanierungsgebiet"],
                    ]}
                    onChange={(v) => upd((x) => void (x.afa.denkmal.art = v))}
                  />
                  <NumberField
                    label="Begünstigter Sanierungsanteil"
                    unit="€"
                    value={d.afa.denkmal.sanierungsanteil}
                    min={0}
                    onChange={(v) => upd((x) => void (x.afa.denkmal.sanierungsanteil = v ?? 0))}
                    hint="Anteil am Kaufpreis laut Kaufvertrag bzw. Bescheinigung"
                  />
                  <NumberField
                    label="Fertigstellung der Maßnahmen"
                    unit="Jahr"
                    nullable
                    placeholder={d.kaufdatum.slice(0, 4)}
                    value={d.afa.denkmal.abJahr}
                    onChange={(v) => upd((x) => void (x.afa.denkmal.abJahr = v === null ? null : Math.round(v)))}
                    hint="Leer = Kaufjahr. Ab diesem Jahr volle Jahresbeträge."
                  />
                </div>
                <p className="note small">
                  Begünstigt sind nur Baumaßnahmen, die nach Abschluss des Kaufvertrags durchgeführt werden und von der{" "}
                  {d.afa.denkmal.art === "7i" ? "Denkmalbehörde" : "Gemeinde"} bescheinigt sind. Bei einer bereits fertig sanierten Wohnung
                  gilt für den Kauf meist nur die normale AfA.
                </p>
                {k && d.afa.denkmal.sanierungsanteil > k.erwerb.kaufpreis - k.steuerbasis.bodenwert + 1 && (
                  <p className="warn">Der Sanierungsanteil ist größer als der Gebäudeanteil und wird auf {euro(k.erwerb.kaufpreis - k.steuerbasis.bodenwert)} begrenzt.</p>
                )}
              </>
            )}
          </div>

          {k && (
            <dl className="mini-breakdown">
              <div>
                <dt>Grundstückswert</dt>
                <dd>{euro(k.steuerbasis.bodenwert)}</dd>
              </div>
              <div>
                <dt>
                  {k.steuerbasis.denkmalBasis > 0 ? "AfA-Basis Altbausubstanz" : "AfA-Bemessungsgrundlage"} (inkl. anteiliger Nebenkosten)
                </dt>
                <dd>{euro(k.steuerbasis.afaBasis)}</dd>
              </div>
              {k.steuerbasis.denkmalBasis > 0 && (
                <>
                  <div>
                    <dt>AfA-Basis Sanierungsanteil (inkl. anteiliger Nebenkosten)</dt>
                    <dd>{euro(k.steuerbasis.denkmalBasis)}</dd>
                  </div>
                  <div>
                    <dt>
                      Denkmal-AfA {k.steuerbasis.denkmalAbJahr}–{(k.steuerbasis.denkmalAbJahr ?? 0) + 7} (9 %)
                    </dt>
                    <dd>{euro(k.steuerbasis.denkmalBasis * 0.09)} / Jahr</dd>
                  </div>
                  <div>
                    <dt>
                      Denkmal-AfA {(k.steuerbasis.denkmalAbJahr ?? 0) + 8}–{(k.steuerbasis.denkmalAbJahr ?? 0) + 11} (7 %)
                    </dt>
                    <dd>{euro(k.steuerbasis.denkmalBasis * 0.07)} / Jahr</dd>
                  </div>
                </>
              )}
              <div className="strong">
                <dt>AfA gesamt im ersten vollen Jahr</dt>
                <dd>{euro((ersteVolleJahr?.afaGebaeude ?? 0) + (ersteVolleJahr?.afaDenkmal ?? 0))}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="card actions-card" aria-label="Aktionen">
          <a className="btn primary" href={href.objekt(objekt.id, "ergebnis")}>
            Ergebnis ansehen
          </a>
          {objekt.status === "plan" && (
            <ConfirmButton
              confirmText="Das Objekt wird als gekauft markiert. Die aktuellen Eingaben werden als Plan eingefroren, damit du später Ist-Werte damit vergleichen kannst."
              confirmLabel="Als gekauft markieren"
              onConfirm={() => {
                alsGekauft(objekt.id);
                navigate(href.objekt(objekt.id, "ist"));
              }}
            >
              Als gekauft markieren
            </ConfirmButton>
          )}
          <button type="button" className="btn" onClick={() => navigate(href.objekt(dupliziere(objekt.id), "eingaben"))}>
            Duplizieren
          </button>
          <ConfirmButton
            className="btn danger-outline"
            confirmText={`„${d.name}“ mit allen Ist-Daten löschen? Das lässt sich nicht rückgängig machen.`}
            confirmLabel="Endgültig löschen"
            onConfirm={() => {
              entferne(objekt.id);
              navigate(href.uebersicht());
            }}
          >
            Objekt löschen
          </ConfirmButton>
        </section>
      </div>

      {k && res && (
        <aside className="summary-panel" aria-label="Zwischenergebnis">
          <h2>Zwischenergebnis</h2>
          <dl>
            <div>
              <dt>Gesamtinvestition</dt>
              <dd>{euro(k.erwerb.gesamtinvestition)}</dd>
            </div>
            <div>
              <dt>Eigenkapitaleinsatz inkl. Nebenkosten</dt>
              <dd>{euro(k.nebenkosten.eigenkapitalEinsatz)}</dd>
            </div>
            <div>
              <dt>Darlehen gesamt</dt>
              <dd>{euro(k.erwerb.darlehensbetrag)}</dd>
            </div>
            <div>
              <dt>Monatsrate</dt>
              <dd>{euroCent(k.kapitaldienst.monatsrate)}</dd>
            </div>
            <div>
              <dt>Mietrendite brutto</dt>
              <dd>{prozent(k.kennwerte.bruttomietrendite, 2)}</dd>
            </div>
            {ersteVolleJahr && (
              <div>
                <dt>Cashflow nach Steuern {ersteVolleJahr.jahr}</dt>
                <dd className={tone(ersteVolleJahr.monatlich.ueberschuss)}>{euro(ersteVolleJahr.monatlich.ueberschuss)} / Monat</dd>
              </div>
            )}
            {res.kennzahlenJeHorizont[10] && (
              <div>
                <dt>EK-Rendite p.a. (10 Jahre)</dt>
                <dd className={tone(res.kennzahlenJeHorizont[10].ekRendite)}>{prozent(res.kennzahlenJeHorizont[10].ekRendite, 2)}</dd>
              </div>
            )}
          </dl>
          <a className="btn primary block" href={href.objekt(objekt.id, "ergebnis")}>
            Ergebnis ansehen
          </a>
        </aside>
      )}
    </div>
  );
}
