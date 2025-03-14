const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: Number, required: true },
  otpExpires: { 
    type: Date, 
    required: true, 
    expires: 3600 // ✅ Automatically delete after 1 hour (3600 seconds)
  } 
}, { timestamps: true });

const Otp = mongoose.model('Otp', otpSchema);
module.exports = Otp;
