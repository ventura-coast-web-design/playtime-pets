/**
 * Home hero grid: main spotlight, 2×2 promo tiles, and Dog/Cat category tiles.
 * Promo/main images from Shopify `products`; category art uses static assets.
 */
module.exports = async function () {
  const products = await require("./products.js")();
  const withImage = (products || []).filter(function (p) {
    return p && p.image;
  });

  const main = withImage[0] || null;

  const onSale = withImage.filter(function (p) {
    return p.comparePrice;
  });
  const promos = [];
  const seen = new Set();
  for (const p of onSale) {
    if (promos.length >= 4) break;
    promos.push(p);
    seen.add(p.handle);
  }
  for (const p of withImage) {
    if (promos.length >= 4) break;
    if (!seen.has(p.handle)) {
      promos.push(p);
      seen.add(p.handle);
    }
  }

  const promoSlots = promos.slice(0, 4);
  while (promoSlots.length < 4) {
    promoSlots.push(null);
  }

  const categoryTiles = [
    {
      label: "For Dogs",
      href: "/collections/dog",
      image: "/assets/images/cartoon_dog_hero.png"
    },
    {
      label: "For Cats",
      href: "/collections/cat",
      image: "/assets/images/cartoon_cat_hero.png"
    }
  ];

  return {
    main,
    promos,
    promoSlots,
    categoryTiles
  };
};
