export function PriceRange({ value, label }: { value: number | null; label: string }) {
  if (!value) return null;
  return (
    <span aria-label={`${label}: ${"$".repeat(value)}`} className="font-medium">
      <span>{"$".repeat(value)}</span>
      <span className="text-muted/40">{"$".repeat(4 - value)}</span>
    </span>
  );
}
