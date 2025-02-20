import React, { useEffect } from 'react';
import './App.css';

function App() {
  useEffect(() => {
    // Setup message listener
    window.addEventListener('message', event => {
      const message = event.data;
      // Handle messages from extension
      console.log('Message received:', message);
    });

    // Notify extension that webview is ready
    // vscode.postMessage({ type: 'webviewReady' });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Prompt Pilot Panel</h1>
      </header>
    </div>
  );
}

export default App;
