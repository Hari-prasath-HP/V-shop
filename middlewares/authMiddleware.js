exports.adminAuth = (req, res, next) => {
    if (!req.session.isAdmin) {
      // Allow access to login page to avoid redirect loop
      if (req.path === "/login") {
        return next();
      }
      return res.redirect('/admin/login'); // Redirect only if not on login page
    }
    next(); // Continue if authenticated
  };
  