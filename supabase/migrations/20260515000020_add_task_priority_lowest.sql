-- Adds a 'lowest' value to the task_priority enum so tasks can be set below
-- 'low'. The UI (PriorityTag) already supports a "Lowest" level; this is the
-- missing DB backing. Ordered before 'low' so enum ordering stays intuitive
-- (the app ranks priority via lookup maps, not enum order, so this is cosmetic).
--
-- IF NOT EXISTS makes it idempotent / safe to re-run. ALTER TYPE ... ADD VALUE
-- must run as a standalone statement (not wrapped in a larger transaction with
-- the value's first use). The TaskDetailModal probes for this value at runtime
-- and only offers "Lowest" once it exists, so applying this is the single
-- switch that turns the option on.

alter type task_priority add value if not exists 'lowest' before 'low';
