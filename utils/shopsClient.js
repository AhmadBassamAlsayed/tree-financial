/**
 * Calls the shops service internal API to check if a user owns a given shop.
 * @param {number} shopId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
const isShopOwner = async (shopId, userId) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `${process.env.SHOPS_BASE_URL}/api/internal/shops/${shopId}/is-owner/${userId}`,
      {
        headers: { 'X-Internal-Secret': process.env.INTERNAL_API_SECRET },
        signal: controller.signal
      }
    );
    const body = await res.json();
    return res.ok && body.data?.isOwner === true;
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { isShopOwner };
