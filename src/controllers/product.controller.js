import { Product } from "../models/product.model.js";
import Shop from "../models/shop.model.js";
import { ShopFollow } from "../models/shopFollow.model.js";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { createBulkNotifications } from "./notification.controller.js";
import { saveBase64Image } from "../lib/imageHelpers.js";
import path from "path";
// Helper to parse potential JSON strings from FormData
const parseBody = (body) => {
  const parsed = { ...body };
  ["tags", "colors", "sizes", "customAttributes", "discount", "existingImages", "relatedProducts"].forEach(key => {
    if (parsed[key] && typeof parsed[key] === "string") {
      try {
        parsed[key] = JSON.parse(parsed[key]);
      } catch (e) {
        // keep as is or ignore
      }
    }
  });
  // Handle boolean strings
  ["isFeatured", "isPublished", "trackInventory", "allowBackorders"].forEach(key => {
    if (parsed[key] === "true") parsed[key] = true;
    if (parsed[key] === "false") parsed[key] = false;
  });
  return parsed;
};

export async function createProduct(req, res) {
  try {
    const body = parseBody(req.body);

    let images = [];
    if (req.files && req.files.length > 0) {
      const primaryIndex = parseInt(body.newImagePrimaryIndex) || 0; // Default to 0 if not provided

      images = req.files.map((file, idx) => {
        const rel = path.relative(path.join(process.cwd(), "src"), file.path).split(path.sep).join("/");
        return {
          url: `/${rel}`,
          alt: body.name || "",
          isPrimary: idx === primaryIndex,
        };
      });
    }

    // Support base64 images sent in JSON (e.g. from mobile clients)
    if ((!images || images.length === 0) && body.base64Images) {
      let arr = body.base64Images;
      if (typeof arr === "string") {
        try { arr = JSON.parse(arr); } catch { arr = [arr]; }
      }
      if (Array.isArray(arr)) {
        for (const b64 of arr) {
          if (typeof b64 === "string" && b64.startsWith("data:image/")) {
            try {
              const saved = await saveBase64Image(b64, { base: 'products' });
              images.push({ url: saved, alt: body.name || "", isPrimary: false });
            } catch (err) {
              console.warn("Failed to save base64 product image:", err.message || err);
            }
          }
        }
      }
    }

    const {
      name, description, price, compareAtPrice, costPrice, stock,
      lowStockThreshold, category, subcategory, vendor, brand,
      tags, discount, isFeatured, isPublished, trackInventory,
      allowBackorders, colors, sizes, weight, customAttributes, createdBy,
      relatedProducts
    } = body;

    const product = await Product.create({
      name, description, price, compareAtPrice, costPrice, stock,
      lowStockThreshold, category, subcategory, vendor, brand,
      tags, discount, isFeatured, isPublished, trackInventory,
      allowBackorders, colors, sizes, weight, customAttributes,
      relatedProducts,
      createdBy: createdBy || req.userId,
      images
    });

    if (vendor) {
      await Shop.findByIdAndUpdate(vendor, { $inc: { "stats.totalProducts": 1 } });

      // Notify all followers of this shop about the new product
      const shop = await Shop.findById(vendor);
      if (shop) {
        const followers = await ShopFollow.find({ shop: vendor }).select("user");
        const followerIds = followers.map((f) => f.user);
        if (followerIds.length > 0) {
          await createBulkNotifications(followerIds, {
            type: "new_product",
            title: "New Product",
            message: `${shop.name} just added a new product: "${product.name}"`,
            product: product._id,
            shop: shop._id,
          });
        }
      }
    }
    res.status(201).json({ product });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const body = parseBody(req.body);

    // Fetch old product to compare discount changes
    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    const hadDiscount = oldProduct.discount?.type && oldProduct.discount.type !== "none";

    // Determine if the request explicitly includes image data
    const hasUploadedFiles = req.files && req.files.length > 0;
    const hasExistingImages = body.existingImages && Array.isArray(body.existingImages);
    const hasImageData = hasUploadedFiles || hasExistingImages || body.existingImages === '[]';

    if (hasImageData) {
      let newImages = [];
      if (hasUploadedFiles) {
        const newPrimaryIndex = parseInt(body.newImagePrimaryIndex);

        newImages = req.files.map((file, idx) => {
          const rel = path.relative(path.join(process.cwd(), "src"), file.path).split(path.sep).join("/");
          return {
            url: `/${rel}`,
            alt: body.name || "",
            isPrimary: idx === newPrimaryIndex,
          };
        });
      }

      // If client provided base64 images (mobile clients may send these), save them
      if (!hasUploadedFiles && body.base64Images) {
        let arr = body.base64Images;
        if (typeof arr === "string") {
          try { arr = JSON.parse(arr); } catch { arr = [arr]; }
        }
        if (Array.isArray(arr)) {
          for (const b64 of arr) {
            if (typeof b64 === "string" && b64.startsWith("data:image/")) {
              try {
                const saved = await saveBase64Image(b64, { base: 'products' });
                newImages.push({ url: saved, alt: body.name || "", isPrimary: false });
              } catch (err) {
                console.warn("Failed to save base64 product image:", err.message || err);
              }
            }
          }
        }
      }

      // Combine existing and new images
      let finalImages = [];
      if (hasExistingImages) {
        finalImages = [...body.existingImages];
      }
      finalImages = [...finalImages, ...newImages];

      // Ensure one primary
      if (finalImages.length > 0) {
        const hasPrimary = finalImages.some(img => img.isPrimary);
        if (!hasPrimary) {
          finalImages[0].isPrimary = true;
        } else {
          let foundPrimary = false;
          finalImages = finalImages.map(img => {
            if (img.isPrimary) {
              if (foundPrimary) return { ...img, isPrimary: false };
              foundPrimary = true;
            }
            return img;
          });
        }
      }

      body.images = finalImages;
    }

    // Clean up body
    delete body.existingImages;
    delete body.createdBy;
    delete body.createdAt;
    delete body.newImagePrimaryIndex;

    // Handle vendor change
    if (body.vendor !== undefined) {
      const oldVendorId = oldProduct.vendor?.toString();
      const newVendorId = body.vendor ? body.vendor.toString() : null;

      if (oldVendorId !== newVendorId) {
        // Decrement old vendor stats
        if (oldVendorId) {
          await Shop.findByIdAndUpdate(oldVendorId, { $inc: { "stats.totalProducts": -1 } });
        }
        // Increment new vendor stats
        if (newVendorId) {
          await Shop.findByIdAndUpdate(newVendorId, { $inc: { "stats.totalProducts": 1 } });
        }

        // Ensure body.vendor is set correctly (null if empty string)
        if (!body.vendor) body.vendor = null;
      }
    }

    console.log("Updating product:", id, "Body vendor:", body.vendor);

    const product = await Product.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // If a discount was just added/changed, notify followers
    const hasNewDiscount = product.discount?.type && product.discount.type !== "none" && product.discount.value > 0;
    if (hasNewDiscount && !hadDiscount && product.vendor) {
      const shop = await Shop.findById(product.vendor);
      if (shop) {
        const followers = await ShopFollow.find({ shop: product.vendor }).select("user");
        const followerIds = followers.map((f) => f.user);
        if (followerIds.length > 0) {
          const discountText = product.discount.type === "percentage"
            ? `${product.discount.value}% off`
            : `$${product.discount.value} off`;
          await createBulkNotifications(followerIds, {
            type: "product_discount",
            title: "New Discount!",
            message: `${shop.name} has a deal: "${product.name}" is now ${discountText}!`,
            product: product._id,
            shop: shop._id,
          });
        }
      }
    }

    res.status(200).json({ product });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: error.message });
  }
}

// Add product deletion controller (example: deleteProduct)
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    // Decrement totalProducts for the shop
    if (product.vendor) {
      await Shop.findByIdAndUpdate(product.vendor, { $inc: { "stats.totalProducts": -1 } });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await Product.findById(id)
      .populate("vendor", "name logo slug description stats address")
      .populate("category", "name slug icon image")
      .populate("relatedProducts", "name images price slug");

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Normalize any relative image URLs to absolute so frontend can load them during dev
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const obj = product.toObject ? product.toObject() : { ...product };
    if (Array.isArray(obj.images)) {
      obj.images = obj.images.map((img) => {
        if (!img || !img.url) return img;
        if (typeof img.url === "string" && img.url.startsWith("/")) {
          return { ...img, url: `${baseUrl}${img.url}` };
        }
        return img;
      });
    }
    if (obj.thumbnail && typeof obj.thumbnail === "string" && obj.thumbnail.startsWith("/")) {
      obj.thumbnail = `${baseUrl}${obj.thumbnail}`;
    }

    // Normalize vendor logo URL
    if (obj.vendor && obj.vendor.logo && typeof obj.vendor.logo === "string" && obj.vendor.logo.startsWith("/")) {
      obj.vendor.logo = `${baseUrl}${obj.vendor.logo}`;
    }

    // Normalize category image URL
    // Normalize category image URL
    if (obj.category && obj.category.image && typeof obj.category.image === "string" && obj.category.image.startsWith("/")) {
      obj.category.image = `${baseUrl}${obj.category.image}`;
    }

    // Normalize related products images
    if (obj.relatedProducts && Array.isArray(obj.relatedProducts)) {
      obj.relatedProducts = obj.relatedProducts.map(rp => {
        const rpObj = rp.toObject ? rp.toObject() : { ...rp };
        if (rpObj.images && Array.isArray(rpObj.images)) {
          rpObj.images = rpObj.images.map(img => {
            if (img && img.url && typeof img.url === "string" && img.url.startsWith("/")) {
              return { ...img, url: `${baseUrl}${img.url}` };
            }
            return img;
          });
        }
        return rpObj;
      });
    }

    res.status(200).json({ product: obj });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Track product view
export async function trackProductView(req, res) {
  try {
    const { id } = req.params;

    await Product.findByIdAndUpdate(id, {
      $inc: { "stats.views": 1 },
      $set: { "stats.lastViewedAt": new Date() }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error tracking view:", error);
    res.status(500).json({ error: "Failed to track view" });
  }
}

// Track add to cart
export async function trackAddToCart(req, res) {
  try {
    const { id } = req.params;

    await Product.findByIdAndUpdate(id, {
      $inc: { "stats.addedToCart": 1 }
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error tracking cart:", error);
    res.status(500).json({ error: "Failed to track cart addition" });
  }
}

// Get product analytics
export async function getProductAnalytics(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Verify ownership (vendor only sees their products)
    if (req.user.role === "vendor") {
      const Shop = (await import("../models/shop.model.js")).default;
      const shop = await Shop.findOne({ owner: req.user._id });
      if (!shop || product.vendor?.toString() !== shop._id.toString()) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    // Map topLocations to topRegions format for frontend
    const topRegions = (product.buyerInsights?.topLocations || []).map((loc) => ({
      region: [loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "Unknown",
      count: loc.count || 0,
    }));

    // Compute real buyer gender breakdown from orders
    const orders = await Order.find({ "items.product": id, status: { $ne: "cancelled" } }).select("user");
    const buyerIds = [...new Set(orders.map((o) => o.user.toString()))];
    let genderData = { male: 0, female: 0, other: 0 };
    if (buyerIds.length > 0) {
      const buyers = await User.find({ _id: { $in: buyerIds } }).select("sexe");
      for (const buyer of buyers) {
        if (buyer.sexe === "male") genderData.male++;
        else if (buyer.sexe === "female") genderData.female++;
        else genderData.other++;
      }
    }

    res.json({
      success: true,
      analytics: {
        views: product.stats.views,
        uniqueViews: product.stats.uniqueViews,
        addedToCart: product.stats.addedToCart,
        addedToWishlist: product.stats.addedToWishlist,
        orders: product.stats.totalOrders,
        totalOrders: product.stats.totalOrders,
        totalQuantitySold: product.stats.totalQuantitySold,
        totalRevenue: product.stats.totalRevenue,
        totalProfit: product.stats.totalProfit,
        conversionRate: product.stats.conversionRate,
        lastSoldAt: product.stats.lastSoldAt,
        lastViewedAt: product.stats.lastViewedAt,
        buyerInsights: {
          totalBuyers: product.buyerInsights?.totalBuyers || 0,
          repeatBuyers: product.buyerInsights?.repeatBuyers || 0,
          repeatBuyerRate: product.buyerInsights?.repeatBuyerRate || 0,
          averageOrderQuantity: product.buyerInsights?.averageOrderQuantity || 0,
          gender: genderData,
          topRegions,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}
