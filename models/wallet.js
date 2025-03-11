const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    balance: { 
        type: Number, 
        required: true, 
        default: 0 
    },
    transactions: [
        {
            transactionType: { 
                type: String, 
                enum: ['credit', 'debit'], 
                required: true 
            },
            amount: { 
                type: Number, 
                required: true 
            },
            description: { 
                type: String, 
                enum: ['cancel', 'return', 'online_added', 'placed_using_wallet','referred'], 
                required: true 
            },
            orderId: {  // 🔹 Added this field to link transactions to orders
                type: mongoose.Schema.Types.ObjectId, 
                ref: 'Order',
                required: function() { return this.description === 'cancel' || this.description === 'return'; } // Required for returns/cancellations
            },
            createdAt: { 
                type: Date, 
                default: Date.now 
            }
        }
    ]
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
