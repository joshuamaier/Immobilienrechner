import { useEffect, useMemo, useRef, useState } from "react";
import { euro } from "./format";

export interface Serie {
  name: string;
  werte: (number | null)[];
  /** CSS-Variable, z. B. "--c1" */
  farbe: string;
  art?: "linie" | "flaeche" | "balken";
  gestrichelt?: boolean;
}

const M_WIDE = { top: 14, right: 14, bottom: 28, left: 72 };
const M_NARROW = { top: 12, right: 8, bottom: 26, left: 62 };

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) {
    max = min + 1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; ticks.length < 50; v += step) {
    ticks.push(Math.round(v / step) * step);
    if (v >= max - step * 1e-9) break;
  }
  return ticks;
}

const kurz = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 0 })} Tsd.`;
  return v.toLocaleString("de-DE", { maximumFractionDigits: 0 });
};

export function Chart({
  labels,
  serien,
  stapeln = false,
  hoehe = 260,
  format = euro,
  markierung,
  titel,
}: {
  labels: (string | number)[];
  serien: Serie[];
  stapeln?: boolean;
  hoehe?: number;
  format?: (v: number) => string;
  /** Index einer hervorgehobenen Spalte (z. B. heute) */
  markierung?: number;
  titel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // In tatsächlicher Breite zeichnen, damit Beschriftungen auf dem Handy lesbar bleiben.
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const M = W < 520 ? M_NARROW : M_WIDE;
  const n = labels.length;
  const H = W < 520 ? Math.round(hoehe * 0.85) : hoehe;
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const band = n > 0 ? innerW / n : innerW;

  const { stacks, ticks, y } = useMemo(() => {
    // Gestapelte Grenzen je Serie: [unten, oben]
    const stacks = serien.map(() => new Array<[number, number] | null>(n).fill(null));
    const pos = new Array(n).fill(0);
    const neg = new Array(n).fill(0);
    let lo = 0;
    let hi = 0;
    serien.forEach((s, si) => {
      for (let i = 0; i < n; i++) {
        const v = s.werte[i];
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        if (stapeln && s.art !== "linie") {
          const base = v >= 0 ? pos[i] : neg[i];
          stacks[si][i] = [base, base + v];
          if (v >= 0) pos[i] += v;
          else neg[i] += v;
        } else {
          stacks[si][i] = [0, v];
        }
        lo = Math.min(lo, stacks[si][i]![1], stacks[si][i]![0]);
        hi = Math.max(hi, stacks[si][i]![1]);
      }
    });
    const ticks = niceTicks(lo, hi);
    const t0 = ticks[0];
    const t1 = ticks[ticks.length - 1];
    const y = (v: number) => M.top + innerH - ((v - t0) / (t1 - t0 || 1)) * innerH;
    return { stacks, ticks, y };
  }, [serien, n, stapeln, innerH, M.top]);

  const x = (i: number) => M.left + band * i + band / 2;
  const labelStep = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(innerW / 56))));
  const balkenSerien = serien.filter((s) => s.art === "balken");
  const balkenBreite = Math.max(2, (band * 0.7) / (stapeln ? 1 : Math.max(1, balkenSerien.length)));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - M.left) / band);
    setHover(i >= 0 && i < n ? i : null);
  };

  return (
    <figure className="chart">
      <div className="chart-wrap" ref={wrapRef}>
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={titel}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? "axis-zero" : "grid"} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {kurz(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % labelStep === 0 ? (
              <text key={i} className="tick" x={x(i)} y={H - 8} textAnchor="middle">
                {l}
              </text>
            ) : null,
          )}
          {markierung !== undefined && markierung >= 0 && markierung < n && (
            <line className="marker" x1={x(markierung)} x2={x(markierung)} y1={M.top} y2={M.top + innerH} />
          )}

          {serien.map((s, si) => {
            const st = stacks[si];
            if (s.art === "balken") {
              const bi = balkenSerien.indexOf(s);
              return (
                <g key={s.name} style={{ fill: `var(${s.farbe})` }}>
                  {st.map((r, i) => {
                    if (!r) return null;
                    const off = stapeln ? -balkenBreite / 2 : -((balkenSerien.length * balkenBreite) / 2) + bi * balkenBreite;
                    const top = y(Math.max(r[0], r[1]));
                    const h = Math.max(0.5, Math.abs(y(r[0]) - y(r[1])));
                    return <rect key={i} x={x(i) + off} y={top} width={balkenBreite - 1} height={h} rx={1.5} />;
                  })}
                </g>
              );
            }
            const pts = st.map((r, i) => (r ? [x(i), y(r[1])] : null));
            const segs: string[] = [];
            let cur = "";
            pts.forEach((p) => {
              if (!p) {
                if (cur) segs.push(cur);
                cur = "";
              } else cur += `${cur ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
            });
            if (cur) segs.push(cur);
            if (s.art === "flaeche") {
              const idx = st.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
              if (!idx.length) return null;
              const top = idx.map((i) => `${x(i).toFixed(1)},${y(st[i]![1]).toFixed(1)}`).join("L");
              const bottom = [...idx].reverse().map((i) => `${x(i).toFixed(1)},${y(st[i]![0]).toFixed(1)}`).join("L");
              return (
                <g key={s.name}>
                  <path d={`M${top}L${bottom}Z`} style={{ fill: `var(${s.farbe})`, opacity: 0.28 }} />
                  <path d={`M${top}`} className="series-line" style={{ stroke: `var(${s.farbe})` }} />
                </g>
              );
            }
            return (
              <g key={s.name}>
                {segs.map((d, k) => (
                  <path key={k} d={d} className={`series-line${s.gestrichelt ? " dashed" : ""}`} style={{ stroke: `var(${s.farbe})` }} />
                ))}
              </g>
            );
          })}

          {hover !== null && <line className="hover-line" x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} />}
        </svg>
        {hover !== null && (
          <div className={`chart-tip${x(hover) > W * 0.6 ? " left" : ""}`} style={{ left: `${(x(hover) / W) * 100}%` }}>
            <strong>{labels[hover]}</strong>
            {serien.map((s) => {
              const v = s.werte[hover];
              if (v === null || v === undefined) return null;
              return (
                <span key={s.name}>
                  <i className="swatch" style={{ background: `var(${s.farbe})` }} />
                  {s.name}: <b>{format(v)}</b>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <figcaption className="legend">
        {serien.map((s) => (
          <span key={s.name}>
            <i className={`swatch${s.art === "linie" ? " line" : ""}${s.gestrichelt ? " dashed" : ""}`} style={{ background: `var(${s.farbe})`, borderColor: `var(${s.farbe})` }} />
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
