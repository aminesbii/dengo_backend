import { Router } from "express";
import {
  createProduct,
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  suspendCustomer,
  reactivateCustomer,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getAllProducts,
  getProductById,
  getDashboardStats,
  updateOrderStatus,
  updateProduct,
  deleteProduct,
  getProductStats,
  bulkUpdateProducts,
  bulkDeleteProducts,
  deleteProductImage,
  setPrimaryImage,
  getVendors,
} from "../controllers/admin.controller.js";
import { adminLogin, adminLogout, getAdminMe } from "../controllers/adminAuth.controller.js";
import { adminOnly, protectRoute } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

// Admin auth routes (no auth required for login)
router.post("/auth/login", adminLogin);
router.post("/auth/logout", adminLogout);
router.get("/auth/me", getAdminMe);

// Protected admin routes
router.use(protectRoute, adminOnly);

// Product routes
router.post("/products", upload.array("images", 5), createProduct);
router.get("/products", getAllProducts);
router.get("/products/:id", getProductById);
router.get("/products/:id/stats", getProductStats);
router.put("/products/:id", upload.array("images", 5), updateProduct);
router.delete("/products/:id", deleteProduct);
router.delete("/products/:id/images/:imageIndex", deleteProductImage);
router.patch("/products/:id/images/:imageIndex/primary", setPrimaryImage);
router.post("/products/bulk/update", bulkUpdateProducts);
router.post("/products/bulk/delete", bulkDeleteProducts);

router.get("/orders", getAllOrders);
router.get("/orders/:id", getOrderById);
router.put("/orders/:id", updateOrder);
router.patch("/orders/:orderId/status", updateOrderStatus);
router.delete("/orders/:id", deleteOrder);

router.post("/customers", upload.single("image"), createCustomer);
router.get("/customers", getAllCustomers);
router.get("/customers/:id", getCustomerById);
router.put("/customers/:id", upload.single("image"), updateCustomer);
router.delete("/customers/:id", deleteCustomer);
router.post("/customers/:id/suspend", suspendCustomer);
router.post("/customers/:id/reactivate", reactivateCustomer);

router.get("/stats", getDashboardStats);
router.get("/vendors", getVendors);

// PUT: Used for full resource replacement, updating the entire resource
// PATCH: Used for partial resource updates, updating a specific part of the resource

export default router;