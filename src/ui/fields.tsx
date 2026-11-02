import { useEffect, useId, useState, type ReactNode } from "react";
import { MONATE, parseZahl } from "./format";

interface Base {
  label: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
  id?: string;
}

function formatEingabe(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(Math.round(v * 10000) / 10000).replace(".", ",");
}

export function NumberField({
  label,
  hint,
  wide,
  value,
  onChange,
  unit,
  min,
  max,
  nullable,
  placeholder,
  id: idProp,
}: Base & {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  placeholder?: string;
}) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [text, setText] = useState(formatEingabe(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(formatEingabe(value));
  }, [value, focus]);
  const describedBy = [unit ? `${id}-unit` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field${wide ? " wide" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="with-unit">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-describedby={describedBy}
          value={text}
          placeholder={placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            setText(formatEingabe(value));
          }}
          onChange={(e) => {
            setText(e.target.value);
            let n = parseZahl(e.target.value);
            if (n === null) {
              if (nullable) onChange(null);
              return;
            }
            if (min !== undefined) n = Math.max(min, n);
            if (max !== undefined) n = Math.min(max, n);
            onChange(n);
          }}
        />
        {unit && <em id={`${id}-unit`}>{unit}</em>}
      </span>
      {hint && (
        <small className="hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}

export function TextField({ label, hint, wide, value, onChange }: Base & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className={`field${wide ? " wide" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} type="text" value={value} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
      {hint && (
        <small className="hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}

export function TextArea({ label, hint, wide, value, onChange }: Base & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className={`field${wide ? " wide" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} rows={5} value={value} aria-describedby={hint ? `${id}-hint` : undefined} onChange={(e) => onChange(e.target.value)} />
      {hint && (
        <small className="hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}

export function SelectField<T extends string | number>({
  label,
  hint,
  wide,
  value,
  options,
  onChange,
}: Base & { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className={`field${wide ? " wide" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        value={String(value)}
        onChange={(e) => {
          const found = options.find(([v]) => String(v) === e.target.value);
          if (found) onChange(found[0]);
        }}
      >
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
      {hint && (
        <small className="hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
    </div>
  );
}

export function CheckField({ label, hint, wide, checked, onChange }: Base & { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label className={`field check${wide ? " wide" : ""}`} htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <small className="hint">{hint}</small>}
      </span>
    </label>
  );
}

/** Monat + Jahr als "YYYY-MM". */
export function MonthField({ label, hint, wide, value, onChange }: Base & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [j, m] = value.split("-").map(Number);
  const [jahrText, setJahrText] = useState(String(j || ""));
  useEffect(() => setJahrText(String(j || "")), [j]);
  const set = (jahr: number, monat: number) => onChange(`${jahr}-${String(monat).padStart(2, "0")}`);
  return (
    <div className={`field${wide ? " wide" : ""}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <span className="month-input">
        <select id={id} aria-label="Monat" value={m || 1} onChange={(e) => set(j, Number(e.target.value))}>
          {MONATE.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          aria-label="Jahr"
          value={jahrText}
          onChange={(e) => {
            setJahrText(e.target.value);
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1950 && n <= 2100) set(n, m || 1);
          }}
        />
      </span>
      {hint && <small className="hint">{hint}</small>}
    </div>
  );
}

/** Schaltfläche mit Bestätigung im Seiteninhalt (kein Browser-Dialog). */
export function ConfirmButton({
  children,
  confirmText,
  confirmLabel,
  onConfirm,
  className = "btn",
}: {
  children: ReactNode;
  confirmText: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
    );
  return (
    <div className="confirm" role="alertdialog" aria-live="polite">
      <p>{confirmText}</p>
      <div className="row-gap">
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
