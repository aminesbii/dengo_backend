import mongoose from "mongoose";

const shopFollowSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
  },
  { timestamps: true }
);

// Each user can follow a shop only once
shopFollowSchema.index({ user: 1, shop: 1 }, { unique: true });
shopFollowSchema.index({ shop: 1 }); // For querying followers of a shop

export const ShopFollow = mongoose.model("ShopFollow", shopFollowSchema);
