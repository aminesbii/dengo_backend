import { getChatResponse } from "../services/gemini_services.js";

export const chat = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Message is required" });
    }

    // Limit message length to prevent abuse
    const trimmedMessage = message.trim().substring(0, 1000);
    const safeHistory = Array.isArray(history) ? history.slice(-20) : []; // Last 20 messages max

    const response = await getChatResponse(trimmedMessage, safeHistory);

    res.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AI Controller Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

