const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get all users except current user
router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password')
      .sort({ isOnline: -1, username: 1 });

    // Get last message for each user
    const usersWithLastMessage = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.user._id, receiver: user._id },
            { sender: user._id, receiver: req.user._id }
          ]
        }).sort({ createdAt: -1 }).populate('sender', 'username');

        return {
          ...user.toObject(),
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            isSentByMe: lastMessage.sender._id.toString() === req.user._id.toString()
          } : null
        };
      })
    );

    res.json(usersWithLastMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;