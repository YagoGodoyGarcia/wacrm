import crypto from 'node:crypto'
import { processMessage, handleStatusUpdate } from '@/lib/webhooks/process-inbound'
import { supabaseAdmin } from '@/lib/flows/admin-client'

// ============================================================
// DEMO_MODE "looks alive" scheduling — status ticks on outbound sends
// and simulated customer replies. Deliberately NOT imported by
// meta-api.ts (which only fakes the network response) — this module
// owns everything past that point, called explicitly by
// send-message.ts / broadcast-core.ts once they have a fake result in
// hand. Reuses the real inbound webhook processing (processMessage /
// handleStatusUpdate) so automations, Flows, and the dashboard behave
// exactly as they would for a genuine Meta webhook.
// ============================================================

const DEMO_REPLY_POOL = [
  'Oi! Vi a mensagem, ainda dá tempo de comprar um número?',
  'Qual foi o número da sorte que saiu no último sorteio?',
  'Cadê meu comprovante da compra? Não recebi nada.',
  'Isso é sério? Ganhei e não sorteou o prêmio ainda, quando sai o resultado?',
  'Como faço para pagar, tem Pix?',
  'Quero participar de novo, faz tempo que não jogo.',
  'Recebi o comprovante, obrigado!',
  'Vocês ainda têm números disponíveis para essa rifa?',
  'Perdi a data do sorteio passado, tem outro chegando?',
  'Pode me confirmar se meu número foi mesmo registrado?',
]

function pickReply(): string {
  return DEMO_REPLY_POOL[Math.floor(Math.random() * DEMO_REPLY_POOL.length)]
}

function fakeTimestamp(): string {
  return String(Math.floor(Date.now() / 1000))
}

/**
 * Simulate Meta's delivery/read webhook ticks for a demo-mode send.
 * No-ops unless `demoMode` is true — callers resolve this from the
 * sending account's own `accounts.demo_mode` flag (migration 037)
 * rather than a global env var, so demo accounts and the real
 * customer account can coexist in the same deployment. Fire-and-
 * forget — timer callbacks log and swallow their own errors, matching
 * the real webhook's best-effort status handling.
 */
export function scheduleDemoStatusTicks(waMessageId: string, demoMode: boolean): void {
  if (!demoMode) return

  setTimeout(() => {
    handleStatusUpdate({
      id: waMessageId,
      status: 'delivered',
      timestamp: fakeTimestamp(),
      recipient_id: '',
    }).catch((err) => console.error('[demo] delivered tick failed:', err))
  }, 1500 + Math.random() * 1500)

  setTimeout(() => {
    handleStatusUpdate({
      id: waMessageId,
      status: 'read',
      timestamp: fakeTimestamp(),
      recipient_id: '',
    }).catch((err) => console.error('[demo] read tick failed:', err))
  }, 5000 + Math.random() * 3000)
}

interface InjectReplyParams {
  accountId: string
  configOwnerUserId: string
  contactId: string
  /** Fallback if the contact row lookup fails for some reason. */
  contactPhone?: string
}

interface MaybeScheduleAutoReplyParams extends InjectReplyParams {
  /** Resolved from the account's `accounts.demo_mode` flag. No-ops
   *  when false — see `scheduleDemoStatusTicks` for the same pattern. */
  demoMode: boolean
  probability?: number
}

async function injectReply(params: InjectReplyParams, text: string): Promise<void> {
  const db = supabaseAdmin()
  const { data: contact } = await db
    .from('contacts')
    .select('name, phone')
    .eq('id', params.contactId)
    .maybeSingle()

  const phone = contact?.phone ?? params.contactPhone
  if (!phone) {
    console.error('[demo] injectReply: no phone available for contact', params.contactId)
    return
  }
  const name = contact?.name || phone

  await processMessage(
    {
      id: `wa.sim.reply.${crypto.randomUUID()}`,
      from: phone,
      timestamp: fakeTimestamp(),
      type: 'text',
      text: { body: text },
    },
    { profile: { name }, wa_id: phone },
    params.accountId,
    params.configOwnerUserId,
    'demo', // accessToken — unused for plain text inbound
  )
}

// Cooldown so a single contact can't fire more than one auto-reply in
// quick succession (e.g. broadcast fan-out to the same contact twice).
const lastAutoReplyAt = new Map<string, number>()
const AUTO_REPLY_COOLDOWN_MS = 5 * 60 * 1000

/**
 * With `probability` chance, schedule a simulated customer reply
 * 10-40s from now. No-ops unless `params.demoMode` is true. Used
 * after a demo-mode template send (broadcast fan-out or a one-off
 * template) so a live demo shows some recipients replying on their
 * own, feeding the reactivation automation end-to-end.
 */
export function maybeScheduleAutoReply(
  params: MaybeScheduleAutoReplyParams,
): void {
  if (!params.demoMode) return
  const probability = params.probability ?? 0.4
  if (Math.random() > probability) return

  const last = lastAutoReplyAt.get(params.contactId)
  if (last && Date.now() - last < AUTO_REPLY_COOLDOWN_MS) return

  const delay = 10_000 + Math.random() * 30_000
  setTimeout(() => {
    lastAutoReplyAt.set(params.contactId, Date.now())
    injectReply(params, pickReply()).catch((err) =>
      console.error('[demo] auto-reply failed:', err),
    )
  }, delay)
}

/**
 * Fire a simulated customer reply immediately — the manual "Simulate
 * reply" control. Always available in demo mode regardless of
 * probability/cooldown, since an operator explicitly asked for it.
 */
export async function simulateReplyNow(
  params: InjectReplyParams & { text?: string },
): Promise<void> {
  await injectReply(params, params.text?.trim() || pickReply())
}
