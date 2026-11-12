export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div className="h-8 w-56 animate-pulse rounded bg-line-soft" />
      <div className="h-32 animate-pulse rounded-md border border-line bg-surface" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
