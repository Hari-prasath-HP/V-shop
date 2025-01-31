const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const otpService = require('../services/otpService');
const Category = require('../models/category');
const Product = require('../models/product');

// Render sign-up page
exports.renderSignup = (req, res) => {
  if (req.session.logstate) {
    return res.redirect("/home");
  }
  const error = req.session.signerr || null;
  req.session.signerr = null;
  res.render("user/signup", { error });
}
 // Handle sign-up page
exports.handleSignup = async (req, res) => {
  const { username, email, phone, password } = req.body;

  try {
    // Check if email already exists in the database
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.session.signerr = "Email already exists.";
      return res.redirect("/signup");
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit OTP
    const otpExpires = new Date(Date.now() + 2 * 60 * 1000); // OTP expires in 2 minutes

    // Store OTP in the Otp collection in the database
    const otpData = new Otp({
      email,
      otp,
      otpExpires,
    });

    await otpData.save(); // Save OTP in the database

    // Send OTP to the user's email (or phone via SMS)
    await otpService.sendOtp(email, otp);

    // Render the OTP verification page
    res.render("user/verifyOtp", { 
      email, 
      signerr: null, 
      otpExpires: otpExpires,
      otpExpired: false 
    });
  } catch (err) {
    console.error("Error during sign-up:", err);
    req.session.signerr = "An internal server error occurred. Please try again later.";
    return res.redirect("/signup");
  }
};

exports.renderlogin = (req, res) => {
  if (req.session.logstate) {
    return res.redirect("/home");
  }
  const loginError = req.session.loginerr || null;
  req.session.signerr = null;
  res.render("user/login", { error: loginError });
}

exports.handlelogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      req.session.loginerr = 'Invalid email or password';
      return res.redirect('/login');
    }
    if (user.isBlocked) {
      req.session.loginerr = 'Your account has been blocked by the admin.';
      return res.redirect('/login');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.session.loginerr = 'Invalid email or password';
      return res.redirect('/login');
    }
    req.session.user = { 
      id: user._id,
      email: user.email
    };
    req.session.logstate = true;
    return res.redirect('/');

  } catch (err) {
    console.error('Error during login:', err);
    req.session.loginerr = 'An internal server error occurred. Please try again later.';
    return res.redirect('/login');
  }
};


exports.renderOtpPage = (req, res) => {
  const email = req.query.email; 
  const signerr = req.session.signerr || null;
  delete req.session.signerr;
  const otpExpires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
  res.render("user/verifyOtp", { 
    email, 
    signerr, 
    otpExpires: otpExpires.getTime()
  });
};

// Route to handle OTP resend
exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Generate a new OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = new Date(Date.now() + 2 * 60 * 1000); // OTP expires in 2 minutes

    // Update the OTP and expiration time in the user's record
    user.otp = otp;
    user.otpExpires = otpExpires;

    // Save the updated user record
    await user.save();

    // Send the OTP to the user via email or SMS
    await otpService.sendOtp(user.email, otp); // Implement the actual OTP sending service

    return res.status(200).json({ success: true, message: 'OTP has been resent' });

  } catch (error) {
    console.error('Error during OTP resend:', error);
    return res.status(500).json({ success: false, message: 'An error occurred while resending OTP. Please try again.' });
  }
};

// Handle OTP verification
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Find the OTP data in the database based on the email
    const otpData = await Otp.findOne({ email });

    if (!otpData) {
      req.session.signerr = "OTP data not found. Please request a new OTP.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }

    // Check if OTP is expired
    if (otpData.otpExpires < Date.now()) {
      req.session.signerr = "OTP has expired. Please request a new one.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }

    // Validate OTP
    if (otpData.otp === parseInt(otp)) {
      // OTP is valid, hash the password and create a new user
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const newUser = new User({
        username: req.body.username,
        email,
        phone: req.body.phone,
        password: hashedPassword,
      });

      await newUser.save(); // Save the new user to the database

      // Clear OTP data after successful verification
      await Otp.deleteOne({ email }); // Remove OTP data from the database

      req.session.user = {
        email: newUser.email,
        username: newUser.username,
        phone: newUser.phone,
      };

      return res.redirect("/home"); // Redirect to home after successful signup
    } else {
      req.session.signerr = "Invalid OTP. Please try again.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }
  } catch (err) {
    console.error("Error during OTP verification:", err);
    req.session.signerr = "An error occurred. Please try again.";
    return res.redirect(`/verifyOtp?email=${email}`);
  }
};
exports.renderhome = async (req, res) => {
  try {
    let user = null;
    let username = "";
    if (req.session.user) {
      user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }
    const categories = await Category.find({ isDeleted: { $ne: true } });
    const products = await Product.find({ isDeleted: { $ne: true } }).populate('category');
    products.forEach(product => {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
    });
    res.render("user/home", {
      username, 
      phone: user ? user.phone : null,
      categories,
      products,
      isLoggedIn: !!req.session.user,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    return res.status(500).send("An internal server error occurred");
  }
};
exports.getShopProducts = async (req, res) => {
  try {
    const products = await Product.find({ isDeleted: { $ne: true } }).populate('category');
    products.forEach(product => {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
    });
    let user = null;
    let username = "";
    if (req.session.user) {
      user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }
      res.render('user/shopproduct', { products ,username });
  } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).send('Server Error');
  }
};
exports.viewProduct = async (req, res) => {
  try {
    const productId = req.params.id; // Get the product ID from the URL
    const product = await Product.findById(productId).populate('category'); // Fetch the product and populate category

    // Ensure that image paths are properly formatted
    if (product) {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
    }

    // Get the username from the session if the user is logged in
    let username = "";
    if (req.session.user) {
      const user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }

    // Render the product detail page
    res.render('user/product-detail', { product, username });
  } catch (err) {
    console.error('Error fetching product details:', err);
    res.status(500).send('Server Error');
  }
};







