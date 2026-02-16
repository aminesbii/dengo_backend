import mongoose from "mongoose";
import Category from "./category.model.js";

const businessHoursSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      required: true,
    },
    open: { type: String, default: "09:00" },
    close: { type: String, default: "18:00" },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const shopAddressSchema = new mongoose.Schema(
  {
    streetAddress: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, default: "" },
    country: { type: String, default: "Tunis" },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    routingNumber: { type: String },
    swiftCode: { type: String },
  },
  { _id: false }
);

const shopSchema = new mongoose.Schema(
  {
    // Shop Basic Info
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
    logo: {
      type: String,
      default: "",
    },
    banner: {
      type: String,
      default: "",
    },

    // Owner Reference
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Contact Information
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    website: {
      type: String,
      default: "",
    },

    // Address
    address: shopAddressSchema,

    // Business Details
    businessType: {
      type: String,
      enum: ["individual", "company", "partnership"],
      default: "individual",
    },
    businessRegistrationNumber: {
      type: String,
      default: "",
    },
    taxId: {
      type: String,
      default: "",
    },

    primaryCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // Bank Details for Payouts
    bankDetails: bankDetailsSchema,

    // Business Hours
    businessHours: [businessHoursSchema],

    // Shop Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    statusReason: {
      type: String,
      default: "",
    },
    statusUpdatedAt: {
      type: Date,
    },
    statusUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Shop Settings
    isActive: {
      type: Boolean,
      default: false,
    },
    commissionRate: {
      type: Number,
      default: 10, // percentage
      min: 0,
      max: 100,
    },

    // Verification Documents
    documents: [
      {
        type: { type: String }, // e.g., "business_license", "id_card", "tax_certificate"
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],

    // Statistics (cached for performance)
    stats: {
      totalProducts: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
    },

    // Social Media Links
    socialMedia: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
    },

    // Notes from admin
    adminNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug before saving
shopSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      + "-" + Date.now().toString(36);
  }
  next();
});

// Index for efficient queries
shopSchema.index({ status: 1 });
shopSchema.index({ owner: 1 });
shopSchema.index({ "address.city": 1 });
shopSchema.index({ primaryCategory: 1 });
shopSchema.index({ categories: 1 });
shopSchema.index({ createdAt: -1 });

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;
