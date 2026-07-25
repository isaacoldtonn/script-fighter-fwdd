const express = require('express');
const supabase = require('../lib/supabase');
const router = express.Router();

// POST /api/matches: (no auth needed — called internally by Socket.io handler)
router.post('/', async (req, res) => {
  try {
    const { session_id, player1_id, player2_id } = req.body;
    if (!session_id || !player1_id || !player2_id) {
      return res.status(400).json({ error: 'session_id, player1_id, and player2_id are required' });
    }

    const { data: match, error } = await supabase
      .from('matches')
      .insert([
        {
          session_id,
          player1_id,
          player2_id,
          player1_final_hp: 100,
          player2_final_hp: 100,
        },
      ])
      .select('*')
      .single();

    if (error || !match) {
      console.error('Error creating match in POST /api/matches:', error);
      return res.status(500).json({ error: 'Failed to create match' });
    }

    console.log(`[POST /api/matches] Created match_id: ${match.match_id}`);
    return res.status(201).json({ match_id: match.match_id, match });
  } catch (err) {
    console.error('POST /api/matches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/matches/:id: (no auth needed — called internally)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { winner_id, player1_final_hp, player2_final_hp } = req.body;

    const updateData = {};
    if (winner_id !== undefined) updateData.winner_id = winner_id;
    if (player1_final_hp !== undefined) updateData.player1_final_hp = player1_final_hp;
    if (player2_final_hp !== undefined) updateData.player2_final_hp = player2_final_hp;
    updateData.played_at = new Date().toISOString();

    const { data: updatedMatch, error: matchError } = await supabase
      .from('matches')
      .update(updateData)
      .eq('match_id', id)
      .select('*')
      .single();

    if (matchError || !updatedMatch) {
      console.error('Error updating match in PATCH /api/matches/:id:', matchError);
      return res.status(500).json({ error: 'Failed to update match' });
    }

    console.log(`[PATCH /api/matches/:id] Updated match_id: ${id} with winner_id: ${winner_id}`);

    if (winner_id) {
      // Increment total_wins in USERS table for winner_id
      const { data: user } = await supabase
        .from('users')
        .select('total_wins')
        .eq('user_id', winner_id)
        .single();

      if (user) {
        const newTotalWins = (user.total_wins || 0) + 1;
        await supabase
          .from('users')
          .update({ total_wins: newTotalWins })
          .eq('user_id', winner_id);
        console.log(`[PATCH /api/matches/:id] Incremented users total_wins to ${newTotalWins} for winner ${winner_id}`);
      }

      // Also update leaderboard stats for the winner
      const { data: lb } = await supabase
        .from('leaderboard')
        .select('wins, total_matches, xp')
        .eq('user_id', winner_id)
        .single();

      if (lb) {
        const newWins = (lb.wins || 0) + 1;
        const newTotal = lb.total_matches || 1;
        const newWinRate = parseFloat(((newWins / newTotal) * 100).toFixed(2));
        await supabase
          .from('leaderboard')
          .update({
            wins: newWins,
            win_rate: newWinRate,
            xp: (lb.xp || 0) + 120,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', winner_id);
        console.log(`[PATCH /api/matches/:id] Updated leaderboard stats for winner ${winner_id}`);
      }
    }

    return res.status(200).json(updatedMatch);
  } catch (err) {
    console.error('PATCH /api/matches/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/matches/:id/rounds: (no auth needed — called internally)
router.post('/:id/rounds', async (req, res) => {
  try {
    const { id: match_id } = req.params;
    const {
      question_id,
      round_number,
      player1_key_struck,
      player2_key_struck,
      player1_response_ms,
      player2_response_ms,
      round_winner_id,
      damage_dealt,
    } = req.body;

    if (!question_id || round_number === undefined) {
      return res.status(400).json({ error: 'question_id and round_number are required' });
    }

    const insertData = {
      match_id,
      question_id,
      round_number,
      player1_key_struck: player1_key_struck || null,
      player2_key_struck: player2_key_struck || null,
      player1_response_ms: player1_response_ms !== undefined ? player1_response_ms : null,
      player2_response_ms: player2_response_ms !== undefined ? player2_response_ms : null,
      round_winner_id: round_winner_id || null,
      damage_dealt: damage_dealt || 0,
    };

    const { data: round, error } = await supabase
      .from('match_rounds')
      .insert([insertData])
      .select('*')
      .single();

    if (error || !round) {
      console.error('Error inserting match round in POST /api/matches/:id/rounds:', error);
      return res.status(500).json({ error: 'Failed to insert match round' });
    }

    console.log(`[POST /api/matches/:id/rounds] Created round_id: ${round.round_id} for round_number: ${round_number}`);
    return res.status(201).json({ round_id: round.round_id, round });
  } catch (err) {
    console.error('POST /api/matches/:id/rounds error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
