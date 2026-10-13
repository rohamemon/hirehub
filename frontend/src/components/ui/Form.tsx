import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface FieldProps {
  label: string; error?: string; hint?: string; className?: string;
}

/** Wraps a control with an accessible label, hint and error message. */
function Field({ label, error, hint, id, children, className = "" }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const aria = (id: string, error?: string, hint?: string) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps & { suggestions?: string[] }>(
  function Input({ label, error, hint, className, suggestions, ...rest }, ref) {
    const id = useId();
    return (
      <Field id={id} label={label} error={error} hint={hint} className={className}>
        <input id={id} ref={ref} className={`input ${error ? "input-error" : ""}`} {...aria(id, error, hint)}
          list={suggestions ? `${id}-list` : undefined} {...rest} />
        {suggestions && <datalist id={`${id}-list`}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
      </Field>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, error, hint, className, rows = 4, ...rest }, ref) {
    const id = useId();
    return (
      <Field id={id} label={label} error={error} hint={hint} className={className}>
        <textarea id={id} ref={ref} rows={rows} className={`input ${error ? "input-error" : ""}`} {...aria(id, error, hint)} {...rest} />
      </Field>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  function Select({ label, error, hint, className, children, ...rest }, ref) {
    const id = useId();
    return (
      <Field id={id} label={label} error={error} hint={hint} className={className}>
        <select id={id} ref={ref} className={`input ${error ? "input-error" : ""}`} {...aria(id, error, hint)} {...rest}>
          {children}
        </select>
      </Field>
    );
  },
);
