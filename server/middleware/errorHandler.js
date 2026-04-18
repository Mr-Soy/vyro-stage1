/**
 * Global error handler middleware.
 * Catches all unhandled errors and returns a consistent JSON response.
 * Must be registered AFTER all routes with app.use(errorHandler).
 */
function errorHandler(err, req, res, _next) {
  // Log the error
  console.error(`[${new Date().toISOString()}] ${err.code || 'ERROR'}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Determine HTTP status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred.',
    },
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    response.error.details = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
