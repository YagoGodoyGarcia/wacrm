/**
 * "AN" monogram — the compact brand mark for Aposta Nacional CRM, used
 * everywhere a small square icon is needed (sidebar logo, auth pages).
 * The full illustrated logo (cards/dice/clover) doesn't hold up at
 * icon size, so this mirrors what most brands do: a simplified
 * monogram in the brand's exact blue for anything below hero size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.06em" }}
      aria-hidden
    >
      AN
    </span>
  );
}
