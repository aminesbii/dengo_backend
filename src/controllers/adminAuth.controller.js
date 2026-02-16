import { User } from "../models/user.model.js";
import { generateToken, setTokenCookie, clearTokenCookie } from "../middleware/auth.middleware.js";
import { ENV } from "../config/env.js";

/**
 * Admin Login
 * POST /api/admin/auth/login
 */
export async function adminLogin(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Please provide email and password",
        code: "MISSING_CREDENTIALS" 
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    
    if (!user) {
      return res.status(401).json({ 
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS" 
      });
    }

    // Check if user is admin
    if (user.role !== "admin" && user.email !== ENV.ADMIN_EMAIL) {
      return res.status(403).json({ 
        message: "Access denied - admin only",
        code: "NOT_ADMIN" 
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS" 
      });
    }

    // Generate token and set cookie
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Admin Logout
 * POST /api/admin/auth/logout
 */
export async function adminLogout(req, res) {
  try {
    clearTokenCookie(res);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error in admin logout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Get current admin user
 * GET /api/admin/auth/me
 */
export async function getAdminMe(req, res) {
  try {
    let token;

    // Check for token in cookies first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // Then check Authorization header (Bearer token)
    else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ 
        message: "Not authenticated",
        code: "NO_TOKEN" 
      });
    }

    // Verify token
    const jwt = await import("jsonwebtoken");
    let decoded;
    try {
      decoded = jwt.default.verify(token, ENV.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ 
        message: "Invalid or expired token",
        code: "INVALID_TOKEN" 
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        message: "User not found",
        code: "USER_NOT_FOUND" 
      });
    }

    // Check if user is admin
    if (user.role !== "admin" && user.email !== ENV.ADMIN_EMAIL) {
      return res.status(403).json({ 
        message: "Access denied - admin only",
        code: "NOT_ADMIN" 
      });
    }

    res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in getAdminMe:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
