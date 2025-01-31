const mongoose = require('mongoose');

// Define the User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  isBlocked: { type: Boolean, default: false },
}, { timestamps: true });

// Create the User model
const User = mongoose.model('User', userSchema);

module.exports = User;
