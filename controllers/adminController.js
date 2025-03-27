const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/category'); 
const Product = require('../models/product')
const path = require('path');
const fs = require('fs');
const Order = require('../models/order');
const moment = require('moment');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const PdfPrinter = require('pdfmake');
const cloudinary = require('cloudinary').v2;

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
exports.dashboardPage = async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect("/admin/login");
  }

  try {
    const completedOrders = await Order.countDocuments({ orderStatus: "Delivered" });
    const ordersToShip = await Order.countDocuments({ orderStatus: { $in: ["Ordered", "Shipped"] } });

    const todaysIncome = await Order.aggregate([
      {
        $match: {
          orderStatus: "Delivered",
          deliveredAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const totalRevenueData = await Order.aggregate([
      { $match: { orderStatus: "Delivered" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const startOfNextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

const monthlyRevenueData = await Order.aggregate([
  {
    $match: {
      orderStatus: "Delivered",
      deliveredAt: { $exists: true, $gte: startOfMonth, $lt: startOfNextMonth },
    },
  },
  {
    $group: {
      _id: null,
      total: { $sum: "$totalAmount" },
    },
  },
]);

const totalRevenue = Math.floor(totalRevenueData[0]?.total || 0);
const monthlyRevenue = Math.floor(monthlyRevenueData[0]?.total || 0);
const totalProducts = await Product.countDocuments();

const categoryRevenue = await Order.aggregate([
  { $unwind: "$products" },
  {
    $lookup: {
      from: "products",
      localField: "products.product",
      foreignField: "_id",
      as: "productDetails",
    },
  },
  { $unwind: "$productDetails" },
  {
    $group: {
      _id: "$productDetails.category",
      totalRevenue: { $sum: "$products.price" },
    },
  },
  {
    $lookup: {
      from: "categories",
      localField: "_id",
      foreignField: "_id",
      as: "categoryInfo",
    },
  },
  { $unwind: "$categoryInfo" },
  {
    $project: {
      _id: 0,
      categoryName: "$categoryInfo.name",
      totalRevenue: { $round: ["$totalRevenue", 2] },
    },
  },
]);

    const salesReport = await getDailySales();
    res.render("admin/dashboard", {
      adminEmail: req.session.adminEmail,
      completedOrders,
      ordersToShip,
      todaysIncome: Math.floor(todaysIncome[0]?.total || 0),
      totalRevenue,
      totalProducts,
      categoryRevenue,
      monthlyRevenue,
      salesReport,
    });
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    res.status(500).send("Server Error");
  }
};
exports.getfilter = async (req, res) => {
  const filter = req.query.filter || "daily";

  try {
    let salesData = [];
    
    switch (filter) {
      case "daily":
        salesData = await getDailySales();
        break;
      case "weekly":
        salesData = await getWeeklySales();
        break;
      case "monthly":
        salesData = await getMonthlySales();
        break;
      case "yearly":
        salesData = await getYearlySales();
        break;
      default:
        salesData = [];
    }
    res.json({
      labels: salesData.map(entry => entry.date),
      values: salesData.map(entry => entry.totalSales),
    });

  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({ error: "Failed to fetch sales data" });
  }
};

const getDailySales = async () => {
  return await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$deliveredAt" },
        },
        totalSales: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", totalSales: 1 } },
  ]);
};

const getWeeklySales = async () => {
  return await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: {
          year: { $year: "$deliveredAt" },
          week: { $week: "$deliveredAt" },
        },
        totalSales: { $sum: "$totalAmount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.week": 1 } },
    {
      $project: {
        _id: 0,
        date: { $concat: ["Year ", { $toString: "$_id.year" }, " - Week ", { $toString: "$_id.week" }] },
        totalSales: 1,
      },
    },
  ]);
};

const getMonthlySales = async () => {
  return await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$deliveredAt" } },
        totalSales: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", totalSales: 1 } },
  ]);
};

const getYearlySales = async () => {
  return await Order.aggregate([
    { $match: { orderStatus: "Delivered" } },
    {
      $group: {
        _id: { $year: "$deliveredAt" },
        totalSales: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: { $toString: "$_id" }, totalSales: 1 } },
  ]);
};
exports.getTopSellingProducts = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      {$match:{orderStatus:"Delivered"}},
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          totalQuantity: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 1,
          name: "$productDetails.name",
          price: "$productDetails.offerPrice",
          totalQuantity: 1
        }
      }
    ]);
    res.render("admin/topSelling", { type: "products", data: topProducts });
  } catch (error) {
    console.error("Error fetching top-selling products:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getTopSellingCategories = async (req, res) => {
  try {
    const topCategories = await Order.aggregate([
      {$match:{orderStatus:"Delivered"}},
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.category",
          totalSales: { $sum: "$products.quantity" }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      { $unwind: "$categoryDetails" },
      {
        $project: {
          _id: 1,
          name: "$categoryDetails.name",
          totalSales: 1
        }
      }
    ]);

    res.render("admin/topSelling", { type: "categories", data: topCategories });
  } catch (error) {
    console.error("Error fetching top-selling categories:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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
      imageURL: category.image 
  ? category.image.includes("cloudinary.com") 
    ? category.image  // If it's already a full Cloudinary URL, use it
    : `https://res.cloudinary.com/dzbmwcgol/image/upload/v1743051548/categories/${category.image}` 
  : 'https://res.cloudinary.com/dzbmwcgol/image/upload/v123456789/default-image.jpg',
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
    
    // Check if category already exists (case insensitive)
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }, 
      isDeleted: { $ne: true }
    });

    if (existingCategory) {
      req.session.errorMessage = 'Category with this name already exists and is not deleted!';
      return res.redirect('/admin/addCategory'); 
    }

    // Get Cloudinary Image URL
    const image = req.file.path;  

    // Save Category with Cloudinary Image URL
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

    let imagePath = category.image; // Keep the existing image if no new upload

    if (req.file) {
      // Delete old image from Cloudinary (if exists)
      if (category.image) {
        const publicId = category.image.split('/').pop().split('.')[0]; // Extract public_id from URL
        await cloudinary.uploader.destroy(publicId);
      }

      // Get new Cloudinary image URL
      imagePath = req.file.path;
    }

    // Update the category with new data
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name, description, isListed: isListedBool, image: imagePath },
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
    const searchQuery = req.query.search ? req.query.search.trim() : '';
    const page = parseInt(req.query.page) || 1; 
    const limit = 3;
    const skip = (page - 1) * limit;

    // Dynamic filtering (if search query is present)
    const filter = {
      isDeleted: { $ne: true },
      ...(searchQuery && { name: { $regex: searchQuery, $options: "i" } }),
    };

    const totalProducts = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Formatting products for rendering
    const updatedProducts = products.map(product => {
      const finalPrice = product.offerPrice || product.price;
      return {
        ...product._doc,
        category: product.category ? { name: product.category.name } : { name: "Uncategorized" },
        imageURLs: product.images, // Cloudinary URLs are already stored in DB
        offerPrice: finalPrice,
        discountPrice: product.price - finalPrice,
        quantity: product.quantity?.value || null,
        unit: product.quantity?.unit || null
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
    console.error("❌ Error fetching products:", error);
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

    if (!name || !description || !price || !category || !stock || !quantity || !unit) {
      req.session.error = 'All fields are required';
      return res.redirect('/admin/addProduct');
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const validPrice = parseFloat(price);
    const validStock = parseInt(stock);
    const validOfferPrice = offerPrice ? parseFloat(offerPrice) : validPrice;
    const validQuantity = parseFloat(quantity);

    const existingProduct = await Product.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') });
    if (existingProduct) {
      req.session.error = 'Product with this name already exists';
      return res.redirect('/admin/addProduct');
    }

    if (!req.files || req.files.length < 3) {
      req.session.error = 'You must upload at least 3 cropped images';
      return res.redirect('/admin/addProduct');
    }

    // Upload images to Cloudinary and get their URLs
    const imageUploads = await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'products',
        });
        return result.secure_url; // Store only the Cloudinary URL
      })
    );

    if (imageUploads.length === 0) {
      req.session.error = 'No images were uploaded to Cloudinary';
      return res.redirect('/admin/addProduct');
    }

    const newProduct = new Product({
      name: trimmedName,
      description: trimmedDescription,
      price: validPrice,
      category,
      stock: validStock,
      images: imageUploads, // Cloudinary URLs
      offerPrice: validOfferPrice,
      isListed: true,
      quantity: {
        value: validQuantity,
        unit: unit.trim(),
      }
    });

    await newProduct.save();
    res.redirect('/admin/product');
  } catch (error) {
    console.error("❌ Error adding product:", error);
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

    // Handle new images if uploaded
    if (req.files && req.files.length > 0) {
      // Delete old images from Cloudinary
      if (product.images.length > 0) {
        await Promise.all(
          product.images.map(async (imageUrl) => {
            const publicId = imageUrl.split('/').pop().split('.')[0]; // Extract public_id from URL
            await cloudinary.uploader.destroy(`products/${publicId}`);
          })
        );
      }

      // Upload new images to Cloudinary
      images = await Promise.all(
        req.files.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'products',
          });
          return result.secure_url; // Store only Cloudinary URLs
        })
      );
    }

    // Calculate discount
    let updatedOfferPrice = parseFloat(offerPrice) || product.offerPrice || price;
    let discount = 0;
    if (updatedOfferPrice < price) {
      discount = Math.round(((price - updatedOfferPrice) / price) * 100);
    } else {
      updatedOfferPrice = price;
    }

    // Update product in the database
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
          value: parseFloat(quantity),
          unit: unit.trim(),
        }
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).send('Product not found');
    }

    res.redirect('/admin/product');
  } catch (error) {
    console.error("❌ Error updating product:", error);
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
      let page = parseInt(req.query.page) || 1;

      const totalOrders = await Order.countDocuments();
      const totalPages = Math.ceil(totalOrders / perPage);

      // Ensure the page does not exceed the totalPages
      if (page > totalPages) page = totalPages;
      if (page < 1) page = 1;

      const orders = await Order.find()
          .populate('user', 'username email')
          .populate('products.product', 'name price images')
          .sort({ orderedAt: -1 })
          .skip(perPage * (page - 1))
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
          totalPages
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

    // Update order status
    order.orderStatus = status;

    // Update product statuses, excluding cancelled or returned products
    order.products.forEach(product => {
      if (product.status !== 'Cancelled' && product.status !== 'Returned') {
        product.status = status;
      }
    });

    // Update payment status based on order status
    if (status === 'Ordered') {
      if (order.paymentStatus === 'Refunded') {
        order.paymentStatus = 'Completed';
      }
    } else if (status === 'Cancelled') {
      order.paymentStatus = 'Refunded';
    } else if (status === 'Delivered') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'Completed';
    } else {
      order.deliveredAt = null;
    }

    // Reset isCancelled and isReturned flags
    order.isCancelled = false;
    order.isReturned = false;

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
exports.getSalesReport = async (req, res) => {
  try {
      const orders = await Order.find({ orderStatus: "Delivered" })
        .populate('user', 'name') 
        .populate('products.product')
        .sort({ createdAt: -1 });
      const formattedOrders = await Promise.all(
        orders.map(async (order) => {
          const items = await Promise.all(
            order.products.map(async (item) => {
              const product = await Product.findById(item.product).select('name');
              return {
                productName: product ? product.name : 'Unknown Product',
                quantity: item.quantity
              };
            })
          );

          return {
            userName: order.shippingAddress.name, 
            orderDate: order.createdAt.toISOString().split('T')[0],
            items,
            price: order.totalAmount,
            offerPrice: order.products.reduce((sum, item) => sum + (item.offerPrice * item.quantity), 0), 
            paymentMethod: order.paymentMethod,
            status: order.orderStatus
          };
        })
      );

      const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      res.render('admin/salesReport', { orders: formattedOrders, totalSales });

  } catch (error) {
      console.error('Error fetching sales report:', error);
      res.status(500).send('Internal Server Error');
  }
};
exports.filterOrders = async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.json({ success: false, message: "Invalid date range" });
        }

        const startDate = new Date(from);
        startDate.setHours(0, 0, 0, 0); 

        const endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);

        const orders = await Order.find({
          orderStatus: "Delivered",orderedAt: { $gte: startDate, $lte: endDate }
        }).populate('products.product', 'name') 
        .lean().sort({ createdAt: -1 });
        const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        res.json({ success: true, orders , totalSales});
    } catch (error) {
        console.error("Error fetching filtered orders:", error);
        res.json({ success: false, message: "Server error" });
    }
};
exports.getAllOrders = async (req, res) => {
  try {
      const orders = await Order.find({ orderStatus: "Delivered" }).populate('products.product', 'name')
      .lean().sort({ createdAt: -1 });
      const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      res.json({ success: true, orders , totalSales});
  } catch (error) {
      console.error("Error fetching all orders:", error);
      res.json({ success: false, message: "Server error" });
  }
};
exports.filterOrdersByTime = async (req, res) => {
  try {
      const { filterType } = req.query;
      let startDate, endDate;

      const now = new Date();

      if (filterType === "week") {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - startDate.getDay()); 
        startDate.setHours(0, 0, 0, 0); 
    
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6); 
        endDate.setHours(23, 59, 59, 999);
    } else if (filterType === "month") {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); 
      } else if (filterType === "year") {
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      } else {
          return res.json({ success: false, message: "Invalid filter type" });
      }

      const orders = await Order.find({orderStatus: "Delivered",
          orderedAt: { $gte: startDate, $lte: endDate }
      }).populate('products.product', 'name')
      .lean().sort({ createdAt: -1 });
      const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
      res.json({ success: true, orders,totalSales });
  } catch (error) {
      console.error("Error fetching filtered orders:", error);
      res.json({ success: false, message: "Server error" });
  }
};
exports.downloadSalesXlsx = async (req, res) => {
  try {
      let { from, to, timeFilter } = req.query;
      let totalSales = req.query.totalSales;
      const today = moment().startOf('day');  
      let query = {orderStatus: "Delivered"};
      if (timeFilter) {
        if (timeFilter === 'week') {
          from = today.startOf('week').toDate(); 
          to = today.endOf('week').toDate(); 
      } else if (timeFilter === 'month') {
            from = today.startOf('month').toDate();
            to = today.endOf('month').toDate();
        } else if (timeFilter === 'year') {
            from = today.startOf('year').toDate();
            to = today.endOf('year').toDate();
        }
    }
      if (from && to) {
          query.orderedAt  = {
              $gte: moment(from).startOf('day').toDate(),
              $lte: moment(to).endOf('day').toDate()
          };
      }
      const orders = await Order.find(query).populate('user');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');
      worksheet.columns = [
          { header: 'Order ID', key: '_id', width: 20 },
          { header: 'User', key: 'user', width: 20 },
          { header: 'Total Amount', key: 'totalAmount', width: 15 },
          { header: 'Order Date', key: 'orderDate', width: 20 }
      ];
      orders.forEach(order => {
          worksheet.addRow({
              _id: order._id,
              user: order.shippingAddress.name,
              totalAmount: order.totalAmount,
              orderDate: moment(order.orderedAt).format('YYYY-MM-DD ')
          });
      });
      worksheet.addRow([]);
      worksheet.addRow({ _id: 'Total Sales', totalAmount: totalSales });
      const filePath = './sales_report.xlsx';
      await workbook.xlsx.writeFile(filePath);
      res.download(filePath, 'Sales_Report.xlsx', () => {
          fs.unlinkSync(filePath);
      });

  } catch (error) {
      console.error("Error generating XLSX:", error);
      res.status(500).send("Internal Server Error");
  }
};
exports.downloadSalesPdf = async (req, res) => {
  try {
    let { from, to, timeFilter } = req.query;
    let totalSales = req.query.totalSales;
    const today = moment().startOf('day');  
    let query = {orderStatus: "Delivered"};
    if (timeFilter) {
      if (timeFilter === 'week') {
        from = today.startOf('week').toDate(); 
        to = today.endOf('week').toDate(); 
    } else if (timeFilter === 'month') {
          from = today.startOf('month').toDate();
          to = today.endOf('month').toDate();
      } else if (timeFilter === 'year') {
          from = today.startOf('year').toDate();
          to = today.endOf('year').toDate();
      }
  }
    if (from && to) {
      query.orderedAt  = {
        $gte: moment(from).startOf('day').toDate(),
        $lte: moment(to).endOf('day').toDate()
      };
    }
    const orders = await Order.find(query).populate('products.product').lean();
    const printer = new PdfPrinter({
      Roboto: { normal: 'Helvetica', bold: 'Helvetica-Bold' } 
    });
    const tableBody = [
      [
        { text: 'Order ID', style: 'tableHeader' }, 
        { text: 'Customer Name', style: 'tableHeader' }, 
        { text: 'Total Amount', style: 'tableHeader' }, 
        { text: 'Order Date', style: 'tableHeader' }, 
        { text: 'Products', style: 'tableHeader' }
      ]
    ];
    orders.forEach((order, index) => {
      tableBody.push([
        { text: order._id.toString(), style: 'tableCell', fillColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' },
        { text: order.shippingAddress.name || 'N/A', style: 'tableCell', fillColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' },
        { text: `₹${order.totalAmount}`, style: 'tableCell', alignment: 'right', fillColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' },
        { text: moment(order.orderedAt).format('YYYY-MM-DD'), style: 'tableCell', alignment: 'center', fillColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' },
        { text: order.products.map(p => p.product.name).join(', ') || 'N/A', style: 'tableCell', fillColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' }
      ]);
    });
    tableBody.push([
      { text: '', colSpan: 2, border: [false, false, false, false] },
      {},
      { text: `Total Sales: ₹${totalSales}`, style: 'tableHeader', colSpan: 3, alignment: 'right' },
      {},
      {}
  ]);
    const docDefinition = {
      content: [
        { text: 'Sales Report', style: 'header', alignment: 'center', margin: [0, 10, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ['30%', '20%', '10%', '20%', '20%'],
            body: tableBody
          },
          layout: {
            fillColor: function (rowIndex) {
              return rowIndex === 0 ? '#dddddd' : null; 
            },
            hLineWidth: function (i, node) {
              return i === 0 || i === node.table.body.length ? 1 : 0.5;
            },
            vLineWidth: function () {
              return 0.5;
            },
            hLineColor: function () {
              return '#aaaaaa';
            },
            vLineColor: function () {
              return '#aaaaaa';
            }
          } 
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        tableHeader: { bold: true, fontSize: 12, fillColor: '#eeeeee', margin: [5, 5, 5, 5], alignment: 'center' },
        tableCell: { fontSize: 10, margin: [5, 5, 5, 5] }
      }
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const filePath = './sales_report.pdf';
    const stream = fs.createWriteStream(filePath);

    pdfDoc.pipe(stream);
    pdfDoc.end();
    stream.on('finish', () => {
      res.download(filePath, 'Sales_Report.pdf', () => {
        fs.unlinkSync(filePath);
      });
    });

  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.logout = (req, res) => {
  try {
    req.session.isAdmin = false; // Mark admin as logged out
    req.session.adminEmail = null; // Clear stored admin email

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.redirect('/admin/login');
  } catch (err) {
    console.error("Error during logout:", err);
    res.status(500).send("Error logging out");
  }
};
