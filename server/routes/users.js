const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const supabase = require('../lib/supabase');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Duplicated from auth.js on purpose — auth.js's register/login logic is
// off-limits to touch for this feature, so these validators are kept local
// to this file instead of exported/shared from there.
const isValidUsername = (username) => {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(username);
};

const isValidPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  return hasUpper && hasDigit && hasSpecial;
};

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported image type. Use JPEG, PNG, WEBP, or GIF.'));
    }
  },
});

// Wraps multer so its errors come back as clean JSON instead of falling
// through to Express's default (non-JSON) error handler. Requests that
// aren't multipart/form-data pass straight through untouched.
const handleAvatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 2MB or smaller' });
      }
      return res.status(400).json({ error: err.message || 'Invalid file upload' });
    }
    next();
  });
};

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

    let profileById = {};
    if (opponentIds.length > 0) {
      const { data: opponents, error: usersError } = await supabase
        .from('users')
        .select('user_id, username, profile_picture_url')
        .in('user_id', opponentIds);

      if (usersError) {
        console.error('Error fetching opponent profiles:', usersError);
      } else {
        profileById = Object.fromEntries(
          (opponents || []).map((u) => [u.user_id, u])
        );
      }
    }

    const formatted = (matches || []).map((m) => {
      const isPlayer1 = m.player1_id === id;
      const opponentId = isPlayer1 ? m.player2_id : m.player1_id;
      const myFinalHp = isPlayer1 ? m.player1_final_hp : m.player2_final_hp;
      const opponentFinalHp = isPlayer1 ? m.player2_final_hp : m.player1_final_hp;
      const opponentProfile = profileById[opponentId];

      let result = 'draw';
      if (m.winner_id === id) result = 'win';
      else if (m.winner_id) result = 'loss';

      return {
        match_id: m.match_id,
        session_id: m.session_id,
        opponent_username: opponentProfile?.username || 'Unknown',
        opponent_profile_picture_url: opponentProfile?.profile_picture_url || null,
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

// GET /api/users/:id/public-profile — public, no auth required
router.get('/:id/public-profile', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username, profile_picture_url, description, total_wins, created_at')
      .eq('user_id', id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: lb, error: lbError } = await supabase
      .from('leaderboard')
      .select('rank, xp, total_matches, win_rate')
      .eq('user_id', id)
      .maybeSingle();

    if (lbError) {
      console.error('Error fetching leaderboard stats for public profile:', lbError);
    }

    return res.status(200).json({
      username: user.username,
      profile_picture_url: user.profile_picture_url,
      description: user.description,
      total_wins: user.total_wins,
      created_at: user.created_at,
      rank: lb?.rank ?? 0,
      xp: lb?.xp ?? 0,
      total_matches: lb?.total_matches ?? 0,
      win_rate: lb?.win_rate ?? 0,
    });
  } catch (err) {
    console.error('GET /api/users/:id/public-profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/profile — handles three independent update types:
// profile info (username/description), password change, or avatar upload.
// The client only ever sends one type per request (one card, one button).
router.patch('/:id/profile', verifyToken, handleAvatarUpload, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.user_id !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Type 3 — profile picture upload
    if (req.file) {
      const extFromMime = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
      const ext = extFromMime[req.file.mimetype] || 'jpg';
      const path = `${id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading avatar to storage:', uploadError);
        return res.status(500).json({ error: 'Failed to upload profile picture' });
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust: the storage path is stable across re-uploads, so without
      // this the browser would keep showing the old cached image.
      const profile_picture_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_picture_url })
        .eq('user_id', id);

      if (updateError) {
        console.error('Error saving avatar URL:', updateError);
        return res.status(500).json({ error: 'Failed to save profile picture' });
      }

      return res.status(200).json({ profile_picture_url });
    }

    // Type 2 — change password
    if (req.body.current_password || req.body.new_password) {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'current_password and new_password are required' });
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('user_id', id)
        .single();

      if (userError || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      if (!isValidPassword(new_password)) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters and include an uppercase letter, a digit, and a special character',
        });
      }

      const newHash = await bcrypt.hash(new_password, 10);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('user_id', id);

      if (updateError) {
        console.error('Error updating password:', updateError);
        return res.status(500).json({ error: 'Failed to update password' });
      }

      return res.status(200).json({ message: 'Password updated successfully' });
    }

    // Type 1 — profile info (username / description)
    const { username, description } = req.body;

    if (username === undefined && description === undefined) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    const updateData = {};

    if (username !== undefined) {
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscores)' });
      }

      const { data: existing, error: existingError } = await supabase
        .from('users')
        .select('user_id')
        .eq('username', username)
        .neq('user_id', id);

      if (existingError) {
        console.error('Error checking username uniqueness:', existingError);
        return res.status(500).json({ error: 'Database error while checking username' });
      }
      if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'Username already taken' });
      }
      updateData.username = username;
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 200) {
        return res.status(400).json({ error: 'Description must be 200 characters or fewer' });
      }
      updateData.description = description;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', id)
      .select('user_id, username, email, description, profile_picture_url, total_wins, created_at')
      .single();

    if (updateError || !updatedUser) {
      console.error('Error updating profile:', updateError);
      if (updateError && updateError.code === '23505') {
        return res.status(409).json({ error: 'Username already taken' });
      }
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    return res.status(200).json(updatedUser);
  } catch (err) {
    console.error('PATCH /api/users/:id/profile error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
