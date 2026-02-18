import fs from "fs";
import path from "path";

const BASE = path.join(process.cwd(), "src", "images");

const ensure = (p) => {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (err) {
    // ignore
  }
};

const writeFile = (buffer, fullPath) => fs.promises.writeFile(fullPath, buffer);

export async function saveBase64Image(base64String, { base = "uploads", sub = "", folderName } = {}) {
  if (!base64String || typeof base64String !== "string") throw new Error("Invalid base64 string");

  const matches = base64String.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!matches) throw new Error("Invalid data URL");

  const mime = matches[1];
  const extMap = { "image/png": ".png", "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/webp": ".webp" };
  const ext = extMap[mime] || ".jpg";

  const data = matches[3];
  const buffer = Buffer.from(data, "base64");

  const folder = folderName || `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6)}`;
  const parts = [BASE, base];
  if (sub) parts.push(sub);
  parts.push(folder);
  const dir = path.join(...parts);
  ensure(dir);

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(buffer, fullPath);

  // return normalized relative path used across app
  const rel = path.relative(path.join(process.cwd(), "src"), fullPath).split(path.sep).join("/");
  return `/${rel}`;
}

export function ensureImageFolders() {
  const bases = [
    "users/profile",
    "shops/logos",
    "shops/banners",
    "products",
    "icons",
    "uploads",
    "categories",
    "categories/subcategories",
  ];
  bases.forEach((b) => ensure(path.join(BASE, ...b.split("/"))));
}

export async function deleteLocalImage(imageUrl) {
  try {
    if (!imageUrl) return;
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return;
    const rel = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
    const fullPath = path.join(process.cwd(), "src", rel);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    // log and continue
    console.error("deleteLocalImage failed:", err.message || err);
  }
}
