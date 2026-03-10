
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.innerText = "Error: Could not find root element to mount to";
  document.body.appendChild(errorDiv);
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e: any) {
  console.error("Mounting error:", e);
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.backgroundColor = 'white';
  errorDiv.style.padding = '20px';
  errorDiv.style.margin = '20px';
  errorDiv.style.border = '2px solid red';
  errorDiv.innerHTML = `<h1>Mounting Error</h1><pre>${e?.message || e}</pre><p>Check the console for more details.</p>`;
  document.body.appendChild(errorDiv);
}

