import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { rechnePortfolio, type PortfolioErgebnis } from "../domain/calc";
import { ladePortfolio } from "../domain/io";
import { beispielPortfolio, leeresPortfolio, neuesObjekt, uid } from "../domain/presets";
import type { Objekt, Portfolio, Steuerprofil } from "../domain/types";

const KEY = "immobilienrechner:portfolio";
const EXPORT_KEY = "immobilienrechner:letzterExport";

function lesen(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function schreiben(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Speicher nicht verfügbar, z. B. im privaten Modus */
  }
}

interface Store {
  portfolio: Portfolio;
  ergebnis: PortfolioErgebnis;
  letzterExport: string | null;
  setSteuerprofil: (s: Steuerprofil) => void;
  updateObjekt: (id: string, fn: (o: Objekt) => Objekt) => void;
  neuesObjekt: () => string;
  dupliziere: (id: string) => string;
  entferne: (id: string) => void;
  alsGekauft: (id: string) => void;
  planNeuFestlegen: (id: string) => void;
  importiere: (objekte: { objekt: Objekt; aktion: "neu" | "ersetzen" }[], steuerprofil: Steuerprofil | null) => void;
  allesLoeschen: () => void;
  beispieleLaden: () => void;
  exportiert: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(() => {
    return ladePortfolio(lesen(KEY)) ?? beispielPortfolio();
  });
  const [letzterExport, setLetzterExport] = useState<string | null>(() => lesen(EXPORT_KEY));

  useEffect(() => {
    schreiben(KEY, JSON.stringify(portfolio));
  }, [portfolio]);

  const ergebnis = useMemo(() => rechnePortfolio(portfolio), [portfolio]);

  const updateObjekt = useCallback((id: string, fn: (o: Objekt) => Objekt) => {
    setPortfolio((p) => ({ ...p, objekte: p.objekte.map((o) => (o.id === id ? fn(o) : o)) }));
  }, []);

  const store: Store = {
    portfolio,
    ergebnis,
    letzterExport,
    setSteuerprofil: (s) => setPortfolio((p) => ({ ...p, steuerprofil: s })),
    updateObjekt,
    neuesObjekt: () => {
      const o = neuesObjekt();
      setPortfolio((p) => ({ ...p, objekte: [...p.objekte, o] }));
      return o.id;
    },
    dupliziere: (id) => {
      const neu = uid();
      setPortfolio((p) => {
        const o = p.objekte.find((x) => x.id === id);
        if (!o) return p;
        const kopie: Objekt = {
          ...structuredClone(o),
          id: neu,
          status: "plan",
          baseline: null,
          ist: { buchungen: [], stichtage: [] },
        };
        kopie.daten.name = `${o.daten.name} (Kopie)`;
        kopie.daten.finanzierung.darlehen = kopie.daten.finanzierung.darlehen.map((d) => ({ ...d, id: uid() }));
        return { ...p, objekte: [...p.objekte, kopie] };
      });
      return neu;
    },
    entferne: (id) => setPortfolio((p) => ({ ...p, objekte: p.objekte.filter((o) => o.id !== id) })),
    alsGekauft: (id) =>
      updateObjekt(id, (o) => ({ ...o, status: "bestand", baseline: o.baseline ?? structuredClone(o.daten) })),
    planNeuFestlegen: (id) => updateObjekt(id, (o) => ({ ...o, baseline: structuredClone(o.daten) })),
    importiere: (liste, steuerprofil) =>
      setPortfolio((p) => {
        let objekte = [...p.objekte];
        for (const { objekt, aktion } of liste) {
          if (aktion === "ersetzen" && objekte.some((o) => o.id === objekt.id)) {
            objekte = objekte.map((o) => (o.id === objekt.id ? objekt : o));
          } else {
            const id = objekte.some((o) => o.id === objekt.id) ? uid() : objekt.id;
            objekte.push({ ...objekt, id });
          }
        }
        return { ...p, steuerprofil: steuerprofil ?? p.steuerprofil, objekte };
      }),
    allesLoeschen: () => setPortfolio(leeresPortfolio()),
    beispieleLaden: () => setPortfolio(beispielPortfolio()),
    exportiert: () => {
      const jetzt = new Date().toISOString();
      schreiben(EXPORT_KEY, jetzt);
      setLetzterExport(jetzt);
    },
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider fehlt");
  return s;
}
