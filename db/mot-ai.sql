-- Apply only to a dedicated MOTBOT Neon database after provisioning approval.
-- Separate from legacy SQLite examples; never run against an unrelated database.
CREATE TABLE IF NOT EXISTS mot_ai_generations (
 id uuid PRIMARY KEY, owner_hash text NOT NULL, ip_hash text NOT NULL, model text NOT NULL,
 prompt jsonb NOT NULL, result text, model_output jsonb, usage jsonb, estimated_cost_usd numeric,
 status text NOT NULL CHECK(status IN ('pending','complete','error')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mot_ai_created_idx ON mot_ai_generations(created_at);
CREATE INDEX IF NOT EXISTS mot_ai_owner_idx ON mot_ai_generations(owner_hash,created_at);
CREATE INDEX IF NOT EXISTS mot_ai_ip_idx ON mot_ai_generations(ip_hash,created_at);
