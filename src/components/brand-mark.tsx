/**
 * "AN" monogram — the compact brand mark for Aposta Nacional CRM, used
 * on the pre-login auth pages (login/signup/forgot-password) where no
 * account is known yet. The full illustrated logo (cards/dice/clover)
 * doesn't hold up at icon size, so this mirrors what most brands do: a
 * simplified monogram in the brand's exact blue for anything below
 * hero size.
 *
 * Inside the signed-in app, the sidebar shows a per-account monogram
 * instead (see `accountInitials` below) — this component stays as the
 * generic pre-auth fallback and the deployment's own identity.
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

/**
 * Derives a 1-2 letter monogram from an account's display name, for the
 * sidebar's per-account brand mark. wacrm is multi-tenant (migration
 * 017) — each account has its own `name` — but until now the sidebar
 * ignored it and always showed the hardcoded "AN"/"Aposta Nacional CRM"
 * regardless of which account was signed in. This is the fix: any
 * account whose name doesn't happen to start with "Aposta Nacional"
 * gets its own initials instead of silently wearing the wrong brand.
 *
 *   "Transportadora Nacional" -> "TN"
 *   "Aposta Nacional CRM"     -> "AN"
 *   "acme"                    -> "AC" (single word: first two letters)
 */
export function accountInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
