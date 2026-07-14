import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBook } from '../contexts/BookContext';
import './MainLayout.css';

const MainLayout = () => {
  const { bookInfo, isLoading } = useBook();
  const { user, logout, isSuperuser, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  console.log('MainLayout - user:', user);
  console.log('MainLayout - loading:', false);

  const handleLogout = () => {
    logout();
    navigate('/accounts/login');
  };

  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  if (!user) {
    console.log('MainLayout - user가 없음, 로그인 페이지로 리다이렉트');
    return (
      <div className="loading">
        <span className="loading-icon" aria-label="loading">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-480Zm-400 0q0-88 34-163t93-130q59-55 136-83.5T508-879q17 2 27 14.5t7 29.5q-3 17-16.5 27t-30.5 9q-69-3-129.5 19.5T259-713q-46 44-72.5 103.5T160-480q0 134 93 227t227 93q69 0 128.5-26.5T712-259q46-48 68-109t19-127q-1-17 9-30.5t27-16.5q17-3 29.5 7t14.5 27q6 87-22.5 164T774-208q-57 62-133 95T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480Zm640-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z"/></svg>
        </span>
        <span>사용자 정보를 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="main-layout">
      {/* 헤더 */}
      <header className="main-header">
        <div className="header-left">
          <h1 className="logo" onClick={() => navigate('/')}>
            Milestone
          </h1>
        </div>
        
        <div className="header-right">
          <div className="user-info">
            <span className="username">{user.username}</span>
            <span className="user-type">({user.user_type})</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout; 