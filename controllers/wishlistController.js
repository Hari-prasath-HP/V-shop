const Wishlist = require("../models/wishlist");
const Product = require("../models/product");
const mongoose = require("mongoose");
require('dotenv').config();
const Razorpay = require('razorpay');
const crypto = require("crypto");
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_SECRET  
});
const Wallet = require("../models/wallet");
exports.addToWishlist = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not logged in" });
    }

    try {
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [productId] });
            await wishlist.save();
            return res.json({ success: true, message: "Product added to wishlist", action: "added" });
        }

        const productExists = wishlist.products.some(id => id.toString() === productId);

        if (productExists) {
            wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
            await wishlist.save();
            return res.json({ success: true, message: "Product removed from wishlist", action: "removed" });
        } else {
            wishlist.products.push(productId);
            await wishlist.save();
            return res.json({ success: true, message: "Product added to wishlist", action: "added" });
        }
    } catch (error) {
        console.error("Error toggling wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.removeFromWishlist = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not logged in" });
    }

    try {
        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }
        wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
        await wishlist.save();
        res.redirect(`/wishlist?removed=true`);
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getWishlist = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const wishlist = await Wishlist.findOne({ userId }).populate("products");

        if (!wishlist) {
            return res.json({ success: true, wishlist: [] });
        }

        res.json({
            success: true,
            wishlist: wishlist.products.map(product => ({
                productId: product._id,
                name: product.name,
                image: product.images[0], 
                price: product.price
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.renderWishlistPage = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/login");
        }

        let userId;
        if (req.session.user.id) {
            userId = req.session.user.id; // Regular login user
        } else if (req.session.user.googleId) {
            const user = await User.findOne({ googleId: req.session.user.googleId });
            if (!user) {
                return res.redirect("/login");
            }
            userId = user._id;
        } else {
            return res.redirect("/login");
        }

        const wishlist = await Wishlist.findOne({ userId }).populate("products");

        res.render("user/wishlist", { wishlist: wishlist?.products || [] });
    } catch (error) {
        console.error("Error rendering wishlist page:", error);
        res.status(500).send("Error loading wishlist page");
    }
};
// Add Money to Wallet - Create Razorpay Order
exports.createWalletOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        console.log("Requested Amount:", amount);

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        if (amount > 10000) {
            return res.status(400).json({ success: false, message: "Amount should be less than 10,000" });
        }

        // ✅ Handle both normal login and Google login users
        let userId;
        if (req.session.user?.id) {
            userId = req.session.user.id;
        } else if (req.session.user?.googleId) {
            const user = await User.findOne({ googleId: req.session.user.googleId });
            if (!user) {
                return res.status(401).json({ success: false, message: "User not found" });
            }
            userId = user._id;
        } else {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        console.log("User ID:", userId);

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
            await wallet.save();
        }

        // ✅ Validate `razorpay` is initialized properly
        if (!razorpay) {
            return res.status(500).json({ success: false, message: "Payment gateway is not configured" });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: amount * 100, // Convert to paisa
            currency: "INR",
            receipt: `wallet_${userId.toString().slice(-6)}_${Date.now().toString().slice(-6)}`
        });

        console.log("Razorpay Order:", razorpayOrder);

        return res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Error creating wallet order:", error);
        return res.status(500).json({ message: "Failed to create wallet order" });
    }
};
// Verify Razorpay Payment and Update Wallet
exports.verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        console.log("Received Payment Details:", req.body);

        if (!req.session.user) {
            return res.status(401).json({ message: "User not authenticated." });
        }

        let userId;
        if (req.session.user.id) {
            userId = req.session.user.id;  // Regular login
        } else if (req.session.user.googleId) {
            const user = await User.findOne({ googleId: req.session.user.googleId });
            if (!user) {
                return res.status(404).json({ message: "User not found." });
            }
            userId = user._id;
        } else {
            return res.status(401).json({ message: "Invalid session data." });
        }

        // Verify Razorpay Signature
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Payment verification failed." });
        }

        // Ensure valid amount
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ message: "Invalid payment amount." });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }

        wallet.balance += parsedAmount;
        wallet.transactions.push({
            transactionType: "credit",
            amount: parsedAmount,
            description: "Online Wallet Top-up",
            createdAt: new Date()
        });

        await wallet.save();
        return res.json({ success: true, newBalance: wallet.balance });
    } catch (error) {
        console.error("Error verifying wallet payment:", error);
        return res.status(500).json({ message: "Wallet payment verification failed." });
    }
};