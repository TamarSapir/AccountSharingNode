// routes/scan.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

router.post('/scan-receipt', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const form = new FormData();
    form.append('image', fs.createReadStream(req.file.path));

    const response = await axios.post('https://api.api-ninjas.com/v1/imagetotext', form, {
      headers: {
        'X-Api-Key': 'YOUR_API_KEY_HERE',
        ...form.getHeaders(),
      },
    });

    const textItems = response.data.map((item) => item.text);
    res.json({ items: textItems });

    fs.unlinkSync(req.file.path); //clean file
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Failed to extract text' });
  }
});

module.exports = router;
