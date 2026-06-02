const path = require("path");

function capitalizeLabel(s) {
  const lower = String(s).trim().toLowerCase();
  if (!lower) return "";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function materialOptionsFromProducts(products) {
  const seen = new Set();
  const out = [];

  for (const p of products || []) {
    const raw = p.materialFilter || "";
    const parts = raw ? raw.split("|") : [];
    if (!parts.length && p.material && p.material !== "—") {
      parts.push(String(p.material).trim().toLowerCase());
    }
    for (const part of parts) {
      const token = part.trim().toLowerCase();
      if (!token || seen.has(token)) continue;
      seen.add(token);
      out.push(capitalizeLabel(token));
    }
  }

  return out.sort(function (a, b) {
    return a.localeCompare(b);
  });
}

module.exports = async function () {
  const loadProducts = require(path.join(__dirname, "products.js"));
  const products = await loadProducts();
  return {
    materials: materialOptionsFromProducts(products)
  };
};
