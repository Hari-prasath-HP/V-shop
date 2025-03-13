const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,ref: 'User',required: true,
    },
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        offerPrice: { type: Number, required: true },
        status: { 
          type: String, 
          enum: ['Ordered', 'Shipped', 'Delivered', 'Cancelled','Return Pending', 'Returned'], 
          default: 'Ordered' 
        },
        cancellationReason: { type: String, default: null },
        returnReason: { type: String, default: null }
      }
    ],    
    totalAmount: {type: Number,required: true,},
    paymentMethod: {type: String,enum: ['COD', 'Online Payment', 'Wallet'],required: true,},
    paymentStatus: {type: String,enum: ['Pending', 'Completed', 'Failed', 'Refunded'],default: 'Pending',},
    razorpayOrderId: { type: String },  // Razorpay Order ID
    razorpayPaymentId: { type: String },
    orderStatus: {type: String,enum: ['Pending', 'Ordered','Payment Failed', 'Shipped', 'Delivered', 'Cancelled','Return Pending', 'Returned'],default: 'Pending',},
    shippingAddress: {
        userId: {type: mongoose.Schema.Types.ObjectId,ref: 'User',required: true,},
        name: {type: String,required: true,},
        phone: {type: String,required: true,},
        houseNo: {type: String,required: true,},
        area: {type: String,required: true,},
        city: {type: String,required: true,},
        state: {type: String,required: true,},
        pincode: {type: String,required: true,},
        title: {type: String,enum: ['Home', 'Office'],required: true,},},
    orderedAt: {type: Date,default: Date.now,},
    deliveredAt: {type: Date,},
    isCancelled: {type: Boolean,default: false,},
    isReturned: {type: Boolean,default: false,},
    cancellationReason: { type: String, default: null },
    returnReason: { type: String, default: null },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
