import crypto from 'node:crypto'
import type {
  MetaSendResult,
  MetaPhoneInfo,
  RegisterPhoneNumberResult,
  SubscribedApp,
  SubmitMessageTemplateResult,
} from './meta-api'

// ============================================================
// DEMO_MODE — canned stand-ins for every network-calling export in
// meta-api.ts. No scheduling / follow-up logic lives here on purpose:
// this file must stay leaf-level (no imports from the webhook or
// automation layers) so callers that DO want "looks alive" behavior
// (status ticks, simulated replies — see src/lib/demo/simulate-inbound.ts)
// can layer it on without an import cycle back into meta-api.ts.
// ============================================================

/**
 * Legacy global gate — the DEMO_MODE env var used to be the ONLY way
 * to flip a deployment into demo mode. Since the accounts.demo_mode
 * column (migration 037) lets each account opt in independently,
 * every real call site now resolves the account's own flag and
 * passes it explicitly as `demoMode` instead of calling this. It's
 * kept as a fallback (`args.demoMode ?? isDemoMode()`) so a call site
 * that hasn't been threaded through yet still fails safe to the old
 * behaviour rather than silently hitting the real Meta API.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true'
}

export function mockSendResult(): MetaSendResult {
  return { messageId: `wa.sim.${crypto.randomUUID()}` }
}

/**
 * `accountName` personalizes the canned `verified_name` so a demo
 * account (e.g. "Sabor Caseiro") doesn't show another tenant's name
 * ("Rifa da Sorte (Demo)") in its own connection-test toast. Falls
 * back to a generic label when no account name is available.
 */
export function mockPhoneInfo(
  phoneNumberId: string,
  accountName?: string,
): MetaPhoneInfo {
  return {
    id: phoneNumberId,
    display_phone_number: '+55 11 90000-0000',
    verified_name: accountName ? `${accountName} (Demo)` : 'Conta Demo',
    quality_rating: 'GREEN',
  }
}

export function mockRegisterResult(): RegisterPhoneNumberResult {
  return { success: true, alreadyRegistered: true }
}

export function mockSubscribeResult(): void {
  // no-op — mirrors subscribeWabaToApp's void return
}

export function mockSubscribedApps(accountName?: string): SubscribedApp[] {
  return [
    {
      whatsapp_business_api_data: {
        id: 'demo-app-id',
        name: accountName ? `${accountName} (demo)` : 'CRM (demo)',
        link: 'https://wacrm.tech',
      },
    },
  ]
}

export function mockSubmitTemplateResult(): SubmitMessageTemplateResult {
  return { id: `demo-${crypto.randomUUID()}`, status: 'APPROVED', category: 'MARKETING' }
}

export function mockEditTemplateResult(): { success: boolean } {
  return { success: true }
}
