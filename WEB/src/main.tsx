import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Open the calendar when a date input is clicked anywhere, not just on its icon
document.addEventListener('click', (e) => {
  const target = e.target;
  if (target instanceof HTMLInputElement && target.type === 'date' && !target.disabled && !target.readOnly) {
    try {
      target.showPicker();
    } catch {
      // showPicker is unsupported or blocked; the native icon still works
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
