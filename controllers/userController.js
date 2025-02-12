const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const otpService = require('../services/otpService');
const Category = require('../models/category');
const Product = require('../models/product');
const Otp = require('../models/renderotp');
const passport = require("passport");
const Cart = require('../models/Cart'); 
//handle signup
exports.renderSignup = (req, res) => {
  if (req.session.logstate) {
    return res.redirect("/home");
  }
  const error = req.session.signerr || null;
  req.session.signerr = null;
  res.render("user/signup", { error });
}
exports.handleSignup = async (req, res) => {
  const { username, email, phone, password, confirmPassword } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.render("user/signup", { 
            error: "Email already exists", 
            username, 
            email, 
            phone,
            password,
            confirmPassword
        });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = new Date(Date.now() + 1 * 60 * 1000); // Expires in 1 min

    // Store otpExpires in session
    req.session.otpExpires = otpExpires;

    await Otp.findOneAndUpdate(
      { email },
      { otp, otpExpires },
      { upsert: true, new: true }
    );
    await otpService.sendOtp(email, otp);
    console.log(`✅ OTP: ${otp} sent to ${email}, expires at: ${otpExpires}`);
    req.session.signupData = { username, email, phone, password };
    res.render("user/verifyOtp", { 
      email, 
      signerr: null, 
      otpExpires: otpExpires.getTime(),
      otpExpired: false 
    });
  } catch (err) {
    console.error("Error during sign-up:", err);
    req.session.signerr = "An internal server error occurred. Please try again later.";
    return res.redirect("/signup");
  }
};
// Google Authentication Callback
exports.googleAuthCallback = (req, res) => {
  if (req.user) {
    req.session.user = req.user; // Store user in session
    res.redirect("/"); // Redirect to homepage after login
  } else {
    res.redirect("/login");
  }
};

// render login
exports.renderlogin = (req, res) => {
  if (req.session.logstate) {
    return res.redirect("/");
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

// otp verify
exports.renderVerifyOtpPage = (req, res) => {
  const { email } = req.query;

  if (!email) {
    req.session.signerr = "Email is required.";
    return res.redirect('/signup'); 
  }
  res.render('user/verifyOtp', {
    email,
    signerr: req.session.signerr || null,
    otpExpires: req.session.otpExpires || 0,
    otpExpired: false,
  });
};
exports.resendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).send("Email is required");
    }
    const newOtp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = new Date(Date.now() + 1 * 60 * 1000); 
    await Otp.findOneAndUpdate(
      { email },
      { otp: newOtp, otpExpires },
      { upsert: true, new: true }
    );
    await otpService.sendOtp(email, newOtp);
    console.log(`New OTP: ${newOtp} sent to ${email}, expires at: ${otpExpires}`);
    res.render("user/verifyOtp", { 
      email, 
      signerr: null, 
      otpExpires: otpExpires.getTime(),
      otpExpired: false 
    });
  } catch (err) {
    console.error(" Error in resendOtp:", err);
    res.status(500).send("Server error. Try again later.");
  }
};
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.render("user/verifyOtp", {
        email,
        signerr: "Email and OTP are required.",
        otpExpires: req.session.otpExpires ? new Date(req.session.otpExpires) : null 
      });
    }

    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord) {
      return res.render("user/verifyOtp", {
        email,
        signerr: "OTP not found. Please request a new OTP.",
        otpExpires: req.session.otpExpires ? new Date(req.session.otpExpires) : null
      });
    }

    // Store OTP expiration in session if not already set
    req.session.otpExpires = req.session.otpExpires || otpRecord.otpExpires;

    if (Date.now() > new Date(req.session.otpExpires)) {
      return res.render("user/verifyOtp", {
        email,
        signerr: "OTP has expired. Please request a new one.",
        otpExpires: new Date(req.session.otpExpires)
      });
    }

    if (String(otpRecord.otp) !== String(otp)) {
      return res.render("user/verifyOtp", {
        email,
        signerr: "Invalid OTP. Please try again.",
        otpExpires: new Date(req.session.otpExpires) // Convert back to Date
      });
    }

    // OTP is valid, proceed with user registration
    await Otp.deleteOne({ email });
    req.session.otpExpires = null; // Clear session after successful OTP verification

    const { username, phone, password } = req.session.signupData;
    const newUser = new User({
      username,
      email,
      phone,
      password: await bcrypt.hash(password, 10)
    });

    await newUser.save();
    return res.render("user/login", {
      email, 
      loginerr: null,
      error: null
    });

  } catch (err) {
    console.error("Error during OTP verification:", err);
    return res.render("user/verifyOtp", {
      email,
      signerr: "An error occurred. Please try again.",
      otpExpires: req.session.otpExpires ? new Date(req.session.otpExpires) : null
    });
  }
};
// Render home
exports.renderhome = async (req, res) => {
  try {
    let user = req.session.user ||null;
    let username = "";
    if (req.session.user) {
      user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }
    const categories = await Category.find({ isDeleted: { $ne: true } });
    const products = await Product.find({ isDeleted: { $ne: true } }).populate('category');
    const calculateOfferPercentage = (price, offerPrice) => {
      if (price > 0 && offerPrice > 0) {
        return ((price - offerPrice) / price) * 100;
      }
      return 0;
    };
    products.forEach(product => {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
      product.discountedPrice = product.offerPrice > 0 ? product.offerPrice : product.price;
      product.offerPercentage = calculateOfferPercentage(product.price, product.offerPrice);
    });
    const topOfferProducts = products.sort((a, b) => b.offerPercentage - a.offerPercentage).slice(0, 4);
    res.render("user/home", {
      user,
      username,
      phone: user ? user.phone : null,
      categories,
      topOfferProducts, 
      isLoggedIn: !!req.session.user,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    return res.status(500).send("An internal server error occurred");
  }
};
exports.getShopProducts = async (req, res) => {
  try {
    let user = req.session.user ||null;
    let username = "";
    if (req.session.user) {
      const user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }    
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 8;
    const totalProducts = await Product.countDocuments({ isDeleted: { $ne: true } });
    const totalPages = Math.ceil(totalProducts / itemsPerPage);
    const products = await Product.find({ isDeleted: { $ne: true } })
      .skip((currentPage - 1) * itemsPerPage) 
      .limit(itemsPerPage)
      .populate('category');
    products.forEach(product => {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
      if (product.offerPrice > 0) {
        const discountPercentage = ((product.price - product.offerPrice) / product.price) * 100;
        product.offerPercentage = discountPercentage.toFixed(2); 
        product.offerPrice = product.offerPrice.toFixed(2);
      } else {
        product.offerPercentage = 0;
        product.offerPrice = product.price.toFixed(2);
      }
    });
    res.render('user/shopproduct', {
      user,
      products,
      username,
      currentPage,
      totalPages
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Server Error');
  }
};
exports.viewProduct = async (req, res) => {
  let user = req.session.user ||null;
    let username = "";
    if (req.session.user) {
      const user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).send('Product not found');
    }
    product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
    if (product.offerPrice > 0) {
      const discountPercentage = ((product.price - product.offerPrice) / product.price) * 100;
      product.offerPercentage = discountPercentage.toFixed(2); 
      product.offerPrice = product.offerPrice.toFixed(2); 
    } else {
      product.offerPercentage = 0; 
      product.offerPrice = product.price.toFixed(2);  
    }
    if (product.offerPrice !== product.price.toFixed(2)) {
      product.offerPercentageDisplay = product.offerPercentage + "% OFF";
    }
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId } 
    }).limit(4);
    relatedProducts.forEach(relatedProduct => {
      relatedProduct.imagePaths = relatedProduct.images.map(image => `/uploads/products/${image}`);
      if (relatedProduct.offerPrice > 0) {
        const relatedDiscountPercentage = ((relatedProduct.price - relatedProduct.offerPrice) / relatedProduct.price) * 100;
        relatedProduct.offerPercentage = relatedDiscountPercentage.toFixed(2); 
        relatedProduct.offerPrice = relatedProduct.offerPrice.toFixed(2); 
      } else {
        relatedProduct.offerPercentage = 0; 
        relatedProduct.offerPrice = relatedProduct.price.toFixed(2); 
      }
    });
    res.render('user/product-detail', { user, product, username, relatedProducts });
  } catch (err) {
    console.error('Error fetching product details:', err);
    res.status(500).send(`Server Error: ${err.message}`);
  }
};
exports.addToCart = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send('Product not found');
    }
    let cartItem = await Cart.findOne({ userId, productId });
    if (cartItem) {
      cartItem.quantity += parseInt(quantity, 10);
    } else {
      cartItem = new Cart({ userId, productId, quantity });
    }
    await cartItem.save();
    res.redirect('/cart');
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).send('Server Error');
  }
};
exports.viewCart = async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    const userId = req.session.user.id; 
    const cartItems = await Cart.find({ userId }).populate('productId');
    if (!cartItems || cartItems.length === 0) {
      return res.render('user/cart', { cart: [], username: req.session.user.username });
    }
    const cart = cartItems.map(item => ({
      _id: item._id,
      productId: item.productId._id,
      name: item.productId.name,
      description: item.productId.description,
      price: item.productId.price,
      image: item.productId.images[0],
      quantity: item.quantity,
      subtotal: item.quantity * item.productId.price
    }));
    console.log("Processed Cart Data:", cart);
    res.render('user/cart', { cart, username: req.session.user.username });
  } catch (err) {
    console.error('Error viewing cart:', err);
    res.status(500).send('Server Error');
  }
};
exports.logout = (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).send('An error occurred while logging out');
      }
      res.redirect('/');
    });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).send('An error occurred during logout');
  }
};

