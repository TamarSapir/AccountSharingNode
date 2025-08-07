const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Item = require('../models/item'); 
const verifyJwt = require('../middleware/authMiddleware'); // verify

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

const { v4: uuidv4 } = require('uuid'); // require uuid 

router.post('/scan-receipt', verifyJwt, upload.single('image'), async (req, res) => {
  console.log("Received file:", req.file);
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const sessionId = uuidv4();
  console.log("Generated sessionId:", sessionId);

  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));

    const response = await axios.post('http://localhost:5100/scan-receipt', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: req.headers['authorization']  
      }
    });

    const textItems = response.data.items || [];
    console.log("Extracted items:", textItems);

    const docs = textItems.map(item => ({
      sessionId,
      userId: req.user.userId,
      name: item.name,
      quantity: item.quantity,
      price: item.price
    }));

    await Item.insertMany(docs);
    fs.unlinkSync(req.file.path);

    console.log("Sending response to frontend with sessionId:", sessionId);
    res.json({ items: textItems, sessionId }); 
  } catch (error) {
    console.error('OCR error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to extract text' });
  }
});



router.post('/save-items', verifyJwt, async (req, res) => {
  const { items, sessionId } = req.body;

  const docs = items.map(i => ({
    sessionId,
    userId: req.user.userId,
    name: i.name,
    quantity: i.quantity,
    price: i.price
  }));

  await Item.insertMany(docs);
  res.json({ count: docs.length });
});


module.exports = router;
