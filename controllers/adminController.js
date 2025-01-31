const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/category'); 
const Product = require('../models/product')
const path = require('path');
const fs = require('fs');


const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
exports.loginPage = (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect("/admin/dashboard");
  }
  const error = req.session.adminLogError || null;
  req.session.adminLogError = null;
  res.render("admin/login", { error });
};
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
exports.dashboardPage = (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  res.render('admin/dashboard', { adminEmail: req.session.adminEmail });
};
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
exports.addUser = async (req,res)=>{
  try {
      const { username, email, phone, password } = req.body;
      if (!username || !email || !phone || !password) {
          return res.status(400).json({ error: 'Name, email, phone and password are required.' });
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ error: 'User with this email already exists.' });
      }
      const hashedPassword = await bcrypt.hash(password,10);
      const newUser = new User({
          username,
          email,
          phone,
          password: hashedPassword,
      });
      await newUser.save();
      res.status(201).json({ message: 'User added successfully.' });
  } catch (error) {
      console.error('Error in addUser:', error);
      res.status(500).json({ error: 'Internal Server Error. Please try again later.' });
  }
};
exports.routeedit = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.render('admin/edit', { user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user details.' });
  }
};
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

    res.redirect('/admin/users'); 
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user.' });
  }
};
exports.handleDelete = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user.' });
  }
};
exports.handleBlock = async (req, res) => {
  const { id } = req.params;
  try {
    const blockedUser = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
    if (!blockedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ message: 'Error blocking user.' });
  }
};
exports.handleUnblock = async (req, res) => {
  const { id } = req.params;
  try {
    const unblockedUser = await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
    if (!unblockedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    res.redirect('/admin/users');
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
      isDeleted: { $ne: true },
    });

    const updatedCategories = categories.map(category => ({
      ...category._doc,
      imageURL: category.image ? `/uploads/categories/${category.image}` : null,
    }));

    res.render('admin/categories', { categories: updatedCategories, searchQuery });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).render('admin/error', { message: 'Unable to fetch categories.' });
  }
};
exports.addCategoryPage = (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  res.render("admin/addCategory");
};
exports.addCategory = async (req, res) => {
  console.log(req.body);
  console.log(req.file);
  if (!req.file) {
    return res.status(400).send('Category image is required!');
  }
  try {
    const { name, description } = req.body;
    const image = `/uploads/categories/${req.file.filename}`;
    const newCategory = new Category({
      name,
      description,
      image, 
    });
    await newCategory.save();
    res.redirect('/admin/categories');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};
exports.editCategoryPage = async (req, res) => {
  const categoryId = req.params.id;

  try {
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found.' });
    }
    res.render('admin/editCategory', { category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Error fetching category details.' });
  }
};
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, description, isListed } = req.body;
    const isListedBool = isListed === 'true'; 
    const category = await Category.findById(categoryId);
    if (!category) {
        return res.status(404).send('Category not found');
    }
    let imagePath = category.image;
    if (req.file) {
      imagePath = `/uploads/categories/${req.file.filename}`;
    }
    category.name = name;
    category.description = description;
    category.isListed = isListedBool;
    category.image = imagePath;
    await category.save();
    res.redirect('/admin/categories');
} catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating the category');
}
};
exports.softDeleteCategory = async (req, res) => {
  const categoryId = req.params.id;

  try {
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { isDeleted: true },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found.' });
    }
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category.' });
  }
};
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
      const updatedProducts = products.map(product => ({
          ...product._doc,
          category: product.category || { name: "Uncategorized" },
          imageURLs: product.images.map(image => `/uploads/products/${image}`) 
      }));

      res.render('admin/product', { products: updatedProducts });
  } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).send("Server Error");
  }
};
exports.addProductPage = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render('admin/addProduct', { categories , product: null });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send('Internal Server Error');
  }
};
exports.addProduct = async (req, res) => {
  try {
      const { name, description, price, category, stock,offer } = req.body;
      if (!category) {
          return res.status(400).send('Category is required');
      }
      const images = req.files.map(file => file.filename);
      const newProduct = new Product({
          name,
          description,
          price,
          category,
          stock,
          images, 
          offer: offer || 0,
          isListed: true,
      });
      await newProduct.save();
      res.redirect('/admin/product');
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};
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
exports.updateProduct = async (req, res) => {
  try {
      const productId = req.params.id;
      const { name, description, price, category, stock, isListed,offer } = req.body;
      const isListedBool = isListed === 'true';
      const product = await Product.findById(productId);
      if (!product) {
          return res.status(404).send('Product not found');
      }
      let images = product.images;
      if (req.files && req.files.length > 0) {
          product.images.forEach(image => {
              const imagePath = path.join(__dirname, '../uploads/products', image);
              if (fs.existsSync(imagePath)) {
                  fs.unlinkSync(imagePath);
              }
          });
          images = req.files.map(file => file.filename);
      }
      const offerPrice = offer > 0 ? (price - (price * offer / 100)).toFixed(2) : price;
      console.log("Updating product:", { name, description, price, category, stock, isListed: isListedBool, images,offer, offerPrice });

      const updatedProduct = await Product.findByIdAndUpdate(
          productId,
          { name, description, price, category, stock, isListed: isListedBool, images,offer, offerPrice },
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
exports.softDeleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isDeleted: true }, 
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    res.redirect('/admin/product');
  } catch (error) {
    console.error('Error soft deleting product:', error);
    res.status(500).json({ message: 'Error soft deleting product.' });
  }
};
exports.listProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isListed: true },
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).send('Product not found');
    }
    res.redirect('/admin/product'); 
  } catch (error) {
    console.error('Error listing product:', error);
    res.status(500).send('Server Error');
  }
};
exports.unlistProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { isListed: false }, 
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).send('Product not found');
    }
    res.redirect('/admin/product');
  } catch (error) {
    console.error('Error unlisting product:', error);
    res.status(500).send('Server Error');
  }
} ;
