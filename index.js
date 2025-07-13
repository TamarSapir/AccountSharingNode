require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

// Do this FIRST
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Do this only AFTER initializeApp()
admin.auth().listUsers(1)
  .then((result) => {
    console.log("Firebase Admin connected.");
    console.log("First user:", result.users[0]?.email || "No users found.");
  })
  .catch((error) => {
    console.error("Firebase Admin error:", error.message);
  });

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB
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
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
