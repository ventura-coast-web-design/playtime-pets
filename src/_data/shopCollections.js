/**
 * Unique Shopify collections across the catalog (for shop filter options).
 */
module.exports = async function () {
  const loadProducts = require("./products.js");
  const products = await loadProducts();
  const byTitle = new Map();

  for (const product of products || []) {
    for (const collection of product.collections || []) {
      if (!collection || !collection.title) continue;
      if (!byTitle.has(collection.title)) {
        byTitle.set(collection.title, {
          handle: collection.handle || "",
          title: collection.title
        });
      }
    }
  }

  return Array.from(byTitle.values()).sort(function (a, b) {
    return a.title.localeCompare(b.title);
  });
};
