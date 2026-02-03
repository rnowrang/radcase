const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Directories
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const THUMB_DIR = path.join(__dirname, '..', 'thumbnails');

// Get all cases with filters
router.get('/', (req, res, next) => {
  try {
    const { modality, body_part, difficulty, tag, search, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT c.*,
             GROUP_CONCAT(DISTINCT t.name) as tags,
             COUNT(DISTINCT i.id) as image_count,
             (SELECT filename FROM images WHERE case_id = c.id ORDER BY sequence LIMIT 1) as thumbnail
      FROM cases c
      LEFT JOIN case_tags ct ON c.id = ct.case_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      LEFT JOIN images i ON c.id = i.case_id
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
    if (tag) {
      conditions.push('t.name = ?');
      params.push(tag);
    }
    if (search) {
      conditions.push('(c.title LIKE ? OR c.diagnosis LIKE ? OR c.clinical_history LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const cases = db.prepare(sql).all(...params);

    // Get total count
    let countSql = 'SELECT COUNT(DISTINCT c.id) as total FROM cases c';
    if (tag) {
      countSql += ' LEFT JOIN case_tags ct ON c.id = ct.case_id LEFT JOIN tags t ON ct.tag_id = t.id';
    }
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    const countParams = params.slice(0, -2);
    const { total } = db.prepare(countSql).get(...countParams) || { total: 0 };

    res.json({ cases, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) {
    next(err);
  }
});

// Get single case with all details
router.get('/:id', (req, res, next) => {
  try {
    const caseData = db.prepare(`
      SELECT c.*, GROUP_CONCAT(DISTINCT t.name) as tags
      FROM cases c
      LEFT JOIN case_tags ct ON c.id = ct.case_id
      LEFT JOIN tags t ON ct.tag_id = t.id
      WHERE c.id = ?
      GROUP BY c.id
    `).get(req.params.id);

    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const images = db.prepare('SELECT * FROM images WHERE case_id = ? ORDER BY sequence').all(req.params.id);

    res.json({ ...caseData, images });
  } catch (err) {
    next(err);
  }
});

// Create new case
router.post('/', requireAuth, (req, res, next) => {
  try {
    const { title, modality, body_part, diagnosis, difficulty, clinical_history, teaching_points, findings, tags } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO cases (id, title, modality, body_part, diagnosis, difficulty, clinical_history, teaching_points, findings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, modality, body_part, diagnosis, difficulty || 2, clinical_history, teaching_points, findings);

    // Handle tags
    if (tags && tags.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
      const linkTag = db.prepare('INSERT INTO case_tags (case_id, tag_id) VALUES (?, ?)');

      for (const tagName of tags) {
        insertTag.run(tagName.trim().toLowerCase());
        const tag = getTagId.get(tagName.trim().toLowerCase());
        if (tag) linkTag.run(id, tag.id);
      }
    }

    res.status(201).json({ id, message: 'Case created' });
  } catch (err) {
    next(err);
  }
});

// Update case
router.put('/:id', requireAuth, (req, res, next) => {
  try {
    const { title, modality, body_part, diagnosis, difficulty, clinical_history, teaching_points, findings, tags } = req.body;

    // Check if case exists
    const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    db.prepare(`
      UPDATE cases
      SET title = ?, modality = ?, body_part = ?, diagnosis = ?, difficulty = ?,
          clinical_history = ?, teaching_points = ?, findings = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, modality, body_part, diagnosis, difficulty, clinical_history, teaching_points, findings, req.params.id);

    // Update tags
    db.prepare('DELETE FROM case_tags WHERE case_id = ?').run(req.params.id);
    if (tags && tags.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
      const getTagId = db.prepare('SELECT id FROM tags WHERE name = ?');
      const linkTag = db.prepare('INSERT INTO case_tags (case_id, tag_id) VALUES (?, ?)');

      for (const tagName of tags) {
        insertTag.run(tagName.trim().toLowerCase());
        const tag = getTagId.get(tagName.trim().toLowerCase());
        if (tag) linkTag.run(req.params.id, tag.id);
      }
    }

    res.json({ message: 'Case updated' });
  } catch (err) {
    next(err);
  }
});

// Delete case
router.delete('/:id', requireAuth, (req, res, next) => {
  try {
    // Check if case exists
    const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Get images to delete files
    const images = db.prepare('SELECT filename FROM images WHERE case_id = ?').all(req.params.id);
    for (const img of images) {
      fs.unlink(path.join(UPLOAD_DIR, img.filename), (err) => {
        if (err) console.error(`Failed to delete upload ${img.filename}:`, err.message);
      });
      fs.unlink(path.join(THUMB_DIR, img.filename), (err) => {
        if (err) console.error(`Failed to delete thumbnail ${img.filename}:`, err.message);
      });
    }

    db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
    res.json({ message: 'Case deleted' });
  } catch (err) {
    next(err);
  }
});

// Export single case
router.get('/:id/export', (req, res) => {
  const caseData = db.prepare(`
    SELECT c.*, GROUP_CONCAT(DISTINCT t.name) as tags
    FROM cases c
    LEFT JOIN case_tags ct ON c.id = ct.case_id
    LEFT JOIN tags t ON ct.tag_id = t.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(req.params.id);

  if (!caseData) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const images = db.prepare('SELECT * FROM images WHERE case_id = ?').all(caseData.id);

  const exportData = {
    ...caseData,
    tags: caseData.tags ? caseData.tags.split(',') : [],
    images: images.map(img => ({
      ...img,
      data: fs.existsSync(path.join(UPLOAD_DIR, img.filename))
        ? fs.readFileSync(path.join(UPLOAD_DIR, img.filename), 'base64')
        : null
    }))
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="case-${caseData.id}.json"`);
  res.json({ version: 1, case: exportData });
});

module.exports = router;
