const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    images: [{ type: String, required: true }],
    stock: { type: Number, required: true, default: 0 },
    isListed: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    offerPrice: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
