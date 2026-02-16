import Shop from "../models/shop.model.js";
import { User } from "../models/user.model.js";
import path from "path";
import fs from "fs";

const deleteLocalImage = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return;
    const rel = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
    const fullPath = path.join(process.cwd(), "src", rel);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.error("Failed to delete local image", imageUrl, err.message || err);
  }
};

// ==================== ADMIN VENDOR MANAGEMENT ====================

// Get all shops (for admin)
export const getAllShops = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const query = {};

    // Filter by status
    if (status && status !== "all") {
      query.status = status;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [shops, total] = await Promise.all([
      Shop.find(query)
        .populate("owner", "name email imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Shop.countDocuments(query),
    ]);

    // Get counts by status
    const statusCounts = await Shop.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = {
      all: total,
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
    };

    statusCounts.forEach((s) => {
      counts[s._id] = s.count;
    });

    res.json({
      success: true,
      shops,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      counts,
    });
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({ error: "Failed to fetch shops" });
  }
};

// Get single shop details (for admin)
export const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate("owner", "name email imageUrl phone createdAt")
      .populate("statusUpdatedBy", "name email");

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    res.json({ success: true, shop });
  } catch (error) {
    console.error("Error fetching shop:", error);
    res.status(500).json({ error: "Failed to fetch shop" });
  }
};

// Admin: Create a new shop (creates or assigns owner)
export const adminCreateShop = async (req, res) => {
  try {
    const {
      name,
      description,
      email,
      phone,
      address,
      ownerId,
      ownerEmail,
      ownerName,
      businessType,
      categories,
      commissionRate,
      adminNotes,
      website,
    } = req.body;

    if (!name || !description || !email || !phone || !address) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // address may be sent as a JSON string from some clients — normalize to object
    let parsedAddress = address;
    if (typeof address === "string") {
      try {
        parsedAddress = JSON.parse(address);
      } catch (err) {
        return res.status(400).json({ error: "Invalid address format: must be an object or JSON string" });
      }
    }

    let owner = null;

    if (ownerId) {
      owner = await User.findById(ownerId);
      if (!owner) return res.status(404).json({ error: "Owner user not found" });
      if (owner.role !== "vendor") {
        return res.status(400).json({ error: "Selected owner must have role 'vendor'" });
      }
    } else {
      // No owner selected -> assign to admin (requesting user)
      owner = await User.findById(req.user._id);
      if (!owner) return res.status(404).json({ error: "Admin user not found" });
    }

    // normalize categories which may be sent as JSON string, single-element array, or CSV
    let parsedCategories = [];
    if (categories) {
      if (Array.isArray(categories)) {
        // sometimes FormData produces an array with one JSON-string element
        if (categories.length === 1 && typeof categories[0] === "string") {
          try {
            const parsed = JSON.parse(categories[0]);
            if (Array.isArray(parsed)) parsedCategories = parsed;
            else parsedCategories = [String(parsed)];
          } catch (err) {
            // fallback: treat as CSV or single id
            const s = categories[0];
            parsedCategories = s.includes(",") ? s.split(",").map((c) => c.trim()) : [s.trim()];
          }
        } else {
          parsedCategories = categories.map((c) => String(c));
        }
      } else if (typeof categories === "string") {
        try {
          const parsed = JSON.parse(categories);
          if (Array.isArray(parsed)) parsedCategories = parsed;
          else parsedCategories = [String(parsed)];
        } catch (err) {
          // comma separated string
          parsedCategories = categories.includes(",") ? categories.split(",").map((c) => c.trim()) : [categories.trim()];
        }
      }
    }

    const shop = new Shop({
      name,
      description,
      email,
      phone,
      address: parsedAddress,
      owner: owner._id,
      businessType: businessType || "individual",
      categories: parsedCategories || [],
      website: website || "",
      commissionRate: commissionRate !== undefined ? commissionRate : 10,
      adminNotes: adminNotes || "",
      status: "approved",
      isActive: true,
      statusUpdatedAt: new Date(),
      statusUpdatedBy: req.user._id,
    });

    await shop.save();

    // handle uploaded logo/banner
    if (req.files) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      let changed = false;
      if (req.files.logo && req.files.logo[0]) {
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.logo[0].path).split(path.sep).join("/");
        shop.logo = `${baseUrl}/${rel}`;
        changed = true;
      }
      if (req.files.banner && req.files.banner[0]) {
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.banner[0].path).split(path.sep).join("/");
        shop.banner = `${baseUrl}/${rel}`;
        changed = true;
      }
      if (changed) await shop.save();
    }

    // handle uploaded logo/banner files
    if (req.files) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      let changed = false;
      if (req.files.logo && req.files.logo[0]) {
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.logo[0].path).split(path.sep).join("/");
        shop.logo = `${baseUrl}/${rel}`;
        changed = true;
      }
      if (req.files.banner && req.files.banner[0]) {
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.banner[0].path).split(path.sep).join("/");
        shop.banner = `${baseUrl}/${rel}`;
        changed = true;
      }
      if (changed) await shop.save();
    }

    res.status(201).json({ success: true, message: "Shop created", shop, ownerId: owner._id });
  } catch (error) {
    console.error("Error creating shop:", error);
    if (error.name === "ValidationError") {
      // collect validation messages
      const messages = Object.values(error.errors || {}).map((e) => e.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    res.status(500).json({ error: "Failed to create shop" });
  }
};

// Approve shop
export const approveShop = async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionRate, adminNotes } = req.body;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    shop.status = "approved";
    shop.isActive = true;
    shop.statusReason = "Shop approved by admin";
    shop.statusUpdatedAt = new Date();
    shop.statusUpdatedBy = req.user._id;

    if (commissionRate !== undefined) {
      shop.commissionRate = commissionRate;
    }

    if (adminNotes) {
      shop.adminNotes = adminNotes;
    }

    // Update owner role to vendor
    await User.findByIdAndUpdate(shop.owner, { role: "vendor" });

    await shop.save();

    res.json({ success: true, message: "Shop approved successfully", shop });
  } catch (error) {
    console.error("Error approving shop:", error);
    res.status(500).json({ error: "Failed to approve shop" });
  }
};

// Reject shop — delete the shop so the user can re-apply
export const rejectShop = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    const ownerId = shop.owner;
    const rejectionInfo = {
      shopName: shop.name,
      reason,
      rejectedAt: new Date(),
    };

    // Delete the shop logo if it exists
    if (shop.logo) {
      await deleteLocalImage(shop.logo);
    }

    // Delete the shop so the user can submit a new application
    await Shop.findByIdAndDelete(id);

    // Reset the user's role back to "customer" so they can re-apply
    await User.findByIdAndUpdate(ownerId, {
      role: "customer",
      accountType: "customer",
    });

    res.json({
      success: true,
      message: "Shop rejected and deleted. User can re-apply.",
      rejection: rejectionInfo,
    });
  } catch (error) {
    console.error("Error rejecting shop:", error);
    res.status(500).json({ error: "Failed to reject shop" });
  }
};

// Suspend shop
export const suspendShop = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "Suspension reason is required" });
    }

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    shop.status = "suspended";
    shop.isActive = false;
    shop.statusReason = reason;
    shop.statusUpdatedAt = new Date();
    shop.statusUpdatedBy = req.user._id;

    await shop.save();

    res.json({ success: true, message: "Shop suspended", shop });
  } catch (error) {
    console.error("Error suspending shop:", error);
    res.status(500).json({ error: "Failed to suspend shop" });
  }
};

// Reactivate shop (from suspended)
export const reactivateShop = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    if (shop.status !== "suspended") {
      return res.status(400).json({ error: "Shop is not suspended" });
    }

    shop.status = "approved";
    shop.isActive = true;
    shop.statusReason = "Shop reactivated by admin";
    shop.statusUpdatedAt = new Date();
    shop.statusUpdatedBy = req.user._id;

    await shop.save();

    res.json({ success: true, message: "Shop reactivated", shop });
  } catch (error) {
    console.error("Error reactivating shop:", error);
    res.status(500).json({ error: "Failed to reactivate shop" });
  }
};

// Update shop details (admin)
export const updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fields admin can update
    const allowedUpdates = [
      "commissionRate",
      "adminNotes",
      "categories",
      "isActive",
    ];

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // Normalized categories if present
    if (updates.categories) {
      let parsedCategories = [];
      const categories = updates.categories;

      if (Array.isArray(categories)) {
        // sometimes FormData produces an array with one JSON-string element
        if (categories.length === 1 && typeof categories[0] === "string") {
          try {
            const parsed = JSON.parse(categories[0]);
            if (Array.isArray(parsed)) parsedCategories = parsed;
            else parsedCategories = [String(parsed)];
          } catch (err) {
            // fallback: treat as CSV or single id
            const s = categories[0];
            parsedCategories = s.includes(",") ? s.split(",").map((c) => c.trim()) : [s.trim()];
          }
        } else {
          parsedCategories = categories.map((c) => String(c));
        }
      } else if (typeof categories === "string") {
        try {
          const parsed = JSON.parse(categories);
          if (Array.isArray(parsed)) parsedCategories = parsed;
          else parsedCategories = [String(parsed)];
        } catch (err) {
          // comma separated string
          parsedCategories = categories.includes(",") ? categories.split(",").map((c) => c.trim()) : [categories.trim()];
        }
      } else {
        parsedCategories = [String(categories)];
      }

      updates.categories = parsedCategories;
    }

    // Apply allowed updates
    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        shop[field] = updates[field];
      }
    });

    // handle uploaded logo/banner
    if (req.files) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      if (req.files.logo && req.files.logo[0]) {
        // delete old logo file if local or hosted on same server
        if (shop.logo) {
          if (shop.logo.startsWith("/")) await deleteLocalImage(shop.logo);
          else if (shop.logo.startsWith(baseUrl)) {
            const relPath = shop.logo.replace(baseUrl, "");
            await deleteLocalImage(relPath);
          }
        }
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.logo[0].path).split(path.sep).join("/");
        shop.logo = `${baseUrl}/${rel}`;
      }
      if (req.files.banner && req.files.banner[0]) {
        if (shop.banner) {
          if (shop.banner.startsWith("/")) await deleteLocalImage(shop.banner);
          else if (shop.banner.startsWith(baseUrl)) {
            const relPath = shop.banner.replace(baseUrl, "");
            await deleteLocalImage(relPath);
          }
        }
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.banner[0].path).split(path.sep).join("/");
        shop.banner = `${baseUrl}/${rel}`;
      }
    }
    await shop.save();

    res.json({ success: true, message: "Shop updated", shop });
  } catch (error) {
    console.error("Error updating shop:", error);
    res.status(500).json({ error: "Failed to update shop" });
  }
};

// Delete shop (admin)
export const deleteShop = async (req, res) => {
  try {
    const { id } = req.params;

    const shop = await Shop.findById(id);

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // Reset owner role back to user
    await User.findByIdAndUpdate(shop.owner, { role: "user" });

    // Delete products belonging to this shop
    // Import Product and Category lazily to avoid circular requires
    const ProductModule = await import("../models/product.model.js");
    const Product = ProductModule.Product || ProductModule.default;
    const Category = (await import("../models/category.model.js")).default;
    // delete local image files for each product
    const products = await Product.find({ vendor: shop._id });
    for (const product of products) {
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          const imageUrl = image.url || image;
          await deleteLocalImage(imageUrl);
        }
      }

      // update category stats
      if (product.category) {
        await Category.findByIdAndUpdate(product.category, { $inc: { 'stats.totalProducts': -1 } });
      }
    }

    await Product.deleteMany({ vendor: shop._id });

    await Shop.findByIdAndDelete(id);

    res.json({ success: true, message: "Shop and its products deleted successfully" });
  } catch (error) {
    console.error("Error deleting shop:", error);
    res.status(500).json({ error: "Failed to delete shop" });
  }
};

// Helper: delete a shop by id (cascade products, reviews, follows, etc). Exported for reuse by other controllers.
export const deleteShopCascade = async (shopId) => {
  const shop = await Shop.findById(shopId);
  if (!shop) return;

  // Reset owner role
  await User.findByIdAndUpdate(shop.owner, { role: "user", accountType: "customer" });

  const ProductModule = await import("../models/product.model.js");
  const Product = ProductModule.Product || ProductModule.default;
  const Category = (await import("../models/category.model.js")).default;
  const { Review } = await import("../models/review.model.js");
  const { ShopFollow } = await import("../models/shopFollow.model.js");
  const { Notification } = await import("../models/notification.model.js");
  const { Cart } = await import("../models/cart.model.js");

  const products = await Product.find({ vendor: shop._id });
  const productIds = products.map((p) => p._id);

  // Delete product images from disk
  for (const product of products) {
    if (product.images && product.images.length > 0) {
      for (const image of product.images) {
        const imageUrl = image.url || image;
        await deleteLocalImage(imageUrl);
      }
    }

    // Decrement category product counts
    if (product.category) {
      await Category.findByIdAndUpdate(product.category, { $inc: { 'stats.totalProducts': -1 } });
    }
  }

  // Delete shop logo/banner images from disk
  if (shop.logo) await deleteLocalImage(shop.logo);
  if (shop.banner) await deleteLocalImage(shop.banner);

  // Cascade delete all related data
  if (productIds.length > 0) {
    // Remove deleted products from all users' wishlists
    await User.updateMany(
      { wishlist: { $in: productIds } },
      { $pullAll: { wishlist: productIds } }
    );

    // Remove deleted products from all carts
    await Cart.updateMany(
      { "items.product": { $in: productIds } },
      { $pull: { items: { product: { $in: productIds } } } }
    );

    // Delete all reviews for this shop's products
    await Review.deleteMany({ $or: [{ shopId: shop._id }, { productId: { $in: productIds } }] });

    // Delete notifications referencing this shop or its products
    await Notification.deleteMany({ $or: [{ shop: shop._id }, { product: { $in: productIds } }] });
  } else {
    await Review.deleteMany({ shopId: shop._id });
    await Notification.deleteMany({ shop: shop._id });
  }

  // Delete all shop follows
  await ShopFollow.deleteMany({ shop: shop._id });

  // Delete all products
  await Product.deleteMany({ vendor: shop._id });

  // Finally delete the shop itself
  await Shop.findByIdAndDelete(shop._id);
};

// ==================== VENDOR REGISTRATION (PUBLIC) ====================

// Register a new shop (for business owners)
export const registerShop = async (req, res) => {
  try {
    const {
      name,
      description,
      email,
      phone,
      businessType,
      businessRegistrationNumber,
      taxId,
      website,
    } = req.body;

    // Parse JSON string fields that come from FormData (multipart)
    let address = req.body.address;
    if (typeof address === "string") {
      try { address = JSON.parse(address); } catch { }
    }

    let categories = req.body.categories;
    if (typeof categories === "string") {
      try { categories = JSON.parse(categories); } catch { categories = []; }
    }
    // Flatten in case of double-stringified array
    if (Array.isArray(categories) && categories.length === 1 && typeof categories[0] === "string") {
      try { const inner = JSON.parse(categories[0]); if (Array.isArray(inner)) categories = inner; } catch { }
    }

    let socialMedia = req.body.socialMedia;
    if (typeof socialMedia === "string") {
      try { socialMedia = JSON.parse(socialMedia); } catch { socialMedia = {}; }
    }

    let bankDetails = req.body.bankDetails;
    if (typeof bankDetails === "string") {
      try { bankDetails = JSON.parse(bankDetails); } catch { bankDetails = undefined; }
    }

    // Handle uploaded logo/banner
    let logo, banner;
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.logo[0].path).split(path.sep).join("/");
        logo = `/${rel}`;
      }
      if (req.files.banner && req.files.banner[0]) {
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.banner[0].path).split(path.sep).join("/");
        banner = `/${rel}`;
      }
    }

    // Validation
    if (!name || !description || !email || !phone || !address) {
      return res.status(400).json({
        error: "Please provide all required fields: name, description, email, phone, address",
      });
    }

    // Check if user already has a shop (only block if it's not rejected)
    const existingShop = await Shop.findOne({ owner: req.user._id });

    if (existingShop) {
      // If the previous shop was rejected, delete it so the user can re-apply
      if (existingShop.status === "rejected") {
        if (existingShop.logo) await deleteLocalImage(existingShop.logo);
        await Shop.findByIdAndDelete(existingShop._id);
      } else {
        return res.status(400).json({
          error: "You already have a shop registered",
          shop: existingShop,
        });
      }
    }

    // Create shop
    const shopData = {
      name,
      description,
      email,
      phone,
      address,
      owner: req.user._id,
      businessType: businessType || "individual",
      businessRegistrationNumber,
      taxId,
      categories: categories || [],
      website,
      socialMedia,
      bankDetails,
      status: "pending",
      businessHours: [
        { day: "monday", open: "09:00", close: "18:00", isClosed: false },
        { day: "tuesday", open: "09:00", close: "18:00", isClosed: false },
        { day: "wednesday", open: "09:00", close: "18:00", isClosed: false },
        { day: "thursday", open: "09:00", close: "18:00", isClosed: false },
        { day: "friday", open: "09:00", close: "18:00", isClosed: false },
        { day: "saturday", open: "10:00", close: "16:00", isClosed: false },
        { day: "sunday", open: "00:00", close: "00:00", isClosed: true },
      ],
    };
    if (logo) shopData.logo = logo;
    if (banner) shopData.banner = banner;

    const shop = new Shop(shopData);

    await shop.save();

    res.status(201).json({
      success: true,
      message: "Shop registration submitted successfully. Pending admin approval.",
      shop,
    });
  } catch (error) {
    console.error("Error registering shop:", error);
    res.status(500).json({ error: "Failed to register shop" });
  }
};

// Get vendor's own shop
export const getMyShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop yet" });
    }

    res.json({ success: true, shop });
  } catch (error) {
    console.error("Error fetching shop:", error);
    res.status(500).json({ error: "Failed to fetch shop" });
  }
};

// Update vendor's own shop
export const updateMyShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop yet" });
    }

    // Only allow updating if shop is approved
    if (shop.status !== "approved") {
      return res.status(400).json({
        error: "You can only update your shop after it's approved",
      });
    }

    const allowedUpdates = [
      "name",
      "description",
      "email",
      "logo",
      "banner",
      "phone",
      "website",
      "address",
      "businessHours",
      "socialMedia",
      "bankDetails",
    ];

    const updates = req.body;

    // Fields that arrive as JSON strings via FormData need parsing
    const jsonFields = ["address", "businessHours", "socialMedia", "bankDetails"];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        let value = updates[field];
        if (jsonFields.includes(field) && typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch (_) {
            // leave as-is if not valid JSON
          }
        }
        shop[field] = value;
      }
    });

    // Sanitize corrupted array fields before save
    if (shop.categories && Array.isArray(shop.categories)) {
      const validIds = shop.categories.filter(
        (c) => typeof c === "string" && /^[a-f\d]{24}$/i.test(c) || (c && c._id)
      );
      if (validIds.length !== shop.categories.length) {
        shop.categories = validIds;
      }
    }

    // handle uploaded logo/banner for vendor
    if (req.files) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      if (req.files.logo && req.files.logo[0]) {
        if (shop.logo) {
          if (shop.logo.startsWith("/")) await deleteLocalImage(shop.logo);
          else if (shop.logo.startsWith(baseUrl)) {
            const relPath = shop.logo.replace(baseUrl, "");
            await deleteLocalImage(relPath);
          }
        }
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.logo[0].path).split(path.sep).join("/");
        shop.logo = `${baseUrl}/${rel}`;
      }
      if (req.files.banner && req.files.banner[0]) {
        if (shop.banner) {
          if (shop.banner.startsWith("/")) await deleteLocalImage(shop.banner);
          else if (shop.banner.startsWith(baseUrl)) {
            const relPath = shop.banner.replace(baseUrl, "");
            await deleteLocalImage(relPath);
          }
        }
        const rel = path.relative(path.join(process.cwd(), "src"), req.files.banner[0].path).split(path.sep).join("/");
        shop.banner = `${baseUrl}/${rel}`;
      }
    }

    await shop.save();

    res.json({ success: true, message: "Shop updated", shop });
  } catch (error) {
    console.error("Error updating shop:", error);
    res.status(500).json({ error: "Failed to update shop" });
  }
};

// Get vendor statistics
export const getVendorStats = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop yet" });
    }

    // Import models
    const ProductModule = await import("../models/product.model.js");
    const Product = ProductModule.Product || ProductModule.default;
    const OrderModule = await import("../models/order.model.js");
    const Order = OrderModule.Order || OrderModule.default;
    const ReviewModule = await import("../models/review.model.js");
    const Review = ReviewModule.Review || ReviewModule.default;

    // Compute real stats from actual data
    const products = await Product.find({ vendor: shop._id });
    const productIds = products.map((p) => p._id);
    const totalProducts = products.length;

    // Count real orders from the Order collection
    const orders = await Order.find({
      "orderItems.product": { $in: productIds },
    });

    // Compute real revenue and order count
    let totalRevenue = 0;
    const orderIds = new Set();
    for (const order of orders) {
      const vendorItems = order.orderItems.filter((item) =>
        productIds.some((pid) => pid.toString() === item.product?.toString())
      );
      if (vendorItems.length > 0) {
        orderIds.add(order._id.toString());
        totalRevenue += vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      }
    }
    const totalOrders = orderIds.size;

    // Get real reviews
    const [productReviews, shopReviews] = await Promise.all([
      Review.find({ productId: { $in: productIds } }),
      Review.find({ shopId: shop._id }),
    ]);
    const allReviews = [...productReviews, ...shopReviews];
    const totalReviews = allReviews.length;
    const averageRating =
      totalReviews > 0
        ? Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
        : 0;

    // Update cached stats on shop document
    shop.stats = { totalProducts, totalOrders, totalRevenue, averageRating, totalReviews };
    await shop.save();

    res.json({
      success: true,
      stats: shop.stats,
      shopStatus: shop.status,
      isActive: shop.isActive,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
};

// Delete vendor's own shop (requires password verification)
export const deleteMyShop = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required to delete your shop" });
    }

    // Find vendor's shop
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop" });
    }

    // Verify password
    const bcrypt = (await import("bcryptjs")).default;
    const user = await User.findById(req.user._id).select("+password");
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Get product count before deletion
    const ProductModule = await import("../models/product.model.js");
    const Product = ProductModule.Product || ProductModule.default;
    const productCount = await Product.countDocuments({ vendor: shop._id });

    // Use the helper to delete shop and cascade all products
    await deleteShopCascade(shop._id);

    res.json({
      success: true,
      message: `Shop and ${productCount} product(s) deleted successfully`,
      deletedProducts: productCount,
    });
  } catch (error) {
    console.error("Error deleting shop:", error);
    res.status(500).json({ error: "Failed to delete shop" });
  }
};

// Get customers who bought from vendor's shop
export const getMyShopCustomers = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });
    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop yet" });
    }

    const ProductModule = await import("../models/product.model.js");
    const Product = ProductModule.Product || ProductModule.default;
    const OrderModule = await import("../models/order.model.js");
    const Order = OrderModule.Order || OrderModule.default;

    // Get all product IDs from this shop
    const products = await Product.find({ vendor: shop._id }).select("_id");
    const productIds = products.map((p) => p._id);

    // Find orders that contain these products
    const orders = await Order.find({
      "orderItems.product": { $in: productIds },
    })
      .populate("user", "name email imageUrl createdAt")
      .sort({ createdAt: -1 });

    // Aggregate customer data
    const customerMap = {};
    for (const order of orders) {
      if (!order.user) continue;
      const uid = order.user._id.toString();
      if (!customerMap[uid]) {
        customerMap[uid] = {
          _id: order.user._id,
          name: order.user.name,
          email: order.user.email,
          imageUrl: order.user.imageUrl,
          joinedAt: order.user.createdAt,
          totalOrders: 0,
          totalSpent: 0,
          lastOrderAt: null,
        };
      }
      // Only count vendor's items in this order
      const vendorItems = order.orderItems.filter((item) =>
        productIds.some((pid) => pid.toString() === item.product?.toString())
      );
      const orderTotal = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      customerMap[uid].totalOrders += 1;
      customerMap[uid].totalSpent += orderTotal;
      if (!customerMap[uid].lastOrderAt || new Date(order.createdAt) > new Date(customerMap[uid].lastOrderAt)) {
        customerMap[uid].lastOrderAt = order.createdAt;
      }
    }

    const customers = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);

    res.json({
      success: true,
      customers,
      total: customers.length,
    });
  } catch (error) {
    console.error("Error fetching vendor customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// Get vendor shop analytics
export const getMyShopAnalytics = async (req, res) => {
  try {
    const shop = await Shop.findOne({ owner: req.user._id });

    if (!shop) {
      return res.status(404).json({ error: "You don't have a shop yet" });
    }

    // Import models
    const ProductModule = await import("../models/product.model.js");
    const Product = ProductModule.Product || ProductModule.default;
    const OrderModule = await import("../models/order.model.js");
    const Order = OrderModule.Order || OrderModule.default;

    // Get all products for this shop
    const products = await Product.find({ vendor: shop._id });
    const productIds = products.map((p) => p._id);

    // ─── Revenue by Month (last 6 months) from actual Orders ──────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      "orderItems.product": { $in: productIds },
      createdAt: { $gte: sixMonthsAgo },
    }).lean();

    // Build a map: monthKey -> revenue
    const revenueMap = {};
    const customerSet = new Set();
    let totalRevenue = 0;
    let totalOrderCount = 0;
    const orderIdSet = new Set();

    for (const order of orders) {
      const vendorItems = order.orderItems.filter((item) =>
        productIds.some((pid) => pid.toString() === item.product?.toString())
      );
      if (vendorItems.length === 0) continue;

      orderIdSet.add(order._id.toString());
      if (order.user) customerSet.add(order.user.toString());

      const orderDate = new Date(order.createdAt);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      const itemRevenue = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      revenueMap[monthKey] = (revenueMap[monthKey] || 0) + itemRevenue;
      totalRevenue += itemRevenue;
    }
    totalOrderCount = orderIdSet.size;

    // Build the 6-month array with actual data
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.push({
        month: monthKey,
        revenue: revenueMap[monthKey] || 0,
      });
    }

    // ─── Also count all-time orders for totalCustomers ────────────────
    const allOrders = await Order.find({
      "orderItems.product": { $in: productIds },
    }).lean();

    const allCustomerSet = new Set();
    let allTimeRevenue = 0;
    let allTimeOrderCount = 0;
    const allOrderIdSet = new Set();

    for (const order of allOrders) {
      const vendorItems = order.orderItems.filter((item) =>
        productIds.some((pid) => pid.toString() === item.product?.toString())
      );
      if (vendorItems.length === 0) continue;
      allOrderIdSet.add(order._id.toString());
      if (order.user) allCustomerSet.add(order.user.toString());
      allTimeRevenue += vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
    allTimeOrderCount = allOrderIdSet.size;

    // ─── Top Categories ──────────────────────────────────────────────
    const categoryRevenue = {};
    for (const product of products) {
      if (product.category) {
        const catId = product.category.toString();
        if (!categoryRevenue[catId]) {
          categoryRevenue[catId] = {
            categoryId: catId,
            sold: 0,
            revenue: 0,
          };
        }
        categoryRevenue[catId].sold += product.stats?.totalQuantitySold || 0;
        categoryRevenue[catId].revenue += product.stats?.totalRevenue || 0;
      }
    }

    // If product stats are 0 (legacy), compute from orders
    const hasProductStats = Object.values(categoryRevenue).some((c) => c.revenue > 0);
    if (!hasProductStats && allOrders.length > 0) {
      // Build product -> category map
      const productCategoryMap = {};
      for (const product of products) {
        if (product.category) {
          productCategoryMap[product._id.toString()] = product.category.toString();
        }
      }
      // Reset and recompute from orders
      for (const key of Object.keys(categoryRevenue)) {
        categoryRevenue[key].sold = 0;
        categoryRevenue[key].revenue = 0;
      }
      for (const order of allOrders) {
        for (const item of order.orderItems) {
          const pid = item.product?.toString();
          const catId = productCategoryMap[pid];
          if (catId) {
            if (!categoryRevenue[catId]) {
              categoryRevenue[catId] = { categoryId: catId, sold: 0, revenue: 0 };
            }
            categoryRevenue[catId].sold += item.quantity;
            categoryRevenue[catId].revenue += item.price * item.quantity;
          }
        }
      }
    }

    const topCategories = Object.values(categoryRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Populate category names
    const Category = (await import("../models/category.model.js")).default;
    for (const cat of topCategories) {
      const categoryDoc = await Category.findById(cat.categoryId);
      cat.name = categoryDoc?.name || "Unknown";
    }

    // ─── Views ────────────────────────────────────────────────────────
    const totalViews = products.reduce((sum, p) => sum + (p.stats?.views || 0), 0);
    const totalAddedToCart = products.reduce((sum, p) => sum + (p.stats?.addedToCart || 0), 0);
    const totalAddedToWishlist = products.reduce((sum, p) => sum + (p.stats?.addedToWishlist || 0), 0);

    res.json({
      success: true,
      analytics: {
        views: totalViews,
        addedToCart: totalAddedToCart,
        addedToWishlist: totalAddedToWishlist,
        totalCustomers: allCustomerSet.size,
        uniqueCustomers: allCustomerSet.size,
        totalOrders: allTimeOrderCount,
        totalRevenue: allTimeRevenue,
        revenueByMonth,
        topCategories,
      },
    });
  } catch (error) {
    console.error("Error fetching shop analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
};

