/**
 * Build-time product list: Shopify Storefront API, or products.fallback.json when env is unset.
 */
const fs = require("fs");
const path = require("path");

const API_VERSION = process.env.SHOPIFY_STOREFRONT_API_VERSION || "2024-10";

function shopifyDebugEnabled() {
  const v = process.env.SHOPIFY_DEBUG;
  return v === "1" || v === "true" || String(v).toLowerCase() === "yes";
}

const PRODUCTS_QUERY = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          handle
          title
          description
          descriptionHtml
          vendor
          productType
          tags
          availableForSale
          featuredImage {
            url(transform: { maxWidth: 800, maxHeight: 800 })
          }
          images(first: 20) {
            edges {
              node {
                url(transform: { maxWidth: 1200, maxHeight: 1200 })
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                availableForSale
                price {
                  amount
                }
                compareAtPrice {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query Collections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          handle
          title
          products(first: 250) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`;

const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts($id: ID!, $first: Int!, $after: String) {
    collection(id: $id) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

function gidNumericId(gid) {
  if (!gid || typeof gid !== "string") return 0;
  const m = /\/(\d+)\s*$/.exec(gid);
  return m ? parseInt(m[1], 10) : 0;
}

function pickVariant(variants) {
  const edges = (variants && variants.edges) || [];
  if (!edges.length) return null;
  const available = edges.find(function (e) {
    return e.node && e.node.availableForSale;
  });
  return (available || edges[0]).node;
}

/**
 * Optional tag conventions (colon-separated), e.g. breed:small, material:Plush, rating:4.5
 * (Animal type is derived from the product title, not tags.)
 */
function parseTagFilters(tags) {
  const out = {
    breedSize: "all",
    material: "—",
    rating: 4.5
  };
  if (!Array.isArray(tags)) return out;
  for (const t of tags) {
    const lower = t.toLowerCase();
    if (lower.startsWith("breed:")) {
      const v = t.slice(6).trim().toLowerCase();
      if (v === "small" || v === "medium" || v === "large" || v === "all") out.breedSize = v;
    } else if (lower.startsWith("material:")) {
      out.material = t.slice(9).trim() || "—";
    } else if (lower.startsWith("rating:")) {
      const r = parseFloat(t.slice(7), 10);
      if (!isNaN(r)) out.rating = r;
    }
  }
  return out;
}

/** Shopify / channel tags omitted from storefront (e.g. marketplace listing labels). */
const TAGS_HIDDEN_FROM_DISPLAY = new Set(["listing site - us"]);

function filterDisplayTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter(function (t) {
    if (typeof t !== "string") return false;
    return !TAGS_HIDDEN_FROM_DISPLAY.has(t.trim().toLowerCase());
  });
}

function formatMoney(amountStr) {
  const n = parseFloat(amountStr, 10);
  if (isNaN(n)) return "0.00";
  return n.toFixed(2);
}

/** All unique image URLs in stable order (gallery order, then featured if still empty). */
function collectProductImageUrls(node) {
  const out = [];
  const seen = new Set();
  function add(u) {
    if (u && typeof u === "string" && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  const imgEdges = (node.images && node.images.edges) || [];
  for (const e of imgEdges) {
    add(e.node && e.node.url);
  }
  if (out.length === 0 && node.featuredImage && node.featuredImage.url) {
    add(node.featuredImage.url);
  }
  return out;
}

function productImageUrl(node) {
  const urls = collectProductImageUrls(node);
  return urls.length ? urls[0] : null;
}

async function productIdsInCollection(col) {
  const ids = [];
  const seen = new Set();

  function addEdges(edges) {
    for (const edge of edges || []) {
      const gid = edge && edge.node && edge.node.id;
      if (!gid || seen.has(gid)) continue;
      seen.add(gid);
      ids.push(gid);
    }
  }

  addEdges(col.products && col.products.edges);

  let hasNext = col.products && col.products.pageInfo && col.products.pageInfo.hasNextPage;
  let after = hasNext ? col.products.pageInfo.endCursor : null;

  while (hasNext) {
    const result = await shopifyGraphql(COLLECTION_PRODUCTS_QUERY, {
      id: col.id,
      first: 250,
      after: after
    });

    if (result.errors && result.errors.length && !isUnauthorizedError(result.errors)) {
      console.error("[Shopify GraphQL errors]", JSON.stringify(result.errors, null, 2));
    }

    const productsConn = result.data && result.data.collection && result.data.collection.products;
    if (!productsConn) break;

    addEdges(productsConn.edges);
    hasNext = productsConn.pageInfo && productsConn.pageInfo.hasNextPage;
    after = hasNext ? productsConn.pageInfo.endCursor : null;
  }

  return ids;
}

async function fetchCollectionMembershipByProductId() {
  const byProductId = new Map();
  let after = null;
  let hasNext = true;
  let collectionCount = 0;

  while (hasNext) {
    const result = await shopifyGraphql(COLLECTIONS_QUERY, {
      first: 50,
      after: after
    });

    if (result.errors && result.errors.length) {
      if (isUnauthorizedError(result.errors)) {
        const err = new Error("STOREFRONT_UNAUTHORIZED");
        err.code = "STOREFRONT_UNAUTHORIZED";
        err.graphqlErrors = result.errors;
        throw err;
      }
      console.error("[Shopify GraphQL errors]", JSON.stringify(result.errors, null, 2));
    }

    const data = result.data;
    if (!data || !data.collections) break;

    const edges = data.collections.edges || [];
    for (const edge of edges) {
      const col = edge && edge.node;
      if (!col || !col.title) continue;

      collectionCount += 1;
      const meta = {
        handle: col.handle != null ? String(col.handle) : "",
        title: String(col.title).trim()
      };
      const productGids = await productIdsInCollection(col);

      for (const gid of productGids) {
        const numericId = gidNumericId(gid);
        if (!numericId) continue;
        if (!byProductId.has(numericId)) byProductId.set(numericId, []);
        const list = byProductId.get(numericId);
        if (!list.some(function (c) {
          return c.title === meta.title;
        })) {
          list.push(meta);
        }
      }
    }

    hasNext = data.collections.pageInfo && data.collections.pageInfo.hasNextPage;
    after = hasNext ? data.collections.pageInfo.endCursor : null;
  }

  return { byProductId: byProductId, collectionCount: collectionCount };
}

function attachCollectionsToProducts(products, byProductId) {
  let withCollections = 0;
  for (const product of products) {
    const fromCollections = byProductId.get(product.id) || [];
    const merged = normalizeCollections(
      (product.collections || []).concat(fromCollections)
    );
    product.collections = merged;
    if (merged.length) withCollections += 1;
  }
  return withCollections;
}

function normalizeCollections(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item) continue;
    const title =
      typeof item === "string"
        ? item.trim()
        : item.title != null
          ? String(item.title).trim()
          : "";
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push({
      handle:
        item && item.handle != null
          ? String(item.handle)
          : title.toLowerCase().replace(/\s+/g, "-"),
      title: title
    });
  }
  return out.sort(function (a, b) {
    return a.title.localeCompare(b.title);
  });
}

/**
 * Single display label per brand so filters don't list BARK BOX / Bark Box / BarkBox separately.
 */
function normalizeBrandLabel(raw) {
  if (!raw || typeof raw !== "string") return "—";
  const s = raw.trim();
  if (!s) return "—";

  const key = s.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const compact = key.replace(/\s/g, "");

  if (key === "bark box" || compact === "barkbox") {
    return "BarkBox";
  }
  if (key === "kong") {
    return "KONG";
  }

  // Other brands: stable title case, but keep intentional all-caps acronyms (e.g. ORIJEN, ZIWI).
  const tokens = s.split(/[\s-]+/).filter(Boolean);
  return tokens
    .map(function (tok) {
      const lower = tok.toLowerCase();
      if (tok.length >= 4 && tok === tok.toUpperCase() && /^[A-Z]+$/.test(tok)) {
        return tok;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Shopify vendor often isn't useful for this catalog; titles usually lead with the brand
 * (e.g. "KONG …", "Bark Box …"). Derive a filter/display label from the title.
 */
function deriveBrandFromTitle(title) {
  if (!title || typeof title !== "string") return "—";
  const t = title.trim();
  if (!t) return "—";
  const rawParts = t.split(/\s+/);
  const parts = [];
  for (let i = 0; i < rawParts.length; i++) {
    let w = rawParts[i].replace(/^[\[(]+/, "").replace(/[,;:.!?)\]]+$/g, "");
    if (w) parts.push(w);
  }
  if (!parts.length) return "—";
  const first = parts[0];
  const second = parts[1] || "";
  const fl = first.toLowerCase();
  const sl = second.toLowerCase();
  let raw;
  if (fl === "bark" && sl === "box") {
    raw = first + " " + second;
  } else if (fl === "barkbox" || fl === "bark-box") {
    raw = "BarkBox";
  } else {
  raw = first;
  }
  return normalizeBrandLabel(raw);
}

/**
 * Animal filter value from the product title (case-insensitive "dog" / "cat").
 * Both substrings → "both"; only one → that species; neither → "none" (excluded from Dog-only / Cat-only filters).
 */
function deriveAnimalFromTitle(title) {
  if (!title || typeof title !== "string") return "none";
  const t = title.toLowerCase();
  const hasDog = t.indexOf("dog") !== -1;
  const hasCat = t.indexOf("cat") !== -1;
  if (hasDog && hasCat) return "both";
  if (hasDog) return "dog";
  if (hasCat) return "cat";
  return "none";
}

function mapShopifyNode(node) {
  const variant = pickVariant(node.variants);
  if (!variant) return null;

  const imageUrls = collectProductImageUrls(node);
  if (!imageUrls.length) {
    return null;
  }
  const imageUrl = imageUrls[0];

  const price = formatMoney(variant.price && variant.price.amount);
  let comparePrice = null;
  if (variant.compareAtPrice && variant.compareAtPrice.amount) {
    const cmp = formatMoney(variant.compareAtPrice.amount);
    if (parseFloat(cmp, 10) > parseFloat(price, 10)) comparePrice = cmp;
  }

  const tagParsed = parseTagFilters(node.tags);
  const numericId = gidNumericId(node.id);

  return {
    id: numericId,
    handle: node.handle,
    title: node.title,
    description: node.description || "",
    descriptionHtml:
      node.descriptionHtml ||
      (node.description ? "<p>" + escapeHtml(String(node.description)) + "</p>" : ""),
    price: price,
    comparePrice: comparePrice,
    image: imageUrl,
    images: imageUrls,
    collections: [],
    brand: deriveBrandFromTitle(node.title),
    animal: deriveAnimalFromTitle(node.title),
    breedSize: tagParsed.breedSize,
    material: tagParsed.material,
    rating: tagParsed.rating,
    tags: filterDisplayTags(node.tags || []),
    inStock: Boolean(node.availableForSale && variant.availableForSale),
    variantId: variant.id,
    accentIndex: Math.abs(numericId) % 6
  };
}

function loadFallback() {
  const fallbackPath = path.join(__dirname, "products.fallback.json");
  if (!fs.existsSync(fallbackPath)) {
    console.warn(
      "[products] No SHOPIFY_* env and no products.fallback.json — shop will be empty."
    );
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
  if (!Array.isArray(raw)) return [];
  return raw.map(function (p) {
    const id = p.id;
    const images =
      Array.isArray(p.images) && p.images.length
        ? p.images.slice()
        : p.image
          ? [p.image]
          : [];
    const primary = images.length ? images[0] : p.image || "";
    const title = p.title != null ? String(p.title) : "";
    const collections = normalizeCollections(
      Array.isArray(p.collections)
        ? p.collections
        : p.category
          ? [{ handle: String(p.category).toLowerCase().replace(/\s+/g, "-"), title: String(p.category) }]
          : []
    );
    return Object.assign({}, p, {
      handle: p.handle != null ? String(p.handle) : String(id),
      descriptionHtml:
        p.descriptionHtml ||
        (p.description ? "<p>" + escapeHtml(String(p.description)) + "</p>" : ""),
      variantId: p.variantId != null ? p.variantId : null,
      accentIndex: typeof id === "number" ? Math.abs(id) % 6 : 0,
      images: images,
      image: primary,
      collections: collections,
      brand: title
        ? deriveBrandFromTitle(title)
        : normalizeBrandLabel(p.brand != null ? String(p.brand) : "—"),
      animal: deriveAnimalFromTitle(title),
      tags: filterDisplayTags(Array.isArray(p.tags) ? p.tags : [])
    });
  });
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isUnauthorizedError(errors) {
  if (!errors || !errors.length) return false;
  return errors.some(function (e) {
    return (
      (e.extensions && e.extensions.code === "UNAUTHORIZED") ||
      (typeof e.message === "string" && e.message.indexOf("Unauthorized") !== -1)
    );
  });
}

/**
 * Full GraphQL response (data + errors). Empty catalog = data.products.edges [], not UNAUTHORIZED.
 */
async function shopifyGraphql(query, variables) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  const endpoint = "https://" + domain + "/api/" + API_VERSION + "/graphql.json";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await res.json();
  return { data: body.data, errors: body.errors, httpStatus: res.status };
}

async function fetchAllShopifyProducts() {
  const all = [];
  let after = null;
  let hasNext = true;
  const pageSize = 50;

  while (hasNext) {
    const result = await shopifyGraphql(PRODUCTS_QUERY, {
      first: pageSize,
      after: after
    });

    if (result.errors && result.errors.length) {
      if (isUnauthorizedError(result.errors)) {
        const err = new Error("STOREFRONT_UNAUTHORIZED");
        err.code = "STOREFRONT_UNAUTHORIZED";
        err.graphqlErrors = result.errors;
        throw err;
      }
      console.error("[Shopify GraphQL errors]", JSON.stringify(result.errors, null, 2));
    }

    const data = result.data;
    if (shopifyDebugEnabled()) {
      const edgesPreview = (data && data.products && data.products.edges) || [];
    }
    if (!data || !data.products) break;
    const edges = data.products.edges || [];
    for (const edge of edges) {
      const mapped = mapShopifyNode(edge.node);
      if (mapped) all.push(mapped);
    }
    hasNext = data.products.pageInfo && data.products.pageInfo.hasNextPage;
    after = hasNext ? data.products.pageInfo.endCursor : null;
  }

  const membership = await fetchCollectionMembershipByProductId();
  const withCollections = attachCollectionsToProducts(all, membership.byProductId);
  console.log(
    "[products] Linked " +
      membership.collectionCount +
      " Shopify collections to " +
      withCollections +
      " of " +
      all.length +
      " products."
  );
  if (membership.collectionCount === 0) {
    console.warn(
      "[products] No collections returned from Shopify. Publish collections to your Online Store sales channel, then rebuild."
    );
  }

  return all;
}

function logZeroProductsHint() {
  console.warn("");
  console.warn("[products] Shopify returned 0 products (auth worked). Common causes:");
  console.warn("  • Products are not published to the Online Store sales channel. In Admin: open a product →");
  console.warn("    “Publishing” / “Sales channels and apps” → turn on Online Store (and save).");
  console.warn("  • If you use a Headless channel only, publish to that channel instead.");
  console.warn("  • Draft or archived products are hidden from the Storefront API.");
  console.warn("  • Re-run the build after changing Shopify — this site loads products at build time, not live.");
  console.warn("");
}

function logUnauthorizedHelp() {
  console.warn("");
  console.warn("[products] Storefront API returned UNAUTHORIZED — this is an auth problem, not an empty store.");
  console.warn("  An empty catalog still returns HTTP 200 with products: { edges: [] }.");
  console.warn("  Check:");
  console.warn("  • SHOPIFY_STORE_DOMAIN is your shop hostname only, e.g. your-store.myshopify.com (no https://)");
  console.warn("  • SHOPIFY_STOREFRONT_TOKEN is the Storefront API public token from Admin → Apps → your app → API credentials");
  console.warn("  • Do not use the Admin API secret token here — it must say Storefront API access token");
  console.warn("  • In the app, Storefront API must be enabled with at least product read scopes");
  console.warn("  • Regenerate the token if it was copied wrong (extra spaces/newlines)");
  console.warn("[products] Falling back to products.fallback.json until credentials work.");
  console.warn("");
}

/** Single fetch per build (also used by heroShowcase.js). */
let productsLoadPromise = null;

async function loadProductsInternal() {
  if (process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_TOKEN) {
    try {
      const products = await fetchAllShopifyProducts();
      if (products.length === 0) {
        logZeroProductsHint();
      }
      console.log("[products] Loaded " + products.length + " products from Shopify.");
      return products;
    } catch (e) {
      if (e.code === "STOREFRONT_UNAUTHORIZED") {
        logUnauthorizedHelp();
        return loadFallback();
      }
      console.error("[products] Shopify fetch failed:", e.message);
      return loadFallback();
    }
  }

  console.warn("[products] SHOPIFY_STORE_DOMAIN / SHOPIFY_STOREFRONT_TOKEN not set — using products.fallback.json.");
  return loadFallback();
}

module.exports = async function () {
  if (!productsLoadPromise) {
    productsLoadPromise = loadProductsInternal();
  }
  return productsLoadPromise;
};
