import mongoose from "mongoose";

// Schema for product variants (size, color combinations)
const variantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g., "Size", "Color"
    value: { type: String, required: true }, // e.g., "XL", "Red"
    sku: { type: String },
    priceAdjustment: { type: Number, default: 0 }, // +/- from base price
    stock: { type: Number, default: 0 },
    image: { type: String },
  },
  { _id: true }
);

// Schema for tracking purchases (analytics)
const purchaseRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    quantity: { type: Number, required: true },
    priceAtPurchase: { type: Number, required: true },
    purchasedAt: { type: Date, default: Date.now },
    location: {
      city: { type: String },
      state: { type: String },
      country: { type: String },
    },
  },
  { _id: false }
);

// Schema for product specifications
const specificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
    group: { type: String, default: "General" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    // ==================== BASIC INFO ====================
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      maxlength: 250,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    barcode: {
      type: String,
      default: "",
    },

    // ==================== PRICING & DISCOUNTS ====================
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    compareAtPrice: {
      type: Number, // Original price (for showing discounts)
      min: 0,
    },
    costPrice: {
      type: Number, // Cost to vendor/admin (for profit calculation)
      min: 0,
    },
    // Discount system
    discount: {
      type: {
        type: String,
        enum: ["none", "percentage", "fixed"],
        default: "none",
      },
      value: { type: Number, default: 0 }, // percentage or fixed amount
      startDate: { type: Date },
      endDate: { type: Date },
      minQuantity: { type: Number, default: 1 }, // Minimum qty to apply discount
      maxUses: { type: Number }, // Limit number of uses
      usedCount: { type: Number, default: 0 },
    },
    // Calculated sale price (updated on save)
    salePrice: {
      type: Number,
      min: 0,
    },
    isOnSale: {
      type: Boolean,
      default: false,
    },

    // ==================== INVENTORY ====================
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    allowBackorders: {
      type: Boolean,
      default: false,
    },
    stockStatus: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock", "backorder"],
      default: "in_stock",
    },

    // ==================== CATEGORIES ====================
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    tags: [{ type: String }],
    brand: {
      type: String,
      default: "",
    },

    // ==================== OWNERSHIP ====================
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isAdminProduct: {
      type: Boolean,
      default: false, // True if created by admin (platform's own product)
    },
    commissionRate: {
      type: Number, // Override shop's default commission for this product
      min: 0,
      max: 100,
    },

    // ==================== MEDIA ====================
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    video: {
      type: String,
      default: "",
    },
    thumbnail: {
      type: String,
      default: "",
    },

    // ==================== VARIANTS ====================
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: [variantSchema],
    variantOptions: [
      {
        name: { type: String }, // e.g., "Size"
        values: [{ type: String }], // e.g., ["S", "M", "L"]
      },
    ],
    // New simplified fields
    colors: [{ type: String }],
    sizes: [{ type: String }],
    customAttributes: [
      {
        title: { type: String, required: true },
        content: { type: String, required: true },
        _id: false
      }
    ],
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    // ==================== SPECIFICATIONS ====================
    specifications: [specificationSchema],

    // ==================== SHIPPING ====================
    weight: { type: Number, default: 0 }, // in grams
    dimensions: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    shippingClass: {
      type: String,
      enum: ["standard", "express", "free", "pickup", "digital"],
      default: "standard",
    },
    freeShipping: {
      type: Boolean,
      default: false,
    },
    isDigital: {
      type: Boolean,
      default: false,
    },

    // ==================== STATUS & VISIBILITY ====================
    status: {
      type: String,
      enum: ["draft", "pending", "active", "inactive", "out_of_stock", "discontinued"],
      default: "draft",
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    visibility: {
      type: String,
      enum: ["public", "private", "hidden"],
      default: "public",
    },

    // ==================== REVIEWS & RATINGS ====================
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    ratingDistribution: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },

    // ==================== STATISTICS & ANALYTICS ====================
    stats: {
      views: { type: Number, default: 0 },
      uniqueViews: { type: Number, default: 0 },
      addedToCart: { type: Number, default: 0 },
      addedToWishlist: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalQuantitySold: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      totalProfit: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 }, // (orders / views) * 100
      returnRate: { type: Number, default: 0 },
      lastSoldAt: { type: Date },
      lastViewedAt: { type: Date },
    },

    // Purchase history (for analytics - limited to last 500)
    purchaseHistory: {
      type: [purchaseRecordSchema],
      default: [],
    },

    // Buyer demographics
    buyerInsights: {
      totalBuyers: { type: Number, default: 0 },
      repeatBuyers: { type: Number, default: 0 },
      repeatBuyerRate: { type: Number, default: 0 },
      averageOrderQuantity: { type: Number, default: 0 },
      topLocations: [
        {
          city: { type: String },
          state: { type: String },
          country: { type: String },
          count: { type: Number },
          revenue: { type: Number },
        },
      ],
      buyersByMonth: [
        {
          month: { type: String }, // "2026-01"
          count: { type: Number },
          revenue: { type: Number },
        },
      ],
    },

    // ==================== SEO ====================
    metaTitle: { type: String },
    metaDescription: { type: String },
    metaKeywords: [{ type: String }],

    // ==================== VENDOR PRODUCT APPROVAL ====================
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "changes_requested"],
      default: "approved", // Admin products auto-approved
    },
    approvalNotes: { type: String, default: "" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, default: "" },

    // ==================== INTERNAL NOTES ====================
    adminNotes: { type: String, default: "" },
    vendorNotes: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// ==================== PRE-SAVE HOOKS ====================

// Generate slug and SKU
productSchema.pre("save", function (next) {
  // Generate slug
  if (this.isModified("name") || !this.slug) {
    this.slug =
      this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Date.now().toString(36);
  }

  // Generate SKU
  if (!this.sku) {
    this.sku = "PRD-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  }

  // Calculate sale price
  const now = new Date();
  if (
    this.discount.type !== "none" &&
    this.discount.value > 0 &&
    (!this.discount.startDate || now >= this.discount.startDate) &&
    (!this.discount.endDate || now <= this.discount.endDate)
  ) {
    if (this.discount.type === "percentage") {
      this.salePrice = this.price * (1 - this.discount.value / 100);
    } else if (this.discount.type === "fixed") {
      this.salePrice = Math.max(0, this.price - this.discount.value);
    }
    this.isOnSale = true;
  } else {
    this.salePrice = this.price;
    this.isOnSale = false;
  }

  // Update stock status
  if (this.stock <= 0) {
    this.stockStatus = this.allowBackorders ? "backorder" : "out_of_stock";
  } else if (this.stock <= this.lowStockThreshold) {
    this.stockStatus = "low_stock";
  } else {
    this.stockStatus = "in_stock";
  }

  // Calculate conversion rate
  if (this.stats.views > 0) {
    this.stats.conversionRate = parseFloat(((this.stats.totalOrders / this.stats.views) * 100).toFixed(2));
  }

  // Set thumbnail from primary image
  if (this.images && this.images.length > 0) {
    const primary = this.images.find((img) => img.isPrimary);
    this.thumbnail = primary ? primary.url : this.images[0].url;
  }

  next();
});

// ==================== INDEXES ====================
productSchema.index({ name: "text", description: "text", tags: "text", brand: "text" });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ createdBy: 1 });
productSchema.index({ status: 1, isPublished: 1 });
productSchema.index({ price: 1, salePrice: 1 });
productSchema.index({ "stats.totalQuantitySold": -1 });
productSchema.index({ "stats.views": -1 });
productSchema.index({ averageRating: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ approvalStatus: 1 });
productSchema.index({ isOnSale: 1 });
productSchema.index({ isFeatured: 1 });

export const Product = mongoose.model("Product", productSchema);