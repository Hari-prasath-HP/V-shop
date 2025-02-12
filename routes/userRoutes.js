const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const passport = require("passport");
//signup
router.get("/signup", UserController.renderSignup);
router.post('/signup', UserController.handleSignup);
//login
router.get('/login', UserController.renderlogin);
router.post('/login', UserController.handlelogin);
// Google Authentication Routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/auth/google/callback", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  UserController.googleAuthCallback
);
// otp
router.post("/resendOtp", UserController.resendOtp);
router.post('/verifyOtp', UserController.verifyOtp);

//product
router.get('/', UserController.renderhome);
router.get('/shop', UserController.getShopProducts);
router.get('/product/:id', UserController.viewProduct);
router.post('/add-to-cart', UserController.addToCart);
router.get('/cart', UserController.viewCart);
// logout
router.post('/logout', UserController.logout);


module.exports = router;
