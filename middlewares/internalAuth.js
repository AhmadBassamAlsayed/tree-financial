const { errorResponse } = require('../utils/response.utils');

const internalAuth = (req, res, next) => {
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return errorResponse(res, 403, 'Forbidden: invalid internal secret');
  }
  next();
};

module.exports = internalAuth;
