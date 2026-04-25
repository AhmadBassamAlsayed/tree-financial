const { errorResponse } = require('../utils/response.utils');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'Access token is required');
  }

  const token = authHeader.split(' ')[1];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const ssoResponse = await fetch(
      `${process.env.SSO_BASE_URL}/api/auth/internal/users/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': process.env.INTERNAL_API_SECRET
        },
        body: JSON.stringify({ token }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    const result = await ssoResponse.json();

    if (!ssoResponse.ok || !result.success) {
      if (ssoResponse.status === 404) {
        return errorResponse(res, 401, 'User not found');
      }
      return errorResponse(res, 401, result.message || 'Invalid or expired token');
    }

    const { data } = result;

    if (data.isDeleted) return errorResponse(res, 403, 'Account has been deleted');
    if (data.isBanned)  return errorResponse(res, 403, `Account is banned: ${data.banReason || 'No reason provided'}`);

    req.userId       = data.tokenData.id;
    req.userFullName = data.tokenData.fullName;
    req.userRole     = data.tokenData.role;

    next();
  } catch (err) {
    if (err.name === 'AbortError') {
      return errorResponse(res, 503, 'Authentication service unavailable');
    }
    console.error('Auth middleware — SSO unreachable:', err.message);
    return errorResponse(res, 503, 'Authentication service unavailable');
  }
};

module.exports = authenticate;
