import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ENV } from "../config/env.js";

/**
 * Generate JWT token for a user
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {string} JWT token
 */
export const generateToken = (userId) => {
  return jwt.sign({ userId }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });
};

/**
 * Set JWT token as HTTP-only cookie
 * @param {Response} res - Express response object
 * @param {string} token - JWT token
 */
export const setTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: ENV.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.cookie("token", token, cookieOptions);
};

/**
 * Clear authentication cookie
 * @param {Response} res - Express response object
 */
export const clearTokenCookie = (res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
    sameSite: ENV.NODE_ENV === "production" ? "strict" : "lax",
    expires: new Date(0),
  });
};

/**
 * Protect routes - requires valid JWT token
 * Checks for token in cookies or Authorization header
 */
export const protectRoute = async (req, res, next) => {
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
        message: "Unauthorized - no token provided",
        code: "NO_TOKEN" 
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ 
          message: "Unauthorized - token expired",
          code: "TOKEN_EXPIRED" 
        });
      }
      return res.status(401).json({ 
        message: "Unauthorized - invalid token",
        code: "INVALID_TOKEN" 
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        message: "Unauthorized - user not found",
        code: "USER_NOT_FOUND" 
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    console.error("Error in protectRoute middleware:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Optional authentication - attaches user if token exists, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, ENV.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (user) {
          req.user = user;
          req.userId = user._id;
        }
      } catch (error) {
        // Token invalid, but continue without user
      }
    }

    next();
  } catch (error) {
    console.error("Error in optionalAuth middleware:", error);
    next();
  }
};

/**
 * Admin only middleware - requires user to have admin role
 */
export const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: "Unauthorized - user not found",
      code: "NOT_AUTHENTICATED" 
    });
  }

  // Check if user has admin role or matches admin email
  if (req.user.role !== "admin" && req.user.email !== ENV.ADMIN_EMAIL) {
    return res.status(403).json({ 
      message: "Forbidden - admin access only",
      code: "NOT_ADMIN" 
    });
  }

  next();
};

/**
 * Require email verification middleware
 */
export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: "Unauthorized - user not found",
      code: "NOT_AUTHENTICATED" 
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({ 
      message: "Please verify your email first",
      code: "EMAIL_NOT_VERIFIED" 
    });
  }

  next();
};