const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/category'); 
const Product = require('../models/product')
const path = require('path');
const fs = require('fs');
const Order = require('../models/order');

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
    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const skip = (page - 1) * limit;
    const totalUsers = await User.countDocuments({
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } },
      ],
    });
    const users = await User.find({
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { phone: { $regex: searchQuery, $options: "i" } },
      ],
    }).skip(skip)
    .limit(limit);
    const totalPages = Math.ceil(totalUsers / limit);
    res.render("admin/users", { users, searchQuery,currentPage: page, totalPages  });
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
    const page = parseInt(req.query.page) || 1;
    const limit = 5; 
    const skip = (page - 1) * limit;
    const totalCategories = await Category.countDocuments({
      name: { $regex: searchQuery, $options: 'i' },
      isDeleted: { $ne: true },
    });
    const categories = await Category.find({
      name: { $regex: searchQuery, $options: 'i' },
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const updatedCategories = categories.map(category => ({
      ...category._doc,
      imageURL: category.image ? `/uploads/categories/${category.image}` : null,
    }));

    const totalPages = Math.ceil(totalCategories / limit);

    res.render('admin/categories', {
      categories: updatedCategories,
      searchQuery,
      currentPage: page,
      totalPages,
      page: "categories",
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).render('admin/error', { message: 'Unable to fetch categories.' });
  }
};

exports.addCategoryPage = (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  const errorMessage = req.session.errorMessage || '';
  req.session.errorMessage = null;
  res.render('admin/addCategory', { errorMessage });
};
exports.addCategory = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Category image is required!');
  }
  try {
    const { name, description } = req.body;
    const categoryNameLower = name.toLowerCase(); 
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }, 
      isDeleted: { $ne: true }
    });

    if (existingCategory) {
      req.session.errorMessage = 'Category with this name already exists and is not deleted!';
      return res.redirect('/admin/addCategory'); 
    }
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
      if (category.image) {
        const existingImagePath = path.join(__dirname, '../uploads/categories', path.basename(category.image));
        if (fs.existsSync(existingImagePath)) {
          fs.unlinkSync(existingImagePath);
        }
      }
      imagePath = `/uploads/categories/${req.file.filename}`;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { 
        name, 
        description, 
        isListed: isListedBool, 
        image: imagePath 
      },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).send('Category not found');
    }

    res.redirect('/admin/categories');
  } catch (error) {
    console.error("Error updating category:", error);
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
    const searchQuery = req.query.search || '';
    const page = parseInt(req.query.page) || 1; 
    const limit = 3;
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments({ isDeleted: { $ne: true } });
    const products = await Product.find({ isDeleted: { $ne: true } })
      .populate("category", "name description image isListed")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const updatedProducts = products.map(product => {
      const finalPrice = product.offerPrice || product.price;

      return {
        ...product._doc,
        category: product.category ? { name: product.category.name } : { name: "Uncategorized" },
        imageURLs: product.images.map(image => `/uploads/products/${image}`),
        offerPrice: finalPrice,
        discountPrice: product.price - finalPrice,
        quantity: product.quantity ? product.quantity.value : null,
        unit: product.quantity ? product.quantity.unit : null
      };
    });

    const totalPages = Math.ceil(totalProducts / limit);

    res.render('admin/product', {
      products: updatedProducts,
      currentPage: page,
      totalPages,
      searchQuery, 
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Server Error");
  }
};
exports.addProductPage = async (req, res) => {
  try {
    const categories = await Category.find();
    const errorMessage = req.session.error || null;
    req.session.error = null;

    const quantity = 0;
    const unit = ''; 

    res.render('admin/addProduct', {
      categories,
      product: null,
      error: errorMessage,
      quantity,
      unit,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send('Internal Server Error');
  }
};


exports.addProduct = async (req, res) => {
  try {
    const { name, description, price, category, stock, offerPrice, quantity, unit } = req.body;
    const existingProduct = await Product.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existingProduct) {
      req.session.error = 'Product already exists';
      return res.redirect('/admin/addProduct');
    }
    if (!category) {
      req.session.error = 'Category is required';
      return res.redirect('/admin/addProduct');
    }
    if (!req.files || req.files.length < 3) {
      req.session.error = 'You must upload minimum 3 images';
      return res.redirect('/admin/addProduct');
    }
    const images = req.files.map(file => file.filename);
    const offerPriceValue = offerPrice ? offerPrice : price;

    const newProduct = new Product({
      name,
      description,
      price,
      category,
      stock,
      images,
      offerPrice: offerPriceValue,
      isListed: true,
      quantity: {
        value: quantity,
        unit: unit
      }
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
    res.render('admin/editProduct', { product, categories,quantity: product.quantity.value,
      unit: product.quantity.unit, });  
  } catch (error) {
    console.error('Error fetching product or categories:', error);
    res.status(500).send('Internal Server Error');
  }
};
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, description, price, category, stock, isListed, offerPrice, quantity, unit } = req.body;
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
    let updatedOfferPrice = parseFloat(offerPrice) || product.offerPrice || price;
    let discount = 0;
    if (updatedOfferPrice < price) {
      discount = Math.round(((price - updatedOfferPrice) / price) * 100);
    } else {
      updatedOfferPrice = price;
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { 
        name, 
        description, 
        price, 
        category, 
        stock, 
        isListed: isListedBool, 
        images, 
        offerPrice: updatedOfferPrice,
        discount,
        quantity: {
          value: quantity,
          unit: unit
        }
      },
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
exports.getOrders = async (req, res) => {
  try {
      let perPage = 10;
      let page = req.query.page || 1;

      const totalOrders = await Order.countDocuments();
      const orders = await Order.find()
          .populate('user', 'username email')
          .populate('products.product', 'name price images')
          .sort({ orderedAt: -1 })
          .skip((perPage * page) - perPage)
          .limit(perPage);

      res.render('admin/ordermanagement', {
          orders: orders.map(order => ({
              _id: order._id,
              userName: order.user.username,
              userEmail: order.user.email,
              products: order.products.map(p => ({
                  productId: p.product._id,
                  name: p.product.name,
                  price: p.price,
                  offerPrice: p.offerPrice,
                  quantity: p.quantity,
                  status: p.status,
              })),
              totalAmount: order.totalAmount,
              paymentMethod: order.paymentMethod,
              paymentStatus: order.paymentStatus,
              orderStatus: order.orderStatus,
              shippingAddress: order.shippingAddress,
              orderedAt: order.orderedAt,
              deliveredAt: order.deliveredAt
          })),
          currentPage: page,
          totalPages: Math.ceil(totalOrders / perPage)
      });
  } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).send("Internal Server Error");
  }
};
exports.updateOrderStatus = async (req, res) => {
  try {
      const { status } = req.body;
      const { orderId } = req.params;
      if (!orderId || !status) {
          return res.status(400).json({ message: "Invalid request data" });
      }
      const order = await Order.findById(orderId);
      if (!order) {
          return res.status(404).json({ message: "Order not found" });
      }
      order.orderStatus = status;
      order.products.forEach(product => {
          product.status = status;
      });
      if (status === 'Delivered') {
          order.deliveredAt = new Date();
      }
      await order.save();
      res.json({ message: 'Order and product statuses updated successfully', order });
  } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: 'Server Error' });
  }
};
exports.viewOrder = async (req, res) => {
  try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId)
          .populate('user', 'name email phone')
          .populate({
            path: 'products.product',
            model: 'Product',
            select: 'name images price offerPrice'
          })

      if (!order) {
          return res.status(404).send("Order not found");
      }
      const orderProducts = order.products.map(item => ({
        image: item.product && item.product.images.length > 0 ? item.product.images[0] : '/images/default.jpg',
        name: item.product ? item.product.name : 'Unknown',
        price: item.price,
        offerPrice: item.offerPrice,
        quantity: item.quantity,
        status:item.status,
        subtotal: item.quantity * (item.offerPrice || item.price),
        productId: item.product ? item.product._id : '',
        cancellationReason: item.status === 'Cancelled' ? item.cancellationReason || 'No reason provided' : null,
        returnReason: item.status === 'Returned' ? item.returnReason || 'No reason provided' : null,
      }));
      res.render('admin/vieworder', { order , products: orderProducts,});
  } catch (error) {
      console.error("Error fetching order details:", error);
      res.status(500).send("Internal Server Error");
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error logging out");
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.redirect('/admin/login');
  });
};