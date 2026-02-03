const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const dicomParser = require('dicom-parser');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Directory
const DICOM_DIR = path.join(__dirname, '..', 'dicom');

// DICOM upload configuration
const dicomStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const seriesId = req.params.seriesId || uuidv4();
    const seriesDir = path.join(DICOM_DIR, seriesId);
    fs.mkdirSync(seriesDir, { recursive: true });
    req.dicomSeriesId = seriesId;
    cb(null, seriesDir);
  },
  filename: (req, file, cb) => {
    const filename = file.originalname || `${uuidv4()}.dcm`;
    cb(null, filename);
  }
});
const dicomUpload = multer({
  storage: dicomStorage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// Helper function to parse DICOM metadata
function parseDicomFile(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const byteArray = new Uint8Array(arrayBuffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    const getString = (tag) => {
      try { return dataSet.string(tag) || ''; } catch (e) { return ''; }
    };
    const getNumber = (tag) => {
      try { return parseFloat(dataSet.string(tag)) || null; } catch (e) { return null; }
    };

    return {
      patientName: getString('x00100010'),
      patientId: getString('x00100020'),
      studyDescription: getString('x00081030'),
      seriesDescription: getString('x0008103e'),
      modality: getString('x00080060'),
      seriesInstanceUID: getString('x0020000e'),
      studyInstanceUID: getString('x0020000d'),
      sopInstanceUID: getString('x00080018'),
      instanceNumber: parseInt(getString('x00200013')) || 0,
      windowCenter: getNumber('x00281050'),
      windowWidth: getNumber('x00281051'),
      rows: parseInt(getString('x00280010')) || 0,
      columns: parseInt(getString('x00280011')) || 0,
      bitsAllocated: parseInt(getString('x00280100')) || 16,
      pixelSpacing: getString('x00280030'),
      sliceThickness: getNumber('x00180050'),
      sliceLocation: getNumber('x00201041')
    };
  } catch (e) {
    console.error('Error parsing DICOM:', e.message);
    return null;
  }
}

// Get DICOM series for a case
router.get('/cases/:id/dicom', (req, res, next) => {
  try {
    const series = db.prepare(`
      SELECT * FROM dicom_series WHERE case_id = ? ORDER BY created_at
    `).all(req.params.id);

    res.json({ series });
  } catch (err) {
    next(err);
  }
});

// Upload DICOM series for a case
router.post('/cases/:id/dicom', requireAuth, dicomUpload.array('files', 1000), async (req, res, next) => {
  try {
    const caseId = req.params.id;

    // Check if case exists
    const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(caseId);
    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No DICOM files provided' });
    }

    const seriesId = req.dicomSeriesId || uuidv4();
    const seriesDir = path.join(DICOM_DIR, seriesId);

    fs.mkdirSync(seriesDir, { recursive: true });

    let metadata = null;
    const dicomFiles = [];
    const parseErrors = [];

    metadata = parseDicomFile(req.files[0].path);
    if (!metadata) {
      parseErrors.push({ filename: req.files[0].filename, error: 'Failed to parse DICOM metadata' });
    }

    for (const file of req.files) {
      const fileMetadata = parseDicomFile(file.path);
      if (!fileMetadata) {
        parseErrors.push({ filename: file.filename, error: 'Failed to parse DICOM file' });
      }
      dicomFiles.push({
        filename: file.filename,
        instanceNumber: fileMetadata?.instanceNumber || 0,
        sliceLocation: fileMetadata?.sliceLocation
      });
    }

    dicomFiles.sort((a, b) => {
      if (a.sliceLocation !== null && b.sliceLocation !== null) {
        return a.sliceLocation - b.sliceLocation;
      }
      return a.instanceNumber - b.instanceNumber;
    });

    db.prepare(`
      INSERT INTO dicom_series (
        id, case_id, series_uid, series_description, modality, num_images,
        folder_name, patient_name, study_description, window_center, window_width
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      seriesId,
      caseId,
      metadata?.seriesInstanceUID || null,
      metadata?.seriesDescription || 'Unnamed Series',
      metadata?.modality || 'Unknown',
      dicomFiles.length,
      seriesId,
      metadata?.patientName || null,
      metadata?.studyDescription || null,
      metadata?.windowCenter || null,
      metadata?.windowWidth || null
    );

    res.status(201).json({
      seriesId,
      numImages: dicomFiles.length,
      metadata,
      files: dicomFiles,
      ...(parseErrors.length > 0 && { parseWarnings: parseErrors })
    });
  } catch (err) {
    next(err);
  }
});

// Get list of DICOM images in a series (for viewer)
router.get('/dicom/series', (req, res) => {
  const { path: seriesPath, seriesId } = req.query;
  const folder = seriesId || seriesPath;

  if (!folder) {
    return res.status(400).json({ error: 'Series path or ID required' });
  }

  const seriesDir = path.join(DICOM_DIR, folder);

  if (!fs.existsSync(seriesDir)) {
    return res.status(404).json({ error: 'Series not found' });
  }

  try {
    const files = fs.readdirSync(seriesDir)
      .filter(f => f.endsWith('.dcm') || !f.includes('.'))
      .map(filename => {
        const filePath = path.join(seriesDir, filename);
        const metadata = parseDicomFile(filePath);
        return {
          filename,
          instanceNumber: metadata?.instanceNumber || 0,
          sliceLocation: metadata?.sliceLocation
        };
      })
      .sort((a, b) => {
        if (a.sliceLocation !== null && b.sliceLocation !== null) {
          return a.sliceLocation - b.sliceLocation;
        }
        return a.instanceNumber - b.instanceNumber;
      });

    const imageIds = files.map(f => `wadouri:/dicom/${folder}/${f.filename}`);
    const firstFile = path.join(seriesDir, files[0]?.filename);
    const metadata = files.length > 0 ? parseDicomFile(firstFile) : null;

    res.json({
      imageIds,
      numImages: files.length,
      metadata
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get DICOM series info
router.get('/dicom/:seriesId', (req, res) => {
  const series = db.prepare('SELECT * FROM dicom_series WHERE id = ?').get(req.params.seriesId);

  if (!series) {
    return res.status(404).json({ error: 'Series not found' });
  }

  const seriesDir = path.join(DICOM_DIR, series.folder_name);
  const files = fs.existsSync(seriesDir)
    ? fs.readdirSync(seriesDir).filter(f => f.endsWith('.dcm') || !f.includes('.'))
    : [];

  res.json({
    ...series,
    files: files.length,
    imageIds: files.map(f => `wadouri:/dicom/${series.folder_name}/${f}`)
  });
});

// Delete DICOM series
router.delete('/dicom/:seriesId', requireAuth, (req, res, next) => {
  try {
    const series = db.prepare('SELECT folder_name FROM dicom_series WHERE id = ?').get(req.params.seriesId);

    if (!series) {
      return res.status(404).json({ error: 'DICOM series not found' });
    }

    const seriesDir = path.join(DICOM_DIR, series.folder_name);
    if (fs.existsSync(seriesDir)) {
      try {
        fs.rmSync(seriesDir, { recursive: true, force: true });
      } catch (fsErr) {
        console.error(`Failed to delete DICOM directory ${series.folder_name}:`, fsErr.message);
      }
    }

    db.prepare('DELETE FROM dicom_series WHERE id = ?').run(req.params.seriesId);

    res.json({ message: 'Series deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
