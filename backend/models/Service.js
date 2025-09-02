import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // ← الحقل المطلوب
    price: { type: Number, required: true },
    active: { type: Boolean, default: true },
    category: { type: String, default: "General" }
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
