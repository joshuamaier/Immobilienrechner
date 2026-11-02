# Immobilienrechner

Web-App zum Planen und Verfolgen eines Immobilien-Portfolios:

- **Eingabeseite pro Objekt** mit Presets: Kauf und Nebenkosten, Möbel (10 % AfA), Miete und Kosten, mehrere Darlehen mit **Zinsbindung und Anschlusszins**, Sondertilgung, Bereitstellungszinsen, **AfA** linear oder degressiv, **Denkmal-AfA** (§7i/§7h), Notizfeld
- **Ergebnisseite**: Monatsübersicht, Vermögensaufbau (10/20/30/40 Jahre), aufklappbare Finanzprojektion, CSV-Export
- **Steuerprofil** für alle Objekte mit **Einkommensverlauf** (Stufen + jährliche Steigerung), Familienstand im Zeitverlauf, Kirchensteuer, §39a
- **Chronologische Steuerverteilung**: Das zuerst gekaufte Objekt erhält die Steuerersparnis auf Basis des Einkommens ohne Immobilien, jedes weitere nur noch die verbleibende Ersparnis auf Basis des bereits reduzierten Einkommens
- **Ist-Tracking für Bestandsobjekte**: Monats- und Jahreswerte, Steuererstattungen, Sondertilgungen, Stichtage (Restschuld, Marktwert, Miete), Plan-Ist-Vergleich und **neue Hochrechnung** ab dem tatsächlichen Stand
- **Gesamtübersicht** mit Vermögensentwicklung, Cashflow je Objekt, Jahrestabelle und Steuerverteilung
- **Export/Import als JSON**, für ein Objekt oder das ganze Portfolio inklusive Ist-Daten; „Alle Daten löschen“ entfernt die Vorlagen für einen Neustart mit eigenen Daten

Beim ersten Öffnen sind drei erfundene Vorlagen hinterlegt: ein **Bestandsobjekt** (2-Zimmer-Wohnung, gekauft 2022) mit Ist-Daten bis Oktober 2026, dessen Entwicklung vom Kaufplan abweicht – höheres Hausgeld, Mieterwechsel mit Renovierung, Sonderumlage, Marktwert unter Plan, höherer Anschlusszins –, sowie zwei Objekte **in Planung**: ein möbliertes 1-Zimmer-Apartment mit Bereitstellungszinsen und ein denkmalgeschützter Altbau mit §7i-AfA und zwei Darlehen. „Vorlagen laden“ unter „Daten“ stellt sie wieder her.

Alle Daten bleiben im Browser (localStorage). Für Sicherungen oder einen Gerätewechsel unter „Daten“ exportieren und wieder importieren.

## Starten

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Tests (Vitest)
npm run build      # Typecheck + Build nach dist/
```

Die Seite wird bei jedem Push auf `main` über GitHub Actions auf GitHub Pages veröffentlicht (`.github/workflows/pages.yml`). Dafür einmalig unter *Settings → Pages* die Quelle **GitHub Actions** wählen.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/domain/tax.ts` | Einkommensteuer 2026 (§32a EStG), Soli, Kirchensteuer, Einkommensverlauf |
| `src/domain/loans.ts` | Monatlicher Tilgungsplan mit Zinsbindung, Anschlusszins, Sondertilgung, Restschuld-Stichtag |
| `src/domain/property.ts` | Projektion eines Objekts vor Steuern (Miete, Kosten, AfA, Darlehen, Wert) |
| `src/domain/portfolio.ts` | Steuerverteilung im Portfolio, Cashflow nach Steuern, Kennzahlen |
| `src/domain/tracking.ts` | Ist-Buchungen, Plan-Ist-Vergleich, Hochrechnung ab Ist-Stand |
| `src/domain/calc.ts` | Rechnet das ganze Portfolio |
| `src/domain/io.ts` | JSON-Export/-Import mit Prüfung und Ergänzung fehlender Felder |
| `src/domain/presets.ts` | Vorlagen (erfunden: ein Bestandsobjekt mit Ist-Daten, zwei Objekte in Planung) und leere Objekte |
| `src/pages/` | Übersicht, Steuerprofil, Daten, Objekt (Eingaben, Ergebnis, Ist & Vergleich) |
| `test/` | Tests mit unabhängig nachgerechneten Werten für Einkommensteuer, Tilgungsplan, Kaufnebenkosten, AfA, Steuerverteilung und Ist-Tracking |

## Rechenmodell

- **Darlehen**: Annuität mit Monatsrate = Betrag × (Zins + Tilgung) / 12 und monatlichem Tilgungsplan wie bei der Bank. Nach der Zinsbindung gilt der Anschlusszins, wahlweise mit gleicher Rate oder neu berechnet mit Anschluss-Tilgung.
- **AfA**: Gebäudeanteil plus anteilige Kaufnebenkosten (ohne Grundschuld). Linear mit frei wählbarem Satz oder degressiv vom Restbuchwert. Grundschuldkosten sind sofort abziehbar. Möbel: 10 % pro Jahr.
- **Denkmal-AfA (§7i/§7h)**: Der begünstigte Sanierungsanteil (inkl. anteiliger Nebenkosten) wird ab dem Jahr der Fertigstellung 8 Jahre mit je 9 % und 4 Jahre mit je 7 % abgeschrieben, jeweils mit vollem Jahresbetrag; die Altbausubstanz weiter mit dem normalen Satz.
- **Steuer**: pro Kalenderjahr gemeinsam für alle Objekte, chronologisch nach Kaufdatum verteilt. Mit Lohnsteuerermäßigung (§39a) wirken laufende Ergebnisse sofort, Einmalabzüge im Folgejahr; ohne fließt die Ersparnis eines Jahres im Folgejahr zurück. Der Tarif 2026 wird für spätere Jahre fortgeschrieben.
- **Hochrechnung für Bestandsobjekte**: Jahre mit Ist-Daten kommen aus der Erfassung (fehlende Monate und Positionen aus dem Modell). Danach rechnet das Modell weiter ab der Restschuld und dem Marktwert laut Stichtag, der aktuellen Miete und dem Kostenniveau des letzten Ist-Jahres. Eingetragene Steuererstattungen ersetzen den Modellwert als Zahlungsfluss.
- **Kennzahlen**: Aufgebautes Vermögen = Immobilienwert − Restschuld + kumulierte Cashflows; EK-Rendite p.a. = annualisiertes Verhältnis zum eingesetzten Kapital (Eigenkapital plus Kaufnebenkosten).

Nicht enthalten: Verkauf und Spekulationsfrist, KfW-Förderdarlehen, Sonder-AfA §7b, Selbstnutzung (§10f).

Die degressive AfA wird vom tatsächlichen Restwert gerechnet, der Solidaritätszuschlag ist enthalten und Grundschuldkosten werden sofort abgezogen.

Alle Ergebnisse sind unverbindliche Modellrechnungen und keine Steuer- oder Finanzierungsberatung.

## Lizenz

MIT, siehe `LICENSE`.
