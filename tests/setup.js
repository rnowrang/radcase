const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Use a test database
const TEST_DB_PATH = path.join(__dirname, '..', 'radcase-test.db');

// Clean up test database before tests
beforeAll(() => {
  // Delete test database if it exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

// Clean up after all tests
afterAll(() => {
  // Optionally delete test database after tests
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});
