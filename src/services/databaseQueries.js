import { Product } from "../models/product.model.js";
import Shop from "../models/shop.model.js";
import { Review } from "../models/review.model.js";

/**
 * Fetch products with optional filters.
 * Supported filters: brand (string or regex), price (object { $gte, $lte }), shopId, available(boolean), type
 */
export async function getProductsFromDB(filters = {}, limit = 50) {
  try {
    const q = {};
    if (filters.brand) q.brand = filters.brand;
    if (filters.shopId) q.vendor = filters.shopId;
    if (filters.available !== undefined) {
      // map older "available" to product `status` / stock heuristics
      if (filters.available === true) q.status = { $in: ["active", "public"] };
    }
    if (filters.type) q.type = filters.type;
    if (filters.minPrice || filters.maxPrice || filters.price) {
      q.price = {};
      if (filters.minPrice || (filters.price && filters.price.$gte)) q.price.$gte = filters.minPrice || (filters.price && filters.price.$gte);
      if (filters.maxPrice || (filters.price && filters.price.$lte)) q.price.$lte = filters.maxPrice || (filters.price && filters.price.$lte);
    }

    return await Product.find(q).limit(limit).populate({ path: "vendor", select: "name email phone" }).lean();
  } catch (err) {
    console.error("getProductsFromDB error:", err);
    return [];
  }
}

export async function getShopsFromDB(limit = 50) {
  try {
    return await Shop.find({ status: { $ne: "rejected" } }).limit(limit).lean();
  } catch (err) {
    console.error("getShopsFromDB error:", err);
    return [];
  }
}

export async function getSiteStats() {
  try {
    const totalProducts = await Product.countDocuments();
    const totalShops = await Shop.countDocuments();
    const popularBrandsAgg = await Product.aggregate([
      { $match: { brand: { $exists: true, $ne: "" } } },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    const popularBrands = popularBrandsAgg.map((r) => ({ name: r._id, count: r.count }));

    return { totalProducts, totalShops, popularBrands };
  } catch (err) {
    console.error("getSiteStats error:", err);
    return null;
  }
}

export async function getBestDeals(limit = 10) {
  try {
    // Find products on sale, sorted by discount value or sale price
    // Assuming discount.value is populated for percentage/fixed
    return await Product.find({
      status: "active",
      isOnSale: true,
      stockStatus: "in_stock"
    })
      .sort({ "discount.value": -1 }) // Higher discount first
      .limit(limit)
      .populate({ path: "vendor", select: "name" })
      .lean();
  } catch (err) {
    console.error("getBestDeals error:", err);
    return [];
  }
}

export async function getTopShops(limit = 10) {
  try {
    return await Shop.find({ status: "approved", isActive: true })
      .sort({ "stats.averageRating": -1, "stats.totalOrders": -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error("getTopShops error:", err);
    return [];
  }
}

export async function searchProducts(queryText, options = {}) {
  try {
    const { minPrice, maxPrice, category, limit = 10 } = options;

    // Use MongoDB text index for fast relevance-based search
    const query = {
      status: "active",
    };

    // Use $text search if we have a query, otherwise just filter
    if (queryText && queryText.trim()) {
      query.$text = { $search: queryText.trim() };
    }

    if (category) {
      query.category = category;
    }

    if (minPrice !== undefined && minPrice !== null || maxPrice !== undefined && maxPrice !== null) {
      query.price = {};
      if (minPrice !== undefined && minPrice !== null) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined && maxPrice !== null) query.price.$lte = Number(maxPrice);
    }

    // If using text search, sort by text relevance score
    const projection = queryText && queryText.trim()
      ? { score: { $meta: "textScore" } }
      : {};

    const sort = queryText && queryText.trim()
      ? { score: { $meta: "textScore" } }
      : { "stats.totalOrders": -1 }; // fallback: popular products first

    return await Product.find(query, projection)
      .sort(sort)
      .limit(limit)
      .populate({ path: "vendor", select: "name" })
      .lean();
  } catch (err) {
    // Fallback to regex if text index fails (e.g., on empty collections)
    console.warn("Text search failed, falling back to regex:", err.message);
    try {
      const { minPrice, maxPrice, limit = 10 } = options;
      const fallbackQuery = { status: "active" };
      if (queryText && queryText.trim()) {
        fallbackQuery.$or = [
          { name: { $regex: queryText, $options: "i" } },
          { description: { $regex: queryText, $options: "i" } },
          { brand: { $regex: queryText, $options: "i" } },
        ];
      }
      if (minPrice !== undefined && minPrice !== null || maxPrice !== undefined && maxPrice !== null) {
        fallbackQuery.price = {};
        if (minPrice !== undefined && minPrice !== null) fallbackQuery.price.$gte = Number(minPrice);
        if (maxPrice !== undefined && maxPrice !== null) fallbackQuery.price.$lte = Number(maxPrice);
      }
      return await Product.find(fallbackQuery)
        .limit(limit)
        .populate({ path: "vendor", select: "name" })
        .lean();
    } catch (fallbackErr) {
      console.error("searchProducts fallback error:", fallbackErr);
      return [];
    }
  }
}

export async function searchShops(queryText, limit = 6) {
  try {
    const query = { status: "approved", isActive: true };

    if (queryText && queryText.trim()) {
      query.$or = [
        { name: { $regex: queryText, $options: "i" } },
        { description: { $regex: queryText, $options: "i" } },
      ];
    }

    return await Shop.find(query)
      .sort({ "stats.averageRating": -1, "stats.totalOrders": -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    console.error("searchShops error:", err);
    return [];
  }
}

export default {
  getProductsFromDB,
  getShopsFromDB,
  getSiteStats,
  searchProducts,
  getBestDeals,
  getTopShops,
  searchShops
};
