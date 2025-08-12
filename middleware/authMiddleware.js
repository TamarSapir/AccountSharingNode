const jwt = require('jsonwebtoken');

const verifyJwtToken = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'No token provided' });

  let token = m[1].trim();
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1); // clean ""
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //use id all over the code
    const userId = decoded.sub || decoded.id || decoded.userId;
    if (!userId) return res.status(401).json({ error: 'Token payload missing user id' });

    req.user = { userId, ...decoded };
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token' }); 
  }
};

module.exports = verifyJwtToken;
