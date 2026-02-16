import dotenv from "dotenv";
import { searchProducts, getBestDeals, getTopShops, searchShops } from "./databaseQueries.js";
dotenv.config();

const SYSTEM_PROMPT = `
You are Dengo, the official AI shopping assistant for the Dengo marketplace — a multivendor online shopping platform.

PERSONA:
- Name: Dengo
- Personality: Friendly, helpful, enthusiastic. Like a trusted shopping buddy.
- Tone: Warm, use emojis naturally (not excessively), match the user's energy.
- Language: ALWAYS reply in the SAME language the user writes in (English, French, Arabic, Tunisian Derja, etc.).

YOUR ROLE:
Help users discover products, find deals, explore shops, and navigate the marketplace. You can also have friendly general conversations.

YOU MUST ALWAYS RESPOND WITH A VALID JSON OBJECT matching one of these formats:

1. GENERAL CHAT (no tool needed):
{ "type": "chat", "message": "Your friendly response here" }

2. SEARCH FOR PRODUCTS (user wants to find/buy something specific):
{ "type": "search", "message": "A short friendly message about what you're looking for", "tool": { "action": "search_products", "query": "search keywords", "minPrice": null, "maxPrice": null, "category": null, "limit": 8 } }

3. BEST DEALS / DISCOUNTS / PROMOTIONS:
{ "type": "deals", "message": "A short friendly message about deals", "tool": { "action": "get_best_deals", "limit": 8 } }

4. FIND SHOPS / STORES:
{ "type": "shops", "message": "A short friendly message about shops", "tool": { "action": "search_shops", "query": "optional search term or null", "limit": 6 } }

5. TOP / BEST SHOPS:
{ "type": "shops", "message": "A short friendly message about top shops", "tool": { "action": "get_top_shops", "limit": 6 } }

INTENT DETECTION RULES:
- "I want to buy X", "show me X", "find X", "do you have X", "looking for X", "I need X" → type: "search"
- "X under Y TND/dinars", "cheap X", "affordable X" → type: "search" with maxPrice
- "expensive X", "premium X", "luxury X" → type: "search" with minPrice (e.g., 100+)
- "best deals", "discounts", "promotions", "sales", "offers", "what's on sale" → type: "deals"
- "best shops", "top stores", "recommended sellers", "where should I buy" → type: "shops" with action "get_top_shops"
- "shops that sell X", "stores with X", "where can I find X" → type: "shops" with action "search_shops"
- Greetings, thanks, general questions, chitchat → type: "chat"
- If the user asks something inappropriate or illegal, politely decline → type: "chat"

IMPORTANT:
- The "message" field should be a natural, friendly response that makes sense even WITHOUT seeing the product/shop results. For example: "Let me find you some great red dresses! 👗✨" or "Here are the hottest deals right now! 🔥"
- Keep the "message" under 40 words.
- For search queries, extract the BEST possible search keywords (e.g., "I want something nice to wear for a party" → query: "party dress").
- Extract price hints: "under 50" → maxPrice: 50, "between 20 and 80" → minPrice: 20, maxPrice: 80.
- Set null for any tool params you can't determine.
- NEVER output anything outside the JSON object. No markdown, no extra text, just the JSON.

EXAMPLES:
User: "hi!"
{ "type": "chat", "message": "Hey there! 👋 Welcome to Dengo! How can I help you shop today? 🛍️" }

User: "I want a red shirt under 50 dinars"
{ "type": "search", "message": "Let me find you some awesome red shirts within your budget! 👕🔥", "tool": { "action": "search_products", "query": "red shirt", "minPrice": null, "maxPrice": 50, "category": null, "limit": 8 } }

User: "any good deals today?"
{ "type": "deals", "message": "Let me check out today's hottest deals for you! 🔥💰", "tool": { "action": "get_best_deals", "limit": 8 } }

User: "what are the best stores?"
{ "type": "shops", "message": "Here are the top-rated shops on Dengo! ⭐🏪", "tool": { "action": "get_top_shops", "limit": 6 } }

User: "are there any stores that sell electronics?"
{ "type": "shops", "message": "Let me find electronics shops for you! 🔌🏪", "tool": { "action": "search_shops", "query": "electronics", "limit": 6 } }
`.trim();

// ─── Gemini Client ──────────────────────────────────────────────

let genAiClient = null;
let hasGenAI = false;

async function initGenAI() {
  if (genAiClient || hasGenAI) return;
  try {
    const mod = await import("@google/genai");
    const GoogleGenAI = mod.GoogleGenAI || mod.default || null;
    if (GoogleGenAI) {
      genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      hasGenAI = true;
    }
  } catch (err) {
    hasGenAI = false;
    console.warn("Gemini SDK not available, AI chat disabled.");
  }
}

// ─── Build structured conversation history ──────────────────────

function buildContents(message, history = []) {
  const parts = [];

  for (const h of history) {
    if (h.user) {
      parts.push({ role: "user", parts: [{ text: h.user }] });
    }
    if (h.assistant) {
      parts.push({ role: "model", parts: [{ text: h.assistant }] });
    }
  }

  // Current user message
  parts.push({ role: "user", parts: [{ text: message }] });

  return parts;
}

// ─── Call Gemini with fallback ──────────────────────────────────

const MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

async function callGemini(message, history = []) {
  await initGenAI();
  if (!hasGenAI || !genAiClient) throw new Error("Gemini AI not available");

  const contents = buildContents(message, history);
  let lastErr = null;

  for (const model of MODELS_TO_TRY) {
    try {
      const response = await genAiClient.models.generateContent({
        model,
        contents,
        systemInstruction: SYSTEM_PROMPT,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const text = response && response.text ? response.text.trim() : "";
      if (!text) throw new Error("Empty response from model");

      return JSON.parse(text);
    } catch (sdkErr) {
      lastErr = sdkErr;
      const status = sdkErr.status || 0;
      const msg = sdkErr.message || "";
      const isRetryable = status === 429 || status === 404 || status === 503
        || msg.includes("429") || msg.includes("not found") || msg.includes("overloaded");

      if (isRetryable) {
        console.warn(`Model ${model} failed (${status || 'error'}), trying next...`);
        continue;
      }

      // JSON parse error — model returned invalid JSON, try to salvage
      if (sdkErr instanceof SyntaxError) {
        console.warn(`Model ${model} returned invalid JSON, trying next...`);
        continue;
      }

      console.error("Gemini SDK Error:", sdkErr);
      throw sdkErr;
    }
  }

  // All models exhausted
  if (lastErr && (lastErr.status === 429 || (lastErr.message && lastErr.message.includes("429")))) {
    throw new Error("QUOTA_EXCEEDED");
  }
  throw lastErr || new Error("All Gemini models failed");
}

// ─── Execute tool action ────────────────────────────────────────

async function executeTool(tool) {
  if (!tool || !tool.action) return null;

  try {
    switch (tool.action) {
      case "search_products":
        return {
          type: "products",
          data: await searchProducts(tool.query || "", {
            minPrice: tool.minPrice,
            maxPrice: tool.maxPrice,
            category: tool.category,
            limit: tool.limit || 8,
          }),
        };

      case "get_best_deals":
        return {
          type: "products",
          data: await getBestDeals(tool.limit || 8),
        };

      case "get_top_shops":
        return {
          type: "shops",
          data: await getTopShops(tool.limit || 6),
        };

      case "search_shops":
        return {
          type: "shops",
          data: await searchShops(tool.query || "", tool.limit || 6),
        };

      default:
        console.warn("Unknown tool action:", tool.action);
        return null;
    }
  } catch (err) {
    console.error("Tool execution error:", err);
    return null;
  }
}

// ─── Format results for frontend ────────────────────────────────

function formatProducts(products) {
  return products.map(p => ({
    _id: p._id,
    name: p.name,
    price: p.price,
    salePrice: p.salePrice || null,
    isOnSale: p.isOnSale || false,
    vendor: p.vendor && p.vendor.name ? p.vendor.name : "Dengo Store",
    shortDescription: p.shortDescription || (p.description ? String(p.description).substring(0, 100) + "..." : ""),
    image: (p.images && p.images.length > 0 ? p.images[0].url : p.thumbnail) || null,
    rating: p.averageRating || 0,
  }));
}

function formatShops(shops) {
  return shops.map(s => ({
    _id: s._id,
    name: s.name,
    slug: s.slug,
    description: s.description ? String(s.description).substring(0, 100) + "..." : "",
    logo: s.logo || null,
    banner: s.banner || null,
    rating: s.stats?.averageRating || 0,
    totalProducts: s.stats?.totalProducts || 0,
    totalReviews: s.stats?.totalReviews || 0,
  }));
}

// ─── Main Chat Handler (single LLM call) ────────────────────────

export async function getChatResponse(message, history = []) {
  try {
    // 1. Single LLM call — gets intent, message, and tool params
    const aiResponse = await callGemini(message, history);

    const type = aiResponse.type || "chat";
    const friendlyMessage = aiResponse.message || "";

    // 2. Chat-only response (no tool needed)
    if (type === "chat" || !aiResponse.tool) {
      return friendlyMessage;
    }

    // 3. Execute the tool
    const toolResult = await executeTool(aiResponse.tool);

    // 4. No results found
    if (!toolResult || !toolResult.data || toolResult.data.length === 0) {
      return friendlyMessage + "\n\nHmm, I couldn't find anything matching that right now. Try different keywords or browse the app! 🔍";
    }

    // 5. Build structured response for frontend
    if (toolResult.type === "products") {
      return {
        structured: true,
        type: "products",
        message: friendlyMessage,
        choices: formatProducts(toolResult.data),
      };
    }

    if (toolResult.type === "shops") {
      return {
        structured: true,
        type: "shops",
        message: friendlyMessage,
        shops: formatShops(toolResult.data),
      };
    }

    return friendlyMessage;
  } catch (err) {
    console.error("Chat Error:", err);

    if (err.message === "QUOTA_EXCEEDED") {
      return "I've reached my daily message limit! 🙈 Please try again later or tomorrow. ✨";
    }

    return "Oh no! 🙈 I'm having a little trouble thinking right now. Please try again in a moment! ✨";
  }
}

export default { getChatResponse };
