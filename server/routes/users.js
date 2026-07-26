const express = require('express');
const supabase = require('../lib/supabase');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// GET /api/users/:id/matches — paginated match history for a user
router.get('/:id/matches', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Only allow a user to view their own match history
    if (req.user.user_id !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: matches, error, count } = await supabase
      .from('matches')
      .select(
        'match_id, session_id, player1_id, player2_id, winner_id, player1_final_hp, player2_final_hp, played_at',
        { count: 'exact' }
      )
      .or(`player1_id.eq.${id},player2_id.eq.${id}`)
      .order('played_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching match history:', error);
      return res.status(500).json({ error: 'Failed to fetch match history' });
    }

    const opponentIds = Array.from(
      new Set(
        (matches || [])
          .map((m) => (m.player1_id === id ? m.player2_id : m.player1_id))
          .filter(Boolean)
      )
    );

    let usernameById = {};
    if (opponentIds.length > 0) {
      const { data: opponents, error: usersError } = await supabase
        .from('users')
        .select('user_id, username')
        .in('user_id', opponentIds);

      if (usersError) {
        console.error('Error fetching opponent usernames:', usersError);
      } else {
        usernameById = Object.fromEntries((opponents || []).map((u) => [u.user_id, u.username]));
      }
    }

    const formatted = (matches || []).map((m) => {
      const isPlayer1 = m.player1_id === id;
      const opponentId = isPlayer1 ? m.player2_id : m.player1_id;
      const myFinalHp = isPlayer1 ? m.player1_final_hp : m.player2_final_hp;
      const opponentFinalHp = isPlayer1 ? m.player2_final_hp : m.player1_final_hp;

      let result = 'draw';
      if (m.winner_id === id) result = 'win';
      else if (m.winner_id) result = 'loss';

      return {
        match_id: m.match_id,
        session_id: m.session_id,
        opponent_username: usernameById[opponentId] || 'Unknown',
        result,
        my_final_hp: myFinalHp,
        opponent_final_hp: opponentFinalHp,
        played_at: m.played_at,
      };
    });

    return res.status(200).json({
      matches: formatted,
      page,
      limit,
      total: count || 0,
      total_pages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (err) {
    console.error('GET /api/users/:id/matches error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
