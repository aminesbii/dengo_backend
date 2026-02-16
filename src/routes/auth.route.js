import { Router } from "express";
import {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile,
  changePassword,
  checkAuth,
  refreshToken,
  verifyEmail,
  resendVerificationCode,
  getVerificationCodeDebug,
  deleteAccount,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/multer.middleware.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify", verifyEmail);
router.post("/resend-code", resendVerificationCode);
router.get("/dev/verification-code", getVerificationCodeDebug);

// Protected routes (require authentication)
router.get("/me", protectRoute, getCurrentUser);
router.put("/me", protectRoute, upload.single("avatar"), updateProfile);
router.put("/change-password", protectRoute, changePassword);
router.delete("/me", protectRoute, deleteAccount);
router.get("/check", protectRoute, checkAuth);
router.post("/refresh", protectRoute, refreshToken);

export default router;
