const User = require('../models/User');

const checkUserStatus = async (req, res, next) => {
  if (req.session.user) {
    const user = await User.findOne({ email: req.session.user.email });
    if (user && user.isBlocked) {
      req.session.logstate = false;
      req.session.user = null;
      return res.redirect('/login');
    } else {
      req.user = user;
      req.session.logstate = true;
      next();
    }
  } else {
    next();
  }
};

module.exports = checkUserStatus;
