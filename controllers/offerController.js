const CategoryOffer = require('../models/categoryoffer');
const Product = require('../models/product');
const Category = require('../models/category')
const cron = require('node-cron');
const Coupon = require('../models/coupon')

cron.schedule('0 0 * * *', async () => {
    try {
        const currentDate = new Date();
        await CategoryOffer.updateMany(
            { endDate: { $lt: currentDate }, status: { $ne: "Inactive" } },
            { $set: { status: "Inactive" } }
        );
        console.log("✅ Expired category offers updated to Inactive.");
    } catch (error) {
        console.error("❌ Error updating expired offers:", error);
    }
});
exports.getCategoryOffers = async (req, res) => {
    try {
        const offers = await CategoryOffer.find().populate('category', 'name');
        const categories = await Category.find({ isListed: true });
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
        const { category, percentage, startDate, endDate } = req.body;
        if (!category) {
            return res.status(400).json({ error: "Category is required" });
        }
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(400).json({ error: "Invalid Category ID" });
        }
        const status = req.body.status || "Active"; 
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
        const { category, percentage, startDate, endDate, status } = req.body;
        const offerId = req.params.id;
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

        res.redirect('/admin/categoryOffers');
    } catch (error) {
        console.error("Error updating category offer:", error);
        res.status(500).send("Server Error");
    }
};
exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({ isDeleted: false }).sort({ createdAt: -1 });
        res.render('admin/coupon', { coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Internal Server Error');
    }
};
exports.addCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minPurchaseAmount,  usageLimit, expiryDate, startDate } = req.body;
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: "Coupon code already exists" });
        }
        const newCoupon = new Coupon({
            code,
            discountType,
            discountValue,
            minPurchaseAmount,
            usageLimit,
            startDate,
            expiryDate
        });
        await newCoupon.save();
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error('Error adding coupon:', error);
        res.status(500).render("user/404");
    }
};
exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(req.params)
        const deletedCoupon = await Coupon.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

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


