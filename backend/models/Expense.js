import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  category: { type: String, enum: ["Salaries","Supplies","Rent","Utilities","Marketing","Other"], required: true },
  note: String,
  amount: { type: Number, required: true },
  occurredAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Expense", expenseSchema);
