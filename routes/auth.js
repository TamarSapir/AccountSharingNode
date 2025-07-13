// routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyFirebaseToken = require('../middleware/authMiddleware');
const admin = require('firebase-admin');

// Register route
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // create in fire base
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username,
    });

    // create in mongodb
    const newUser = new User({ username, email, password });
    await newUser.save();

    res.status(201).json({ message: 'User registered', uid: userRecord.uid });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, password });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', username: user.username, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile from Firebase
router.get('/user-profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await admin.auth().getUser(req.user.uid);
    res.json({
      uid: user.uid,
      email: user.email,
      name: user.displayName || '',
      phone: user.phoneNumber || ''
    });
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    res.status(500).json({ error: 'Error fetching user data' });
  }
});


// בדיקת חיבור ל-Firebase Admin דרך אימות משתמש
router.get('/test-firebase-connection', async (req, res) => {
  try {
    const listUsers = await admin.auth().listUsers(1); // בקשה פשוטה
    res.status(200).json({ message: 'Firebase Admin is connected ✅', sampleUser: listUsers.users[0]?.email });
  } catch (err) {
    console.error('Firebase Admin connection error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
