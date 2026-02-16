import { getCarChatResponse } from "../gemini_services.js";
import { Review } from "../../models/review.model.js";
import { Product } from "../../models/product.model.js";
import dotenv from "dotenv";
dotenv.config();

const SYSTEM_INSTRUCTION = `You are a concise product validator for a Tunisian multi-vendor marketplace. Return ONLY one token among: valid, medium, invalid. Do not explain or add extra text.`;

function localChecks(product) {
  const issues = [];
  if (!product) {
    issues.push("missing_product_object");
    return issues;
  }
  if (!product.name || String(product.name).trim().length < 3) issues.push("missing_name");
  if (!product.description || String(product.description).trim().length < 10) issues.push("missing_description");
  if (product.price == null || isNaN(Number(product.price)) || Number(product.price) < 0) issues.push("invalid_price");
  if (!product.sku || String(product.sku).trim().length < 3) issues.push("missing_sku");
  if (!product.vendor && !product.vendorId && !product.createdBy) issues.push("missing_vendor");
  if (!product.images || (Array.isArray(product.images) && product.images.length === 0)) issues.push("missing_images");
  if (product.stock == null || isNaN(Number(product.stock))) issues.push("missing_stock");

  // simple vulgarity check (small list, extend as needed)
  const text = ((product.name || "") + " " + (product.description || "")).toLowerCase();
  const vulgar = /(merde|con|putain|salope|ta3b|zebi|3arbi)/i;
  if (vulgar.test(text)) issues.push("vulgarity_detected");

  return issues;
}

export async function aiValidateProductDetails(product) {
  // Run quick local validations
  const issues = localChecks(product);
  // If vulgarity found, short-circuit to invalid
  if (issues.includes("vulgarity_detected")) return "invalid";

  // Build a compact prompt for the AI service
  const safe = (v) => (v === undefined || v === null ? "" : String(v));
  const imagesList = Array.isArray(product.images) ? product.images.map(i => (i.url || i)).slice(0,5).join(", ") : safe(product.images);

  const prompt = `
${SYSTEM_INSTRUCTION}

Classify this product listing as one of: valid, medium, invalid.

Name: ${safe(product.name)}
Brand: ${safe(product.brand)}
Price: ${safe(product.price)}
SKU: ${safe(product.sku)}
Vendor: ${safe(product.vendor || product.vendorId || product.createdBy)}
Category: ${safe(product.category)}
Stock: ${safe(product.stock)}
Status: ${safe(product.status)}
Images: ${imagesList}
Short description: ${safe(product.shortDescription)}
Description: ${safe(product.description).substring(0,1000)}
LocalIssues: ${issues.join(",")}
`.trim();

  // Call AI service (Gemini or OpenAI via gemini_services.js fallback)
  try {
    const resp = await getCarChatResponse(prompt);
    const text = resp ? String(resp).trim().toLowerCase() : "";
    if (["valid", "medium", "invalid"].includes(text)) return text;
  } catch (err) {
    console.error("aiValidateProductDetails: AI call failed:", err.message || err);
  }

  // If AI failed or returned unexpected text, apply simple heuristic
  if (issues.length === 0) return "valid";
  if (issues.includes("missing_name") || issues.includes("missing_description") || issues.includes("invalid_price") || issues.includes("missing_vendor")) return "invalid";
  return "medium";
}

export async function getInvalidReason(product) {
  const safe = (v) => (v === undefined || v === null ? "" : String(v));
  const prompt = `You previously classified this product as INVALID. In one short sentence explain why (vulgarity, missing price, missing fields, fake brand, etc.).\n\nName: ${safe(product?.name)}\nBrand: ${safe(product?.brand)}\nSKU: ${safe(product?.sku)}\nPrice: ${safe(product?.price)}\nShort description: ${safe(product?.shortDescription)}\nDescription: ${safe(product?.description).substring(0,500)}\n`;
  try {
    const resp = await getCarChatResponse(prompt);
    return resp ? String(resp).trim() : "";
  } catch (err) {
    console.error("getInvalidReason: AI call failed:", err.message || err);
    return "";
  }
}

export default { aiValidateProductDetails, getInvalidReason };
