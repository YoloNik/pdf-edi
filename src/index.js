import React from 'react';
import ReactDOM from 'react-dom/client';
import  App  from 'components/App';
import { ThemeProvider } from 'components/ThemeContext';
import './index.css';
import TestApp from "./components/TestApp"

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      {/* <TestApp/> */}
    </ThemeProvider>
  </React.StrictMode>
);
