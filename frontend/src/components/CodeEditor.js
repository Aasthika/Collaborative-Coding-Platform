import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { socket } from '../utils/socket';

const CodeEditor = ({ roomId, onSaveCode }) => {
  const [code, setCode] = useState('// Start coding together!\nconsole.log("Hello, World!");');
  const [language, setLanguage] = useState('javascript');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const timeoutRef = useRef(null);
  const iframeRef = useRef(null);

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
    
    socket.emit('user-typing', { isTyping: true });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      socket.emit('user-typing', { isTyping: false });
    }, 1000);

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

  // Execute code on backend
  const executeOnBackend = async () => {
    setIsRunning(true);
    setOutput('Executing on server...');
    
    try {
      const response = await fetch('http://localhost:5000/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, language }),
      });
      
      const result = await response.json();
      
      if (result.error) {
        setOutput('❌ Error:\n' + result.output);
      } else {
        setOutput('✅ Output:\n' + result.output);
      }
    } catch (error) {
      setOutput('❌ Connection Error: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  // Run JavaScript code safely in browser
  const runJavaScriptCode = () => {
    setIsRunning(true);
    setOutput('');
    
    try {
      const originalConsoleLog = console.log;
      let consoleOutput = [];
      
      console.log = (...args) => {
        const output = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        consoleOutput.push(output);
        originalConsoleLog(...args);
      };
      
      const result = eval(code);
      
      console.log = originalConsoleLog;
      
      let outputText = '';
      
      if (consoleOutput.length > 0) {
        outputText += 'Console Output:\n' + consoleOutput.join('\n') + '\n\n';
      }
      
      if (result !== undefined) {
        outputText += 'Return Value: ' + 
          (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
      }
      
      setOutput(outputText || '✅ Code executed successfully (no output)');
      
    } catch (error) {
      setOutput('❌ Error: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  // Run HTML code
  const runHTMLCode = () => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              background: white;
              color: black;
            }
          </style>
        </head>
        <body>
          ${code}
          <script>
            const originalLog = console.log;
            console.log = function(...args) {
              window.parent.postMessage({
                type: 'console-output',
                data: args.map(arg => 
                  typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ')
              }, '*');
              originalLog.apply(console, args);
            };
            
            window.onerror = function(message, source, lineno, colno, error) {
              window.parent.postMessage({
                type: 'console-error',
                data: 'Error: ' + message + ' at line ' + lineno
              }, '*');
            };
          </script>
        </body>
        </html>
      `);
      iframeDoc.close();
      setOutput('✅ HTML rendered in preview area');
    }
  };

  // Handle iframe messages for HTML output
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === 'console-output') {
        setOutput(prev => prev + event.data.data + '\n');
      } else if (event.data.type === 'console-error') {
        setOutput(prev => prev + event.data.data + '\n');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Main run function
  const handleRunCode = () => {
    setOutput('');
    setIsRunning(true);
    
    setTimeout(() => {
      try {
        // Use backend execution for these languages
        const backendLanguages = ['python', 'cpp', 'java'];
        
        if (backendLanguages.includes(language)) {
          executeOnBackend();
        } else if (language === 'javascript') {
          runJavaScriptCode();
        } else if (language === 'html') {
          runHTMLCode();
        } else if (language === 'css') {
          setOutput('❌ CSS cannot be executed directly. Use HTML with CSS instead.');
          setIsRunning(false);
        } else {
          setOutput(`❌ Code execution for ${language} is not supported.`);
          setIsRunning(false);
        }
      } catch (error) {
        setOutput('❌ Execution Error: ' + error.message);
        setIsRunning(false);
      }
    }, 100);
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn" 
            onClick={handleRunCode}
            disabled={isRunning}
            style={{ 
              backgroundColor: '#28a745',
              opacity: isRunning ? 0.6 : 1
            }}
          >
            {isRunning ? '🔄 Running...' : '🚀 Run Code'}
          </button>
          <button className="btn btn-success" onClick={handleSave}>
            💾 Save Code
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
          
          <div style={{ 
            height: '200px', 
            borderTop: '1px solid #444',
            backgroundColor: '#1e1e1e',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#2d2d2d',
              borderBottom: '1px solid #444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <strong>Output</strong>
              <button 
                onClick={() => setOutput('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ccc',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear
              </button>
            </div>
            <pre style={{ 
              flex: 1,
              padding: '1rem',
              margin: 0,
              overflow: 'auto',
              fontSize: '14px',
              lineHeight: '1.4',
              color: '#00ff00',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}>
              {output || 'Click "Run Code" to see output here...'}
            </pre>
          </div>
        </div>

        {language === 'html' && (
          <div style={{ 
            width: '50%', 
            borderLeft: '1px solid #444',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              padding: '0.5rem 1rem', 
              backgroundColor: '#2d2d2d',
              borderBottom: '1px solid #444'
            }}>
              <strong>HTML Preview</strong>
            </div>
            <iframe
              ref={iframeRef}
              style={{
                flex: 1,
                border: 'none',
                background: 'white'
              }}
              title="html-preview"
              sandbox="allow-scripts"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeEditor;