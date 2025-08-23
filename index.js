require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const app = express();
const path = require("path");
// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB error:", err));

// Routes
const authRoutes = require("./routes/auth");
const scanRoutes = require("./routes/scan");
const billRoutes = require("./routes/bill");
const emailRoutes = require("./routes/email");


const buildPath = path.join(__dirname, "client", "dist");
app.use(express.static(buildPath));



// Server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running at port ${PORT}`);
});

const io = new Server(server, {
  cors: { origin: "*" },
});

// Handle socket connections
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("message", (msg) => {
    console.log("📩 Message from client:", msg);
    io.emit("message", msg); // broadcast to all clients
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });

  socket.on("joinBill", (billId) => {
    socket.join(billId);
    console.log(`${socket.id} joined bill room: ${billId}`);
  });
});

app.use((req, res, next) => {
  req.io = io; // make sure io is defined
  next();
});

app.use("/", emailRoutes);
app.use("/", billRoutes);
app.use("/", authRoutes);
app.use("/", scanRoutes);

// serve index.html for all other routes (React Router support)
app.get('/{*any}', (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});
