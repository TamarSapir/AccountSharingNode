// routes/email.js
const express = require('express');
const router = express.Router();
const sendBillShareEmail = require('../utils/sendEmail');

router.post('/send-email', async (req, res) => {
  try {
    const { to, billLink } = req.body;

    if (!to || !billLink) {
      return res.status(400).json({ error: 'Missing required fields: to, billLink' });
    }

    await sendBillShareEmail(to, billLink);
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;
