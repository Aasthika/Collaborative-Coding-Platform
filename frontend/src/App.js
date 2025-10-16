import React, { useState, useEffect } from 'react';
import './App.css';
import CodeEditor from './components/CodeEditor';
import RoomJoin from './components/RoomJoin';
import UserList from './components/UserList';
import { socket } from './utils/socket';

function App() {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [username, setUsername] = useState('');
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    socket.on('users-update', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on('user-typing', (data) => {
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(u => u !== data.username), data.username]);
      } else {
        setTypingUsers(prev => prev.filter(u => u !== data.username));
      }
    });

    socket.on('save-success', (data) => {
      setMessage({ type: 'success', text: data.message });
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('save-error', (data) => {
      setMessage({ type: 'error', text: data.message });
      setTimeout(() => setMessage(''), 3000);
    });

    return () => {
      socket.off('users-update');
      socket.off('user-typing');
      socket.off('save-success');
      socket.off('save-error');
    };
  }, []);

  const handleJoinRoom = (roomData) => {
    setCurrentRoom(roomData);
    setUsername(roomData.username);
  };

  const handleLeaveRoom = () => {
    socket.emit('leave-room');
    setCurrentRoom(null);
    setUsers([]);
    setTypingUsers([]);
  };

  const handleSaveCode = () => {
    // This will be called from CodeEditor component
    socket.emit('save-code', { 
      code: 'current code will be passed from editor', 
      language: 'current language will be passed from editor' 
    });
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Collaborative Code Editor</h1>
        <p>Code together in real-time with your team</p>
      </header>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {!currentRoom ? (
        <RoomJoin onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="main-content">
          <div className="editor-section">
            <div className="room-info">
              <div>
                <h3>Room: {currentRoom.roomId}</h3>
                <p>Welcome, {username}!</p>
              </div>
              <div className="controls">
                <button className="btn" onClick={handleLeaveRoom}>Leave Room</button>
              </div>
            </div>
            <CodeEditor 
              roomId={currentRoom.roomId}
              onSaveCode={handleSaveCode}
            />
          </div>
          <div className="sidebar">
            <UserList users={users} />
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;