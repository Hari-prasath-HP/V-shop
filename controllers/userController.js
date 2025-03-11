const bcrypt = require('bcryptjs');
const User = require('../models/User');
const otpService = require('../services/otpService');
const Category = require('../models/category');
const Product = require('../models/product');
const Otp = require('../models/renderotp');
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');
const Order = require('../models/order');
const crypto = require("crypto");
const Wallet = require("../models/wallet");
exports.renderSignup = (req, res) => {
  if (req.session.logstate) {
    return res.redirect("/home");
  }
  const error = req.session.signerr || null;
  req.session.signerr = null;
  res.render("user/signup", { error });
}
exports.handleSignup = async (req, res) => {
  const { username, email, phone, password, confirmPassword, referralCode } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", {
        error: "Email already exists",
        username,
        email,
        phone,
        password,
        confirmPassword,
        referralCode
      });
    }

    // ✅ Generate referral code for the new user
    const generatedReferralCode = `${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    let referredByUser = null;

    // ✅ If a referral code is entered, check if it exists
    if (referralCode) {
      referredByUser = await User.findOne({ referralCode });

      if (!referredByUser) {
        return res.render("user/signup", {
          error: "Invalid referral code",
          username,
          email,
          phone,
          password,
          confirmPassword,
          referralCode
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpires = new Date(Date.now() + 1 * 60 * 1000);
    req.session.otpExpires = otpExpires;

    await Otp.findOneAndUpdate(
      { email },
      { otp, otpExpires },
      { upsert: true, new: true }
    );

    await otpService.sendOtp(email, otp);
    console.log(`✅ OTP: ${otp} sent to ${email}, expires at: ${otpExpires}`);

    // ✅ Store signup data and referral details in session
    req.session.signupData = { username, email, phone, password, generatedReferralCode, referredByUser };

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
exports.googleAuthCallback = (req, res) => {
  if (req.user) {
    req.session.user = req.user;
    res.redirect("/"); 
  } else {
    res.redirect("/login");
  }
};
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
        otpExpires: new Date(req.session.otpExpires) 
      });
    }

    await Otp.deleteOne({ email });
    req.session.otpExpires = null;

    const { username, phone, password, generatedReferralCode, referredByUser } = req.session.signupData;

    const newUser = new User({
      username,
      email,
      phone,
      password: await bcrypt.hash(password, 10),
      referralCode: generatedReferralCode
    });

    await newUser.save();

    // ✅ Create a wallet for the new user
    const newWallet = new Wallet({
      userId: newUser._id,
      balance: 0,
      transactions: []
    });

    await newWallet.save();

    // ✅ If referred by someone, credit 100 to their wallet
    if (referredByUser) {
      const referrerWallet = await Wallet.findOne({ userId: referredByUser._id });

      if (referrerWallet) {
        referrerWallet.balance += 150;
        referrerWallet.transactions.push({
          transactionType: "credit",
          amount: 100,
          description: "referred"
        });

        await referrerWallet.save();
      }
    }

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

exports.renderhome = async (req, res) => {
  try {
    let user = req.user || null;
    let username = user ? user.username : "";

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
      product.quantityValue = product.quantity.value;
      product.quantityUnit = product.quantity.unit;
    });

    const topOfferProducts = products.sort((a, b) => b.offerPercentage - a.offerPercentage).slice(0, 4);

    res.render("user/home", {
      user,
      username,
      phone: user ? user.phone : null,
      categories,
      topOfferProducts,
      isLoggedIn: !!user,
    });
  } catch (err) {
    console.error("Error fetching user data:", err);
    return res.status(500).send("An internal server error occurred");
  }
};
exports.getShopProducts = async (req, res) => {
  try {
    let user = req.session.user || null;
    let username = "";

    if (req.session.user) {
      const userData = await User.findOne({ email: req.session.user.email });
      if (userData) {
        username = userData.username;
      }
    }

    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 8;
    const searchQuery = req.query.search || "";
    const sortOption = req.query.sort || "";
    const categoryFilter = req.query.category || "";
    const minPrice = Number.isNaN(parseInt(req.query.minPrice)) ? 0 : parseInt(req.query.minPrice);
    const maxPrice = Number.isNaN(parseInt(req.query.maxPrice)) ? 1000 : parseInt(req.query.maxPrice);
    const sortOptions = {
      "low-high": { offerPrice: 1 },
      "high-low": { offerPrice: -1 },
      "a-z": { name: 1 },
      "z-a": { name: -1 },
      "new-arrivals": { createdAt: -1 },
    };
    const sortCriteria = sortOptions[sortOption] || {};
    let searchFilter = { isDeleted: { $ne: true } };

    if (searchQuery) {
      searchFilter.name = { $regex: searchQuery, $options: "i" };
    }
    if (categoryFilter && categoryFilter !== "all") {
      searchFilter.category = new mongoose.Types.ObjectId(categoryFilter);
    }
    searchFilter.offerPrice = { $gte: minPrice, $lte: maxPrice };
    const totalProducts = await Product.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalProducts / itemsPerPage);
    const products = await Product.find(searchFilter)
      .sort(sortCriteria)
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .populate("category");
    products.forEach((product) => {
      product.imagePaths = product.images.map((image) => `/uploads/products/${image}`);
      
      if (product.offerPrice > 0) {
        const discountPercentage = ((product.price - product.offerPrice) / product.price) * 100;
        product.offerPercentage = parseFloat(discountPercentage.toFixed(2));
        product.offerPrice = parseFloat(product.offerPrice.toFixed(2));
      } else {
        product.offerPercentage = 0;
        product.offerPrice = parseFloat(product.price.toFixed(2));
      }

      product.quantity = product.stock;
      product.unit = product.unit || "Unit";
    });
    const categories = await Category.find({});
    res.render("user/shopproduct", {
      user,
      username,
      products,
      categories,
      currentPage,
      totalPages,
      searchQuery,
      sortOption,
      categoryFilter,
      minPrice,
      maxPrice,
    });

  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).send("Server Error");
  }
};
exports.viewProduct = async (req, res) => {
  let user = req.session.user || null;
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
    product.quantity = product.stock; 
    product.unit = product.unit || 'Unit'; 
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: productId }
    }).limit(3);
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
      relatedProduct.quantity = relatedProduct.stock;
      relatedProduct.unit = relatedProduct.unit || 'Unit';
    });
    let errorMessage = req.session.errorMessage;
    req.session.errorMessage = null; 

    res.render('user/product-detail', { user, product, username, relatedProducts , errorMessage});
  } catch (err) {
    console.error('Error fetching product details:', err);
    res.status(500).send(`Server Error: ${err.message}`);
  }
};
const invoicesDir = path.join(__dirname, '../invoices');
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
}
const fonts = {
  Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
  }
};
const printer = new PdfPrinter(fonts);
exports.getInvoice = async (req, res) => {
  try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId).populate('products.product');

      if (!order) {
          return res.status(404).send('Order not found');
      }

      const totalProductPrice = order.products.reduce((total, item) => total + item.quantity * item.product.offerPrice, 0);
      const discountAmount = totalProductPrice - order.totalAmount;

      const tableHeaders = [
          { text: 'Product Name', style: 'tableHeader' },
          { text: 'Quantity', style: 'tableHeader' },
          { text: 'Price', style: 'tableHeader' }
      ];

      const tableRows = order.products.map((item) => [
          { text: item.product.name, style: 'tableBody' },
          { text: item.quantity.toString(), style: 'tableBody' },
          { text: `${(item.quantity * item.product.offerPrice).toFixed(2)}`, style: 'tableBody' }
      ]);

      const docDefinition = {
          content: [
              { text: 'V-Shop', style: 'header', alignment: 'center' },
              { text: '--------------------------------------', alignment: 'center' },

              {
                  columns: [
                      [
                          { text: `Order ID: ${order._id}`, style: 'subHeader' },
                          { text: `Order Date: ${new Date(order.orderedAt).toLocaleDateString()}`, style: 'subHeader' },
                          { text: `Order Status: ${order.orderStatus}`, style: 'subHeader' },
                          { text: `Payment Status: ${order.paymentStatus}`, style: 'subHeader' },
                          { text: `Payment Method: ${order.paymentMethod}`, style: 'subHeader' }
                      ],
                      [
                          { text: 'Shipping Address:', style: 'subHeader', alignment: 'right' },
                          { text: `${order.shippingAddress.name}`, style: 'boldText', alignment: 'right' },
                          { text: `${order.shippingAddress.houseNo}, ${order.shippingAddress.area}`, style: 'addressText', alignment: 'right' },
                          { text: `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}`, style: 'addressText', alignment: 'right' },
                          { text: `Phone: ${order.shippingAddress.phone}`, style: 'addressText', alignment: 'right' }
                      ]
                  ]
              },

              { text: '\nInvoice Details\n', style: 'invoiceTitle', alignment: 'center' },

              {
                  table: {
                      widths: ['50%', '25%', '25%'],
                      body: [tableHeaders, ...tableRows]
                  },
                  layout: 'lightHorizontalLines'
              },

              { text: '\n' },
              {
                  table: {
                      widths: ['50%', '50%'],
                      body: [
                          [{ text: 'Total Product Price', style: 'summaryHeader' }, { text: `${totalProductPrice.toFixed(2)}`, style: 'summaryBody', alignment: 'right' }],
                          [{ text: 'Discount Amount', style: 'summaryHeader' }, { text: `${discountAmount.toFixed(2)}`, style: 'summaryBody', alignment: 'right', color: 'red' }],
                          [{ text: 'Grand Total', style: 'summaryHeader' }, { text: `${order.totalAmount.toFixed(2)}`, style: 'summaryBody', alignment: 'right', bold: true }]
                      ]
                  },
                  layout: 'headerLineOnly'
              }
          ],

          defaultStyle: { font: 'Helvetica' },

          styles: {
              header: { fontSize: 20, bold: true },
              subHeader: { fontSize: 12, margin: [0, 5, 0, 2] },
              invoiceTitle: { fontSize: 16, bold: true, margin: [0, 10, 0, 10] },
              boldText: { fontSize: 12, bold: true, margin: [0, 2, 0, 2] },
              addressText: { fontSize: 11, margin: [0, 2, 0, 2] },
              tableHeader: { bold: true, fillColor: '#eeeeee', margin: [5, 5, 5, 5] },
              tableBody: { margin: [5, 5, 5, 5] },
              summaryHeader: { fontSize: 12, bold: true, margin: [5, 5, 5, 5] },
              summaryBody: { fontSize: 12, margin: [5, 5, 5, 5] }
          }
      };
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const filePath = path.join(invoicesDir, `invoice_${orderId}.pdf`);
      const writeStream = fs.createWriteStream(filePath);

      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      writeStream.on('finish', () => {
          res.download(filePath, `invoice_${orderId}.pdf`, (err) => {
              if (err) console.log(err);
              fs.unlinkSync(filePath); 
          });
      });

  } catch (error) {
      console.error(error);
      res.status(500).send('Error generating invoice');
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

