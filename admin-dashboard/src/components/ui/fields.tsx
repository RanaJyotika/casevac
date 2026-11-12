import type { ReactNode } from "react";

interface BaseFieldProps {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

const control =
  "w-full rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-[#7a848f] disabled:bg-canvas disabled:text-muted";

function controlClass(error?: string) {
  return `${control} ${error ? "border-danger border-[1.5px]" : "border-line"}`;
}

function FieldShell({ name, label, required, error, hint, className = "", children }: BaseFieldProps & { children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={name} className="text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends BaseFieldProps {
  defaultValue?: string;
  type?: "text" | "date" | "tel" | "password";
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
}

export function TextField(props: TextFieldProps) {
  const { name, error, hint, required, type = "text", defaultValue, placeholder, autoComplete, maxLength, disabled, readOnly } = props;
  return (
    <FieldShell {...props}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClass(error)} h-10`}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends BaseFieldProps {
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function SelectField(props: SelectFieldProps) {
  const { name, error, hint, required, options, defaultValue, placeholder, disabled } = props;
  return (
    <FieldShell {...props}>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClass(error)} h-10`}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map(o => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends BaseFieldProps {
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}

export function TextAreaField(props: TextAreaFieldProps) {
  const { name, error, hint, required, defaultValue, rows = 3, maxLength, placeholder } = props;
  return (
    <FieldShell {...props}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`${controlClass(error)} py-2`}
      />
    </FieldShell>
  );
}

/** Converts a label map into select options. */
export function toOptions<T extends string>(map: Record<T, string>) {
  return (Object.entries(map) as [T, string][]).map(([value, label]) => ({ value, label }));
}
