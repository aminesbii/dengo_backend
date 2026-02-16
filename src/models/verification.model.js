import mongoose from "mongoose";


const verificationSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true }, // hashed
  name: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

export const VerificationToken = mongoose.model("VerificationToken", verificationSchema);
