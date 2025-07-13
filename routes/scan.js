const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

router.post('/scan-receipt', upload.single('image'), async (req, res) => {
  console.log("Received file:", req.file);
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));

    const response = await axios.post('https://api.api-ninjas.com/v1/imagetotext', form, {
      headers: {
        'X-Api-Key': '2rqKmKZfOihs863X+zoLHQ==gl1pnJH4omROsJmT',
        ...form.getHeaders(),
      },
    });

    const textItems = response.data.map((item) => item.text).filter(Boolean);
    res.json({ items: textItems });

    fs.unlinkSync(req.file.path); // delete temp file
  } catch (error) {
    console.error('OCR error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to extract text' });
  }
});

module.exports = router;
