import { NextResponse, after } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { simulateReplyNow } from '@/lib/demo/simulate-inbound';

/**
 * POST /api/demo/simulate-reply
 *
 * Demo-mode-only control: fires a simulated customer reply into an
 * existing conversation right now, via the same inbound-processing
 * pipeline the real WhatsApp webhook uses (contact/conversation
 * resolution, automations, Flows, dashboard updates all react exactly
 * as they would for a genuine Meta webhook). Lets an operator drive
 * the "reactivation automation" narrative live during a demo instead
 * of waiting on the background auto-reply timer.
 *
 * 404s outright unless the caller's account has `demo_mode` on
 * (migration 037) — resolved per-account so this route stays
 * demo-only even in a deployment that also hosts a real, non-demo
 * customer account.
 */
export async function POST(request: Request) {
  try {
    // Resolve the account FIRST — the gate below checks THIS
    // account's own `demo_mode` flag (migration 037), not a global
    // env var, so this route stays demo-only per-account even when
    // the deployment also hosts a real, non-demo customer account.
    const { supabase, accountId, account } = await getCurrentAccount();
    if (!account.demo_mode) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId =
      typeof body.conversationId === 'string' ? body.conversationId : null;
    const text = typeof body.text === 'string' ? body.text : undefined;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 },
      );
    }

    // Account-scoped lookup — mirrors sendMessageToConversation's own
    // conversation+contact fetch, so a caller can't simulate a reply
    // into another account's conversation by guessing a UUID.
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, contact:contacts(id, phone)')
      .eq('id', conversationId)
      .eq('account_id', accountId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    const contact = conversation.contact as unknown as
      | { id: string; phone: string }
      | null;
    if (!contact?.id) {
      return NextResponse.json(
        { error: 'Conversation has no contact' },
        { status: 400 },
      );
    }

    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('user_id')
      .eq('account_id', accountId)
      .maybeSingle();
    if (!config?.user_id) {
      return NextResponse.json(
        { error: 'WhatsApp not configured for this account' },
        { status: 400 },
      );
    }

    // Same reasoning as the real webhook route: process after the
    // response so the caller gets an immediate ack, but `after()`
    // keeps the function alive until the simulated inbound message is
    // fully processed (contact/automations/flows all run to completion).
    after(() =>
      simulateReplyNow({
        accountId,
        configOwnerUserId: config.user_id,
        contactId: contact.id,
        contactPhone: contact.phone,
        text,
      }).catch((err) => console.error('[demo] simulate-reply failed:', err)),
    );

    return NextResponse.json({ status: 'queued' });
  } catch (err) {
    return toErrorResponse(err);
  }
}
