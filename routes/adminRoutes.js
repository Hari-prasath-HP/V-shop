const express = require('express');
const adminrouter = express.Router();
const adminController = require('../controllers/adminController');
const { productUpload} = require('../config/multerConfig');
const { categoryUpload } = require('../config/multerConfig');

// Admin Login Route
adminrouter.get('/login', adminController.loginPage);
adminrouter.post('/login', adminController.login); 

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


adminrouter.get('/logout', adminController.logout);

module.exports = adminrouter;
