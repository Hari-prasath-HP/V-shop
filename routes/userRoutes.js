const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const cartController = require('../controllers/cartController')
const checkUserStatus = require('../middlewares/checkUserStatus');
const passport = require("passport");
const accountController = require("../controllers/accountController")
const wishlistController = require("../controllers/wishlistController")
const passwordController = require("../controllers/passwordController")
//signup
router.get("/signup", UserController.renderSignup);
router.post('/signup', UserController.handleSignup);
//login
router.get('/login', UserController.renderlogin);
router.post('/login', UserController.handlelogin);
router.get('/forgot-password', passwordController.getforgetpassword)
router.post('/forgot-password', passwordController.postForgetPassword);
router.post("/verify-otp", passwordController.postVerifyOtp);
router.post("/set-new-password", passwordController.setNewPassword);

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
router.post('/update-quantity',checkUserStatus , cartController.updateQuantity);
router.get('/remove/:productId', checkUserStatus ,cartController.removeFromCart);
router.get('/checkout-1',checkUserStatus , cartController.getCheckoutPage);
router.get('/checkoutaddress',checkUserStatus , cartController.changeaddress);
router.post('/select-address',checkUserStatus , cartController.selectAddress);
router.post('/checkout--2', checkUserStatus ,cartController.proceedToPayment);
router.get('/checkout-2', checkUserStatus , cartController.getCheckoutPage2);
router.post('/paymentMethod', cartController.savePaymentMethod)
router.get('/ordersummary', checkUserStatus ,cartController.getOrderSummary)
router.post('/apply-coupon', cartController.applyCoupon);
router.post('/remove-coupon',cartController.cancelCoupon);
router.post('/placeorder', cartController.placeOrder)
router.get('/success', cartController.getSuccessPage);
router.post('/product/cancel', cartController.cancelProduct);
router.post('/verify-payment',cartController.verifyPayment)
router.post('/product/return', cartController.returnProduct);
router.post('/order/cancel/:orderId', cartController.cancelOrder);
router.post('/order/return/:orderId', cartController.returnOrder);
router.get('/wallet', checkUserStatus ,cartController.getWallet);
// router.post('/create-order', cartController.orderCreate)

router.get('/userdetails', checkUserStatus ,accountController.viewUserDetails);
router.post('/update-user',checkUserStatus ,accountController.updateUser);
router.get('/add-address', checkUserStatus ,accountController.addAddress);

router.post('/add-address',checkUserStatus , accountController.saveAddress);
router.get('/address',checkUserStatus , accountController.getAddresses);
router.get('/edit-address/:id', checkUserStatus ,accountController.getEditAddress);
router.post('/update-address/:id',checkUserStatus , accountController.updateAddress);
router.get('/delete-address/:id',checkUserStatus , accountController.deleteAddress);
router.get('/set-default-address/:id',checkUserStatus , accountController.setDefaultAddress);
router.get('/orders/',checkUserStatus , accountController.getAllOrdersForUser);
router.get('/order/view/:id',checkUserStatus ,accountController.getOrderDetails)

// Add to wishlist
router.post("/wishlist/add", checkUserStatus ,wishlistController.addToWishlist);
router.post("/wishlist/remove", checkUserStatus ,wishlistController.removeFromWishlist);
router.get("/wishlist/get",checkUserStatus , wishlistController.getWishlist);
router.get("/wishlist", wishlistController.renderWishlistPage);

router.post("/wallet/add",wishlistController.createWalletOrder);
router.post("/wallet/verify-payment",wishlistController.verifyWalletPayment);
router.get("/download-invoice/:orderId",UserController.getInvoice)
// logout
router.post('/logout', UserController.logout);


module.exports = router;
