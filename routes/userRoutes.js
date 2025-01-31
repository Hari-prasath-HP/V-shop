const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
//signup
router.get("/signup", UserController.renderSignup);
router.post('/signup', UserController.handleSignup);
//login
router.get('/login', UserController.renderlogin);
router.post('/login', UserController.handlelogin);

// otp
router.get('/verifyOtp', UserController.renderOtpPage);
router.post("/resendOtp", UserController.resendOtp);
router.post('/verifyOtp', UserController.verifyOtp);

//product
router.get('/', UserController.renderhome);
router.get('/shop', UserController.getShopProducts);
// Route for a single product's detail page
router.get('/product/:id', UserController.viewProduct);

module.exports = router;
