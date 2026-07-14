import React from 'react';
import './LoadingBar.css';

const LoadingBar = ({ 
  isLoading, 
  message = '파일을 처리하는 중...'
}) => {
  if (!isLoading) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        
        <div className="loading-content">
          <h3 className="loading-title">파일 처리 중</h3>
          <p className="loading-message">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default LoadingBar;
