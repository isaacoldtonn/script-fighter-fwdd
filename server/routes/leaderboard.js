const express = require('express');
const supabase = require('../lib/supabase');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// GET /api/leaderboard — top 50 by rank (xp desc, win_rate desc)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('leaderboard')
      .select('user_id, rank, wins, total_matches, win_rate, xp, users(username, profile_picture_url, description)')
      .order('rank', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    const formatted = (rows || []).map((row) => ({
      user_id: row.user_id,
      username: row.users?.username || 'Unknown',
      profile_picture_url: row.users?.profile_picture_url || null,
      description: row.users?.description || '',
      rank: row.rank,
      wins: row.wins,
      total_matches: row.total_matches,
      win_rate: row.win_rate,
      xp: row.xp,
    }));

    return res.status(200).json({
      leaderboard: formatted,
      current_user_id: req.user.user_id,
    });
  } catch (err) {
    console.error('GET /api/leaderboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
