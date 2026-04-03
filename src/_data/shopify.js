/**
 * Public Storefront API settings (token is scoped to storefront; safe in browser).
 * Set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN in .env for builds.
 */
module.exports = function () {
  var domain = process.env.SHOPIFY_STORE_DOMAIN || "";
  var token = process.env.SHOPIFY_STOREFRONT_TOKEN || "";
  return {
    configured: Boolean(domain && token),
    domain: domain,
    storefrontToken: token,
    apiVersion: process.env.SHOPIFY_STOREFRONT_API_VERSION || "2024-10"
  };
};
