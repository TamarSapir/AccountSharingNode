const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const User = require("../models/User");
const Item = require("../models/item");
const verifyJwt = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const sendBillShareEmail = require("../utils/sendEmail");
const mongoose = require("mongoose");
const item = require("../models/item");
const { JOIN_LINK_EXPIRATION, INVITE_SECRET } = require("../consts");
const calculatePayments = require("../utils/calculatePayments");
//helper function for checking accsess
async function loadBillAndCheckAccess(sessionId, userId) {
  const bill = await Bill.findOne({ sessionId });
  if (!bill) return { status: 404, error: "Bill not found" };

  const isOwner = bill.ownerId.toString() === userId;
  const isShared = bill.sharedWithUsers
    .map((id) => id.toString())
    .includes(userId);
  if (!isOwner && !isShared) return { status: 403, error: "Access denied" };

  return { status: 200, bill };
}

// create new account
router.post("/create-bill", verifyJwt, async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId in request body" });
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
    console.error("Error in create-bill:", err);

    // return the exist one
    if (err?.code === 11000) {
      const existing = await Bill.findOne({ sessionId }, { _id: 1 }).lean();
      if (existing) return res.status(200).json({ billId: existing._id });
      return res.status(409).json({ error: "sessionId already exists" });
    }

    res.status(500).json({ error: "Failed to create bill" });
  }
});

// share with other users
router.post("/bills/:id/share", verifyJwt, async (req, res) => {
  const { userIds = [] } = req.body;
  const billId = req.params.id;

  try {
    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const requester = req.user.userId;
    const isOwner = bill.ownerId.toString() === requester;
    const isShared = bill.sharedWithUsers
      .map((id) => id.toString())
      .includes(requester);

    //just owners and shared users can see
    if (!isOwner && !isShared) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // share to users
    const current = bill.sharedWithUsers.map((id) => id.toString());
    const incoming = userIds.map(String);
    const merged = [...new Set([...current, ...incoming])]
      .filter((id) => id !== requester && id !== bill.ownerId.toString())
      .map((id) => new mongoose.Types.ObjectId(id));

    bill.sharedWithUsers = merged;
    await bill.save();

    // send emails
    const usersToNotify = await User.find({ _id: { $in: merged } });
    const base = process.env.FRONTEND_URL || "http://localhost:5173";
    const billLink = `${base}/bill/${bill.sessionId}`;

    for (const u of usersToNotify) {
      await sendBillShareEmail(u.email, billLink);
    }

    res.json({ message: "Bill shared and emails sent successfully" });
  } catch (err) {
    console.error("Error sharing bill:", err);
    res.status(500).json({ error: "Failed to share bill" });
  }
});

// search users
router.get("/users/search", verifyJwt, async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: "i" } },
        { username: { $regex: query, $options: "i" } },
      ],
    }).select("_id username email");

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/bills/:sessionId/invite", verifyJwt, async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = req.user;

  try {
    const bill = await Bill.findById(sessionId);

    if (!bill) return res.status(404).json({ error: "Bill not found" });
    if (bill.ownerId.toString() !== userId) {
      return res.status(403).json({ error: "Only owner can create links" });
    }
    console.log(INVITE_SECRET);
    const token = jwt.sign({ sessionId }, INVITE_SECRET, {
      expiresIn: JOIN_LINK_EXPIRATION,
    });
    const inviteLink = `${process.env.CLIENT_URL}/join?token=${token}`;

    res.json({ inviteLink });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "couldnt create link" });
  }
});

router.post("/bills", verifyJwt, async (req, res) => {
  const { userId } = req.user;

  try {
    const bills = await Bill.find({ ownerId: userId })
      .populate("participants.id", "username")
      .lean();
    const sessionIds = bills.map((b) => b._id);

    const items = await Item.find({ sessionId: { $in: sessionIds } }).lean();
    const billsWithItems = bills.map((bill) => {
      let sum = 0;
      items.forEach((item) => (sum += item.price));

      return {
        ...bill,
        items: items.filter(
          (item) => item.sessionId.toString() === bill._id.toString()
        ),
        total: sum,
      };
    });

    res.json({ bills: billsWithItems });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "couldnt create link" });
  }
});

router.post("/bills/join", verifyJwt, async (req, res) => {
  const { token } = req.body;
  const { userId, username } = req.user;

  try {
    const decoded = jwt.verify(token, INVITE_SECRET);
    const { sessionId } = decoded;

    const bill = await Bill.findOne({ _id: sessionId });

    if (!bill) {
      return res.status(400).json({ error: "Bill doesnt exist" });
    }

    console.log(bill.participants);
    console.log(userId);
    if (
      bill.ownerId.toString() === userId.toString() ||
      bill.participants.some(({ id }) => id.toString() === userId.toString())
    ) {
      console.log("user is already a participant");
      return res.json({ success: true, sessionId });
    }

    if (
      bill.state === 'Paid'
    ) {
      console.log("already finished");
      return res.json({ success: true, sessionId });
    }

    const updatedBill = await Bill.findOneAndUpdate(
      {
        _id: sessionId,
        "participants.id": { $ne: userId },
        state: "Not Paid",
      },
      {
        $push: { participants: { id: userId, permission: 1 } },
      },
      { new: true }
    );

    if (!updatedBill) {
      console.log("already participant");
      return res.json({ success: true, sessionId });
    }

    req.io
      .to(sessionId)
      .emit("billEvent", {
        type: "UPDATE",
        message: `${username} was added to bill`,
      });
    console.log(`Added userId ${userId}`);
    res.json({ success: true, sessionId });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: "Invalid or expired token" });
  }
});
//just frindes can see the bill
router.post("/bills/:sessionId", verifyJwt, async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = req.user;

  try {
    const bill = await Bill.findOne({ _id: sessionId }, {})
      .populate("participants.id", "username")
      .lean()
      .exec();
    const items = await Item.find({ sessionId })
      .populate("lockedBy.userId", "username _id")
      .populate("paidBy.userId", "username")
      .lean();

    console.log(bill.ownerId.toString());
    console.log(userId.toString());
    console.log(bill.participants);
    if (
      bill.ownerId.toString() !== userId.toString() &&
      bill.participants.every(
        ({ id }) => id._id.toString() !== userId.toString()
      )
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    //console.log(items);
    bill.items = items.map((item) => {
      console.log(userId);
      console.log(item?.lockedBy);

      return {
        ...item,
        lockedBy: {
          user: item?.lockedBy?.userId?.username ?? "",
          disabled:
            item?.lockedBy?.status === true &&
            item?.lockedBy?.userId?._id?.toString() !== userId,
        },
      };
    });
    //console.log(bill.items);

    if (!bill) {
      console.warn("Bill not found for session:", sessionId);
      return res.status(404).json({ error: "Bill not found" });
    }

    let total = 0;
    let totalPaid = 0;
    items.forEach((item) => {
      total += item.totalQuantity * item.price;
      totalPaid += (item.totalQuantity - item.quantity) * item.price;
    });

    bill.total = total;
    bill.totalPaid = totalPaid;
    const paidBy = calculatePayments(items)
    bill.paidBy = paidBy
    bill.participants = bill.participants.map((participant) => {
    return {
      ...participant,
      totalPaid: paidBy[participant.id],
    }}
    )

    res.json(bill);
  } catch (err) {
    console.error("Failed to fetch bill:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/bills/:sessionId/lock-items", verifyJwt, async (req, res) => {
  const { items } = req.body;
  const { userId } = req.user;
  const { sessionId } = req.params;
  const { io } = req;

  console.log(items);
  try {
    await Item.updateMany(
      {
        sessionId,
        _id: { $in: items },
        $or: [{ "lockedBy.status": false }, { lockedBy: { $exists: false } }],
      },
      {
        $set: { lockedBy: { userId, status: true, date: Date.now() } },
      }
    );

    req.io.to(sessionId).emit("billEvent", { type: "UPDATE" });

    const updatedItems = await Item.find({
      sessionId,
      _id: { $in: items },
      "lockedBy.userId": userId,
      "lockedBy.status": true,
    }).select("_id");

    res.status(200).json({ success: true, updatedItems });
  } catch (error) {
    console.error("Failed to fetch bill items:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/bills/:sessionId/unlock-items", verifyJwt, async (req, res) => {
  const { items } = req.body;
  const { userId } = req.user;
  const { sessionId } = req.params;
  const { io } = req;

  console.log(items);
  try {
    await Item.updateMany(
      {
        sessionId,
        _id: { $in: items },
        $and: [{ "lockedBy.status": true }, { "lockedBy.userId": userId }],
      },
      {
        $set: { lockedBy: { userId: null, status: false, date: Date.now() } },
      }
    );

    req.io.to(sessionId).emit("billEvent", { type: "UPDATE" });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Failed to fetch bill items:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/bills/:sessionId/pay-items", verifyJwt, async (req, res) => {
  const { items } = req.body;
  const { userId } = req.user;
  const { sessionId } = req.params;

  try {
    // Build bulk operations
    const operations = items.map(({ _id, quantity: payQty }) => ({
      updateOne: {
        filter: {
          _id,
          sessionId,
          "lockedBy.userId": userId,
          quantity: { $gte: payQty },
        },
        update: {
          $push: { paidBy: { userId, quantity: payQty } },
          $inc: { quantity: -payQty },
          $set: { lockedBy: { userId: null, status: false, date: Date.now() } },
        },
      },
    }));

    // Execute all updates in one bulkWrite
    const result = await Item.bulkWrite(operations);

    const remainingItems = await Item.find({
      sessionId,
      quantity: { $gt: 0 }, // still unpaid
    }).lean();

    if (remainingItems.length === 0) {
      // All items are paid → set bill state to 'paid'
      await Bill.updateOne(
        { _id: sessionId },
        { $set: { state: "Paid", updatedAt: new Date() } }
      );
    }

    req.io.to(sessionId).emit("billEvent", { type: "UPDATE" });

    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update items" });
  }
});
//get the items of the recipe when you get a invitation for a sharing bill
router.get("/bills/:sessionId/items", verifyJwt, async (req, res) => {
  const { sessionId } = req.params;
  try {
    const { status, error, bill } = await loadBillAndCheckAccess(
      sessionId,
      req.user.userId
    );
    if (status !== 200) return res.status(status).json({ error });

    const items = await Item.find({ sessionId })
      .select("_id name quantity price") //show the instrsting things for the user
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error("Failed to fetch bill items:", err);
    res.status(500).json({ error: "Server error" });
  }
});
module.exports = router;
