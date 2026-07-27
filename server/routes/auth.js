const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const verifyToken = require('../middleware/verifyToken');
require('dotenv').config();

const router = express.Router();

const isValidUsername = (username) => {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(username);
};

const isValidEmail = (email) => {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  return hasUpper && hasDigit && hasSpecial;
};

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!isValidUsername(username) || !isValidEmail(email) || !isValidPassword(password)) {
      return res.status(400).json({ error: 'Invalid validation for username, email, or password' });
    }

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('user_id, username, email')
      .or(`username.eq.${username},email.eq.${email}`);

    if (checkError) {
      console.error('Error checking existing user:', checkError);
      return res.status(500).json({ error: 'Database error while checking existing user' });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password_hash: passwordHash,
          total_wins: 0,
        }
      ])
      .select('user_id, username, email')
      .single();

    if (insertError || !newUser) {
      console.error('Error creating user:', insertError);
      if (insertError && insertError.code === '23505') {
        return res.status(409).json({ error: 'Username or email already taken' });
      }
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const { error: lbError } = await supabase
      .from('leaderboard')
      .insert([
        {
          user_id: newUser.user_id,
          wins: 0,
          total_matches: 0,
          win_rate: 0.00,
          xp: 0,
        }
      ]);

    if (lbError) {
      console.error('Error creating leaderboard row:', lbError);
    }

    return res.status(201).json({
      user_id: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.cookie('sf_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 3600000,
    });

    return res.status(200).json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('sf_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  return res.status(200).json({ message: 'Logged out' });
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, username, email, total_wins, created_at, profile_picture_url, description')
      .eq('user_id', req.user.user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      total_wins: user.total_wins,
      created_at: user.created_at,
      profile_picture_url: user.profile_picture_url,
      description: user.description,
    });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
