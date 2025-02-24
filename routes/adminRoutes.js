const express = require('express');
const adminrouter = express.Router();
const adminController = require('../controllers/adminController');
const { productUpload} = require('../config/multerConfig');
const { categoryUpload } = require('../config/multerConfig');
const { adminAuth } = require("../middlewares/authMiddleware");
const offerController = require("../controllers/offerController")
// Admin Login Route
adminrouter.get('/login', adminController.loginPage);
adminrouter.post('/login', adminController.login); 
// Apply adminAuth to all routes except login
adminrouter.use(adminAuth);
// Admin Dashboard
adminrouter.get('/dashboard', adminController.dashboardPage);

// User management
adminrouter.get('/users', adminController.manageUsersPage);
adminrouter.post("/admin/adduser",adminController.addUser)
adminrouter.get('/deleteUser/:id', adminController.handleDelete);
adminrouter.get('/blockUser/:id', adminController.handleBlock);
adminrouter.get('/unblockUser/:id', adminController.handleUnblock);

// Category management
adminrouter.get('/categories', adminController.manageCategoryPage);
adminrouter.get('/addCategory', adminController.addCategoryPage);
adminrouter.post('/add',categoryUpload, adminController.addCategory);
adminrouter.get('/editCategory/:id', adminController.editCategoryPage);
adminrouter.post('/editCategory/:id', categoryUpload,adminController.updateCategory);
adminrouter.get('/deleteCategory/:id', adminController.softDeleteCategory);
adminrouter.get('/list/:id', adminController.listCategory);
adminrouter.get('/unlist/:id', adminController.unlistCategory);

// Products Management
adminrouter.get('/product', adminController.manageProductPage);
adminrouter.get('/addProduct', adminController.addProductPage);
adminrouter.post('/addProduct',productUpload, adminController.addProduct);
adminrouter.get('/editProduct/:id', adminController.editProductPage);
adminrouter.post('/editProduct/:id', productUpload, adminController.updateProduct); 
adminrouter.get('/deleteProduct/:id', adminController.softDeleteProduct); 
adminrouter.get('/listProduct/:id', adminController.listProduct); 
adminrouter.get('/unlistProduct/:id', adminController.unlistProduct); 

adminrouter.get('/orders', adminController.getOrders);
adminrouter.post('/orders/update-status/:orderId', adminController.updateOrderStatus);
adminrouter.get('/orders/view/:orderId', adminController.viewOrder);

// Route to get all product offers
adminrouter.get('/productoffers', offerController.getProductOffers);

// Route to handle adding a new product offer
adminrouter.post('/add-product-offer', offerController.postAddProductOffer);

// Route to handle editing a product offer
adminrouter.post('/edit-product-offer/:id', offerController.postEditProductOffer);
// Route to get all product offers
adminrouter.get('/categoryOffers', offerController.getCategoryOffers);

// Route to handle adding a new product offer
adminrouter.post('/add-category-offer', offerController.postAddCategoryOffer);
// Route to handle editing a product offer
adminrouter.post('/edit-category-offer/:id', offerController.postEditCategoryOffer);
// GET: Coupon management page
adminrouter.get('/coupons', offerController.getCoupons);

// POST: Add new coupon
adminrouter.post('/coupons/add', offerController.addCoupon);

// POST: Edit coupon details
adminrouter.post('/coupons/edit/:id', offerController.editCoupon);

// GET: Delete (soft delete) coupon
adminrouter.get('/coupons/delete/:id', offerController.deleteCoupon);

// GET: Toggle coupon activation status
adminrouter.get('/coupons/toggle/:id', offerController.toggleCouponStatus);

adminrouter.get('/logout', adminController.logout);

module.exports = adminrouter;
