import { formatDistanceToNowStrict } from 'date-fns'
import type { AutomationTriggerType } from '@/types'
import { dateFnsLocale } from '@/lib/date-fns-locale'

export interface TriggerPillMeta {
  /** Tailwind classes for the Badge pill on the list row. */
  pillClass: string
}

/** Label text lives in messages (Automations.builder.triggers.<type>.label) —
 *  this only owns the pill's Tailwind classes. */
export const TRIGGER_META: Record<AutomationTriggerType, TriggerPillMeta> = {
  new_message_received: {
    pillClass: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  first_inbound_message: {
    pillClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  },
  keyword_match: {
    pillClass: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
  },
  new_contact_created: {
    pillClass: 'border-primary/30 bg-primary/10 text-primary',
  },
  conversation_assigned: {
    pillClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  },
  tag_added: {
    pillClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  time_based: {
    pillClass: 'border-slate-500/30 bg-slate-500/10 text-muted-foreground',
  },
  interactive_reply: {
    pillClass: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
  },
}

export function triggerMeta(t: AutomationTriggerType | string): TriggerPillMeta {
  return (
    TRIGGER_META[t as AutomationTriggerType] ?? {
      pillClass: 'border-slate-500/30 bg-slate-500/10 text-muted-foreground',
    }
  )
}

/** Locale-aware "5 minutes ago" / "há 5 minutos" string. `neverLabel` is
 *  rendered as-is when `iso` is missing/invalid. */
export function formatRelative(
  iso: string | null | undefined,
  locale: string,
  neverLabel: string,
): string {
  if (!iso) return neverLabel
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return neverLabel
  return formatDistanceToNowStrict(then, {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  })
}
