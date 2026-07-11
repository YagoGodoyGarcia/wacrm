// ============================================================
// Clone a demo account's FLOW/CONFIG into a brand-new, empty account.
//
// Run via:
//   npm run clone-account -- --source="Sabor Caseiro" --name="Nova Empresa" --email="dono@novaempresa.com" --password="SenhaForte123!"
//
// Why this exists: demo accounts (Transportadora Nacional, Sabor
// Caseiro, Açaí Tropical — see migration 037 / accounts.demo_mode)
// stay around forever for sales presentations. When a demo turns into
// a real sale, we don't want to touch the demo account itself (it
// needs to keep demoing to the NEXT prospect in the same niche) —
// instead we clone its reusable setup into a fresh account for the
// new paying customer, who then connects their own real WhatsApp
// credentials via the normal onboarding flow.
//
// Cloned ("flow/config" — reusable business logic):
//   - pipelines + pipeline_stages
//   - tags
//   - custom_fields
//   - message_templates
//   - automations + automation_steps (definitions only, not history)
//   - flows + flow_nodes (definitions only, not run history)
//   - general account settings (default_currency)
//
// Deliberately NOT cloned ("data" — must start empty for a new
// customer):
//   - contacts, conversations, messages
//   - deals (the pipeline STAGES are cloned; no deal instances are)
//   - broadcasts / broadcast_recipients
//   - automation_logs / automation_pending_executions
//   - flow_runs / flow_run_events
//   - whatsapp_config (the new customer pastes their own credentials)
//
// The new account is created with demo_mode = false (the DB column
// default — see migration 037) so it goes through the real onboarding
// flow rather than the demo mock.
//
// Bypasses no send pipeline (nothing here talks to Meta at all) — it's
// pure DB-to-DB copying via the service-role client, same posture as
// scripts/demo-setup.ts.
// ============================================================

import { loadEnvConfig } from '@next/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
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

function requiredArg(name: string): string {
  const v = arg(name);
  if (!v) {
    console.error(`\nMissing required --${name}=... argument.\n`);
    console.error(
      'Usage: npm run clone-account -- --source="Sabor Caseiro" --name="Nova Empresa" --email="dono@novaempresa.com" --password="SenhaForte123!"\n',
    );
    process.exit(1);
  }
  return v;
}

const SOURCE_NAME = requiredArg('source');
const NEW_NAME = requiredArg('name');
const NEW_EMAIL = requiredArg('email');
const NEW_PASSWORD = requiredArg('password');

/**
 * Deep-walk a JSONB config object and remap any value under a
 * well-known foreign-id key (tag_id, pipeline_id, stage_id,
 * custom_field_id/field_id) using the supplied id map. Automation
 * step configs and trigger_configs reference these ids by UUID
 * (e.g. a `tag_added` trigger's `tag_id`, an `add_tag` step's
 * `tag_id`, a `create_deal` step's `pipeline_id`/`stage_id`) — without
 * this remap the cloned automation would silently point at the SOURCE
 * account's tags/pipeline, which the new account can't see (and would
 * violate tenancy if it somehow could).
 *
 * Best-effort by design: unknown/unrecognized keys pass through
 * untouched rather than throwing, so an automation using a step shape
 * this script doesn't know about still clones (just without id
 * remapping for that one field) instead of aborting the whole clone.
 */
const REMAPPABLE_KEYS: Record<string, Map<string, string>> = {};

function remapValue(key: string, value: unknown): unknown {
  const map = REMAPPABLE_KEYS[key];
  if (map && typeof value === 'string' && map.has(value)) {
    return map.get(value);
  }
  return value;
}

function deepRemap(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(deepRemap);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = remapValue(k, typeof v === 'object' ? deepRemap(v) : v);
    }
    return out;
  }
  return node;
}

async function resolveSourceAccountId(db: SupabaseClient): Promise<string> {
  const { data, error } = await db
    .from('accounts')
    .select('id, name, default_currency')
    .eq('name', SOURCE_NAME)
    .maybeSingle();
  if (error || !data) {
    console.error(`\nSource account "${SOURCE_NAME}" not found.`);
    process.exit(1);
  }
  return data.id as string;
}

/**
 * Create the new owner user. `handle_new_user()` (migration 017)
 * fires on the auth.users INSERT and creates the profile + a brand
 * new (empty) `accounts` row in the same transaction, so by the time
 * createUser() resolves the new account already exists — same
 * pattern as scripts/demo-setup.ts's demo-user creation.
 */
async function createOwnerAndAccount(
  db: SupabaseClient,
): Promise<{ accountId: string; userId: string }> {
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: NEW_NAME },
  });
  if (createErr || !created?.user) {
    console.error('\nFailed to create the new owner user:', createErr?.message);
    process.exit(1);
  }
  const userId = created.user.id;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: profile } = await db
      .from('profiles')
      .select('account_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (profile?.account_id) {
      return { accountId: profile.account_id as string, userId };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Profile for ${NEW_EMAIL} never got an account_id — is the ` +
      'handle_new_user trigger installed (run all supabase/migrations)?',
  );
}

async function main() {
  const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Looking up source account "${SOURCE_NAME}"...`);
  const sourceAccountId = await resolveSourceAccountId(db);

  const { data: sourceAccount } = await db
    .from('accounts')
    .select('default_currency')
    .eq('id', sourceAccountId)
    .single();

  console.log(`Creating new account "${NEW_NAME}" (owner ${NEW_EMAIL})...`);
  const { accountId, userId } = await createOwnerAndAccount(db);

  // Rename the auto-created account + copy general settings. New
  // account is created with demo_mode = false by the column default
  // (migration 037) — explicit here for clarity/safety, never true.
  const { error: renameErr } = await db
    .from('accounts')
    .update({
      name: NEW_NAME,
      default_currency: sourceAccount?.default_currency ?? 'USD',
      demo_mode: false,
    })
    .eq('id', accountId);
  if (renameErr) throw new Error(`Failed to rename new account: ${renameErr.message}`);

  // ------------------------------------------------------------
  // Pipelines + stages
  // ------------------------------------------------------------
  console.log('Cloning pipelines + stages...');
  const pipelineIdMap = new Map<string, string>();
  const stageIdMap = new Map<string, string>();

  const { data: sourcePipelines } = await db
    .from('pipelines')
    .select('id, name')
    .eq('account_id', sourceAccountId);

  for (const p of sourcePipelines ?? []) {
    const { data: newPipeline, error } = await db
      .from('pipelines')
      .insert({ account_id: accountId, user_id: userId, name: p.name })
      .select('id')
      .single();
    if (error || !newPipeline) throw new Error(`Failed to clone pipeline "${p.name}": ${error?.message}`);
    pipelineIdMap.set(p.id, newPipeline.id);

    const { data: stages } = await db
      .from('pipeline_stages')
      .select('id, name, position, color')
      .eq('pipeline_id', p.id)
      .order('position');
    for (const s of stages ?? []) {
      const { data: newStage, error: stageErr } = await db
        .from('pipeline_stages')
        .insert({
          pipeline_id: newPipeline.id,
          name: s.name,
          position: s.position,
          color: s.color,
        })
        .select('id')
        .single();
      if (stageErr || !newStage) throw new Error(`Failed to clone stage "${s.name}": ${stageErr?.message}`);
      stageIdMap.set(s.id, newStage.id);
    }
  }

  // ------------------------------------------------------------
  // Tags
  // ------------------------------------------------------------
  console.log('Cloning tags...');
  const tagIdMap = new Map<string, string>();
  const { data: sourceTags } = await db
    .from('tags')
    .select('id, name, color')
    .eq('account_id', sourceAccountId);
  for (const t of sourceTags ?? []) {
    const { data: newTag, error } = await db
      .from('tags')
      .insert({ account_id: accountId, user_id: userId, name: t.name, color: t.color })
      .select('id')
      .single();
    if (error || !newTag) throw new Error(`Failed to clone tag "${t.name}": ${error?.message}`);
    tagIdMap.set(t.id, newTag.id);
  }

  // ------------------------------------------------------------
  // Custom fields
  // ------------------------------------------------------------
  console.log('Cloning custom fields...');
  const fieldIdMap = new Map<string, string>();
  const { data: sourceFields } = await db
    .from('custom_fields')
    .select('id, field_name, field_type, field_options')
    .eq('account_id', sourceAccountId);
  for (const f of sourceFields ?? []) {
    const { data: newField, error } = await db
      .from('custom_fields')
      .insert({
        account_id: accountId,
        user_id: userId,
        field_name: f.field_name,
        field_type: f.field_type,
        field_options: f.field_options,
      })
      .select('id')
      .single();
    if (error || !newField) throw new Error(`Failed to clone custom field "${f.field_name}": ${error?.message}`);
    fieldIdMap.set(f.id, newField.id);
  }

  // Wire up the remap table now that every id map is populated.
  REMAPPABLE_KEYS.tag_id = tagIdMap;
  REMAPPABLE_KEYS.pipeline_id = pipelineIdMap;
  REMAPPABLE_KEYS.stage_id = stageIdMap;
  REMAPPABLE_KEYS.custom_field_id = fieldIdMap;
  REMAPPABLE_KEYS.field_id = fieldIdMap;

  // ------------------------------------------------------------
  // Message templates
  // ------------------------------------------------------------
  console.log('Cloning message templates...');
  const { data: sourceTemplates } = await db
    .from('message_templates')
    .select(
      'name, category, language, header_type, header_content, header_media_url, body_text, footer_text, buttons, sample_values',
    )
    .eq('account_id', sourceAccountId);
  for (const tpl of sourceTemplates ?? []) {
    // Cloned as local DRAFT rows — the new account has its own Meta
    // WABA once real credentials land, so meta_template_id / status /
    // rejection_reason / quality_score never carry over (they're
    // Meta-assigned, account-specific facts, not "flow").
    const { error } = await db.from('message_templates').insert({
      account_id: accountId,
      user_id: userId,
      name: tpl.name,
      category: tpl.category,
      language: tpl.language,
      header_type: tpl.header_type,
      header_content: tpl.header_content,
      header_media_url: tpl.header_media_url,
      body_text: tpl.body_text,
      footer_text: tpl.footer_text,
      buttons: tpl.buttons,
      sample_values: tpl.sample_values,
      status: 'DRAFT',
    });
    if (error) throw new Error(`Failed to clone template "${tpl.name}": ${error.message}`);
  }

  // ------------------------------------------------------------
  // Automations + steps
  // ------------------------------------------------------------
  console.log('Cloning automations...');
  const { data: sourceAutomations } = await db
    .from('automations')
    .select('id, name, description, trigger_type, trigger_config, is_active')
    .eq('account_id', sourceAccountId);

  for (const auto of sourceAutomations ?? []) {
    const { data: newAuto, error } = await db
      .from('automations')
      .insert({
        account_id: accountId,
        user_id: userId,
        name: auto.name,
        description: auto.description,
        trigger_type: auto.trigger_type,
        trigger_config: deepRemap(auto.trigger_config ?? {}),
        is_active: auto.is_active,
        // execution_count / last_executed_at intentionally omitted —
        // history stays with the source account, new one starts at 0.
      })
      .select('id')
      .single();
    if (error || !newAuto) throw new Error(`Failed to clone automation "${auto.name}": ${error?.message}`);

    const { data: steps } = await db
      .from('automation_steps')
      .select('id, parent_step_id, branch, step_type, step_config, position')
      .eq('automation_id', auto.id)
      .order('position');

    // Two passes: insert every step first (parent_step_id left null),
    // then patch parent_step_id once every old→new step id is known —
    // a child step can be inserted before its parent in `position`
    // order for branching automations.
    const stepIdMap = new Map<string, string>();
    const inserted: { oldId: string; newId: string; oldParentId: string | null }[] = [];

    for (const step of steps ?? []) {
      const { data: newStep, error: stepErr } = await db
        .from('automation_steps')
        .insert({
          automation_id: newAuto.id,
          parent_step_id: null,
          branch: step.branch,
          step_type: step.step_type,
          step_config: deepRemap(step.step_config ?? {}),
          position: step.position,
        })
        .select('id')
        .single();
      if (stepErr || !newStep) {
        throw new Error(`Failed to clone a step of automation "${auto.name}": ${stepErr?.message}`);
      }
      stepIdMap.set(step.id, newStep.id);
      inserted.push({ oldId: step.id, newId: newStep.id, oldParentId: step.parent_step_id });
    }

    for (const s of inserted) {
      if (!s.oldParentId) continue;
      const newParentId = stepIdMap.get(s.oldParentId);
      if (!newParentId) continue;
      await db.from('automation_steps').update({ parent_step_id: newParentId }).eq('id', s.newId);
    }
  }

  // ------------------------------------------------------------
  // Flows + nodes
  // ------------------------------------------------------------
  console.log('Cloning flows...');
  const { data: sourceFlows } = await db
    .from('flows')
    .select('id, name, description, status, trigger_type, trigger_config, entry_node_id, fallback_policy')
    .eq('account_id', sourceAccountId);

  for (const flow of sourceFlows ?? []) {
    const { data: newFlow, error } = await db
      .from('flows')
      .insert({
        account_id: accountId,
        user_id: userId,
        name: flow.name,
        description: flow.description,
        status: flow.status,
        trigger_type: flow.trigger_type,
        trigger_config: deepRemap(flow.trigger_config ?? {}),
        entry_node_id: flow.entry_node_id,
        fallback_policy: flow.fallback_policy,
        // execution_count / last_executed_at intentionally omitted.
      })
      .select('id')
      .single();
    if (error || !newFlow) throw new Error(`Failed to clone flow "${flow.name}": ${error?.message}`);

    // flow_nodes reference each other by `node_key` (a string local to
    // the flow), not by UUID — no id remap needed, node_key values
    // carry over unchanged.
    const { data: nodes } = await db
      .from('flow_nodes')
      .select('node_key, node_type, config, position_x, position_y')
      .eq('flow_id', flow.id);
    for (const node of nodes ?? []) {
      const { error: nodeErr } = await db.from('flow_nodes').insert({
        flow_id: newFlow.id,
        node_key: node.node_key,
        node_type: node.node_type,
        config: deepRemap(node.config ?? {}),
        position_x: node.position_x,
        position_y: node.position_y,
      });
      if (nodeErr) throw new Error(`Failed to clone a node of flow "${flow.name}": ${nodeErr.message}`);
    }
  }

  console.log('\nDone.');
  console.log(`New account: ${NEW_NAME}`);
  console.log(`Account id:  ${accountId}`);
  console.log(`Login email: ${NEW_EMAIL}`);
  console.log(
    '\nThe new account has NO contacts/conversations/deals/broadcasts and no WhatsApp config yet — ' +
      'the customer connects their own real credentials via Settings → WhatsApp, same as any other account.',
  );
}

main().catch((err) => {
  console.error('\nClone failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
