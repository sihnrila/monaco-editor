import React from 'react';
import { Navigate } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  console.log('HomePage - 프로젝트 목록으로 리다이렉트');
  return <Navigate to="/projects" replace />;
};

export default HomePage; 