import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './components/App.jsx';
import DeepAnalysis from './components/DeepAnalysis.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/deep/:entryId" element={<DeepAnalysis />} />
    </Routes>
  </BrowserRouter>
);
