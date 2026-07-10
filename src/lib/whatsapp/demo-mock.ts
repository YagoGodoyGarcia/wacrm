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

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true'
}

export function mockSendResult(): MetaSendResult {
  return { messageId: `wa.sim.${crypto.randomUUID()}` }
}

export function mockPhoneInfo(phoneNumberId: string): MetaPhoneInfo {
  return {
    id: phoneNumberId,
    display_phone_number: '+55 11 90000-0000',
    verified_name: 'Rifa da Sorte (Demo)',
    quality_rating: 'GREEN',
  }
}

export function mockRegisterResult(): RegisterPhoneNumberResult {
  return { success: true, alreadyRegistered: true }
}

export function mockSubscribeResult(): void {
  // no-op — mirrors subscribeWabaToApp's void return
}

export function mockSubscribedApps(): SubscribedApp[] {
  return [
    {
      whatsapp_business_api_data: {
        id: 'demo-app-id',
        name: 'Aposta Nacional CRM (demo)',
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
