const ProductOffer = require('../models/productoffer');
const CategoryOffer = require('../models/categoryoffer');
const Product = require('../models/product');
const Category = require('../models/category')
const cron = require('node-cron');
const Coupon = require('../models/coupon')

cron.schedule('0 0 * * *', async () => {
    try {
        const currentDate = new Date();

        await ProductOffer.updateMany(
            { endDate: { $lt: currentDate }, status: { $ne: "Inactive" } },
            { $set: { status: "Inactive" } }
        );
        console.log("✅ Expired product offers updated to Inactive.");

        await CategoryOffer.updateMany(
            { endDate: { $lt: currentDate }, status: { $ne: "Inactive" } },
            { $set: { status: "Inactive" } }
        );
        console.log("✅ Expired category offers updated to Inactive.");
    } catch (error) {
        console.error("❌ Error updating expired offers:", error);
    }
});

exports.getProductOffers = async (req, res) => {
    try {
        // Fetch all product offers
        const offers = await ProductOffer.find().populate('product', 'name');

        // Fetch all products to display in the dropdown for adding a new offer
        const products = await Product.find({ isListed: true });

        // Update status if the offer is expired
        const currentDate = new Date();
        for (const offer of offers) {
            if (new Date(offer.endDate) < currentDate && offer.status !== "Inactive") {
                await ProductOffer.findByIdAndUpdate(offer._id, { status: "Inactive" });
            }
        }

        res.render('admin/productOffers', { offers, products });
    } catch (error) {
        console.error("Error fetching product offers:", error);
        res.status(500).send("Server Error");
    }
};
exports.postAddProductOffer = async (req, res) => {
    try {
        console.log("Received Data:", req.body); // Debugging

        const { product, percentage, startDate, endDate } = req.body;
        if (!product) {
            return res.status(400).json({ error: "Product is required" });
        }

        const status = req.body.status || "Active"; // Default status
        const newOffer = new ProductOffer({ product, percentage, startDate, endDate, status });
        await newOffer.save();

        res.redirect('/admin/productoffers');
    } catch (error) {
        console.error("Error adding product offer:", error);
        res.status(500).send("Server Error");
    }
};
exports.postEditProductOffer = async (req, res) => {
    try {
        const { product, percentage, startDate, endDate, status } = req.body;
        await ProductOffer.findByIdAndUpdate(req.params.id, { product, percentage, startDate, endDate, status });
        res.status(200).json({ message: "Offer updated successfully" });
    } catch (error) {
        console.error("Error updating product offer:", error);
        res.status(500).json({ error: "Server Error" });
    }
};
// Get all category offers
exports.getCategoryOffers = async (req, res) => {
    try {
        // Fetch all category offers
        const offers = await CategoryOffer.find().populate('category', 'name');

        // Fetch all categories to display in the dropdown for adding a new offer
        const categories = await Category.find({ isListed: true });

        // Update status if the offer is expired
        const currentDate = new Date();
        for (const offer of offers) {
            if (new Date(offer.endDate) < currentDate && offer.status !== "Inactive") {
                await CategoryOffer.findByIdAndUpdate(offer._id, { status: "Inactive" });
            }
        }

        res.render('admin/categoryoffer', { offers, categories });
    } catch (error) {
        console.error("Error fetching category offers:", error);
        res.status(500).send("Server Error");
    }
};

exports.postAddCategoryOffer = async (req, res) => {
    try {
        console.log("Received Data:", req.body);

        const { category, percentage, startDate, endDate } = req.body;
        if (!category) {
            return res.status(400).json({ error: "Category is required" });
        }

        // Validate if category exists
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ error: "Invalid Category ID" });
        }

        const status = req.body.status || "Active"; // Default status
        const newOffer = new CategoryOffer({ category, percentage, startDate, endDate, status });

        await newOffer.save()
            .then(() => console.log("✅ Category offer added successfully!"))
            .catch(err => console.error("❌ Save error:", err));

        res.redirect('/admin/categoryoffer');
    } catch (error) {
        console.error("Error adding category offer:", error);
        res.status(500).send("Server Error");
    }
};
exports.postEditCategoryOffer = async (req, res) => {
    try {
        console.log("Received edit request:", req.body, req.params); // Debugging

        const { category, percentage, startDate, endDate, status } = req.body;
        const offerId = req.params.id; // Get offer ID from URL

        if (!offerId) {
            return res.status(400).json({ error: "Offer ID is required" });
        }

        await CategoryOffer.findByIdAndUpdate(offerId, {
            category,
            percentage,
            startDate,
            endDate,
            status
        });

        res.redirect('/admin/categoryOffers'); // Correcting the redirect
    } catch (error) {
        console.error("Error updating category offer:", error);
        res.status(500).send("Server Error");
    }
};
// Render coupon management page
exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ isDeleted: false }).sort({ createdAt: -1 });
        res.render('admin/coupon', { coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Add a new coupon
exports.addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minPurchaseAmount, maxDiscount, usageLimit, expiryDate } = req.body;
        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscount,
            usageLimit,
            expiryDate
        });
        await newCoupon.save();
        res.redirect('/coupons')
    } catch (error) {
        console.error('Error adding coupon:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Edit coupon details
exports.editCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, discountType, discountValue, minPurchaseAmount, maxDiscount, usageLimit, expiryDate, isActive } = req.body;
        await Coupon.findByIdAndUpdate(id, {
            code,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscount,
            usageLimit,
            expiryDate,
            isActive
        });
        res.redirect('/admin/coupon');
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Soft delete a coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        await Coupon.findByIdAndUpdate(id, { isDeleted: true });
        res.redirect('/admin/coupon');
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Toggle coupon activation
exports.toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findById(id);
        if (coupon) {
            coupon.isActive = !coupon.isActive;
            await coupon.save();
        }
        res.redirect('/admin/coupon');
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).send('Internal Server Error');
    }
};


