/**
 * Home hero: main spotlight + four tagged category sections (Fetch, Chew, Plush, Treat dispensing).
 * Products match Shopify tags hero-fetch, hero-chew, hero-plush, hero-treat-dispensing when present;
 * otherwise slots fill from the standard product list in order.
 */
module.exports = async function () {
  const products = await require("./products.js")();
  const withImage = (products || []).filter(function (p) {
    return p && p.image;
  });

  const HERO_SECTIONS = [
    { id: "fetch", title: "Fetch", tag: "hero-fetch" },
    { id: "chew", title: "Chew", tag: "hero-chew" },
    { id: "plush", title: "Plush", tag: "hero-plush" },
    { id: "treat-dispensing", title: "Treat Dispensing", tag: "hero-treat-dispensing" }
  ];

  const ITEMS_PER_SECTION = 2;

  function hasHeroTag(product, tag) {
    return (product.tags || []).some(function (t) {
      return String(t).trim().toLowerCase() === tag.toLowerCase();
    });
  }

  function pickTagged(products, tag, used, limit) {
    const picked = [];
    for (const p of products) {
      if (picked.length >= limit) break;
      if (!hasHeroTag(p, tag) || used.has(p.handle)) continue;
      picked.push(p);
      used.add(p.handle);
    }
    return picked;
  }

  function pickFallback(products, used, limit) {
    const picked = [];
    for (const p of products) {
      if (picked.length >= limit) break;
      if (used.has(p.handle)) continue;
      picked.push(p);
      used.add(p.handle);
    }
    return picked;
  }

  const used = new Set();
  const featuredSections = HERO_SECTIONS.map(function (section) {
    let items = pickTagged(withImage, section.tag, used, ITEMS_PER_SECTION);
    if (items.length < ITEMS_PER_SECTION) {
      items = items.concat(
        pickFallback(withImage, used, ITEMS_PER_SECTION - items.length)
      );
    }
    return Object.assign({}, section, { items: items });
  });

  return {
    main: withImage[0] || null,
    featuredSections: featuredSections
  };
};
