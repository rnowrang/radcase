// Custom error class for API errors
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

// Centralized error handler middleware
function errorHandler(err, req, res, next) {
  console.error(`Error in ${req.method} ${req.path}:`, err.message);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }

  // SQLite constraint violations
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(409).json({ error: 'Database constraint violation' });
  }

  // Default server error
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = {
  ApiError,
  errorHandler
};
