import { Router } from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  reorderCategories,
} from "../controllers/category.controller.js";
import { protectRoute, adminOnly } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.get("/", getAllCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategoryById);

// Admin only routes
router.post("/", protectRoute, adminOnly, createCategory);
router.put("/:id", protectRoute, adminOnly, updateCategory);
router.delete("/:id", protectRoute, adminOnly, deleteCategory);
router.post("/reorder", protectRoute, adminOnly, reorderCategories);

export default router;
