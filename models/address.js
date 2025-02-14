const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true, // Makes this field required
    },
    name: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    houseNo: {
        type: String,
        required: true,
    },
    area: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    pincode: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        enum: ['Home', 'Office'],
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;
