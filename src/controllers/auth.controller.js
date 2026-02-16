import { User } from "../models/user.model.js";
import { VerificationToken } from "../models/verification.model.js";
import { generateToken, setTokenCookie, clearTokenCookie } from "../middleware/auth.middleware.js";
import { sendVerificationEmail } from "../lib/mailer.js";
import crypto from "crypto";
import { ENV } from "../config/env.js";

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const { email, password, name, accountType = "customer", preferences = [], location = {} } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        message: "Please provide all required fields",
        code: "MISSING_FIELDS"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Please provide a valid email",
        code: "INVALID_EMAIL"
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
        code: "WEAK_PASSWORD"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
        code: "USER_EXISTS"
      });
    }

    // Remove any previous pending verifications for this email
    await VerificationToken.deleteMany({ email: email.toLowerCase() });

    // Store plain password temporarily in verification token
    // It will be hashed by the User model's pre-save hook when the user is actually created
    const passwordForToken = password;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await VerificationToken.create({
      email: email.toLowerCase(),
      password: passwordForToken,
      name,
      code,
      expiresAt,
      accountType,
      preferences,
      location,
    });
    let mailResult = null;
    try {
      mailResult = await sendVerificationEmail(email, code);
    } catch (err) {
      console.warn("Failed to send verification email:", err);
    }

    // Return response
    const responsePayload = {
      message: "Verification code sent. Please verify your email to complete registration.",
      email: email.toLowerCase(),
      name,
    };
    if (mailResult && mailResult.logged && ENV.NODE_ENV !== "production") {
      responsePayload.verificationCode = mailResult.code || code;
    }
    res.status(201).json(responsePayload);
  } catch (error) {
    console.error("Error in register controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Verify email code
 * POST /api/auth/verify
 */
export async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code required" });

    // Find pending verification
    const tokenDoc = await VerificationToken.findOne({ email: email.toLowerCase(), code });
    if (!tokenDoc) return res.status(400).json({ message: "Invalid verification code" });
    if (tokenDoc.expiresAt < new Date()) {
      return res.status(400).json({ message: "Verification code expired" });
    }

    // Check if user already exists (should not, but double check)
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      await VerificationToken.deleteMany({ email: email.toLowerCase() });
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Create user now
    user = await User.create({
      email: tokenDoc.email,
      password: tokenDoc.password,
      name: tokenDoc.name,
      isEmailVerified: true,
      accountType: tokenDoc.accountType || "customer",
      preferences: tokenDoc.preferences || [],
      location: tokenDoc.location || {},
    });

    // Remove all tokens for this email
    await VerificationToken.deleteMany({ email: email.toLowerCase() });

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.status(200).json({
      message: "Email verified, account created", token, user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      }
    });
  } catch (error) {
    console.error("Error in verifyEmail controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Resend verification code
 * POST /api/auth/resend-code
 */
export async function resendVerificationCode(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email already verified" });

    // Remove old tokens
    await VerificationToken.deleteMany({ userId: user._id });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await VerificationToken.create({ userId: user._id, code, expiresAt });
    let mailResult = null;
    try {
      mailResult = await sendVerificationEmail(user.email, code);
    } catch (err) {
      console.warn("Failed to send verification email:", err);
    }

    const resp = { message: "Verification code resent" };
    if (mailResult && mailResult.logged && ENV.NODE_ENV !== "production") {
      resp.verificationCode = mailResult.code || code;
    }

    res.status(200).json(resp);
  } catch (error) {
    console.error("Error in resendVerificationCode controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Development helper - get latest verification code for an email
 * GET /api/auth/dev/verification-code?email=
 */
export async function getVerificationCodeDebug(req, res) {
  try {
    if (ENV.NODE_ENV === "production") return res.status(403).json({ message: "Not allowed in production" });
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const tokenDoc = await VerificationToken.findOne({ userId: user._id }).sort({ createdAt: -1 });
    if (!tokenDoc) return res.status(404).json({ message: "No verification token found" });

    res.status(200).json({ code: tokenDoc.code, expiresAt: tokenDoc.expiresAt });
  } catch (error) {
    console.error("Error in getVerificationCodeDebug:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req, res) {
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

    // Compare passwords
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
        code: "INVALID_CREDENTIALS"
      });
    }

    // Prevent login if email not verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
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
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
      },
      token, // Also send token in response for mobile apps
    });
  } catch (error) {
    console.error("Error in login controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  try {
    clearTokenCookie(res);

    res.status(200).json({
      message: "Logged out successfully"
    });
  } catch (error) {
    console.error("Error in logout controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Get current user (me)
 * GET /api/auth/me
 */
export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.user._id)
      .populate("wishlist")
      .select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        code: "USER_NOT_FOUND"
      });
    }

    res.status(200).json({
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        phoneNumber: user.phoneNumber,
        age: user.age,
        sexe: user.sexe,
        location: user.location,
        role: user.role,
        accountType: user.accountType,
        isEmailVerified: user.isEmailVerified,
        addresses: user.addresses,
        wishlist: user.wishlist,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error("Error in getCurrentUser controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Update current user profile
 * PUT /api/auth/me
 */
export async function updateProfile(req, res) {
  try {
    const { name, imageUrl, phoneNumber, age, sexe } = req.body;
    let { location } = req.body;

    const user = req.user;

    if (name) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (age !== undefined) user.age = Number(age);
    if (sexe !== undefined) user.sexe = sexe;

    // Handle location (might be a JSON string from FormData)
    if (typeof location === "string") {
      try { location = JSON.parse(location); } catch { location = null; }
    }
    if (location && typeof location === "object") {
      if (!user.location) user.location = {};
      if (location.country !== undefined) user.location.country = location.country;
      if (location.city !== undefined) user.location.city = location.city;
      if (location.address !== undefined) user.location.address = location.address;
      if (location.lat !== undefined) user.location.lat = location.lat;
      if (location.lng !== undefined) user.location.lng = location.lng;
    }

    // Handle avatar upload via multer
    if (req.file) {
      const relativePath = req.file.path
        .replace(process.cwd(), "")
        .replace(/\\/g, "/")
        .replace(/^\/?(src\/)?/, "/");
      user.imageUrl = relativePath;
    } else if (imageUrl !== undefined) {
      user.imageUrl = imageUrl;
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        phoneNumber: user.phoneNumber,
        age: user.age,
        sexe: user.sexe,
        location: user.location,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in updateProfile controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Delete user account
 * DELETE /api/auth/me
 */
export async function deleteAccount(req, res) {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Password is required to delete your account",
        code: "MISSING_PASSWORD",
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Password is incorrect",
        code: "INVALID_PASSWORD",
      });
    }

    await User.findByIdAndDelete(req.user._id);

    clearTokenCookie(res);

    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error in deleteAccount controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Change password
 * PUT /api/auth/change-password
 */
export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Please provide current and new password",
        code: "MISSING_FIELDS"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
        code: "WEAK_PASSWORD"
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Current password is incorrect",
        code: "INVALID_PASSWORD"
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.status(200).json({
      message: "Password changed successfully",
      token,
    });
  } catch (error) {
    console.error("Error in changePassword controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Check if user is authenticated
 * GET /api/auth/check
 */
export async function checkAuth(req, res) {
  try {
    res.status(200).json({
      authenticated: true,
      user: {
        _id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        imageUrl: req.user.imageUrl,
        role: req.user.role,
        isEmailVerified: req.user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Error in checkAuth controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Refresh token
 * POST /api/auth/refresh
 */
export async function refreshToken(req, res) {
  try {
    // User is already authenticated via protectRoute
    const token = generateToken(req.user._id);
    setTokenCookie(res, token);

    res.status(200).json({
      message: "Token refreshed successfully",
      token,
    });
  } catch (error) {
    console.error("Error in refreshToken controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
