# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start the server (runs on port 3001)
npm start

# Seed database with 8 classic radiology teaching cases
node seed-data.js

# Import cases from teaching-cases.json
node import-teaching-cases.js

# Seed DICOM series data
node seed-dicom.js

# Generate synthetic DICOM files for testing
node generate-demo-dicom.js
```

## Architecture

RadCase is a radiology teaching platform built as a vanilla JS single-page application with an Express/SQLite backend.

### Backend (server.js)

All backend logic lives in a single `server.js` file (~1400 lines). Key components:

- **SQLite database** with 11 tables: cases, images, tags, case_tags, users, user_case_progress, quiz_attempts, dicom_series, ai_config
- **JWT authentication** via HTTP-only cookies (30-day expiration)
- **File handling**: uploads/ for images, thumbnails/ for Sharp-generated 400x400 previews, dicom/ for DICOM series
- **AI integration**: Configurable provider (OpenAI, Anthropic, Ollama) stored in ai_config table

### Frontend (public/)

Modular ES6 classes loaded by index.html:

- **annotate.js** - Canvas annotation with arrow/circle/rectangle/line/freehand/text tools, undo/redo history
- **presentation.js** - Full-screen presentation mode with progressive reveal
- **spaced-repetition.js** - SM-2 algorithm with localStorage + server sync
- **dicom-viewer.js** - Cornerstone.js integration with window/level presets (lung, bone, brain, abdomen, liver, stroke, subdural)
- **ai-tutor.js** - Context-aware AI chat using case data

### Data Flow

1. Cases contain images with optional annotations (stored as JSON in images table)
2. Quiz mode selects random cases, records attempts to quiz_attempts
3. Spaced repetition tracks review intervals in user_case_progress (server) and localStorage (client fallback)
4. DICOM series link to cases via dicom_series table, files stored in dicom/{seriesId}/

### API Structure

- `/api/cases` - Case CRUD, image upload, tag management
- `/api/auth` - Register, login, logout, current user
- `/api/quiz` - Random case selection, attempt recording, stats
- `/api/review/due` - Cases due for spaced repetition review
- `/api/dicom` - DICOM series management
- `/api/ai` - AI provider configuration and chat/completion endpoints
- `/api/export`, `/api/import` - Full case export/import with base64 images

### Key Configuration

- Server port: 3001
- JWT secret: `process.env.JWT_SECRET` or auto-generated
- Max upload: 50MB images, 500MB DICOM
- No build system - code runs directly
