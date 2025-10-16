const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codeeditor';
const client = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let roomsCollection;
let usersCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('collaborative_code_editor');
    roomsCollection = db.collection('rooms');
    usersCollection = db.collection('users');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

connectDB();

// Store active users and rooms in memory (for demo purposes)
const activeUsers = new Map();
const roomData = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', async (data) => {
    const { roomId, username } = data;
    
    // Add user to room
    socket.join(roomId);
    activeUsers.set(socket.id, { username, roomId });
    
    // Initialize room if it doesn't exist
    if (!roomData.has(roomId)) {
      const roomDoc = await roomsCollection.findOne({ roomId });
      if (roomDoc) {
        roomData.set(roomId, {
          code: roomDoc.code || '',
          language: roomDoc.language || 'javascript'
        });
      } else {
        roomData.set(roomId, {
          code: '// Start coding together!\nconsole.log("Hello, World!");',
          language: 'javascript'
        });
      }
    }

    // Send current room data to the new user
    socket.emit('room-data', roomData.get(roomId));
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      username,
      users: getUsersInRoom(roomId)
    });

    // Send updated user list to all in room
    io.to(roomId).emit('users-update', getUsersInRoom(roomId));
    
    console.log(`${username} joined room ${roomId}`);
  });

  // Handle code changes
  socket.on('code-change', (data) => {
    const user = activeUsers.get(socket.id);
    if (user && roomData.has(user.roomId)) {
      const roomInfo = roomData.get(user.roomId);
      roomInfo.code = data.code;
      
      // Broadcast to other users in the room
      socket.to(user.roomId).emit('code-update', data);
    }
  });

  // Handle language change
  socket.on('language-change', (data) => {
    const user = activeUsers.get(socket.id);
    if (user && roomData.has(user.roomId)) {
      roomData.get(user.roomId).language = data.language;
      socket.to(user.roomId).emit('language-update', data);
    }
  });

  // Save code to database
  socket.on('save-code', async (data) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      try {
        await roomsCollection.updateOne(
          { roomId: user.roomId },
          { 
            $set: { 
              code: data.code,
              language: data.language,
              lastSaved: new Date()
            }
          },
          { upsert: true }
        );
        socket.emit('save-success', { message: 'Code saved successfully!' });
      } catch (error) {
        socket.emit('save-error', { message: 'Failed to save code' });
      }
    }
  });

  // Handle user typing
  socket.on('user-typing', (data) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      socket.to(user.roomId).emit('user-typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      const { username, roomId } = user;
      activeUsers.delete(socket.id);
      
      socket.to(roomId).emit('user-left', {
        username,
        users: getUsersInRoom(roomId)
      });

      io.to(roomId).emit('users-update', getUsersInRoom(roomId));
      console.log(`${username} left room ${roomId}`);
    }
  });

  // Helper function to get users in a room
  function getUsersInRoom(roomId) {
    const users = [];
    activeUsers.forEach((user, socketId) => {
      if (user.roomId === roomId) {
        users.push({
          username: user.username,
          socketId: socketId
        });
      }
    });
    return users;
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});