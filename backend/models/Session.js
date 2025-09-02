// backend/models/Session.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SessionSchema = new Schema(
  {
    room: { type: String, required: true },               // e.g., "R-1"
    customerName: { type: String, required: true },       // simple name (string) for now
    serviceName: { type: String, required: true },        // e.g., "Swedish Massage"
    therapistName: { type: String, required: true },      // e.g., "Sara"
    startTime: { type: Date, required: true },
    endTime:   { type: Date, required: true },
    status: { type: String, enum: ["active","finished","cancelled"], default: "active", index: true }
  },
  { timestamps: true }
);

SessionSchema.index({ status: 1, endTime: 1 });

module.exports = mongoose.model("Session", SessionSchema);
