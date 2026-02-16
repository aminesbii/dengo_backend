import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createOrder, getUserOrders, updateOrderStatus, getVendorOrders } from "../controllers/order.controller.js";

const router = Router();

router.post("/", protectRoute, createOrder);
router.get("/", protectRoute, getUserOrders);
router.get("/vendor", protectRoute, getVendorOrders);
router.patch("/:id/status", protectRoute, updateOrderStatus);

export default router;