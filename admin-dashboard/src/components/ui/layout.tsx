import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? <p className="text-xs font-medium text-muted">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {description ? <div className="max-w-3xl text-sm text-ink-2">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  footer,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-md border border-line bg-surface ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          {title ? <h2 className="text-[15px] font-semibold text-ink">{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
      {footer ? <div className="border-t border-line bg-canvas px-5 py-3 text-sm text-ink-2">{footer}</div> : null}
    </section>
  );
}

const alertStyles = {
  info: { box: "border-line bg-surface text-ink-2", Icon: Info },
  ok: { box: "border-ok-line bg-ok-bg text-ok", Icon: CheckCircle2 },
  warn: { box: "border-warn-line bg-warn-bg text-warn", Icon: AlertTriangle },
  danger: { box: "border-danger-line bg-danger-bg text-danger", Icon: XCircle },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof alertStyles;
  title?: string;
  children?: ReactNode;
}) {
  const { box, Icon } = alertStyles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-md border px-4 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-5">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {children ? <div className="max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function DefinitionGrid({
  items,
}: {
  /** `wide` items span both columns (for values with controls or long text). */
  items: ReadonlyArray<{ label: string; value: ReactNode; mono?: boolean; wide?: boolean }>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 px-5 py-2 sm:grid-cols-2">
      {items.map(item => (
        <div key={item.label} className={`min-w-0 border-b border-line-soft py-2.5 ${item.wide ? "sm:col-span-2" : ""}`}>
          <dt className="text-xs text-muted">{item.label}</dt>
          <dd className={`mt-0.5 text-sm text-ink ${item.mono ? "font-mono" : ""}`}>
            {item.value === "" || item.value === null || item.value === undefined ? (
              <span className="text-muted">Not recorded</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* Tables */
export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`bg-canvas px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-ink-2 uppercase ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-t border-line-soft px-4 py-3 align-middle ${className}`}>{children}</td>;
}
