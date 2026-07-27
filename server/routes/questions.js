const express = require('express');
const supabase = require('../lib/supabase');
const router = express.Router();

// Query param: ?difficulty=easy|medium|hard (optional)
// correct_option_index is stripped from the response unless the internal header is set.
router.get('/random', async (req, res) => {
  try {
    const { difficulty, internal } = req.query;
    const isInternal = internal === 'true' || req.headers['x-internal-call'] === 'true';

    let query = supabase.from('questions').select('*');
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      query = query.eq('difficulty', difficulty);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      console.warn(`[GET /api/questions/random] No questions found for difficulty: ${difficulty || 'any'}`);
      return res.status(404).json({ error: 'No questions found' });
    }

    const randomIndex = Math.floor(Math.random() * data.length);
    const question = { ...data[randomIndex] };

    console.log(`[GET /api/questions/random] Selected question_id: ${question.question_id} (difficulty: ${question.difficulty}, isInternal: ${isInternal})`);

    if (!isInternal) {
      delete question.correct_option_index;
    }

    return res.status(200).json(question);
  } catch (err) {
    console.error('GET /api/questions/random error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
