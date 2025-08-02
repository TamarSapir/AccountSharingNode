require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

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
const billRoutes = require('./routes/bill');
app.use('/', billRoutes);
app.use('/', authRoutes);
app.use('/', scanRoutes);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at port ${PORT}`);
});
