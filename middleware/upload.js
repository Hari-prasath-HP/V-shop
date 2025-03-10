const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads/products"); // Ensure correct path

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-cropped${ext}`);
  },
});

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per image
});

/**
 * Middleware to handle multiple image uploads (max 5 files)
 */
const uploadMultiple = upload.array("images", 5); // Ensure "images" matches your form field

module.exports = { upload, uploadMultiple };
