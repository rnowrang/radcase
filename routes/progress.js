const express = require('express');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get user progress summary
router.get('/', requireAuth, (req, res) => {
  const userId = req.user.id;

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_attempts,
      SUM(correct) as correct_count,
      COUNT(DISTINCT case_id) as unique_cases
    FROM quiz_attempts
    WHERE user_id = ?
  `).get(userId);

  const streakData = db.prepare(`
    SELECT DATE(attempted_at) as day, COUNT(*) as attempts
    FROM quiz_attempts
    WHERE user_id = ?
    GROUP BY DATE(attempted_at)
    ORDER BY day DESC
    LIMIT 30
  `).all(userId);

  const masteredCases = db.prepare(`
    SELECT COUNT(*) as count
    FROM user_case_progress
    WHERE user_id = ? AND repetitions >= 3 AND interval_days >= 21
  `).get(userId);

  const learningCases = db.prepare(`
    SELECT COUNT(*) as count
    FROM user_case_progress
    WHERE user_id = ? AND repetitions > 0 AND (repetitions < 3 OR interval_days < 21)
  `).get(userId);

  res.json({
    totalAttempts: stats.total_attempts || 0,
    correctCount: stats.correct_count || 0,
    accuracy: stats.total_attempts ? Math.round((stats.correct_count / stats.total_attempts) * 100) : 0,
    uniqueCases: stats.unique_cases || 0,
    masteredCases: masteredCases.count || 0,
    learningCases: learningCases.count || 0,
    streakData
  });
});

module.exports = router;
