// models/Category.js
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Store a single image filename
  isListed: { type: Boolean, default: true }, // true means listed, false means unlisted
  isDeleted: { type: Boolean, default: false }, // Default value is false (not deleted)
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
