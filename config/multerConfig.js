const multer = require('multer');
const path = require('path');
const fs = require('fs');

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/products/';
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});

const productFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const isValidType = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);

  if (isValidType) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed!'), false);
  }
};

const productUpload = multer({
  storage: productStorage,
  fileFilter: productFileFilter
}).array('images', 10);

  const categoryStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = 'uploads/categories/';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + ext);
    }
  });
    const categoryFileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const isValidType = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);
  
    if (isValidType) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'), false);
    }
  };
  const categoryUpload = multer({
    storage: categoryStorage,
    fileFilter: categoryFileFilter 
  }).single('image')

module.exports = { productUpload, categoryUpload };
