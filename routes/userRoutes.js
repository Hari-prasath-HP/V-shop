const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const cartController = require('../controllers/cartController')
const checkUserStatus = require('../middlewares/checkUserStatus');
const passport = require("passport");
const accountController = require("../controllers/accountController")
const wishlistController = require("../controllers/wishlistController")
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
router.get('/', checkUserStatus , UserController.renderhome);
router.get('/shop', checkUserStatus , UserController.getShopProducts);
router.get('/product/:id', checkUserStatus , UserController.viewProduct);
router.post('/add-to-cart', checkUserStatus , cartController.addToCart);
router.get('/cart', checkUserStatus , cartController.viewCart);
router.post('/update-quantity', cartController.updateQuantity);
router.get('/remove/:productId', cartController.removeFromCart);
router.get('/checkout-1', cartController.getCheckoutPage);
router.get('/checkoutaddress', cartController.changeaddress);
router.post('/select-address', cartController.selectAddress);
router.post('/checkout--2', cartController.proceedToPayment);
router.get('/checkout-2',  cartController.getCheckoutPage2);
router.post('/paymentMethod', cartController.savePaymentMethod)
router.get('/ordersummary', cartController.getOrderSummary)
router.post('/apply-coupon', cartController.applyCoupon);
router.get('/remove-coupon',cartController.cancelcoupon);
router.post('/placeorder', cartController.placeOrder)
router.post('/product/cancel', cartController.cancelProduct);
router.post('/verify-payment',cartController.verifyPayment)
router.post('/product/return', cartController.returnProduct);
router.post('/order/cancel/:orderId', cartController.cancelOrder);
router.post('/order/return/:orderId', cartController.returnOrder);
// router.post('/create-order', cartController.orderCreate)

router.get('/userdetails', accountController.viewUserDetails);
router.post('/update-user',accountController.updateUser);
router.get('/add-address', accountController.addAddress);

router.post('/add-address', accountController.saveAddress);
router.get('/address', accountController.getAddresses);
router.get('/edit-address/:id', accountController.getEditAddress);
router.post('/update-address/:id', accountController.updateAddress);
router.get('/delete-address/:id', accountController.deleteAddress);
router.get('/set-default-address/:id', accountController.setDefaultAddress);
router.get('/orders/', accountController.getAllOrdersForUser);
router.get('/order/view/:id',accountController.getOrderDetails)

// Add to wishlist
router.post("/wishlist/add", wishlistController.addToWishlist);
router.post("/wishlist/remove", wishlistController.removeFromWishlist);
router.get("/wishlist/get", wishlistController.getWishlist);
router.get("/wishlist", wishlistController.renderWishlistPage);


// logout
router.post('/logout', UserController.logout);


module.exports = router;
