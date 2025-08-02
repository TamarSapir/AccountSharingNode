const mongoose = require('mongoose');
const itemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: String,
  quantity: Number,
  price: Number,
  date: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Item', itemSchema);
