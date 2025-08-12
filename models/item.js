const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true }, 
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:      { type: String, required: true, trim: true },
    quantity:  { type: Number, required: true, default: 1, min: 1 },
    price:     { type: Number, required: true, min: 0 },
    date:      { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ItemSchema.index({ sessionId: 1, _id: 1 });

module.exports = mongoose.model('Item', ItemSchema);
