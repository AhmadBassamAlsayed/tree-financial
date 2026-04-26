module.exports = {
  successResponse: (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
      success: true,
      message
    });
  },
  errorResponse: (res, statusCode, message, error = null) => {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error ? error.toString() : null
    });
  }
};
