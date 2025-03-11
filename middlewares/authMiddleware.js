exports.adminAuth = (req, res, next) => {
    if (!req.session.isAdmin) {
      if (req.path === "/login") {
        return next();
      }
      return res.redirect('/admin/login'); 
    }
    next(); 
  };
  