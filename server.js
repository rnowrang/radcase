const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

// Initialize database (runs schema creation)
require('./models/database');

// Import middleware
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const casesRoutes = require('./routes/cases');
const imagesRoutes = require('./routes/images');
const dicomRoutes = require('./routes/dicom');
const quizRoutes = require('./routes/quiz');
const progressRoutes = require('./routes/progress');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure directories exist
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const THUMB_DIR = path.join(__dirname, 'thumbnails');
const DICOM_DIR = path.join(__dirname, 'dicom');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });
fs.mkdirSync(DICOM_DIR, { recursive: true });

// ============ Global Middleware ============
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Auth middleware - extracts user from token
app.use(authMiddleware);

// ============ Static Files ============
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/thumbnails', express.static(THUMB_DIR));
app.use('/dicom', express.static(DICOM_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// ============ API Routes ============

// Authentication routes: /api/auth/*
app.use('/api/auth', authRoutes);

// Users route (GET /api/users uses auth routes)
app.use('/api/users', authRoutes);

// Cases routes: /api/cases/*
app.use('/api/cases', casesRoutes);

// Image routes: /api/images/*, /api/cases/:id/images, /api/tags, /api/filters
app.use('/api', imagesRoutes);

// DICOM routes: /api/dicom/*, /api/cases/:id/dicom
app.use('/api', dicomRoutes);

// Quiz routes: /api/quiz/*
app.use('/api/quiz', quizRoutes);

// Review routes: /api/review/*
app.use('/api/review', quizRoutes);

// Progress routes: /api/progress
app.use('/api/progress', progressRoutes);

// AI routes: /api/ai/*
app.use('/api/ai', aiRoutes);

// Analytics routes: /api/analytics
app.use('/api/analytics', analyticsRoutes);

// Export/Import routes
app.use('/api/export', analyticsRoutes);
app.use('/api/import', analyticsRoutes);

// ============ SPA Fallback ============
// Serve index.html for non-API routes (after all API routes defined)
app.use((req, res, next) => {
  // Don't catch API routes or static files
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') ||
      req.path.startsWith('/thumbnails/') || req.path.startsWith('/dicom/')) {
    return next();
  }
  // For all other paths, serve the SPA
  if (req.method === 'GET') {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// ============ Error Handler ============
app.use(errorHandler);

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`RadCase server running at http://localhost:${PORT}`);
});

module.exports = app;
