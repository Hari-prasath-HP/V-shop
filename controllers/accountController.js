const mongoose = require('mongoose');
const User = require('../models/User');
const Address = require('../models/address');
const Order = require('../models/order');

exports.viewUserDetails = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        let user;
        if (req.session.user.id) {
            // Normal login
            user = await User.findById(req.session.user.id);
        } else if (req.session.user.googleId) {
            // Google login
            user = await User.findOne({ googleId: req.session.user.googleId });
        }

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('user/userdetails', {
            user: {
                username: user.username || user.name,  // Google users might have `name`
                phone: user.phone || 'N/A',
                email: user.email,
                referralCode: user.referralCode || null,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};
exports.updateUser = async (req, res) => {
    const { username, mobile } = req.body;
    
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        let user;
        if (req.session.user.id) {
            // Normal login
            user = await User.findByIdAndUpdate(
                req.session.user.id,
                { username, phone: mobile },
                { new: true, runValidators: true }
            );
        } else if (req.session.user.googleId) {
            // Google login
            user = await User.findOneAndUpdate(
                { googleId: req.session.user.googleId },
                { username, phone: mobile },
                { new: true, runValidators: true }
            );
        }

        if (!user) {
            return res.redirect('/login');
        }

        res.redirect('/userdetails?success=Profile updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong');
    }
};

// Render Add Address Page
exports.addAddress = (req, res) => {
    res.render('user/addaddress');
};

// Save Address to Database
exports.saveAddress = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        let userId;
        if (req.session.user.id) {
            userId = new mongoose.Types.ObjectId(req.session.user.id);
        } else if (req.session.user.googleId) {
            const user = await User.findOne({ googleId: req.session.user.googleId });
            if (!user) {
                return res.redirect('/login');
            }
            userId = user._id;
        } else {
            return res.redirect('/login');
        }

        const { name, phone, houseNo, area, city, state, pincode, title } = req.body;
        const newAddress = new Address({
            userId,
            name,
            phone,
            houseNo,
            area,
            city,
            state,
            pincode,
            title,
        });

        await newAddress.save();
        res.redirect('/address');
    } catch (error) {
        console.error('Error saving address:', error);
        res.status(500).send('Server error');
    }
};

// Fetch User Addresses
exports.getAddresses = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        let userId;
        if (req.session.user.id) {
            userId = new mongoose.Types.ObjectId(req.session.user.id);
        } else if (req.session.user.googleId) {
            const user = await User.findOne({ googleId: req.session.user.googleId });
            if (!user) {
                return res.redirect('/login');
            }
            userId = user._id;
        } else {
            return res.redirect('/login');
        }

        const addresses = await Address.find({ userId });
        res.render('user/address', { user: req.session.user, addresses });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch addresses. Please try again.' });
    }
};
exports.getEditAddress = async (req, res) => {
    try {
        const address = await Address.findById(req.params.id);
        if (!address) {
            return res.status(404).send('Address not found');
        }
        res.render('user/editAddress', { address });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.updateAddress = async (req, res) => {
    try {
        const { name, phone, houseNo, area, city, state, pincode, title } = req.body;
        const updatedAddress = await Address.findByIdAndUpdate(
            req.params.id,
            { name, phone, houseNo, area, city, state, pincode, title },
            { new: true }
        );
        if (!updatedAddress) {
            return res.status(404).send('Address not found');
        }
        res.redirect('/address');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.setDefaultAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const address = await Address.findById(addressId);
        
        if (!address) {
            return res.status(404).send('Address not found');
        }
        await Address.updateMany({}, { $set: { isDefault: false } });
        address.isDefault = true;
        await address.save();
        res.redirect('/address');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.deleteAddress = async (req, res) => {
    try {
        const address = await Address.findByIdAndDelete(req.params.id);
        if (!address) {
            return res.status(404).send('Address not found');
        }
        res.redirect('/address');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.getAllOrdersForUser = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        let userId;
        if (req.session.user.id) {
            userId = req.session.user.id; // Normal login user ID
        } else if (req.session.user.googleId) {
            const user = await User.findOne({ googleId: req.session.user.googleId });
            if (!user) {
                return res.redirect('/login');
            }
            userId = user._id; // Convert Google user ID to database ID
        } else {
            return res.redirect('/login');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ 
            user: userId, 
            orderStatus: { $ne: "Pending" }  
        })
        .select('-products') 
        .sort({ orderedAt: -1 }) 
        .skip((page - 1) * limit)
        .limit(limit);        

        res.render('user/orders', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).send('Server Error');
    }
};
exports.getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        // Validate if orderId is a valid ObjectId
        if (!orderId || orderId.length !== 24) {
            return res.status(400).render('error', { message: 'Invalid Order ID' });
        }

        const order = await Order.findOne({
            _id: orderId,
            orderStatus: { $ne: "Pending" }
        })
        .populate({
            path: 'products.product',
            model: 'Product',
            select: 'name images price offerPrice'
        })
        .populate('user', 'username email')
        .populate('shippingAddress.userId', 'username email')
        .exec();

        if (!order) {
            return res.status(500).render("user/404");
        }

        const orderProducts = order.products.map(item => ({
            image: item.product && item.product.images.length > 0 
  ? item.product.images[0] 
  : 'https://res.cloudinary.com/your-cloud-name/image/upload/v123456789/default-image.jpg',
            name: item.product ? item.product.name : 'Unknown',
            price: item.price,
            offerPrice: item.offerPrice,
            quantity: item.quantity,
            status: item.status,
            subtotal: item.quantity * (item.offerPrice || item.price),
            productId: item.product ? item.product._id : '',
        }));

        res.render('user/vieworders', {
            orderId: order._id,
            orderedAt: order.orderedAt,
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            grandTotal: order.totalAmount,
            orderStatus: order.orderStatus,
            products: orderProducts,
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render("user/404");
    }
};

  