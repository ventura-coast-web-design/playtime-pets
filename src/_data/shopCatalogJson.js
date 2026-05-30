/**
 * Pre-serialized shop catalog for inline <script type="application/json"> (Liquid cannot JSON.stringify arrays).
 */
module.exports = async function () {
  const loadShopCatalogMinimal = require("./shopCatalog");
  const minimal = await loadShopCatalogMinimal();
  return JSON.stringify(minimal);
};
