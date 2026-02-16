import { ShopFollow } from "../models/shopFollow.model.js";
import Shop from "../models/shop.model.js";
import { createNotification } from "./notification.controller.js";

// Follow a shop
export async function followShop(req, res) {
  try {
    const { shopId } = req.params;
    const userId = req.user._id;

    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    // Prevent following your own shop
    if (shop.owner.toString() === userId.toString()) {
      return res.status(400).json({ error: "You cannot follow your own shop" });
    }

    // Check if already following
    const existing = await ShopFollow.findOne({ user: userId, shop: shopId });
    if (existing) {
      return res.status(400).json({ error: "Already following this shop" });
    }

    await ShopFollow.create({ user: userId, shop: shopId });

    // Notify the shop owner about the new follower
    await createNotification({
      recipient: shop.owner,
      type: "new_follower",
      title: "New Follower",
      message: `${req.user.name} started following your shop "${shop.name}"`,
      shop: shop._id,
    });

    const followerCount = await ShopFollow.countDocuments({ shop: shopId });

    res.json({ success: true, message: "Followed successfully", followerCount });
  } catch (error) {
    console.error("Error following shop:", error);
    res.status(500).json({ error: "Failed to follow shop" });
  }
}

// Unfollow a shop
export async function unfollowShop(req, res) {
  try {
    const { shopId } = req.params;
    const userId = req.user._id;

    const result = await ShopFollow.findOneAndDelete({ user: userId, shop: shopId });
    if (!result) {
      return res.status(404).json({ error: "Not following this shop" });
    }

    const followerCount = await ShopFollow.countDocuments({ shop: shopId });

    res.json({ success: true, message: "Unfollowed successfully", followerCount });
  } catch (error) {
    console.error("Error unfollowing shop:", error);
    res.status(500).json({ error: "Failed to unfollow shop" });
  }
}

// Check if current user follows a shop
export async function getFollowStatus(req, res) {
  try {
    const { shopId } = req.params;
    const userId = req.user._id;

    const follow = await ShopFollow.findOne({ user: userId, shop: shopId });
    const followerCount = await ShopFollow.countDocuments({ shop: shopId });

    res.json({
      success: true,
      isFollowing: !!follow,
      followerCount,
    });
  } catch (error) {
    console.error("Error checking follow status:", error);
    res.status(500).json({ error: "Failed to check follow status" });
  }
}

// Get all shops the current user follows
export async function getFollowedShops(req, res) {
  try {
    const userId = req.user._id;
    const follows = await ShopFollow.find({ user: userId })
      .populate("shop", "name logo slug description stats")
      .sort({ createdAt: -1 });

    const shops = follows.map((f) => f.shop).filter(Boolean);
    res.json({ success: true, shops });
  } catch (error) {
    console.error("Error fetching followed shops:", error);
    res.status(500).json({ error: "Failed to fetch followed shops" });
  }
}

// Get follower count of a shop (public)
export async function getShopFollowerCount(req, res) {
  try {
    const { shopId } = req.params;
    const count = await ShopFollow.countDocuments({ shop: shopId });
    res.json({ success: true, followerCount: count });
  } catch (error) {
    console.error("Error fetching follower count:", error);
    res.status(500).json({ error: "Failed to fetch follower count" });
  }
}
