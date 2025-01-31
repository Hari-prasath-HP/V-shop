const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

// Route to render the signup page
router.get("/signup", UserController.renderSignup);

// Route for handling sign-up (user registration)
router.post('/signup', UserController.handleSignup);

// Route for handling login-up (user registration)
router.get('/login', UserController.renderlogin);

// Route for handling login-up (user registration)
router.post('/login', UserController.handlelogin);

// Route to render OTP page (for OTP input)
router.get('/verifyOtp', UserController.renderOtpPage);

// Route for verifying OTP after signup
router.post('/verifyOtp', UserController.verifyOtp);

router.get('/home', UserController.renderhome);

module.exports = router;
