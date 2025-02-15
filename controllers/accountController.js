const mongoose = require('mongoose');
const User = require('../models/User');
const Address = require('../models/address');

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