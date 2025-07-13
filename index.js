require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');
const ip = require('ip');

const app = express();

// Firebase Admin Initialization
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

admin.auth().listUsers(1)
  .then((result) => {
    console.log("Firebase Admin connected.");
    console.log("First user:", result.users[0]?.email || "No users found.");
  })
  .catch((error) => {
    console.error("Firebase Admin error:", error.message);
  });

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB error:', err));

// Routes
const authRoutes = require('./routes/auth');
const scanRoutes = require('./routes/scan');
app.use('/', authRoutes);
app.use('/', scanRoutes);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://${ip.address()}:${PORT}`);
});
