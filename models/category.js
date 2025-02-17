const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true ,unique: true},
  description: { type: String, required: true },
  image: [{ type: String, required: true }],
  isListed: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
});
const Category = mongoose.model('Category', categorySchema);
module.exports = Category;