import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BookProvider } from './contexts/BookContext';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import ProjectsPage from './pages/ProjectsPage';
import NewProjectPage from './pages/NewProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import EditorPage from './pages/EditorPage';
import HomePage from './pages/HomePage';
import PasswordResetPage from './pages/PasswordResetPage';
import PasswordChangePage from './pages/PasswordChangePage';
import './App.css';

// 보호된 라우트 컴포넌트
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  
  if (loading) {
    return (
      <div className="loading">
        <span className="loading-icon" aria-label="loading">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-480Zm-400 0q0-88 34-163t93-130q59-55 136-83.5T508-879q17 2 27 14.5t7 29.5q-3 17-16.5 27t-30.5 9q-69-3-129.5 19.5T259-713q-46 44-72.5 103.5T160-480q0 134 93 227t227 93q69 0 128.5-26.5T712-259q46-48 68-109t19-127q-1-17 9-30.5t27-16.5q17-3 29.5 7t14.5 27q6 87-22.5 164T774-208q-57 62-133 95T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480Zm640-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z"/></svg>
        </span>
        <span>로딩 중...</span>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/accounts/login" replace />;
  }
  
  return children;
};



function App() {
  return (
    <AuthProvider>
      <BookProvider>
        <Router>
          <div className="App">
            <Routes>
              {/* 인증 관련 라우트 */}
              <Route path="/accounts/login" element={<LoginPage />} />
              <Route path="/accounts/password_reset" element={<PasswordResetPage />} />
              <Route path="/accounts/password_change" element={<PasswordChangePage />} />
              
              {/* 보호된 라우트들 */}
              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              } >
                <Route index element={<HomePage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="projects/new" element={<NewProjectPage />} />
                <Route path="projects/:projectId" element={<ProjectDetailPage />} />
                <Route path="projects/:projectId/settings" element={<ProjectSettingsPage />} />
                <Route path="editor/:bookId" element={<EditorPage />} />
              </Route>
            </Routes>
          </div>
        </Router>
      </BookProvider>
    </AuthProvider>
  );
}

export default App; 