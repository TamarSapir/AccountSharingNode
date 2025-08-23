const express = require("express");
const router = express.Router();
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const Item = require("../models/item");
const Bill = require("../models/Bill");
const verifyJwt = require("../middleware/authMiddleware"); // verify
const {
  IMAGE_TO_TEXT_SERVICE_URL,
  USE_MOCK_IMAGE_SERVICE,
} = require("../consts");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

const { v4: uuidv4 } = require("uuid"); // require uuid

router.post(
  "/scan-receipt",
  verifyJwt,
  upload.single("image"),
  async (req, res) => {
    console.log("Received file:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const { billName, billType, billDescription } = req.body;
    const { userId } = req.user;

    try {
      const form = new FormData();
      form.append("image", fs.createReadStream(req.file.path));
      let response = {};

      if (!USE_MOCK_IMAGE_SERVICE) {
        response = await axios.post(
          `${IMAGE_TO_TEXT_SERVICE_URL}/scan-receipt`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: req.headers["authorization"],
            },
          }
        );
      } else {
        response = {
          __isMock: true,
          data: {
            items: [
              { name: "סביצ'", price: 29, quantity: 1 },
              { name: "טבולה", price: 24, quantity: 1 },
              { name: "שרימסס", price: 22, quantity: 1 },
              { name: "ה פילה דגי6", price: 25, quantity: 1 },
              { name: "ה סוכריה", price: 17, quantity: 1 },
            ],
          },
        };
      }

      const textItems = response.data.items || [];
      console.log("Extracted items:", textItems);

      const newBill = await Bill.create({
        ownerId: userId,
        name: billName,
        billContentType: billType,
        description: billDescription,
      });

      const itemDocs = textItems.map((item) => ({
        sessionId: newBill._id,
        userId,
        name: item.name,
        quantity: item.quantity,
        totalQuantity: item.quantity,
        price: item.price,
      }));

      await Item.insertMany(itemDocs);
      //await Item.insertMany(docs);
      fs.unlinkSync(req.file.path);

      res.json({ sessionId: newBill._id });
    } catch (error) {
      console.error("OCR error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to extract text" });
    }
  }
);

router.post("/crop-image", upload.single("image"), async (req, res) => {
  try {
    const { points } = req.body;

    // forward to Python service
    const form = new FormData();
    form.append("image", fs.createReadStream(req.file.path));
    form.append("points", points);

    const response = await axios.post(
      `${IMAGE_TO_TEXT_SERVICE_URL}/crop`,
      form,
      {
        headers: form.getHeaders(),
        responseType: "arraybuffer",
      }
    );

    res.set("Content-Type", "image/jpeg");
    res.send(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to crop image" });
  }
});

router.post("/save-items", verifyJwt, async (req, res) => {
  const { items, sessionId } = req.body;

  const docs = items.map((i) => ({
    sessionId,
    userId: req.user.userId,
    name: i.name,
    quantity: i.quantity,
    price: i.price,
  }));

  await Item.insertMany(docs);
  res.json({ count: docs.length });
});

module.exports = router;
