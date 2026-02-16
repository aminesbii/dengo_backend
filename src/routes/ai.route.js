import express from "express";
import { chat } from "../controllers/ai.controller.js";

const router = express.Router();

// POST /api/ai/chat
router.post("/chat", chat);

export default router;
