const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// Configure Cloudinary with your credentials
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage configuration for products
const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'products', // Folder name in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif']
    }
});

// Storage configuration for categories
const categoryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'categories', // Folder name in Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg', 'gif']
    }
});

// Configure Multer
const productUpload = multer({ storage: productStorage }).array('images', 10);
const categoryUpload = multer({ storage: categoryStorage }).single('image');

module.exports = { productUpload, categoryUpload, cloudinary };
