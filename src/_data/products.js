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
 * Optional tag conventions (colon-separated), e.g. animal:dog, breed:small, material:Plush, rating:4.5
 */
function parseTagFilters(tags) {
  const out = {
    animal: "both",
    breedSize: "all",
    material: "—",
    rating: 4.5
  };
  if (!Array.isArray(tags)) return out;
  for (const t of tags) {
    const lower = t.toLowerCase();
    if (lower.startsWith("animal:")) {
      const v = t.slice(7).trim().toLowerCase();
      if (v === "dog" || v === "cat" || v === "both") out.animal = v;
    } else if (lower.startsWith("breed:")) {
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
    description: "",
    descriptionHtml: node.descriptionHtml || "",
    price: price,
    comparePrice: comparePrice,
    image: imageUrl,
    images: imageUrls,
    category: node.productType || "Products",
    brand: node.vendor || "—",
    animal: tagParsed.animal,
    breedSize: tagParsed.breedSize,
    material: tagParsed.material,
    rating: tagParsed.rating,
    tags: node.tags || [],
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
    return Object.assign({}, p, {
      handle: p.handle != null ? String(p.handle) : String(id),
      descriptionHtml:
        p.descriptionHtml ||
        (p.description ? "<p>" + escapeHtml(String(p.description)) + "</p>" : ""),
      variantId: p.variantId != null ? p.variantId : null,
      accentIndex: typeof id === "number" ? Math.abs(id) % 6 : 0,
      images: images,
      image: primary
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
      console.log("[Shopify DEBUG] products query response:", {
        httpStatus: result.httpStatus,
        graphqlErrors: result.errors,
        pageInfo: data && data.products ? data.products.pageInfo : null,
        edgesThisPage: edgesPreview.length,
        sampleTitles: edgesPreview.slice(0, 5).map(function (e) {
          return e.node && e.node.title;
        })
      });
      if (process.env.SHOPIFY_DEBUG_FULL === "1" && data) {
        console.log("[Shopify DEBUG] full data JSON:\n" + JSON.stringify(data, null, 2));
      }
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

module.exports = async function () {
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
};
