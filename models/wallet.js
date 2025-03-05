const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Users', 
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
                required: true 
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
