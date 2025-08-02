// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyJwtToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Access userId, email
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = verifyJwtToken;
