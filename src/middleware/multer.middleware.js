import multer from "multer";
import path from "path";
import fs from "fs";

const BASE_IMAGES_DIR = path.join(process.cwd(), "src", "images");

const ensureDir = (p) => {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (err) {
    // ignore
  }
};

// Ensure base images dir exists
ensureDir(BASE_IMAGES_DIR);

const mapFieldToEntity = (fieldname, urlParts) => {
  // First try to infer from the request URL (e.g. /api/categories -> categories)
  const apiIdx = urlParts.indexOf("api");
  if (apiIdx >= 0 && urlParts[apiIdx + 1]) {
    let candidate = urlParts[apiIdx + 1].toLowerCase();
    if (candidate === "vendor") candidate = "shops";
    if (candidate === "auth") candidate = "users";
    if (candidate === "category" || candidate === "categories") candidate = "categories";
    if (candidate === "shop" || candidate === "shops") candidate = "shops";
    if (candidate === "product" || candidate === "products") candidate = "products";
    return { base: candidate, sub: "" };
  }

  // Fallback mapping by fieldname
  const lower = (fieldname || "").toLowerCase();
  if (lower === "avatar" || lower === "profile") return { base: "users", sub: "profile" };
  if (lower === "logo") return { base: "shops", sub: "logos" };
  if (lower === "banner") return { base: "shops", sub: "banners" };
  if (lower === "icon") return { base: "icons", sub: "" };
  if (lower === "images" || lower === "photos" || lower === "files") return { base: "products", sub: "" };

  return { base: "uploads", sub: lower };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const original = req.originalUrl || req.url || "";
      const parts = original.split("/").filter(Boolean);

      const mapping = mapFieldToEntity(file.fieldname, parts);

      const folderName = `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6)}`;

      const destParts = [BASE_IMAGES_DIR, mapping.base];
      if (mapping.sub) destParts.push(mapping.sub);
      destParts.push(folderName);
      const dest = path.join(...destParts);
      ensureDir(dest);

      req._upload = req._upload || {};
      req._upload.entity = mapping.base;
      req._upload.sub = mapping.sub;
      req._upload.folder = folderName;
      req._upload.dest = dest;

      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || "").toLowerCase();
    if (![".jpeg", ".jpg", ".png", ".webp"].includes(ext)) {
      const mimeMap = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
      ext = mimeMap[file.mimetype] || ".jpg";
    }
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname || "").toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);
  if (mimeType || extname) cb(null, true);
  else cb(new Error("Only image files are allowed (jpeg,jpg,png,webp)"));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const ensureBaseImageDirs = () => {
  // create common folders used by the app
  const bases = ["users/profile", "shops/logos", "shops/banners", "products", "icons", "uploads"];
  bases.forEach((b) => ensureDir(path.join(BASE_IMAGES_DIR, ...b.split("/"))));
};