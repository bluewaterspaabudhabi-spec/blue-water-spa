import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  staff:    { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
  service:  { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
  startAt:  { type: Date, required: true },
  endAt:    { type: Date, required: true },
  status:   { type: String, enum: ["scheduled","completed","cancelled"], default: "scheduled" },
  rating:   { type: Number, min: 0, max: 5 }
}, { timestamps: true });

export default mongoose.model("Appointment", appointmentSchema);
