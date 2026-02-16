import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getAllProducts } from "../controllers/admin.controller.js";
import {
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    trackProductView,
    trackAddToCart,
    getProductAnalytics,
} from "../controllers/product.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

router.get("/", protectRoute, getAllProducts);
router.post("/", protectRoute, upload.array("images"), createProduct);
router.get("/:id", protectRoute, getProductById);
router.put("/:id", protectRoute, upload.array("images"), updateProduct);
router.post("/:id/track-view", trackProductView);
router.post("/:id/track-cart", trackAddToCart);
router.get("/:id/analytics", protectRoute, getProductAnalytics);
router.delete("/:id", protectRoute, deleteProduct);

export default router;