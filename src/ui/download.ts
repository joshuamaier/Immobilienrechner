/** Datei im Browser herunterladen. */
export function download(dateiname: string, inhalt: string, typ = "application/json"): void {
  const blob = new Blob([inhalt], { type: `${typ};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
