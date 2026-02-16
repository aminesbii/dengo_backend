import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  followShop,
  unfollowShop,
  getFollowStatus,
  getFollowedShops,
  getShopFollowerCount,
} from "../controllers/shopFollow.controller.js";

const router = Router();

// Authenticated routes
router.post("/:shopId/follow", protectRoute, followShop);
router.delete("/:shopId/follow", protectRoute, unfollowShop);
router.get("/:shopId/status", protectRoute, getFollowStatus);
router.get("/my-follows", protectRoute, getFollowedShops);

// Public route
router.get("/:shopId/count", getShopFollowerCount);

export default router;
