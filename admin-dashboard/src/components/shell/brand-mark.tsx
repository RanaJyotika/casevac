export function BrandMark({ subtitle = "Admin Console" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-md border-[1.5px] border-brand text-brand" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-[0.1em] text-ink">CASEVAC</span>
        <span className="text-xs text-muted">{subtitle}</span>
      </span>
    </div>
  );
}
