const mongoose = require('mongoose');
const User = require('../models/User');
const Address = require('../models/address');
const Order = require('../models/order');

exports.viewUserDetails = async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.render('user/userdetails', { 
            user: {
                username: user.username,
                phone: user.phone,
                email: user.email
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};
exports.updateUser = async (req, res) => {
    const { username, mobile } = req.body;
    const userId = req.session.user.id;
    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { username, phone: mobile },
            { new: true, runValidators: true }
        );
        if (!user) {
            return res.redirect('/login');
        }
        res.redirect('/userdetails?success=Profile updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong');
    }
};
exports.addAddress = (req, res) => {
    res.render('user/addaddress');
};
exports.saveAddress = async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.redirect('/login')
    }
    const userId = req.session.user.id;
    try {
        const validUserId = new mongoose.Types.ObjectId(userId);
        console.log(validUserId);
        const { name, phone, houseNo, area, city, state, pincode, title } = req.body;
        const newAddress = new Address({
            userId: validUserId,
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
}
exports.getAddresses = async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.redirect('/login');
    }
    try {
        const userId = new mongoose.Types.ObjectId(req.session.user.id);
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
        res.redirect('/addresses');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
exports.getAllOrdersForUser = async (req, res) => {
    try {
        const userId = req.session.user.id; // Get the userId from URL parameters
        const page = parseInt(req.query.page) || 1; // Get current page, default to 1
        const limit = 5; // Number of orders per page
        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);
        if (!userId) {
            return res.redirect('/login')
        }
        // Fetch all orders for the user
        const orders = await Order.find({ user: userId })
            .select('-products') // Exclude products field
            .sort({ orderedAt: -1 }) // Sort latest orders first
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
      const order = await Order.findById(orderId)
      .populate({
        path: 'products.product',   // Ensure the 'product' field inside 'products' array is populated
        model: 'Product',
        select: 'name images price offerPrice'
      }) // Populating the user details
      .populate('user', 'username email')
        .populate('shippingAddress.userId', 'username email') // Populating shipping address user
        .exec();
      if (!order) {
        return res.status(404).render('error', { message: 'Order not found' });
      }
      // Structure the product details correctly with safeguards
      const orderProducts = order.products.map(item => ({
        image: item.product && item.product.images.length > 0 ? item.product.images[0] : '/images/default.jpg', // Use first image or fallback
        name: item.product ? item.product.name : 'Unknown', // Get product name or use fallback
        price: item.price,
        offerPrice: item.offerPrice,
        quantity: item.quantity,
        status:item.status,
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
      res.status(500).render('error', { message: 'Internal Server Error' });
    }
  };
  
  