CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    total_wins INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    session_code VARCHAR(10) NOT NULL UNIQUE,
    qr_token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(10) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS matches (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(session_id) ON DELETE CASCADE,
    player1_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    player2_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    winner_id UUID NULL REFERENCES users(user_id) ON DELETE CASCADE,
    player1_final_hp INT NOT NULL DEFAULT 0,
    player2_final_hp INT NOT NULL DEFAULT 0,
    played_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
    question_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept_type VARCHAR(50) NOT NULL,
    difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    code_snippet TEXT NOT NULL,
    option_1 VARCHAR(255) NOT NULL,
    option_2 VARCHAR(255) NOT NULL,
    option_3 VARCHAR(255) NOT NULL,
    correct_option_index INT NOT NULL CHECK (correct_option_index IN (1, 2, 3)),
    explanation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_rounds (
    round_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(match_id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(question_id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    player1_key_struck CHAR(1) NULL,
    player2_key_struck CHAR(1) NULL,
    player1_response_ms INT NULL,
    player2_response_ms INT NULL,
    round_winner_id UUID NULL REFERENCES users(user_id) ON DELETE CASCADE,
    damage_dealt INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leaderboard (
    leaderboard_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    rank INT NOT NULL DEFAULT 0,
    wins INT NOT NULL DEFAULT 0,
    total_matches INT NOT NULL DEFAULT 0,
    win_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    xp INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_leaderboard_after_match()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Upsert LEADERBOARD rows for both player1_id and player2_id (insert if not exists).
    IF NEW.player1_id IS NOT NULL THEN
        INSERT INTO leaderboard (user_id, rank, wins, total_matches, win_rate, xp, updated_at)
        VALUES (NEW.player1_id, 0, 0, 0, 0.00, 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    IF NEW.player2_id IS NOT NULL THEN
        INSERT INTO leaderboard (user_id, rank, wins, total_matches, win_rate, xp, updated_at)
        VALUES (NEW.player2_id, 0, 0, 0, 0.00, 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- 2, 3, 4, 7. Update stats for Player 1
    IF NEW.player1_id IS NOT NULL THEN
        UPDATE leaderboard
        SET
            total_matches = total_matches + 1,
            wins = CASE WHEN NEW.winner_id = NEW.player1_id THEN wins + 1 ELSE wins END,
            xp = CASE 
                WHEN NEW.winner_id = NEW.player1_id THEN xp + 120 
                ELSE xp + 40 
            END,
            updated_at = NOW()
        WHERE user_id = NEW.player1_id;
    END IF;

    -- 2, 3, 4, 7. Update stats for Player 2
    IF NEW.player2_id IS NOT NULL THEN
        UPDATE leaderboard
        SET
            total_matches = total_matches + 1,
            wins = CASE WHEN NEW.winner_id = NEW.player2_id THEN wins + 1 ELSE wins END,
            xp = CASE 
                WHEN NEW.winner_id = NEW.player2_id THEN xp + 120 
                ELSE xp + 40 
            END,
            updated_at = NOW()
        WHERE user_id = NEW.player2_id;
    END IF;

    -- 5. Recalculate win_rate = (wins::numeric / total_matches) * 100 for both.
    UPDATE leaderboard
    SET win_rate = ROUND((wins::numeric / NULLIF(total_matches, 0)::numeric) * 100, 2)
    WHERE user_id IN (NEW.player1_id, NEW.player2_id);

    -- 6. Recalculate rank for ALL users: rank by xp DESC, win_rate DESC using ROW_NUMBER().
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_leaderboard ON matches;
CREATE TRIGGER trigger_update_leaderboard
AFTER INSERT ON matches
FOR EACH ROW
EXECUTE FUNCTION update_leaderboard_after_match();

-- Ranks are recalculated for ALL rows whenever a leaderboard row is removed
-- (e.g. a user is deleted and their row is removed via ON DELETE CASCADE) or
-- inserted (e.g. a new user registers), so surviving/new users don't keep
-- stale, gapped rank numbers (e.g. 1,2,3,8,9 after deleting ranks 4-7) and a
-- fresh row's default rank of 0 doesn't outrank every real player.
CREATE OR REPLACE FUNCTION recalculate_leaderboard_ranks()
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
EXECUTE FUNCTION recalculate_leaderboard_ranks();

DROP TRIGGER IF EXISTS trigger_recalculate_leaderboard_on_insert ON leaderboard;
CREATE TRIGGER trigger_recalculate_leaderboard_on_insert
AFTER INSERT ON leaderboard
FOR EACH STATEMENT
EXECUTE FUNCTION recalculate_leaderboard_ranks();
