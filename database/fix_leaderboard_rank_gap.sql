-- One-time fix for existing rank gaps caused by deleting users directly in
-- Supabase before the delete trigger (see schema.sql) existed.
-- Run this once in the Supabase SQL editor. Safe to re-run.

-- 1. Recreate/attach the delete trigger from schema.sql (idempotent).
CREATE OR REPLACE FUNCTION recalculate_leaderboard_ranks_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    WITH ranked_users AS (
        SELECT
            leaderboard_id,
            ROW_NUMBER() OVER (ORDER BY xp DESC, win_rate DESC) AS new_rank
        FROM leaderboard
    )
    UPDATE leaderboard l
    SET rank = r.new_rank
    FROM ranked_users r
    WHERE l.leaderboard_id = r.leaderboard_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalculate_leaderboard_on_delete ON leaderboard;
CREATE TRIGGER trigger_recalculate_leaderboard_on_delete
AFTER DELETE ON leaderboard
FOR EACH STATEMENT
EXECUTE FUNCTION recalculate_leaderboard_ranks_after_delete();

-- 2. Backfill: collapse the existing gaps right now.
WITH ranked_users AS (
    SELECT
        leaderboard_id,
        ROW_NUMBER() OVER (ORDER BY xp DESC, win_rate DESC) AS new_rank
    FROM leaderboard
)
UPDATE leaderboard l
SET rank = r.new_rank
FROM ranked_users r
WHERE l.leaderboard_id = r.leaderboard_id;
