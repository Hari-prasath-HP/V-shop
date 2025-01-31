const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // For generating random OTPs
const User = require('../models/User');
const otpService = require('../services/otpService'); // OTP sending logic (email/sms)
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

/// Handle sign-up page
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
    // Store OTP and the creation time
const otpData = {
  otp: otp,
  createdAt: Date.now()  // Store the current time in milliseconds
};

// Simulate a check after some time (e.g., after 1 minute)
setTimeout(() => {
  const isExpired = Date.now() - otpData.createdAt > 120000;  // 2 minutes

  if (isExpired) {
    console.log('OTP has expired.');
  } else {
    console.log('OTP is valid.');
  }
}, 60000);  // 1 minute wait before checking
    // Temporarily store the user data and OTP in the session
    req.session.tempUser = {
      username,
      email,
      phone,
      password,
      otp, // Store OTP temporarily in session
    };
    // Send OTP to the user's email or phone
    await otpService.sendOtp(email, otp); // Replace with actual email/sms OTP logic
    // Render the OTP page
    res.render("user/verifyOtp", { email, signerr: null });
  } catch (err) {
    console.error("Error during sign-up:", err);
    // Handle unexpected errors
    req.session.signerr = "An internal server error occurred. Please try again later.";
    return res.redirect("/signup");
  }
};

// Render sign-up page
exports.renderlogin = (req, res) => {
  if (req.session.logstate) {
    return res.redirect("/home");
  }
  const loginError = req.session.loginerr || null;
  req.session.signerr = null;
  res.render("user/login", { error: loginError });
}

// handlelogin method in your controller
exports.handlelogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('Searching for user with email:', email); // Debugging statement

    const user = await User.findOne({ email });

    // Check if user is found
    if (!user) {
      console.log('User not found in the database'); // Debugging statement
      req.session.loginerr = 'Invalid email or password';
      return res.redirect('/login'); // Redirect with error
    }

    // Check if user is blocked
    if (user.isBlocked) {
      req.session.loginerr = 'Your account has been blocked by the admin.';
      return res.redirect('/login'); // Redirect with error
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.session.loginerr = 'Invalid email or password';
      return res.redirect('/login'); // Redirect with error
    }

    // Set session details if successful
    req.session.user = { 
      id: user._id,
      email: user.email // Store email in session
    };
    req.session.logstate = true;
    return res.redirect('/home'); // Redirect to home page

  } catch (err) {
    console.error('Error during login:', err);
    req.session.loginerr = 'An internal server error occurred. Please try again later.';
    return res.redirect('/login');
  }
};


// Render OTP page
exports.renderOtpPage = (req, res) => {
  const email = req.query.email; // Get the email from the query string
  // Get the error message from session if it exists
  const signerr = req.session.signerr || null;
  // Clear the error message after rendering the page
  delete req.session.signerr;
  // Pass the email and error to the view
  res.render("user/verifyOtp", { email, signerr });
};
// Handle OTP verification
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    // Check if temporary user data exists in the session
    const tempUser = req.session.tempUser;
    if (!tempUser) {
      req.session.signerr = "Session expired. Please sign up again.";
      return res.redirect("/signup");
    }
    // Convert both OTPs to strings and trim any extra spaces
    const storedOtp = tempUser.otp.toString().trim();
    const receivedOtp = otp.trim();
    // Validate OTP
    if (storedOtp === receivedOtp) {
      // Hash the password and create a new user
      const hashedPassword = await bcrypt.hash(tempUser.password, 10);
      const newUser = new User({
        username: tempUser.username,
        email: tempUser.email,
        phone: tempUser.phone,
        password: hashedPassword,
      });
      await newUser.save();
      // After OTP verification, store the user details in the session
      req.session.user = {
      email: tempUser.email,
      username: tempUser.username,
      phone: tempUser.phone
      };

      // Clear the temporary user session data
      delete req.session.tempUser;


      return res.redirect("/home");
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
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const user = await User.findOne({ email: req.session.user.email });
    

    if (!user) {
      return res.status(400).send('User not found in the database');
    }

    // Fetch categories (excluding soft-deleted ones)
    const categories = await Category.find({ isDeleted: { $ne: true } });

    // Fetch products (excluding soft-deleted ones), sorted by offer percentage
    const products = await Product.find({ isDeleted: { $ne: true } }).populate('category');
    res.render('user/home', {
      username: user.username,
      phone: user.phone,
      categories,  // Pass categories to view
      products,     // Pass products to view
      imageUrl: '/uploads/categories/' // Base URL for category images
    });
  } catch (err) {
    console.error('Error fetching user data:', err);
    return res.status(500).send('An internal server error occurred');
  }
};





