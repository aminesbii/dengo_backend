import { Router } from "express";
import {
  // Admin routes
  getAllShops,
  getShopById,
  approveShop,
  rejectShop,
  suspendShop,
  reactivateShop,
  updateShop,
  deleteShop,
  adminCreateShop,
  // Vendor routes
  registerShop,
  getMyShop,
  updateMyShop,
  getVendorStats,
  deleteMyShop,
  getMyShopAnalytics,
  getMyShopCustomers,
} from "../controllers/vendor.controller.js";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

// Import Shop model
import Shop from "../models/shop.model.js";

const router = Router();

// ==================== PUBLIC ROUTES (For All Users) ====================
// Get all approved shops (public)
router.get("/shops", async (req, res) => {
  try {
    const { page = 1, limit = 30, status = "approved" } = req.query;
    const query = { status };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const shops = await Shop.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("owner", "name imageUrl")
      .lean();
    const total = await Shop.countDocuments(query);
    res.json({ data: shops, total });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shops", error: err.message });
  }
});

// ==================== VENDOR ROUTES (For Business Owners) ====================
// These routes are for users who want to become vendors

router.post(
  "/register",
  protectRoute,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  registerShop
);
router.get("/my-shop", protectRoute, getMyShop);
router.put(
  "/my-shop",
  protectRoute,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  updateMyShop
);
router.get("/stats", protectRoute, getVendorStats);
router.delete("/my-shop", protectRoute, deleteMyShop);
router.get("/my-shop/analytics", protectRoute, getMyShopAnalytics);
router.get("/my-shop/customers", protectRoute, getMyShopCustomers);


// ==================== ADMIN ROUTES (For Admin Panel) ====================
// These routes are for admin to manage all vendors/shops

router.get("/admin/shops", protectRoute, adminOnly, getAllShops);
router.post(
  "/admin/shops",
  protectRoute,
  adminOnly,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  adminCreateShop
);
router.get("/admin/shops/:id", protectRoute, adminOnly, getShopById);
router.post("/admin/shops/:id/approve", protectRoute, adminOnly, approveShop);
router.post("/admin/shops/:id/reject", protectRoute, adminOnly, rejectShop);
router.post("/admin/shops/:id/suspend", protectRoute, adminOnly, suspendShop);
router.post("/admin/shops/:id/reactivate", protectRoute, adminOnly, reactivateShop);
router.put(
  "/admin/shops/:id",
  protectRoute,
  adminOnly,
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  updateShop
);
router.delete("/admin/shops/:id", protectRoute, adminOnly, deleteShop);

export default router;
