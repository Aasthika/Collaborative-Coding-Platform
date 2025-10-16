const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { exec } = require('child_process');
const { writeFileSync, unlinkSync, mkdirSync, existsSync } = require('fs');
const path = require('path');
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

// Create temp directory for code execution
const tempDir = path.join(__dirname, 'temp');
if (!existsSync(tempDir)) {
  mkdirSync(tempDir, { recursive: true });
}

// Code execution endpoint
app.post('/api/execute', async (req, res) => {
  const { code, language } = req.body;
  
  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  try {
    let command = '';
    let filename = '';
    const tempFilePath = path.join(tempDir, `code_${Date.now()}`);

    switch (language) {
      case 'javascript':
        filename = tempFilePath + '.js';
        writeFileSync(filename, code);
        command = `node ${filename}`;
        break;
      
      case 'python':
        filename = tempFilePath + '.py';
        writeFileSync(filename, code);
        command = `python ${filename}`;
        break;
      
      case 'cpp':
        filename = tempFilePath + '.cpp';
        const exeFilename = tempFilePath;
        writeFileSync(filename, code);
        command = `g++ ${filename} -o ${exeFilename} && ${exeFilename}`;
        break;
      
      case 'java':
        filename = tempFilePath + '.java';
        writeFileSync(filename, code);
        // Extract class name from Java code
        const classNameMatch = code.match(/class\s+(\w+)/);
        const className = classNameMatch ? classNameMatch[1] : 'Main';
        command = `javac ${filename} && java -cp ${tempDir} ${className}`;
        break;
      
      default:
        return res.status(400).json({ error: `Language ${language} not supported for execution` });
    }

    console.log(`Executing ${language} code...`);

    exec(command, { timeout: 10000, cwd: tempDir }, (error, stdout, stderr) => {
      // Clean up temp files
      try {
        if (existsSync(filename)) unlinkSync(filename);
        if (existsSync(tempFilePath)) unlinkSync(tempFilePath);
        if (existsSync(tempFilePath + '.exe')) unlinkSync(tempFilePath + '.exe');
        if (existsSync(tempFilePath + '.class')) unlinkSync(tempFilePath + '.class');
      } catch (cleanupError) {
        console.log('Cleanup warning:', cleanupError.message);
      }

      if (error) {
        res.json({ 
          output: stderr || error.message,
          error: true 
        });
      } else {
        res.json({ 
          output: stdout || 'Code executed successfully (no output)',
          error: false 
        });
      }
    });

  } catch (error) {
    res.status(500).json({ 
      error: 'Execution failed',
      details: error.message 
    });
  }
});

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