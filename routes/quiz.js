const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// SM-2 Spaced Repetition Algorithm
function updateSpacedRepetition(userId, caseId, quality) {
  const grade = quality ? 4 : 1;

  let progress = db.prepare('SELECT * FROM user_case_progress WHERE user_id = ? AND case_id = ?').get(userId, caseId);

  if (!progress) {
    progress = { ease_factor: 2.5, interval_days: 1, repetitions: 0 };
  }

  let { ease_factor, interval_days, repetitions } = progress;

  if (grade >= 3) {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions++;
  } else {
    repetitions = 0;
    interval_days = 1;
  }

  ease_factor = ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval_days);

  db.prepare(`
    INSERT OR REPLACE INTO user_case_progress (user_id, case_id, ease_factor, interval_days, repetitions, next_review, last_reviewed)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(userId, caseId, ease_factor, interval_days, repetitions, nextReview.toISOString().split('T')[0]);
}

// Get random case for quiz
router.get('/random', (req, res) => {
  const { modality, body_part, difficulty } = req.query;

  let sql = `
    SELECT c.id, c.title, c.modality, c.body_part, c.diagnosis, c.difficulty,
           c.clinical_history, c.findings, c.teaching_points,
           (SELECT filename FROM images WHERE case_id = c.id ORDER BY sequence LIMIT 1) as image
    FROM cases c
  `;

  const conditions = [];
  const params = [];

  if (modality) {
    conditions.push('c.modality = ?');
    params.push(modality);
  }
  if (body_part) {
    conditions.push('c.body_part = ?');
    params.push(body_part);
  }
  if (difficulty) {
    conditions.push('c.difficulty = ?');
    params.push(parseInt(difficulty));
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY RANDOM() LIMIT 1';

  const quizCase = db.prepare(sql).get(...params);

  if (!quizCase) {
    return res.status(404).json({ error: 'No cases found matching criteria' });
  }

  const images = db.prepare('SELECT * FROM images WHERE case_id = ? ORDER BY sequence').all(quizCase.id);

  res.json({ ...quizCase, images });
});

// Submit quiz attempt
router.post('/attempt', (req, res, next) => {
  try {
    const { case_id, correct, time_spent_ms } = req.body;

    if (!case_id) {
      return res.status(400).json({ error: 'case_id is required' });
    }

    const caseExists = db.prepare('SELECT id FROM cases WHERE id = ?').get(case_id);
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const userId = req.user?.id || null;

    db.prepare(`
      INSERT INTO quiz_attempts (case_id, correct, time_spent_ms, user_id)
      VALUES (?, ?, ?, ?)
    `).run(case_id, correct ? 1 : 0, time_spent_ms, userId);

    if (userId) {
      updateSpacedRepetition(userId, case_id, correct ? 1 : 0);
    }

    res.status(201).json({ message: 'Attempt recorded' });
  } catch (err) {
    next(err);
  }
});

// Get quiz stats
router.get('/stats', (req, res) => {
  const userId = req.user?.id;
  const userFilter = userId ? 'WHERE qa.user_id = ?' : '';
  const userParams = userId ? [userId] : [];

  const overall = db.prepare(`
    SELECT
      COUNT(*) as total_attempts,
      SUM(correct) as correct_count,
      AVG(time_spent_ms) as avg_time_ms
    FROM quiz_attempts qa
    ${userFilter}
  `).get(...userParams);

  const byDifficulty = db.prepare(`
    SELECT
      c.difficulty,
      COUNT(*) as attempts,
      SUM(qa.correct) as correct,
      AVG(qa.time_spent_ms) as avg_time_ms
    FROM quiz_attempts qa
    JOIN cases c ON qa.case_id = c.id
    ${userFilter ? userFilter.replace('WHERE', userFilter.includes('JOIN') ? 'AND' : 'WHERE') : ''}
    GROUP BY c.difficulty
    ORDER BY c.difficulty
  `).all(...userParams);

  const recentMisses = db.prepare(`
    SELECT c.id, c.title, c.diagnosis, c.difficulty, COUNT(*) as miss_count
    FROM quiz_attempts qa
    JOIN cases c ON qa.case_id = c.id
    WHERE qa.correct = 0 ${userId ? 'AND qa.user_id = ?' : ''}
    GROUP BY c.id
    ORDER BY miss_count DESC, qa.attempted_at DESC
    LIMIT 5
  `).all(...userParams);

  res.json({ overall, byDifficulty, recentMisses, isPersonal: !!userId });
});

// Get cases due for review (spaced repetition) - mounted at /api/review/due
router.get('/due', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;

  const dueCases = db.prepare(`
    SELECT c.*, ucp.next_review, ucp.repetitions, ucp.interval_days,
           (SELECT filename FROM images WHERE case_id = c.id ORDER BY sequence LIMIT 1) as thumbnail
    FROM user_case_progress ucp
    JOIN cases c ON ucp.case_id = c.id
    WHERE ucp.user_id = ? AND ucp.next_review <= date('now')
    ORDER BY ucp.next_review ASC
    LIMIT ?
  `).all(userId, parseInt(limit));

  const newCases = db.prepare(`
    SELECT c.*,
           (SELECT filename FROM images WHERE case_id = c.id ORDER BY sequence LIMIT 1) as thumbnail
    FROM cases c
    WHERE c.id NOT IN (SELECT case_id FROM user_case_progress WHERE user_id = ?)
    ORDER BY RANDOM()
    LIMIT ?
  `).all(userId, Math.max(0, parseInt(limit) - dueCases.length));

  res.json({
    dueCases,
    newCases,
    totalDue: dueCases.length,
    totalNew: newCases.length
  });
});

// Note: User progress summary moved to routes/progress.js

module.exports = router;
