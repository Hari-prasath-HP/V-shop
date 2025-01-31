// Required Dependencies
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file
const connectDB = require('./config/mongo');  // Import the connectDB function

// Initialize Express App
const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static File Serving (for assets like CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Set View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session middleware setup
app.use(session({
  secret: 'your-secret-key',  // Change this to a secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set 'secure: true' if you're using HTTPS
}));

// Routes
const Routes = require('./routes/userRoutes');
app.use('/', Routes);
// Connect to MongoDB

// Call connectDB function to connect to MongoDB
connectDB();

// Serve static files from the "uploads" folder
app.use("/uploads", express.static("uploads"));
// Admin Routes (importing the adminRoutes from separate file)
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);

// Error Handling Middleware (for catching unexpected errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong! Please try again later.');
});

app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
