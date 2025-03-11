const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/mongo');
const passport = require("passport");
const flash = require('connect-flash');
require("./config/passport");
const app = express();
const errorhandler = require("./middlewares/error")
const error404 = require("./middlewares/404")
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
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
// **Cache-Control Middleware (Prevents storing previous pages)**
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});
// Routes
const Routes = require('./routes/userRoutes');
app.use('/', Routes);

//  connect to MongoDB
connectDB();

// Serve static files from the "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Admin Routes (importing the adminRoutes from separate file)
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);
// 404 Not Found Middleware
app.use(error404)
app.use(errorhandler)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port 3000`);
});
