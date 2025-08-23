const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: String,
  billContentType: String,
  description: String,
  state: {type: String, default: "Not Paid"},
  items: [
    {
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 },
      lockedBy: { type: mongoose.Schema.Types.ObjectId, default: ""}
    },
  ],
  participants: [
    { id: { type: mongoose.Schema.Types.ObjectId, ref: "User"}, permission: Number },
  ],
  sharedWithUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps : true});

billSchema.index({ _id: 1, "participants.id": 1 }, { unique: true });

module.exports = mongoose.model("Bill", billSchema);
