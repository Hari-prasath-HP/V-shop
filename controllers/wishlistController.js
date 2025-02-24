const Wishlist = require("../models/wishlist");
const Product = require("../models/product");
const mongoose = require("mongoose");

exports.addToWishlist = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user?.id; // Ensure session exists

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not logged in" });
    }

    try {
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            // If no wishlist exists, create a new one with the product
            wishlist = new Wishlist({ userId, products: [productId] });
            await wishlist.save();
            return res.json({ success: true, message: "Product added to wishlist", action: "added" });
        }

        const productExists = wishlist.products.some(id => id.toString() === productId);

        if (productExists) {
            // Remove product from wishlist if it already exists
            wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
            await wishlist.save();
            return res.json({ success: true, message: "Product removed from wishlist", action: "removed" });
        } else {
            // Add product to wishlist
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
    const userId = req.session.user?.id; // Use optional chaining to avoid errors

    if (!userId) {
        return res.status(401).json({ success: false, message: "User not logged in" });
    }

    try {
        const wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        // Remove the product from wishlist
        wishlist.products = wishlist.products.filter(id => id.toString() !== productId);
        await wishlist.save();

        // Redirect with a query parameter to trigger success alert on the frontend
        res.redirect(`/wishlist?removed=true`);
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
exports.getWishlist = async (req, res) => {
    try {
        const userId = req.session.user?.id; // Ensure session exists
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
                image: product.images[0], // Assuming images array
                price: product.price
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.renderWishlistPage = async (req, res) => {
    const userId = req.session.user.id;

    if (!userId) {
        return res.redirect("/login");
    }

    try {
        const wishlist = await Wishlist.findOne({ userId }).populate("products");
        res.render("user/wishlist", { wishlist: wishlist ? wishlist.products : [] });
    } catch (error) {
        console.error("Error rendering wishlist page:", error);
        res.status(500).send("Error loading wishlist page");
    }
};
