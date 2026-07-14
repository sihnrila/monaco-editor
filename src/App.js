import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BookProvider } from './contexts/BookContext';
import EditorPage from './pages/EditorPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BookProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<EditorPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Router>
      </BookProvider>
    </AuthProvider>
  );
}

export default App; 