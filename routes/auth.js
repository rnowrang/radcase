const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');
const { requireAuth, EFFECTIVE_JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  const { username, email, password, displayName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Password policy: 8+ chars, at least one uppercase, one lowercase, one number
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/[A-Z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
  }
  if (!/[a-z]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
  }
  if (!/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must contain at least one number' });
  }

  // Check if username exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  // Check if email exists (if provided)
  if (email) {
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already registered' });
    }
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username.toLowerCase(), email || null, passwordHash, displayName || username);

  // Generate token
  const token = jwt.sign({ id, username: username.toLowerCase(), displayName: displayName || username }, EFFECTIVE_JWT_SECRET, { expiresIn: '30d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({
    success: true,
    user: { id, username: username.toLowerCase(), displayName: displayName || username }
  });
});

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username.toLowerCase(), username.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  // Generate token
  const token = jwt.sign({
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    role: user.role
  }, EFFECTIVE_JWT_SECRET, { expiresIn: '30d' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      role: user.role
    }
  });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  const user = db.prepare('SELECT id, username, email, display_name, role, created_at FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    res.clearCookie('token');
    return res.json({ user: null });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      createdAt: user.created_at
    }
  });
});

// Get all users (for admin) - mounted at /api/auth but also exposed at /api/users
router.get('/', requireAuth, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, display_name, role, created_at, last_login,
           (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = users.id) as quiz_count,
           (SELECT SUM(correct) FROM quiz_attempts WHERE user_id = users.id) as correct_count
    FROM users
    ORDER BY created_at DESC
  `).all();

  res.json({ users });
});

module.exports = router;
