const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');
const verifyToken = require('../middleware/verifyToken');
require('dotenv').config();

const router = express.Router();

// Helper to generate session code like XF-4829
const generateSessionCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetters = letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)];
  const randomDigits = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
  return `${randomLetters}-${randomDigits}`;
};

router.post('/', verifyToken, async (req, res) => {
  try {
    let session_code = generateSessionCode();
    let isUnique = false;
    let attempts = 0;

    // Keep regenerating until it's unique in SESSIONS table
    while (!isUnique && attempts < 10) {
      const { data, error } = await supabase
        .from('sessions')
        .select('session_id')
        .eq('session_code', session_code);

      if (error) {
        console.error('Error checking session_code uniqueness:', error);
        return res.status(500).json({ error: 'Database error while checking session code' });
      }

      if (data && data.length === 0) {
        isUnique = true;
      } else {
        session_code = generateSessionCode();
        attempts++;
      }
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Could not generate a unique session code' });
    }

    const qr_token = uuidv4();

    const { data: newSession, error: insertError } = await supabase
      .from('sessions')
      .insert([
        {
          host_user_id: req.user.user_id,
          session_code,
          qr_token,
          status: 'waiting',
        },
      ])
      .select('*')
      .single();

    if (insertError || !newSession) {
      console.error('Error creating session:', insertError);
      return res.status(500).json({ error: 'Failed to create session' });
    }

    let frontendUrl = process.env.FRONTEND_URL || '';
    if (frontendUrl && !frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
      frontendUrl = `https://${frontendUrl}`;
    }
    const qr_url = `${frontendUrl}/join?token=${qr_token}`;

    return res.status(201).json({
      session_id: newSession.session_id,
      session_code: newSession.session_code,
      qr_url,
    });
  } catch (err) {
    console.error('Create session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Placed above /:token so this two-segment path isn't swallowed by that
// single-segment matcher.
router.get('/join/:session_code', async (req, res) => {
  try {
    const session_code = (req.params.session_code || '').toUpperCase();

    const { data: session, error } = await supabase
      .from('sessions')
      .select('session_id, session_code, qr_token, status')
      .eq('session_code', session_code)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: 'Session not found. Check the code and try again.' });
    }

    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'This session has already started or ended.' });
    }

    return res.status(200).json({
      session_id: session.session_id,
      session_code: session.session_code,
      qr_token: session.qr_token,
      status: session.status,
    });
  } catch (err) {
    console.error('Get session by code error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('qr_token', token)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'Session is no longer open' });
    }

    return res.status(200).json({
      session_id: session.session_id,
      session_code: session.session_code,
      status: session.status,
      host_user_id: session.host_user_id,
    });
  } catch (err) {
    console.error('Get session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'ended') {
      return res.status(400).json({ error: 'Status must be "active" or "ended"' });
    }

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', id)
      .single();

    if (fetchError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.host_user_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Forbidden: You are not the host of this session' });
    }

    const updateData = {
      status,
      ended_at: status === 'ended' ? new Date().toISOString() : null,
    };

    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('session_id', id)
      .select('*')
      .single();

    if (updateError || !updatedSession) {
      console.error('Error updating session:', updateError);
      return res.status(500).json({ error: 'Failed to update session' });
    }

    return res.status(200).json(updatedSession);
  } catch (err) {
    console.error('Patch session error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
