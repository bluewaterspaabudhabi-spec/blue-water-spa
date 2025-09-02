import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialties: [String],
  email: { type: String, lowercase: true },
  phone: String,
  active: { type: Boolean, default: true },
  ratingAvg: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("Staff", staffSchema);
