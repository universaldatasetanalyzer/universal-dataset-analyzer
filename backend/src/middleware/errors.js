const { captureException } = require('../services/monitoring');

function errorHandler(err, req, res, next) {
  captureException(err, { method: req.method, path: req.path, requestId: req.id });

  if (err.code === '23505') { // Unique violation
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ error: 'Referenced resource not found' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max size is 500MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Please upload a smaller dataset.' });
  }

  res.status(err.status || 500).json({
    error: err.status && err.message ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}

module.exports = { errorHandler, notFound };
