const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const token = req.cookies.authToken;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('authToken');
    res.redirect('/login');
  }
};

const verifyAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) return res.status(403).send('Admin access only');
  next();
};

module.exports = { verifyToken, verifyAdmin };