import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema({
  number: { type: String, unique: true, required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  items: [{
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    description: String,
    qty: { type: Number, default: 1 },
    unitPrice: Number,
    total: Number
  }],
  subTotal: Number,
  discount: { type: Number, default: 0 },
  taxRate:  { type: Number, default: 0 },
  tax: Number,
  grandTotal: Number,
  paidBy: { type: String, enum: ["cash","card","online"], default: "cash" },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" }
}, { timestamps: true });

export default mongoose.model("Invoice", invoiceSchema);
