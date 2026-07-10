// ============================================================
// Demo seed / reset script for wacrm's DEMO_MODE.
//
// Run via `npm run demo:setup` (first run) or `npm run demo:reset`
// (wipe + reseed). Creates a demo login, then seeds ~40 Brazilian
// raffle-bettor contacts with tags, realistic conversation history,
// a sales pipeline, message templates, historical broadcasts, and the
// two reactivation automations described in the project brief.
//
// Bypasses the real send pipeline entirely (raw inserts, not
// createBroadcast/deliverBroadcast/processMessage) — seeding must
// never fire a live Meta call or an automation storm.
// ============================================================

import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

loadEnvConfig(process.cwd());

const RESET = process.argv.includes('--reset');

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@wacrm.local';
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'DemoRifa123!';

const TAG_ATIVO = 'ativo';
const TAG_INATIVO_30_60 = 'inativo 30-60 dias';
const TAG_INATIVO_60 = 'inativo 60+ dias';

// First contact seeded — used to detect "already seeded" on a plain
// `demo:setup` re-run (without --reset).
const SENTINEL_PHONE = '+5511900000001';

function daysAgo(days: number, extraHours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - extraHours);
  return d.toISOString();
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`\nMissing required env var: ${name}.`);
    console.error('Fill in .env.local first (see .env.local.example) and try again.\n');
    process.exit(1);
  }
  return v;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ------------------------------------------------------------
// Contact generation
// ------------------------------------------------------------

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Fábio', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Otávio',
  'Patrícia', 'Rafael', 'Sabrina', 'Thiago', 'Vanessa', 'Wesley', 'Yasmin',
  'Camila', 'Douglas', 'Eduarda', 'Felipe', 'Giovana', 'Hugo', 'Ingrid',
  'Jorge', 'Kátia', 'Leandro', 'Mônica', 'Natália', 'Paulo', 'Renata',
  'Sérgio', 'Tatiane', 'Vinícius', 'Aline',
] as const;

const LAST_NAMES = [
  'Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Costa', 'Rodrigues',
  'Almeida', 'Nascimento', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Melo',
  'Barbosa', 'Ribeiro', 'Alves', 'Monteiro', 'Cardoso', 'Reis', 'Teixeira',
  'Correia', 'Lima', 'Pinto', 'Moreira', 'Cavalcanti', 'Dias', 'Castro',
  'Campos', 'Andrade', 'Vieira', 'Freitas', 'Barros', 'Mendes', 'Ramos',
  'Nunes', 'Moura', 'Rocha', 'Fonseca', 'Machado',
] as const;

interface ContactSeed {
  name: string;
  phone: string;
  segment: 'ativo' | 'inativo_30_60' | 'inativo_60';
  lastActivityDaysAgo: number;
}

function buildContactSeeds(): ContactSeed[] {
  const seeds: ContactSeed[] = [];
  for (let i = 0; i < 40; i++) {
    const name = `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`;
    const phone = `+5511${String(900000001 + i).padStart(9, '0')}`;
    let segment: ContactSeed['segment'];
    let lastActivityDaysAgo: number;
    if (i < 12) {
      segment = 'ativo';
      lastActivityDaysAgo = Math.floor(Math.random() * 20); // 0-19 days
    } else if (i < 26) {
      segment = 'inativo_30_60';
      lastActivityDaysAgo = 31 + Math.floor(Math.random() * 29); // 31-59 days
    } else {
      segment = 'inativo_60';
      lastActivityDaysAgo = 61 + Math.floor(Math.random() * 90); // 61-150 days
    }
    seeds.push({ name, phone, segment, lastActivityDaysAgo });
  }
  return seeds;
}

// ------------------------------------------------------------
// Conversation content
// ------------------------------------------------------------

const MESSAGE_PAIRS: Record<string, { customer: string; agent: string }> = {
  numero_sorte: {
    customer: 'Oi! Qual foi o número da sorte que saiu no último sorteio?',
    agent: 'Oi! O número sorteado foi o 4821 🎉 Quer participar da próxima rifa?',
  },
  comprovante: {
    customer: 'Cadê meu comprovante da compra? Não recebi nada.',
    agent: "Claro! Segue seu comprovante: número 1187, rifa \"Moto 0km\". Qualquer dúvida é só chamar!",
  },
  reclamacao: {
    customer: 'Isso é sério? Já passou da data do sorteio e não vi resultado nenhum.',
    agent: 'Peço desculpas pela demora! O sorteio foi remarcado para o dia 15 por conta da Loteria Federal. Vamos te avisar assim que sair.',
  },
  pagamento: {
    customer: 'Como faço para pagar, tem Pix?',
    agent: 'Temos sim! Pix: 11999998888 (Rifa da Sorte). Assim que confirmar o pagamento, te mando o número 😊',
  },
};
const MESSAGE_CATEGORIES = Object.keys(MESSAGE_PAIRS);

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function main() {
  const url = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
  required('ENCRYPTION_KEY');

  // Loaded dynamically so it reads ENCRYPTION_KEY from the env vars
  // loadEnvConfig() just populated — a static top-level import would
  // evaluate before that env is in place.
  const { encrypt } = await import('../src/lib/whatsapp/encryption');

  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n=== wacrm demo ${RESET ? 'reset' : 'setup'} ===\n`);

  const { accountId, userId } = await ensureDemoAccount(db);
  console.log(`Account: ${accountId}  (login: ${DEMO_USER_EMAIL})`);

  if (RESET) {
    await wipeAccountData(db, accountId);
  } else {
    const { data: sentinel } = await db
      .from('contacts')
      .select('id')
      .eq('account_id', accountId)
      .eq('phone', SENTINEL_PHONE)
      .maybeSingle();
    if (sentinel) {
      console.log('\nDemo data already present. Run `npm run demo:reset` to wipe and reseed.\n');
      return;
    }
  }

  console.log('Seeding tags...');
  const tagIds = await seedTags(db, accountId, userId);

  console.log('Seeding pipeline...');
  const pipeline = await seedPipeline(db, accountId, userId);

  console.log('Seeding 40 contacts...');
  const contacts = await seedContacts(db, accountId, userId, tagIds);

  console.log('Seeding conversation history...');
  await seedConversations(db, accountId, userId, contacts);

  console.log('Seeding pipeline deals...');
  await seedDeals(db, accountId, userId, pipeline, contacts);

  console.log('Seeding message templates...');
  const templates = await seedTemplates(db, accountId, userId);

  console.log('Seeding WhatsApp config...');
  if (process.env.DEMO_MODE === 'true') {
    await seedWhatsappConfig(db, accountId, userId, encrypt);
  } else if (process.env.WA_PHONE_NUMBER_ID && process.env.CLOUD_API_ACCESS_TOKEN) {
    await seedWhatsappConfig(db, accountId, userId, encrypt, {
      phoneNumberId: process.env.WA_PHONE_NUMBER_ID,
      wabaId: process.env.WA_BUSINESS_ACCOUNT_ID,
      accessToken: process.env.CLOUD_API_ACCESS_TOKEN,
    });
    console.log(
      '  Saved real WhatsApp credentials from env vars. Open Settings → WhatsApp → ' +
      '"Verify Registration" once to confirm the number is live for inbound messages.',
    );
  } else {
    console.log('  Skipped (DEMO_MODE is off and no WA_PHONE_NUMBER_ID/CLOUD_API_ACCESS_TOKEN set). ' +
      'Configure WhatsApp from Settings after logging in.');
  }

  console.log('Seeding historical broadcasts...');
  await seedBroadcasts(db, accountId, userId, templates, contacts, tagIds);

  console.log('Seeding automations...');
  await seedAutomations(db, accountId, userId, tagIds, templates);

  console.log('\n✅ Demo data ready.');
  console.log(`   Login: ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`);
  console.log('   Run `npm run demo:reset` any time to wipe and reseed.\n');
}

// ------------------------------------------------------------
// Account bootstrap
// ------------------------------------------------------------

async function ensureDemoAccount(
  db: SupabaseClient,
): Promise<{ accountId: string; userId: string }> {
  let userId: string | undefined;

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: DEMO_USER_EMAIL,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
  } else {
    // Most likely "already registered" — look the user up instead.
    const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => u.email === DEMO_USER_EMAIL);
    if (!existing) {
      throw createErr ?? new Error(`Could not create or find user ${DEMO_USER_EMAIL}`);
    }
    userId = existing.id;
  }

  // handle_new_user() (migration 017) runs in the same transaction as
  // the INSERT into auth.users, so the profile/account should already
  // exist by the time createUser() resolves. Short retry as a safety
  // net, not because it's expected to be needed.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: profile } = await db
      .from('profiles')
      .select('account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile?.account_id) {
      return { accountId: profile.account_id as string, userId: userId! };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Profile for ${DEMO_USER_EMAIL} never got an account_id — is the ` +
    'handle_new_user trigger installed (run all supabase/migrations)?',
  );
}

// ------------------------------------------------------------
// Reset
// ------------------------------------------------------------

async function wipeAccountData(db: SupabaseClient, accountId: string) {
  console.log('Resetting existing demo data for this account...');

  const { data: autos } = await db.from('automations').select('id').eq('account_id', accountId);
  const autoIds = (autos ?? []).map((a) => a.id as string);
  if (autoIds.length) await db.from('automation_steps').delete().in('automation_id', autoIds);
  await db.from('automation_logs').delete().eq('account_id', accountId);
  await db.from('automation_pending_executions').delete().eq('account_id', accountId);
  await db.from('automations').delete().eq('account_id', accountId);

  const { data: bcasts } = await db.from('broadcasts').select('id').eq('account_id', accountId);
  const bcastIds = (bcasts ?? []).map((b) => b.id as string);
  if (bcastIds.length) await db.from('broadcast_recipients').delete().in('broadcast_id', bcastIds);
  await db.from('broadcasts').delete().eq('account_id', accountId);

  await db.from('deals').delete().eq('account_id', accountId);

  const { data: convs } = await db.from('conversations').select('id').eq('account_id', accountId);
  const convIds = (convs ?? []).map((c) => c.id as string);
  if (convIds.length) await db.from('messages').delete().in('conversation_id', convIds);
  await db.from('conversations').delete().eq('account_id', accountId);

  await db.from('message_templates').delete().eq('account_id', accountId);

  const { data: pipelines } = await db.from('pipelines').select('id').eq('account_id', accountId);
  const pipelineIds = (pipelines ?? []).map((p) => p.id as string);
  if (pipelineIds.length) await db.from('pipeline_stages').delete().in('pipeline_id', pipelineIds);
  await db.from('pipelines').delete().eq('account_id', accountId);

  // contact_tags cascades via FK ON DELETE CASCADE on both sides.
  await db.from('contacts').delete().eq('account_id', accountId);
  await db.from('tags').delete().eq('account_id', accountId);

  await db.from('whatsapp_config').delete().eq('account_id', accountId);
}

// ------------------------------------------------------------
// Tags
// ------------------------------------------------------------

async function seedTags(
  db: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<Record<string, string>> {
  const rows = [
    { name: TAG_ATIVO, color: '#22c55e' },
    { name: TAG_INATIVO_30_60, color: '#f59e0b' },
    { name: TAG_INATIVO_60, color: '#ef4444' },
  ].map((t) => ({ account_id: accountId, user_id: userId, name: t.name, color: t.color }));

  const { data, error } = await db.from('tags').insert(rows).select('id, name');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((t) => [t.name as string, t.id as string]));
}

// ------------------------------------------------------------
// Pipeline
// ------------------------------------------------------------

const STAGE_NAMES = ['Novo lead', 'Em negociação', 'Comprou', 'Recuperado', 'Perdido'] as const;
const STAGE_COLORS = ['#64748b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444'];

async function seedPipeline(
  db: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<{ id: string; stages: Record<string, string> }> {
  const { data: pipeline, error } = await db
    .from('pipelines')
    .insert({ account_id: accountId, user_id: userId, name: 'Rifas' })
    .select('id')
    .single();
  if (error || !pipeline) throw error ?? new Error('pipeline insert failed');

  const stageRows = STAGE_NAMES.map((name, i) => ({
    pipeline_id: pipeline.id,
    name,
    position: i,
    color: STAGE_COLORS[i],
  }));
  const { data: stages, error: stageErr } = await db
    .from('pipeline_stages')
    .insert(stageRows)
    .select('id, name');
  if (stageErr) throw stageErr;

  return {
    id: pipeline.id as string,
    stages: Object.fromEntries((stages ?? []).map((s) => [s.name as string, s.id as string])),
  };
}

// ------------------------------------------------------------
// Contacts + tags
// ------------------------------------------------------------

interface SeededContact extends ContactSeed {
  id: string;
}

async function seedContacts(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  tagIds: Record<string, string>,
): Promise<SeededContact[]> {
  const seeds = buildContactSeeds();
  const rows = seeds.map((s) => ({
    account_id: accountId,
    user_id: userId,
    name: s.name,
    phone: s.phone,
  }));

  const { data, error } = await db.from('contacts').insert(rows).select('id, phone');
  if (error) throw error;

  const idByPhone = new Map((data ?? []).map((c) => [c.phone as string, c.id as string]));
  const contacts: SeededContact[] = seeds.map((s) => ({ ...s, id: idByPhone.get(s.phone)! }));

  const segmentTag: Record<ContactSeed['segment'], string> = {
    ativo: tagIds[TAG_ATIVO],
    inativo_30_60: tagIds[TAG_INATIVO_30_60],
    inativo_60: tagIds[TAG_INATIVO_60],
  };
  const contactTagRows = contacts.map((c) => ({
    contact_id: c.id,
    tag_id: segmentTag[c.segment],
  }));
  const { error: ctErr } = await db.from('contact_tags').insert(contactTagRows);
  if (ctErr) throw ctErr;

  return contacts;
}

// ------------------------------------------------------------
// Conversations + messages
// ------------------------------------------------------------

async function seedConversations(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  contacts: SeededContact[],
) {
  for (const contact of contacts) {
    const category = pick(MESSAGE_CATEGORIES);
    const pair = MESSAGE_PAIRS[category];
    const baseDaysAgo = contact.lastActivityDaysAgo;

    const { data: conv, error: convErr } = await db
      .from('conversations')
      .insert({
        account_id: accountId,
        user_id: userId,
        contact_id: contact.id,
        status: contact.segment === 'inativo_60' ? 'closed' : 'open',
        last_message_text: pair.agent,
        last_message_at: daysAgo(baseDaysAgo),
        unread_count: contact.segment === 'ativo' && Math.random() > 0.6 ? 1 : 0,
      })
      .select('id')
      .single();
    if (convErr || !conv) throw convErr ?? new Error('conversation insert failed');

    const messages = [
      {
        conversation_id: conv.id,
        sender_type: 'customer',
        content_type: 'text',
        content_text: pair.customer,
        status: 'delivered',
        created_at: daysAgo(baseDaysAgo, 2),
      },
      {
        conversation_id: conv.id,
        sender_type: 'agent',
        content_type: 'text',
        content_text: pair.agent,
        status: 'read',
        created_at: daysAgo(baseDaysAgo, 1),
      },
    ];

    // Active contacts get one extra fresh exchange so "today" dashboard
    // metrics have real recent activity to show.
    if (contact.segment === 'ativo' && Math.random() > 0.4) {
      messages.push({
        conversation_id: conv.id,
        sender_type: 'customer',
        content_type: 'text',
        content_text: 'Comprei de novo, valeu! Quando é o próximo sorteio?',
        status: 'delivered',
        created_at: daysAgo(0, Math.floor(Math.random() * 6)),
      });
    }

    const { error: msgErr } = await db.from('messages').insert(messages);
    if (msgErr) throw msgErr;
  }
}

// ------------------------------------------------------------
// Deals
// ------------------------------------------------------------

async function seedDeals(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  pipeline: { id: string; stages: Record<string, string> },
  contacts: SeededContact[],
) {
  const distribution: { stage: (typeof STAGE_NAMES)[number]; count: number }[] = [
    { stage: 'Novo lead', count: 5 },
    { stage: 'Em negociação', count: 4 },
    { stage: 'Comprou', count: 6 },
    { stage: 'Recuperado', count: 3 },
    { stage: 'Perdido', count: 2 },
  ];

  const pool = [...contacts];
  const rows: Record<string, unknown>[] = [];
  for (const { stage, count } of distribution) {
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const contact = pool.splice(idx, 1)[0];
      rows.push({
        account_id: accountId,
        user_id: userId,
        pipeline_id: pipeline.id,
        stage_id: pipeline.stages[stage],
        contact_id: contact.id,
        title: `Rifa da Sorte — ${contact.name}`,
        value: 20 + Math.floor(Math.random() * 280),
        currency: 'BRL',
        status: stage === 'Perdido' ? 'lost' : stage === 'Comprou' ? 'won' : 'open',
      });
    }
  }

  const { error } = await db.from('deals').insert(rows);
  if (error) throw error;
}

// ------------------------------------------------------------
// Message templates
// ------------------------------------------------------------

interface SeededTemplate {
  id: string;
  name: string;
}

async function seedTemplates(
  db: SupabaseClient,
  accountId: string,
  userId: string,
): Promise<Record<string, SeededTemplate>> {
  const rows = [
    {
      name: 'reativacao_rifa',
      category: 'Marketing',
      language: 'pt_BR',
      body_text:
        'Ei! Faz tempo que você não joga com a gente 👀 Preparamos uma rifa nova ' +
        'com prêmio de R$ {{1}}. Bora garantir seu número da sorte antes que esgote?',
    },
    {
      name: 'lembrete_sorteio',
      category: 'Utility',
      language: 'pt_BR',
      body_text:
        'O sorteio da nossa rifa está chegando! 🎉 Marque na agenda: {{1}}. ' +
        'Não perca a chance de ganhar!',
    },
    {
      name: 'confirmacao_compra',
      category: 'Utility',
      language: 'pt_BR',
      body_text:
        'Recebemos seu pagamento! ✅ Seu número da sorte é {{1}}. ' +
        'Guarde este comprovante para o sorteio.',
    },
  ].map((t) => ({
    account_id: accountId,
    user_id: userId,
    name: t.name,
    category: t.category,
    language: t.language,
    body_text: t.body_text,
    status: 'APPROVED',
    meta_template_id: `demo-${crypto.randomUUID()}`,
  }));

  const { data, error } = await db.from('message_templates').insert(rows).select('id, name');
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((t) => [t.name as string, { id: t.id as string, name: t.name as string }]),
  );
}

// ------------------------------------------------------------
// WhatsApp config
// ------------------------------------------------------------

async function seedWhatsappConfig(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  encrypt: (text: string) => string,
  overrides?: { phoneNumberId?: string; wabaId?: string; accessToken?: string },
) {
  const phoneNumberId = overrides?.phoneNumberId || '123456789012345';
  const wabaId = overrides?.wabaId || '987654321098765';
  const accessToken = overrides?.accessToken || 'DEMO_FAKE_ACCESS_TOKEN';
  const now = new Date().toISOString();

  const row = {
    account_id: accountId,
    user_id: userId,
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    access_token: encrypt(accessToken),
    verify_token: encrypt('demo_verify_token'),
    status: 'connected',
    connected_at: now,
    // Only claim a real registration when we saved REAL creds — a
    // fake demo config never actually subscribed to Meta's webhook.
    registered_at: overrides ? null : now,
    subscribed_apps_at: overrides ? null : now,
  };

  const { error } = await db.from('whatsapp_config').upsert(row, { onConflict: 'account_id' });
  if (error) throw error;
}

// ------------------------------------------------------------
// Historical broadcasts
// ------------------------------------------------------------

async function seedBroadcasts(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  templates: Record<string, SeededTemplate>,
  contacts: SeededContact[],
  tagIds: Record<string, string>,
) {
  void tagIds;
  const inativo60Contacts = contacts.filter((c) => c.segment === 'inativo_60').slice(0, 10);
  const ativoContacts = contacts.filter((c) => c.segment === 'ativo').slice(0, 8);

  await seedOneBroadcast(db, accountId, userId, {
    name: 'Reativação — Rifa da Moto',
    template: templates.reativacao_rifa,
    sentDaysAgo: 10,
    recipients: inativo60Contacts,
    statusPlan: ['read', 'read', 'read', 'read', 'delivered', 'delivered', 'delivered', 'sent', 'sent', 'failed'],
  });

  await seedOneBroadcast(db, accountId, userId, {
    name: 'Lembrete de sorteio',
    template: templates.lembrete_sorteio,
    sentDaysAgo: 2,
    recipients: ativoContacts,
    statusPlan: ['read', 'read', 'read', 'read', 'read', 'delivered', 'delivered', 'sent'],
  });
}

async function seedOneBroadcast(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  args: {
    name: string;
    template: SeededTemplate;
    sentDaysAgo: number;
    recipients: SeededContact[];
    statusPlan: string[];
  },
) {
  const { data: broadcast, error } = await db
    .from('broadcasts')
    .insert({
      account_id: accountId,
      user_id: userId,
      name: args.name,
      template_name: args.template.name,
      template_language: 'pt_BR',
      status: 'sent',
      total_recipients: args.recipients.length,
      created_at: daysAgo(args.sentDaysAgo),
      updated_at: daysAgo(args.sentDaysAgo),
    })
    .select('id')
    .single();
  if (error || !broadcast) throw error ?? new Error('broadcast insert failed');

  const rows = args.recipients.map((contact, i) => {
    const status = args.statusPlan[i % args.statusPlan.length];
    const sentAt = daysAgo(args.sentDaysAgo);
    return {
      broadcast_id: broadcast.id,
      contact_id: contact.id,
      status,
      sent_at: status === 'failed' ? null : sentAt,
      delivered_at: status === 'delivered' || status === 'read' ? sentAt : null,
      read_at: status === 'read' ? sentAt : null,
      error_message: status === 'failed' ? 'Recipient number not reachable' : null,
    };
  });

  const { error: recErr } = await db.from('broadcast_recipients').insert(rows);
  if (recErr) throw recErr;
}

// ------------------------------------------------------------
// Automations
// ------------------------------------------------------------

async function seedAutomations(
  db: SupabaseClient,
  accountId: string,
  userId: string,
  tagIds: Record<string, string>,
  templates: Record<string, SeededTemplate>,
) {
  const inativo60TagId = tagIds[TAG_INATIVO_60];

  // Automation 1 — tag_added(inativo 60+) → send_template(reativação).
  // Note: nothing in the app's tag-toggle UI fires `tag_added` today —
  // see src/app/api/demo/trigger-reactivation/route.ts for the
  // demo-only control that makes this automation demonstrable live.
  const { data: auto1, error: auto1Err } = await db
    .from('automations')
    .insert({
      account_id: accountId,
      user_id: userId,
      name: 'Reativação — 60+ dias inativo',
      description:
        'Quando um contato é marcado como inativo há mais de 60 dias, envia o template de reativação.',
      trigger_type: 'tag_added',
      trigger_config: { tag_id: inativo60TagId },
      is_active: true,
      execution_count: 14,
      last_executed_at: daysAgo(10),
    })
    .select('id')
    .single();
  if (auto1Err || !auto1) throw auto1Err ?? new Error('automation 1 insert failed');

  const { error: step1Err } = await db.from('automation_steps').insert({
    automation_id: auto1.id,
    parent_step_id: null,
    branch: null,
    step_type: 'send_template',
    step_config: {
      template_name: templates.reativacao_rifa.name,
      language: 'pt_BR',
      variables: { '1': '500' },
    },
    position: 0,
  });
  if (step1Err) throw step1Err;

  // Automation 2 — new_message_received → if still tagged inativo 60+,
  // remove the tag and hand the conversation to an agent (the DB
  // trigger on conversation assignment fires the in-app notification).
  const { data: auto2, error: auto2Err } = await db
    .from('automations')
    .insert({
      account_id: accountId,
      user_id: userId,
      name: 'Resposta recebida — recuperar contato',
      description:
        'Quando um contato inativo responde, remove a tag de inatividade e avisa o atendente.',
      trigger_type: 'new_message_received',
      trigger_config: {},
      is_active: true,
      execution_count: 3,
      last_executed_at: daysAgo(3),
    })
    .select('id')
    .single();
  if (auto2Err || !auto2) throw auto2Err ?? new Error('automation 2 insert failed');

  const { data: conditionStep, error: condErr } = await db
    .from('automation_steps')
    .insert({
      automation_id: auto2.id,
      parent_step_id: null,
      branch: null,
      step_type: 'condition',
      step_config: { subject: 'tag_presence', operand: inativo60TagId },
      position: 0,
    })
    .select('id')
    .single();
  if (condErr || !conditionStep) throw condErr ?? new Error('condition step insert failed');

  const { error: branchErr } = await db.from('automation_steps').insert([
    {
      automation_id: auto2.id,
      parent_step_id: conditionStep.id,
      branch: 'yes',
      step_type: 'remove_tag',
      step_config: { tag_id: inativo60TagId },
      position: 0,
    },
    {
      automation_id: auto2.id,
      parent_step_id: conditionStep.id,
      branch: 'yes',
      step_type: 'assign_conversation',
      step_config: { mode: 'round_robin' },
      position: 1,
    },
  ]);
  if (branchErr) throw branchErr;
}

main().catch((err) => {
  console.error('\ndemo-setup failed:', err);
  process.exit(1);
});
