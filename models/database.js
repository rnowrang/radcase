const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'radcase.db'));

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    modality TEXT,
    body_part TEXT,
    diagnosis TEXT,
    difficulty INTEGER DEFAULT 2,
    clinical_history TEXT,
    teaching_points TEXT,
    findings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT,
    sequence INTEGER DEFAULT 0,
    annotations TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS case_tags (
    case_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (case_id, tag_id),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id TEXT NOT NULL,
    correct INTEGER NOT NULL,
    time_spent_ms INTEGER,
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cases_modality ON cases(modality);
  CREATE INDEX IF NOT EXISTS idx_cases_body_part ON cases(body_part);
  CREATE INDEX IF NOT EXISTS idx_cases_difficulty ON cases(difficulty);
  CREATE INDEX IF NOT EXISTS idx_images_case ON images(case_id);

  CREATE TABLE IF NOT EXISTS dicom_series (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    series_uid TEXT,
    series_description TEXT,
    modality TEXT,
    num_images INTEGER DEFAULT 0,
    folder_name TEXT NOT NULL,
    patient_name TEXT,
    study_description TEXT,
    window_center REAL,
    window_width REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_dicom_case ON dicom_series(case_id);

  -- User authentication
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'resident',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Spaced repetition progress per user
  CREATE TABLE IF NOT EXISTS user_case_progress (
    user_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    next_review DATE,
    last_reviewed DATETIME,
    PRIMARY KEY (user_id, case_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_user_progress ON user_case_progress(user_id, next_review);

  -- AI Configuration
  CREATE TABLE IF NOT EXISTS ai_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Add user_id column to quiz_attempts if not exists
try {
  db.exec('ALTER TABLE quiz_attempts ADD COLUMN user_id TEXT');
} catch (e) {
  // Column already exists
}

module.exports = db;
