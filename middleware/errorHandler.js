function errorHandler(err, req, res, next) {
  const message = err.message || 'Internal Server Error';
  res.status(500).json({ error: message });
}

module.exports = errorHandler;
