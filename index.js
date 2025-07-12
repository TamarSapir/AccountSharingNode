require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());


console.log("MONGO_URI:", process.env.MONGO_URI);

// connect to mongo
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

//routes
const authRoutes = require('./routes/auth'); 
app.use('/', authRoutes);
const scanRoutes = require('./routes/scan');
app.use('/', scanRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
