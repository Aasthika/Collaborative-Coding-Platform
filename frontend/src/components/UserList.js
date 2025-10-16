import React from 'react';

const UserList = ({ users }) => {
  return (
    <div className="user-list">
      <h3>Online Users ({users.length})</h3>
      {users.map((user, index) => (
        <div key={user.socketId} className="user-item">
          <div className="user-dot"></div>
          <span>{user.username}</span>
          {index === 0 && <span style={{marginLeft: 'auto', fontSize: '0.8rem', color: '#61dafb'}}>👑</span>}
        </div>
      ))}
      {users.length === 0 && (
        <p style={{ color: '#888', fontStyle: 'italic' }}>No users online</p>
      )}
    </div>
  );
};

export default UserList;