const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,ref: 'Users',required: true,
    },
    products: [
      {product: {type: mongoose.Schema.Types.ObjectId,ref: 'Product',},
        quantity: {type: Number,required: true,min: 1,},
        price: {type: Number,required: true,},
      },
    ],
    totalAmount: {type: Number,required: true,},
    paymentMethod: {type: String,enum: ['COD', 'Online Payment', 'Wallet'],required: true,},
    paymentStatus: {type: String,enum: ['Pending', 'Completed', 'Failed', 'Refunded'],default: 'Pending',},
    orderStatus: {type: String,enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],default: 'Pending',},
    shippingAddress: {
        userId: {type: mongoose.Schema.Types.ObjectId,ref: 'Users',required: true,},
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
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
