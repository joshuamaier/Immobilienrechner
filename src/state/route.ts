import { useEffect, useState } from "react";

export type Route =
  | { seite: "uebersicht" }
  | { seite: "steuer" }
  | { seite: "daten" }
  | { seite: "objekt"; id: string; tab: "eingaben" | "ergebnis" | "ist" };

export function parseRoute(hash: string): Route {
  const teile = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (teile[0] === "steuer") return { seite: "steuer" };
  if (teile[0] === "daten") return { seite: "daten" };
  if (teile[0] === "objekt" && teile[1]) {
    const tab = teile[2] === "ergebnis" || teile[2] === "ist" ? teile[2] : "eingaben";
    return { seite: "objekt", id: decodeURIComponent(teile[1]), tab };
  }
  return { seite: "uebersicht" };
}

export const href = {
  uebersicht: () => "#/",
  steuer: () => "#/steuer",
  daten: () => "#/daten",
  objekt: (id: string, tab: "eingaben" | "ergebnis" | "ist" = "eingaben") => `#/objekt/${encodeURIComponent(id)}/${tab}`,
};

export function navigate(to: string) {
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
