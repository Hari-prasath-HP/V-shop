const express = require('express');
const adminrouter = express.Router();
const adminController = require('../controllers/adminController');
const { productUpload} = require('../config/multerConfig');
const { categoryUpload } = require('../config/multerConfig');

// Admin Login Route
adminrouter.get('/login', adminController.loginPage); // Render login page
adminrouter.post('/login', adminController.login); // Handle login logic

// Admin Dashboard (protected route)
adminrouter.get('/dashboard', adminController.dashboardPage);

// User management
adminrouter.get('/users', adminController.manageUsersPage);
adminrouter.post("/admin/adduser",adminController.addUser)
adminrouter.get('/editUser/:id',adminController.routeedit);
adminrouter.post('/updateUser/:id',adminController.handleEdit);
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

// Product Management Routes
adminrouter.get('/product', adminController.manageProductPage); // Render the Manage Products page
adminrouter.get('/addProduct', adminController.addProductPage); // Render the Add Product page
adminrouter.post('/addProduct',productUpload, adminController.addProduct); // Handle adding a new product
adminrouter.get('/editProduct/:id', adminController.editProductPage); // Render the Edit Product page
adminrouter.post('/editProduct/:id', productUpload, adminController.updateProduct); // Handle updating product details
adminrouter.get('/deleteProduct/:id', adminController.softDeleteProduct); // Soft delete a product
adminrouter.get('/listProduct/:id', adminController.listProduct); // List a product (make it visible)
adminrouter.get('/unlistProduct/:id', adminController.unlistProduct); // Unlist a product (hide it)

module.exports = adminrouter;
