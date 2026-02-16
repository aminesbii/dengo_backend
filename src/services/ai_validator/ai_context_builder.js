import { getProductsFromDB, getShopsFromDB, getSiteStats, searchProducts } from "../databaseQueries.js";
import { Review } from "../../models/review.model.js";

// Extract intent and parameters from user message (marketplace-focused)
export async function analyzeUserIntent(message) {
  const lower = (message || "").toLowerCase();
  const patterns = {
    search: /cherche|search|looking for|trouve|find|show me|i need|looking to buy|looking to rent/,
    brand: /marque\s*[:]?\s*([\w-]+)/i,
    priceRange: /(\d+(?:[.,]\d+)?)\s*(dt|dinars|tnd|euros|eur|dinar)/i,
    vendor: /(shop|vendor|seller|boutique|vendeur|magasin|vendeuse|store|vendor)\b/i,
    reviews: /avis|review|rating|note|commentaires|comments/i,
    categories: /categorie|category|catégorie|type/i,
    stats: /combien|how many|total|statistics|stats|nombre/i,
    availability: /disponible|available|stock|rupture|out of stock|in stock/i,
  };

  const intent = {};
  if (patterns.search.test(lower)) intent.type = "search";
  if (patterns.reviews.test(lower)) intent.type = "reviews";
  if (patterns.vendor.test(lower)) intent.type = "vendors";
  if (patterns.stats.test(lower)) intent.type = "stats";

  const brandMatch = lower.match(patterns.brand);
  if (brandMatch) intent.brand = brandMatch[1];

  const priceMatch = lower.match(patterns.priceRange);
  if (priceMatch) intent.price = priceMatch[1];

  if (patterns.availability.test(lower)) intent.availability = true;

  return intent;
}

// Build context using site models/services
export async function buildAIContext(userMessage, options = {}) {
  const intent = await analyzeUserIntent(userMessage);
  const skipSiteData = !!options.skipSiteData;
  let context = "";

  try {
    if (!skipSiteData) {
      // Site stats
      const stats = await getSiteStats();
      if (stats) {
        context += "Website Statistics:\n";
        context += `- Total products: ${stats.totalProducts}\n`;
        context += `- Total shops: ${stats.totalShops}\n`;
        if (stats.popularBrands && stats.popularBrands.length) {
          context += `- Top brands: ${stats.popularBrands.slice(0,3).map(b => b.name).join(", ")}\n`;
        }
        context += "\n";
      }

      // Vendors / shops
      if (intent.type === "vendors") {
        const shops = await getShopsFromDB(5);
        if (shops && shops.length) {
          context += "Partner Shops:\n";
          shops.slice(0,3).forEach(s => {
            const city = s.address && s.address.city ? s.address.city : "";
            context += `- ${s.name} (${city}) - ${s.phone || "no phone"} - ${s.email || s.owner || ""}\n`;
          });
          context += "\n";
        } else {
          context += "No partner shops found.\n\n";
        }
      }

      // Reviews request or include reviews for product search
      if (intent.type === "reviews") {
        // try to find products matching the message
        const prods = await searchProducts(userMessage, 3);
        if (prods && prods.length) {
          context += "Reviews for matching products:\n";
          for (const p of prods) {
            context += `- ${p.name || p.title || p.brand || "Product"} - ${p.price || "N/A"} - Shop: ${(p.vendor && p.vendor.name) || p.vendor}\n`;
            try {
              const revs = await Review.find({ productId: p._id }).limit(2).lean();
              revs.forEach(r => {
                context += `  - Review: rating ${r.rating || "N/A"}, ${r.comment ? r.comment.substring(0,120) : "no comment"}\n`;
              });
            } catch (rErr) {
              // ignore
            }
          }
          context += "\n";
        } else {
          context += "No products found to show reviews for.\n\n";
        }
      }

      // Search / product listing
      if (intent.type === "search" || intent.brand || intent.price || intent.availability) {
        const filters = {};
        if (intent.brand) filters.brand = new RegExp(intent.brand, "i");
        if (intent.price) {
          const p = parseFloat(intent.price.replace(',', '.')) || 0;
          filters.minPrice = Math.floor(p * 0.8);
          filters.maxPrice = Math.ceil(p * 1.2);
        }
        if (intent.availability) filters.available = true;

        const products = await getProductsFromDB(filters, 5);
        if (products && products.length) {
          context += "Matching Products:\n";
          products.slice(0,3).forEach(prod => {
            const shopName = prod.vendor && prod.vendor.name ? prod.vendor.name : (prod.vendor || "Direct");
            context += `- ${prod.name || prod.title} - ${prod.brand || ""} - ${prod.price || "N/A"} - Stock: ${prod.stock != null ? prod.stock : "N/A"} - Shop: ${shopName}\n`;
          });
          context += "\n";
        } else {
          // fallback to text search
          const results = await searchProducts(userMessage, 3);
          if (results && results.length) {
            context += "Related Products Found:\n";
            results.forEach(p => {
              context += `- ${p.name || p.title} - ${p.brand || ""} - ${p.price || "N/A"}\n`;
            });
            context += "\n";
          } else {
            context += "No products found matching the search criteria.\n\n";
          }
        }
      }
    }

    // Generic fallback when nothing matched specifically
    if (!skipSiteData && !intent.type) {
      const results = await searchProducts(userMessage, 3);
      if (results && results.length) {
        context += "Related Products Found:\n";
        results.slice(0,3).forEach(p => {
          context += `- ${p.name || p.title} - ${p.brand || ""} - ${p.price || "N/A"}\n`;
        });
        context += "\n";
      }
    }
  } catch (err) {
    console.error("Error building AI context:", err);
  }

  return context;
}
