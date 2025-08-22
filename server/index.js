const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/messages', messageRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('Authentication error'));
    }

    socket.userId = user._id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('User connected:', socket.userId);

  // Update user online status
  await User.findByIdAndUpdate(socket.userId, { 
    isOnline: true,
    lastSeen: new Date()
  });

  // Join user to their own room
  socket.join(socket.userId);

  // Handle sending messages
  socket.on('message:send', async (data) => {
    try {
      const { receiverId, content } = data;

      const message = new Message({
        sender: socket.userId,
        receiver: receiverId,
        content,
        delivered: false,
        isRead: false
      });

      await message.save();
      
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username')
        .populate('receiver', 'username');

      // Emit to sender
      socket.emit('message:sent', populatedMessage);

      // Emit to receiver
      socket.to(receiverId).emit('message:new', populatedMessage);

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message:error', { error: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing:start', (data) => {
    socket.to(data.receiverId).emit('typing:start', { senderId: socket.userId });
  });

  socket.on('typing:stop', (data) => {
    socket.to(data.receiverId).emit('typing:stop', { senderId: socket.userId });
  });

  // Handle message read receipts
  socket.on('message:read', async (data) => {
    try {
      const { senderId } = data;

      await Message.updateMany(
        {
          sender: senderId,
          receiver: socket.userId,
          isRead: false
        },
        { isRead: true }
      );

      socket.to(senderId).emit('message:read', { readerId: socket.userId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.userId);

    // Update user online status
    await User.findByIdAndUpdate(socket.userId, { 
      isOnline: false,
      lastSeen: new Date()
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});