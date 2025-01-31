const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/category'); 
const Product = require('../models/product')
const path = require('path');
const fs = require('fs');
const { validationResult } = require('express-validator');

// Admin credentials stored in environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Render Admin Login Page
exports.loginPage = (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect("/admin/dashboard");
  }
  const error = req.session.adminLogError || null;
  req.session.adminLogError = null;
  res.render("admin/login", { error });
};

// Handle Admin Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      req.session.adminLogError = "Invalid email or password";
      return res.redirect("/admin/login");
    }
    req.session.isAdmin = true;
    req.session.adminEmail = ADMIN_EMAIL;
    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error("Error during login:", err);
    req.session.adminLogError = "An internal error occurred.";
    return res.redirect('/admin/login');
  }
};

// Admin Dashboard Page
exports.dashboardPage = (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  res.render('admin/dashboard', { adminEmail: req.session.adminEmail });
};

// Manage Users
exports.manageUsersPage = async (req, res) => {
  try {
    const searchQuery = req.query.search || "";
    const users = await User.find({
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } },
      ],
    });
    res.render("admin/users", { users, searchQuery });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).render("admin/error", { message: "Unable to fetch users." });
  }
};

// add User
exports.addUser = async (req,res)=>{
  try {
      const { username, email, phone, password } = req.body;
  
      // Validate input fields
      if (!username || !email || !phone || !password) {
          return res.status(400).json({ error: 'Name, email, phone and password are required.' });
      }
  
      // Check if the user already exists by email
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ error: 'User with this email already exists.' });
      }
      //hash the password
      const hashedPassword = await bcrypt.hash(password,10);

      // Create a new user if the email does not exist
      const newUser = new User({
          username,
          email,
          phone,
          password: hashedPassword, // You should hash the password in a real-world scenario using bcrypt
      });
  
      // Save the new user to the database
      await newUser.save();
  
      // Return success response
      res.status(201).json({ message: 'User added successfully.' });
  } catch (error) {
      console.error('Error in addUser:', error);
      res.status(500).json({ error: 'Internal Server Error. Please try again later.' });
  }
};


// In your adminController.js
exports.routeedit = async (req, res) => {
  const userId = req.params.id;  // Get the user ID from the URL
  try {
    // Fetch the user from the database using the provided ID
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Render the edit page and pass the user data to the template
    res.render('admin/edit', { user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user details.' });
  }
};



// handleEdit controller
exports.handleEdit = async (req, res) => {
  const { id } = req.params;
  const { username, email, phone } = req.body;
  if (!username || !email) {
    return res.status(400).json({ message: 'Username and email are required.' });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(id, {
      username,
      email,
      phone,
    }, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.redirect('/admin/users'); // or redirect to the user management page
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user.' });
  }
};


// Handle Delete User
exports.handleDelete = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.redirect('/admin/users'); // Ensure this route is correct
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user.' });
  }
};

//Block User
exports.handleBlock = async (req, res) => {
  const { id } = req.params;
  try {
    const blockedUser = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
    if (!blockedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.redirect('/admin/users'); // Ensure this route is correct
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ message: 'Error blocking user.' });
  }
};

// // Unblock User
exports.handleUnblock = async (req, res) => {
  const { id } = req.params;
  try {
    const unblockedUser = await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
    if (!unblockedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.redirect('/admin/users'); // Ensure this route is correct
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ message: 'Error unblocking user.' });
  }
};

exports.manageCategoryPage = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const categories = await Category.find({
      name: { $regex: searchQuery, $options: 'i' },
      isDeleted: { $ne: true }, // Exclude categories that are marked as deleted
    });

    const updatedCategories = categories.map(category => ({
      ...category._doc,
      imageURL: category.image ? `/uploads/categories/${category.image}` : null, // Construct the URL
    }));

    res.render('admin/categories', { categories: updatedCategories, searchQuery });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).render('admin/error', { message: 'Unable to fetch categories.' });
  }
};

// // Add Category Page
exports.addCategoryPage = (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  res.render("admin/addCategory");
};

// Add category route
exports.addCategory = async (req, res) => {
  // Log req.body and req.file to check the submitted data
  console.log(req.body);  // Should show the category and other fields
  console.log(req.file);  // Should show the uploaded image

  // Handle the case if no image is uploaded
  if (!req.file) {
    return res.status(400).send('Category image is required!');
  }

  try {
    const { name, description } = req.body;
    const imagePath = `/uploads/categories/${req.file.filename}`;  // Store the image path

    // Create a new category with the image path
    const newCategory = new Category({
      name,
      description,
      image: imagePath,  // Save the image path in the database
    });

    // Save the category to the database
    await newCategory.save();

    // Redirect back to the category list page
    res.redirect('/admin/categories');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

// In your adminController.js
exports.editCategoryPage = async (req, res) => {
  const categoryId = req.params.id; // Get the category ID from the URL

  try {
    // Fetch the category from the database using the provided ID
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    // Render the edit category page and pass the category data to the template
    res.render('admin/editCategory', { category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category details.' });
  }
};

// Handle updating a category with image, isListed status, name, and description
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, isListed } = req.body;

    // Convert isListed to boolean
    const isListedBool = isListed === 'true'; 

    // Find the existing category
    const category = await Category.findById(categoryId);
    if (!category) {
        return res.status(404).send('Category not found');
    }

    // Check if a new image was uploaded
    let imageURL = category.image; // Keep old image if no new image is uploaded
    if (req.file) {
        imageURL = `/uploads/categories/${req.file.filename}`; // Update with new image path
    }

    // Update the category with new values
    category.name = name;
    category.description = description;
    category.isListed = isListedBool;
    category.image = imageURL; // Save the image path in the category

    // Save the updated category to the database
    await category.save();

    // Redirect back to the category list page
    res.redirect('/admin/categories');
} catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating the category');
}
};

// Handle soft deleting a category
exports.softDeleteCategory = async (req, res) => {
  const categoryId = req.params.id;

  try {
    // Find the category by ID and update the isDeleted flag
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { isDeleted: true },  // Setting isDeleted to true for soft delete
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found.' });
    }

    // Redirect to category management page or list of categories
    res.redirect('/admin/categories'); // Update this route as per your requirement
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category.' });
  }
};

// Make category visible (list it)
exports.listCategory = async (req, res) => {
  try {
      const categoryId = req.params.id;
      
      await Category.findByIdAndUpdate(categoryId, { isListed: true });
      
      res.redirect('/admin/categories'); 
  } catch (error) {
      console.error('Error listing category:', error);
      res.status(500).send('Internal Server Error');
  }
};

// Hide category (unlist it)
exports.unlistCategory = async (req, res) => {
  try {
      const categoryId = req.params.id;
      
      await Category.findByIdAndUpdate(categoryId, { isListed: false });
      
      res.redirect('/admin/categories'); 
  } catch (error) {
      console.error('Error unlisting category:', error);
      res.status(500).send('Internal Server Error');
  }
};

exports.manageProductPage = async (req, res) => {
  try {
      const products = await Product.find({ isDeleted: { $ne: true } }).populate("category");

      // Ensure image URLs are properly constructed and category is always an object
      const updatedProducts = products.map(product => ({
          ...product._doc,
          category: product.category || { name: "Uncategorized" }, // Default category if not found
          imageURLs: product.images.map(image => `/uploads/products/${image}`) // Map images to URLs
      }));

      res.render('admin/product', { products: updatedProducts }); // Render the page with the products and images
  } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).send("Server Error");
  }
};

// Render Add Product Page
exports.addProductPage = async (req, res) => {
  try {
    const categories = await Category.find(); // Fetch all categories
    res.render('admin/addProduct', { categories , product: null }); // Only pass categories for adding product
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Example for handling product images in your controller (addProduct method)
exports.addProduct = async (req, res) => {
  try {
      // Log req.body and req.files to inspect the data being sent
      console.log(req.body);  // Should show the category and other fields
      console.log(req.files);  // Should show the images array

      const { name, description, price, category, stock } = req.body;

      // Check if category is missing in the request
      if (!category) {
          return res.status(400).send('Category is required');
      }

      const images = req.files.map(file => file.filename);

      // Create a new product
      const newProduct = new Product({
          name,
          description,
          price,
          category,  // Ensure category is correctly passed
          stock,
          images,    // Array of image filenames
          isListed: true,
      });

      // Save the new product
      await newProduct.save();

      // Redirect to the product management page
      res.redirect('/admin/product');
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};

// Render Edit Product Page
exports.editProductPage = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    const categories = await Category.find();

    if (!product) {
      return res.status(404).send('Product not found');
    }

    res.render('admin/editProduct', { product, categories });
  } catch (error) {
    console.error('Error fetching product or categories:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Handle Updating Product Details with isListed Status
exports.updateProduct = async (req, res) => {
  try {
      const productId = req.params.id;
      const { name, description, price, category, stock, isListed } = req.body;
      // Convert isListed to boolean
      const isListedBool = isListed === 'true';
      // Fetch the existing product
      const product = await Product.findById(productId);
      if (!product) {
          return res.status(404).send('Product not found');
      }
      // Handle multiple file uploads
      let images = product.images; // Retain existing images by default
      if (req.files && req.files.length > 0) {
          // Delete old images
          product.images.forEach(image => {
              const imagePath = path.join(__dirname, '../uploads/products', image);
              if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
              }
          });
          // Store new uploaded images
          images = req.files.map(file => file.filename);
      }

      // Log the updated data for debugging
      console.log("Updating product:", { name, description, price, category, stock, isListed: isListedBool, images });

      const updatedProduct = await Product.findByIdAndUpdate(
          productId,
          { name, description, price, category, stock, isListed: isListedBool, images },
          { new: true }
      );

      if (!updatedProduct) {
          return res.status(404).send('Product not found');
      }

      res.redirect('/admin/product');
  } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).send('Internal Server Error');
  }
};


// Soft Delete Product (Mark as Deleted)
exports.softDeleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Update isDeleted instead of deleting the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isDeleted: true }, // Soft delete by setting isDeleted flag
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.redirect('/admin/product'); // Redirect to product management page
  } catch (error) {
    console.error('Error soft deleting product:', error);
    res.status(500).json({ message: 'Error soft deleting product.' });
  }
};

// For listing the product (set isListed to true)
exports.listProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isListed: true }, // Update isListed to true
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).send('Product not found');
    }
    res.redirect('/admin/product'); // Redirect to the product page
  } catch (error) {
    console.error('Error listing product:', error);
    res.status(500).send('Server Error');
  }
};

// For unlisting the product (set isListed to false)
exports.unlistProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isListed: false }, // Update isListed to false
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).send('Product not found');
    }
    res.redirect('/admin/product'); // Redirect to the product page
  } catch (error) {
    console.error('Error unlisting product:', error);
    res.status(500).send('Server Error');
  }
} ;
