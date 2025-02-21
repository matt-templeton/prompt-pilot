import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Acquire VS Code API once at the highest level
// console.log("Acquiring api....");
// const vscodeApi = acquireVsCodeApi();
// console.log("did it, ", vscodeApi);
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
