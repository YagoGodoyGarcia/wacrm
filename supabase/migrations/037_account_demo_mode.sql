-- ============================================================
-- 037_account_demo_mode
--
-- Per-account demo/simulation flag, replacing the old global
-- DEMO_MODE env var.
--
-- Before this, `DEMO_MODE=true`/`false` was a single deployment-wide
-- switch (read by `isDemoMode()` in src/lib/whatsapp/demo-mock.ts)
-- that every Meta-API-calling function checked before deciding
-- whether to simulate or make a real network call. That meant a demo
-- account and a real paying customer's account could never coexist
-- in the same deployment — flipping the switch for one flipped it
-- for everyone. This was found the hard way: with DEMO_MODE=true in
-- production, the Sabor Caseiro (restaurant demo) account's "Test API
-- Connection" button returned a canned "Connected to Rifa da Sorte
-- (Demo)" response — a different tenant's name — because the mock had
-- no idea which account was asking.
--
-- This migration adds `accounts.demo_mode`, a per-row boolean the app
-- now reads instead of the env var (with the env var kept only as a
-- last-resort fallback for any call site not yet threaded through —
-- see `args.demoMode ?? isDemoMode()` in meta-api.ts).
--
-- RLS: no new policy needed. The existing `accounts_update` policy
-- (017) already restricts writes to admins+, which is exactly who
-- should flip this per-account setting; reads go through the existing
-- `accounts_select` policy every account member already has.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS demo_mode BOOLEAN NOT NULL DEFAULT false;

-- Mark the three sales-demo accounts as demo_mode — matched by name
-- since these are the exact, already-seeded account names (see
-- scripts/demo-setup.ts and the Transportadora/Sabor Caseiro/Açaí
-- Tropical build-out). Every other account (including Aposta
-- Nacional, the real paying customer) keeps the `false` default —
-- deliberately no UPDATE targets it.
UPDATE accounts
  SET demo_mode = true
  WHERE name IN ('Transportadora Nacional', 'Sabor Caseiro', 'Açaí Tropical');
