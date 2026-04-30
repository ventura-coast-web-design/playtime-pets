const path = require("path");

/**
 * Full shop catalog for client-side filters (pagination only loads a page of HTML).
 */
module.exports = {
  data() {
    return {
      permalink: "/assets/data/shop-catalog.json",
      eleventyExcludeFromCollections: true,
      layout: false
    };
  },
  async render() {
    const loadProducts = require(path.join(__dirname, "_data", "products.js"));
    const products = await loadProducts();
    const minimal = (products || []).map(function (p) {
      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        brand: p.brand,
        animal: p.animal,
        breedSize: p.breedSize,
        category: p.category,
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
    return JSON.stringify(minimal);
  }
};
