const express = require('express');
const router = express.Router();
const Bill = require('../models/Bill');
const User = require('../models/User');
const Item = require('../models/item');
const verifyJwt = require('../middleware/authMiddleware');
const sendBillShareEmail = require('../utils/sendEmail');
const mongoose = require('mongoose');

//helper function for checking accsess
async function loadBillAndCheckAccess(sessionId, userId) {
  const bill = await Bill.findOne({ sessionId });
  if (!bill) return { status: 404, error: 'Bill not found' };

  const isOwner  = bill.ownerId.toString() === userId;
  const isShared = bill.sharedWithUsers.map(id => id.toString()).includes(userId);
  if (!isOwner && !isShared) return { status: 403, error: 'Access denied' };

  return { status: 200, bill };
}

// create new account
router.post('/create-bill', verifyJwt, async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId in request body' });
  }

  try {
    //if not exist try insert
    const setOnInsert = {
      ownerId: req.user.userId,
      sessionId,
      participants: [],
      sharedWithUsers: [],
      createdAt: new Date(),
    };

    //avoid doubles
    const result = await Bill.updateOne(
      { sessionId },
      { $setOnInsert: setOnInsert },
      { upsert: true }
    );

    //decide create new or use exist
     if (result.upsertedId) {
      const billId = result.upsertedId._id || result.upsertedId;
      return res.status(201).json({ billId });
    }

    // if already exist
    const existing = await Bill.findOne({ sessionId }, { _id: 1 }).lean();
    if (existing) return res.status(200).json({ billId: existing._id });

    // not created and not found
    const created = await Bill.create(setOnInsert);
    return res.status(201).json({ billId: created._id });

  } catch (err) {
    console.error('Error in create-bill:', err);

    // return the exist one
    if (err?.code === 11000) {
      const existing = await Bill.findOne({ sessionId }, { _id: 1 }).lean();
      if (existing) return res.status(200).json({ billId: existing._id });
      return res.status(409).json({ error: 'sessionId already exists' });
    }

    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// share with other users
router.post('/bills/:id/share', verifyJwt, async (req, res) => {
  const { userIds = [] } = req.body;
  const billId = req.params.id;

  try {
    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    if (bill.ownerId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // save users that share
     const merged = [
      ...bill.sharedWithUsers.map(id => id.toString()),
      ...userIds.map(id => id.toString())
    ];
    const unique = [...new Set(merged)].map(id => new mongoose.Types.ObjectId(id));
    bill.sharedWithUsers = unique;
    await bill.save();

    // get userIds
    const usersToNotify = await User.find({ _id: { $in: userIds } });

    // send mail to user that we share with
     for (const user of usersToNotify) {
      const base = process.env.FRONTEND_URL || 'http://localhost:5173';
      const billLink = `${base}/bill/${bill.sessionId}`;
      await sendBillShareEmail(user.email, billLink);
    }

    res.json({ message: 'Bill shared and emails sent successfully' });
  } catch (err) {
    console.error('Error sharing bill:', err);
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

//just frindes can see the bill
router.get('/bills/:sessionId', verifyJwt, async (req, res) => {
  const { sessionId } = req.params;

  try {
    const bill = await Bill.findOne({ sessionId });

    if (!bill) {
      console.warn("Bill not found for session:", sessionId);
      return res.status(404).json({ error: 'Bill not found' });
    }

    const userId = req.user.userId;
    const isOwner = bill.ownerId.toString() === userId;
    const isShared = bill.sharedWithUsers.map(id => id.toString()).includes(userId);

    console.log("Checking access for user:", userId);
    console.log("Bill owner:", bill.ownerId.toString());
    console.log("Shared with:", bill.sharedWithUsers.map(id => id.toString()));

    if (!isOwner && !isShared) {
      console.warn("Access denied to bill", sessionId, "for user", userId);
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log("Access granted to bill", sessionId, "for user", userId);
    res.json(bill);
  } catch (err) {
    console.error("Failed to fetch bill:", err);
    res.status(500).json({ error: 'Server error' });
  }
});


//get the items of the recipe when you get a invitation for a sharing bill
router.get('/bills/:sessionId/items', verifyJwt, async (req, res) => {
  const { sessionId } = req.params;
  try {
    const { status, error, bill } = await loadBillAndCheckAccess(sessionId, req.user.userId);
    if (status !== 200) return res.status(status).json({ error });

    const items = await Item.find({ sessionId })
      .select('_id name quantity price') //show the instrsting things for the user
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error('Failed to fetch bill items:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
module.exports = router;