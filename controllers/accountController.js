const mongoose = require('mongoose');
const User = require('../models/User'); // Adjust the path to your User model
const Address = require('../models/address');

exports.viewUserDetails = async (req, res) => {
    // Check if user is authenticated
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        // Retrieve user details from the database using the user ID stored in the session
        const user = await User.findById(req.session.user.id);

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Render the user details page with the user's name, mobile number, and email
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
// Update user profile
exports.updateUser = async (req, res) => {
    const { username, mobile } = req.body;

    // Get the user ID from the session (assuming user is logged in and session is being used)
    const userId = req.session.user.id;

    try {
        // Find the user by ID and update the fields
        const user = await User.findByIdAndUpdate(
            userId,
            { username, phone: mobile },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).send('User not found');
        }

        // Redirect to the user profile page with a success message
        res.redirect('/userdetails?success=Profile updated successfully');
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong');
    }
};
// Add Address Functionality
exports.addAddress = (req, res) => {
    res.render('user/addaddress');
};
exports.saveAddress = async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(400).send('User not logged in or session expired');
    }
    const userId = req.session.user.id;

    try {
        const validUserId = new mongoose.Types.ObjectId(userId);
        console.log(validUserId);
        const { name, phone, houseNo, area, city, state, pincode, title } = req.body;

        // Create a new Address instance
        const newAddress = new Address({
            userId: validUserId, // Ensure userId is stored as an ObjectId
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
        res.redirect('/address'); // Redirect after successful save
    } catch (error) {
        console.error('Error saving address:', error);
        res.status(500).send('Server error');
    }
}
exports.getAddresses = async (req, res) => {
    if (!req.session.user || !req.session.user.id) {
        return res.status(400).json({ success: false, message: 'User not logged in or session expired' });
    }

    try {
        const userId = new mongoose.Types.ObjectId(req.session.user.id);

        // Fetch all addresses for the logged-in user
        const addresses = await Address.find({ userId });

        // Pass addresses correctly to the view
        res.render('user/address', { user: req.session.user, addresses });
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch addresses. Please try again.' });
    }
};// GET request for editing address
exports.getEditAddress = async (req, res) => {
    try {
        // Find the address by ID from the URL parameter
        const address = await Address.findById(req.params.id);
        
        if (!address) {
            return res.status(404).send('Address not found');
        }

        // Render the address edit form with the current address data
        res.render('user/editAddress', { address });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// POST request to update the address
exports.updateAddress = async (req, res) => {
    try {
        const { name, phone, houseNo, area, city, state, pincode, title } = req.body;

        // Find the address by ID and update the details
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
        await Address.updateMany({}, { $set: { isDefault: false } }); // Reset all addresses to non-default
        address.isDefault = true; // Set the current address to default
        await address.save();
        res.redirect('/address'); // Adjust according to your route for displaying addresses
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};
// DELETE request to delete an address
exports.deleteAddress = async (req, res) => {
    try {
        // Find the address by ID and delete it
        const address = await Address.findByIdAndDelete(req.params.id);

        if (!address) {
            return res.status(404).send('Address not found');
        }

        // Redirect to the user's address list page or another page after deletion
        res.redirect('/addresses'); // Adjust according to your route for displaying addresses
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};