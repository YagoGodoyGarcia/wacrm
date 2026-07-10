import { NextResponse, after } from 'next/server';
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account';
import { runAutomationsForTrigger } from '@/lib/automations/engine';

const INACTIVE_TAG_NAME = 'inativo 60+ dias';

/**
 * POST /api/demo/trigger-reactivation
 *
 * Demo-mode-only control: tags a contact "inativo 60+ dias" (idempotent)
 * and fires the `tag_added` automation trigger for it.
 *
 * Why this exists: `tag_added` is a real, fully-built trigger type (see
 * `src/lib/automations/engine.ts` + the automation builder UI), but
 * nothing in the app today calls `runAutomationsForTrigger` for it —
 * the tag-toggle UI (contact-detail-view, contact-form, contact-sidebar)
 * writes `contact_tags` directly via the client-side Supabase client, no
 * server route in between. Wiring that up properly is a bigger, riskier
 * change to real production tag UI than is safe hours before a demo, so
 * this demo-only route reuses the existing, already-tested automation
 * engine to make the "Reativação" automation demonstrable live, without
 * touching the real tag-toggle components at all.
 */
export async function POST(request: Request) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { supabase, accountId } = await getCurrentAccount();

    const body = await request.json().catch(() => ({}));
    const contactId =
      typeof body.contactId === 'string' ? body.contactId : null;
    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 },
      );
    }

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('account_id', accountId)
      .eq('name', INACTIVE_TAG_NAME)
      .maybeSingle();
    if (tagError || !tag) {
      return NextResponse.json(
        { error: `Tag "${INACTIVE_TAG_NAME}" not found — run npm run demo:setup first.` },
        { status: 400 },
      );
    }

    // Idempotent — ignore the unique-violation if the contact already
    // carries this tag (re-clicking the demo button shouldn't error).
    await supabase
      .from('contact_tags')
      .upsert(
        { contact_id: contactId, tag_id: tag.id },
        { onConflict: 'contact_id,tag_id', ignoreDuplicates: true },
      );

    after(() =>
      runAutomationsForTrigger({
        accountId,
        triggerType: 'tag_added',
        contactId,
        context: { tag_id: tag.id },
      }),
    );

    return NextResponse.json({ status: 'queued' });
  } catch (err) {
    return toErrorResponse(err);
  }
}
