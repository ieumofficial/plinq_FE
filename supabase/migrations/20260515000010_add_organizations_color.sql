-- Adds an organisation accent colour. Stores a palette key string
-- (e.g. 'blue', 'green', 'red', 'brown', 'purple', 'turquoise') — the same
-- convention projects.color uses. Existing rows default to 'blue' so every
-- read path has a consistent fallback.
--
-- Idempotent (IF NOT EXISTS) so it's safe to re-run / apply out of order.
-- The renderer probes for this column at runtime and only persists colour
-- once it exists, so applying this is the single switch that turns on org
-- colour saving in the Organization → Settings page.

alter table public.organizations
  add column if not exists color text not null default 'blue';
