import { ptBR } from "date-fns/locale";
import type { Locale } from "date-fns";

/** Maps the app's next-intl locale to a date-fns Locale for relative/absolute date formatting. */
export function dateFnsLocale(appLocale: string): Locale | undefined {
  return appLocale === "pt-BR" ? ptBR : undefined;
}
