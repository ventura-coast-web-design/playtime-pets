/**
 * Full shop catalog JSON for client-side filters (pagination only loads a page of HTML).
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
    const loadShopCatalogMinimal = require("./_data/shopCatalog");
    const minimal = await loadShopCatalogMinimal();
    return JSON.stringify(minimal);
  }
};
