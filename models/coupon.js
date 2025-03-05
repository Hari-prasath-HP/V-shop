const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true, // Ensures the code is stored in uppercase
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'], // Percentage-based or fixed discount
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  minPurchaseAmount: {
    type: Number,
    default: 0 // Minimum cart value required to apply the coupon
  },
  usageLimit: {
    type: Number,
    default: 1 // Number of times a coupon can be used
  },
  usedCount: {
    type: Number,
    default: 0 // Tracks how many times the coupon has been used
  },
  startDate: { type: Date, required: true },
  expiryDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
