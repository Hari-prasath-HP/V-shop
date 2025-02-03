const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const googleAuthController = require('../controllers/googleAuthController');
//signup
router.get("/signup", UserController.renderSignup);
router.post('/signup', UserController.handleSignup);
//login
router.get('/login', UserController.renderlogin);
router.post('/login', UserController.handlelogin);

// otp
router.post("/resendOtp", UserController.resendOtp);
router.post('/verifyOtp', UserController.verifyOtp);

//product
router.get('/', UserController.renderhome);
router.get('/shop', UserController.getShopProducts);
router.get('/product/:id', UserController.viewProduct);
// Google authentication route
router.post('/google', googleAuthController.googleLogin);
// logout
router.post('/logout', UserController.logout);


module.exports = router;
