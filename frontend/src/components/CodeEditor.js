import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { socket } from '../utils/socket';

const CodeEditor = ({ roomId, onSaveCode }) => {
  const [code, setCode] = useState('// Start coding together!\nconsole.log("Hello, World!");');
  const [language, setLanguage] = useState('javascript');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const timeoutRef = useRef(null);

  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
  ];

  useEffect(() => {
    // Socket event listeners
    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room-data', (data) => {
      setCode(data.code);
      setLanguage(data.language);
    });

    socket.on('code-update', (data) => {
      setCode(data.code);
    });

    socket.on('language-update', (data) => {
      setLanguage(data.language);
    });

    // Join room when component mounts
    if (roomId) {
      const username = localStorage.getItem('username') || `User${Math.floor(Math.random() * 1000)}`;
      socket.emit('join-room', { roomId, username });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-data');
      socket.off('code-update');
      socket.off('language-update');
    };
  }, [roomId]);

  const handleCodeChange = (value) => {
    setCode(value);
    
    // Emit typing start
    socket.emit('user-typing', { isTyping: true });
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set timeout to emit typing stop
    timeoutRef.current = setTimeout(() => {
      socket.emit('user-typing', { isTyping: false });
    }, 1000);

    // Emit code change to other users
    socket.emit('code-change', { code: value });
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit('language-change', { language: newLanguage });
  };

  const handleSave = () => {
    onSaveCode(code, language);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        padding: '0.5rem 1rem', 
        backgroundColor: '#2d2d2d', 
        borderBottom: '1px solid #444',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            value={language} 
            onChange={handleLanguageChange}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: '#3c3c3c',
              color: 'white',
              border: '1px solid #555',
              borderRadius: '4px'
            }}
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            fontSize: '0.9rem',
            color: isConnected ? '#28a745' : '#dc3545'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? '#28a745' : '#dc3545',
              marginRight: '0.5rem'
            }}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <button className="btn btn-success" onClick={handleSave}>
          Save Code
        </button>
      </div>
      
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;