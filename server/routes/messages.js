const express = require('express');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get messages for a conversation
router.get('/conversations/:userId/messages', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
      .populate('sender', 'username')
      .populate('receiver', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mark messages as delivered
    await Message.updateMany(
      {
        sender: userId,
        receiver: req.user._id,
        delivered: false
      },
      { delivered: true }
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;