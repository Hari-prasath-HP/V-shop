const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const otpService = require('../services/otpService');
const Category = require('../models/category');
const Product = require('../models/product');
const Otp = require('../models/renderotp');

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
  const { username, email, phone, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.session.signerr = "Email already exists.";
      return res.redirect("/signup");
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = new Date(Date.now() + 1 * 60 * 1000); 
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
    console.log(`✅ New OTP: ${newOtp} sent to ${email}, expires at: ${otpExpires}`);
    res.render("user/verifyOtp", { 
      email, 
      signerr: null, 
      otpExpires: otpExpires.getTime(),
      otpExpired: false 
    });
  } catch (err) {
    console.error("❌ Error in resendOtp:", err);
    res.status(500).send("Server error. Try again later.");
  }
};
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      req.session.signerr = "Email and OTP are required.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }
    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      req.session.signerr = "OTP not found. Please request a new OTP.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }
    if (Date.now() > otpRecord.otpExpires) {
      req.session.signerr = "OTP has expired. Please request a new one.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }
    if (String(otpRecord.otp) !== String(otp)) {
      req.session.signerr = "Invalid OTP. Please try again.";
      return res.redirect(`/verifyOtp?email=${email}`);
    }
    await Otp.deleteOne({ email });
    req.session.signerr = null;
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
      error:null
    });
  } catch (err) {
    console.error("Error during OTP verification:", err);
    req.session.signerr = "An error occurred. Please try again.";
    return res.redirect(`/verifyOtp?email=${email}`);
  }
};
// Render home
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

    // Fetch categories that are not deleted
    const categories = await Category.find({ isDeleted: { $ne: true } });

    // Fetch all products that are not deleted and populate the category
    const products = await Product.find({ isDeleted: { $ne: true } }).populate('category');

    // Function to calculate offer percentage
    const calculateOfferPercentage = (price, offerPrice) => {
      if (price > 0 && offerPrice > 0) {
        return ((price - offerPrice) / price) * 100;
      }
      return 0;
    };

    // Add offer percentage and discounted price to each product
    products.forEach(product => {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
      product.discountedPrice = product.offerPrice > 0 ? product.offerPrice : product.price;
      product.offerPercentage = calculateOfferPercentage(product.price, product.offerPrice);
    });

    // Sort products by offer percentage in descending order and limit to top 4
    const topOfferProducts = products.sort((a, b) => b.offerPercentage - a.offerPercentage).slice(0, 4);

    // Render the homepage with the top offer products
    res.render("user/home", {
      username,
      phone: user ? user.phone : null,
      categories,
      topOfferProducts, // Send the top 4 offer percentage products
      isLoggedIn: !!req.session.user,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    return res.status(500).send("An internal server error occurred");
  }
};
exports.getShopProducts = async (req, res) => {
  try {
    // Fetch all products that are not deleted, and populate category data
    const products = await Product.find({ isDeleted: { $ne: true } })
                                  .populate('category');

    // Process product data, map image paths, calculate offer price and offer percentage
    products.forEach(product => {
      product.imagePaths = product.images.map(image => `/uploads/products/${image}`);
      
      // Calculate offer price if there's an offer percentage
      if (product.offerPrice > 0) {
        const discountPercentage = ((product.price - product.offerPrice) / product.price) * 100;
        product.offerPercentage = discountPercentage.toFixed(2);  // Store the offer percentage
        product.offerPrice = product.offerPrice.toFixed(2);  // Format offer price
      } else {
        product.offerPercentage = 0;  // If no offer, set percentage to 0
        product.offerPrice = product.price.toFixed(2);  // No offer, so set offer price to regular price
      }
    });

    // Get username from session if the user is logged in
    let username = "";
    if (req.session.user) {
      const user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }

    // Render the products page with the products and username
    res.render('user/shopproduct', { products, username });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Server Error');
  }
};
exports.viewProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Fetch product details by ID and populate the category data
    const product = await Product.findById(productId).populate('category');
    if (!product) {
      return res.status(404).send('Product not found');
    }

    // Process image paths to display on the product page
    product.imagePaths = product.images.map(image => `/uploads/products/${image}`);

    // Calculate offer price and offer percentage
    if (product.offerPrice > 0) {
      // Calculate the discount percentage if offerPrice is available
      const discountPercentage = ((product.price - product.offerPrice) / product.price) * 100;
      product.offerPercentage = discountPercentage.toFixed(2);  // Store the offer percentage
      product.offerPrice = product.offerPrice.toFixed(2);  // Format offer price
    } else {
      // If no offer price is provided, set offer percentage to 0 and offer price to regular price
      product.offerPercentage = 0;  // No offer
      product.offerPrice = product.price.toFixed(2);  // Set offer price as regular price
    }

    // If offerPrice is different from regular price, display the offer percentage
    if (product.offerPrice !== product.price.toFixed(2)) {
      product.offerPercentageDisplay = product.offerPercentage + "% OFF";
    }

    // Fetch related products within the same category (excluding the current product)
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId } // Exclude the current product
    }).limit(4); // Limit to 4 related products

    // Process related products: format image paths and calculate offer prices if applicable
    relatedProducts.forEach(relatedProduct => {
      relatedProduct.imagePaths = relatedProduct.images.map(image => `/uploads/products/${image}`);
      // Calculate offer price for related products
      if (relatedProduct.offerPrice > 0) {
        const relatedDiscountPercentage = ((relatedProduct.price - relatedProduct.offerPrice) / relatedProduct.price) * 100;
        relatedProduct.offerPercentage = relatedDiscountPercentage.toFixed(2);  // Store the offer percentage
        relatedProduct.offerPrice = relatedProduct.offerPrice.toFixed(2);  // Format offer price
      } else {
        relatedProduct.offerPercentage = 0;  // If no offer, set percentage to 0
        relatedProduct.offerPrice = relatedProduct.price.toFixed(2);  // No offer, set offer price to regular price
      }
    });

    // Initialize username from the session if the user is logged in
    let username = "";
    if (req.session.user) {
      const user = await User.findOne({ email: req.session.user.email });
      if (user) {
        username = user.username;
      }
    }

    // Render the product detail page with product, related products, and username
    res.render('user/product-detail', { product, username, relatedProducts });
  } catch (err) {
    console.error('Error fetching product details:', err);
    res.status(500).send(`Server Error: ${err.message}`);
  }
};

// logout user
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