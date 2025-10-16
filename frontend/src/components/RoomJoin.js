import React, { useState } from 'react';

const RoomJoin = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (roomId.trim() && username.trim()) {
      localStorage.setItem('username', username);
      onJoinRoom({ roomId: roomId.trim(), username: username.trim() });
    }
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(id);
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '60vh',
      padding: '2rem'
    }}>
      <div style={{ 
        backgroundColor: '#2d2d2d', 
        padding: '2rem', 
        borderRadius: '8px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#61dafb' }}>
          Join a Coding Room
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Your Name</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="roomId">
              Room ID 
              <button 
                type="button" 
                onClick={generateRoomId}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#61dafb',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginLeft: '0.5rem'
                }}
              >
                (Generate Random)
              </button>
            </label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn"
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Join Room
          </button>
        </form>

        <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#ccc' }}>
          <h4>How it works:</h4>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <li>Enter your name and a room ID</li>
            <li>Share the room ID with your teammates</li>
            <li>Start coding together in real-time!</li>
            <li>Your code is automatically saved</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoomJoin;