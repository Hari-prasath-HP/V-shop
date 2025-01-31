const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage setup for product images
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/products/';
    
    // Ensure the products upload directory exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // Get file extension
    cb(null, Date.now() + ext); // Save image with timestamp as filename
  }
});

// File filter for product images (only images allowed)
const productFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const isValidType = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);

  if (isValidType) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed!'), false);
  }
};

// Product image upload setup (allowing up to 10 images)
const productUpload = multer({
  storage: productStorage,
  fileFilter: productFileFilter
}).array('images', 10); // Allow up to 10 files with the field name 'images'

  // Category image storage configuration
  const categoryStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = 'uploads/categories/';
      // Ensure the categories upload directory exists
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname); // Get file extension
      cb(null, Date.now() + ext); // Save image with timestamp as filename
    }
  });
    // Category image filter
    const categoryFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const isValidType = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);
  
    if (isValidType) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  };
  // Category image upload setup (single image upload)
  const categoryUpload = multer({
    storage: categoryStorage,
    fileFilter: categoryFileFilter // Apply categoryFileFilter here
  }).single('image') // Single image field for category

module.exports = { productUpload, categoryUpload };
