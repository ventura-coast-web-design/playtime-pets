const path = require("path");

/**
 * Minimal product fields for client-side shop filters (shared with shop-catalog.11ty.js).
 */
function toShopCatalogMinimal(products) {
  return (products || []).map(function (p) {
    return {
      id: p.id,
      handle: p.handle,
      title: p.title,
      brand: p.brand,
      animal: p.animal,
      breedSize: p.breedSize,
      collections: Array.isArray(p.collections) ? p.collections : [],
      material: p.material,
      rating: p.rating,
      price: p.price,
      comparePrice: p.comparePrice,
      image: p.image,
      images: Array.isArray(p.images) ? p.images : [],
      inStock: Boolean(p.inStock),
      variantId: p.variantId || null,
      accentIndex:
        typeof p.accentIndex === "number" ? p.accentIndex : Math.abs(p.id || 0) % 6
    };
  });
}

async function loadShopCatalogMinimal() {
  const loadProducts = require(path.join(__dirname, "products.js"));
  const products = await loadProducts();
  return toShopCatalogMinimal(products);
}

module.exports = loadShopCatalogMinimal;
module.exports.toShopCatalogMinimal = toShopCatalogMinimal;
