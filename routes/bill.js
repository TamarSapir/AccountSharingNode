const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill');
const User = require('../models/User');
const verifyJwt = require('../middleware/authMiddleware');

// create new account
router.post('/create-bill', verifyJwt, async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId in request body' });
  }

  try {
    const newBill = new Bill({
      ownerId: req.user.userId,
      sessionId,
      participants: [],
      sharedWithUsers: []
    });

    await newBill.save();
    res.status(201).json({ billId: newBill._id });
  } catch (err) {
    console.error('Error in create-bill:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'sessionId already exists' });
    }
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// share with other users
router.post('/bills/:id/share', verifyJwt, async (req, res) => {
  const { userIds } = req.body;
  const billId = req.params.id;

  try {
    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    if (bill.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    bill.sharedWithUsers = Array.from(new Set([...bill.sharedWithUsers, ...userIds]));
    await bill.save();

    res.json({ message: 'Bill shared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to share bill' });
  }
});

// search users
router.get('/users/search', verifyJwt, async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    }).select('_id username email');

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

//just freinds can see the bill
router.get('/bills/:sessionId', verifyJwt, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const bill = await Bill.findOne({ sessionId });

    if (!bill) {
      console.warn("❌ Bill not found for session:", sessionId);
      return res.status(404).json({ error: 'Bill not found' });
    }

    const userId = req.user.userId;
    const isOwner = bill.ownerId.toString() === userId;
    const isShared = bill.sharedWithUsers.map(id => id.toString()).includes(userId);

    console.log("🔍 Checking access for user:", userId);
    console.log("📄 Bill owner:", bill.ownerId.toString());
    console.log("👥 Shared with:", bill.sharedWithUsers.map(id => id.toString()));

    if (!isOwner && !isShared) {
      console.warn("🚫 Access denied to bill", sessionId, "for user", userId);
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log("✅ Access granted to bill", sessionId, "for user", userId);
    res.json(bill);
  } catch (err) {
    console.error("❗ Failed to fetch bill:", err);
    res.status(500).json({ error: 'Server error' });
  }
});



module.exports = router;