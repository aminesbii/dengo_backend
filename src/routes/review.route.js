import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createReview, deleteReview, updateReview, getVendorReviews, getProductReviews, getShopReviews } from "../controllers/review.controller.js";

const router = Router();

router.post("/", protectRoute, createReview);
router.get("/vendor", protectRoute, getVendorReviews);
router.get("/product/:productId", getProductReviews);
router.get("/shop/:shopId", getShopReviews);
router.put("/:reviewId", protectRoute, updateReview);
router.delete("/:reviewId", protectRoute, deleteReview);

export default router;