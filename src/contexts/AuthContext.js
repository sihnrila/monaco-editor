import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(sessionStorage.getItem('token'));

  // 사용자 타입 정의
  const USER_TYPES = {
    SUPERUSER: 'superuser',
    STAFF: 'staff',
    USER: 'user'
  };

  // 프로젝트 역할 정의
  const PROJECT_ROLES = {
    PM: 'PM',
    REVIEWER: 'reviewer',
    WORKER: 'worker'
  };

  // 로그인 함수
  const login = async (username, password) => {
    try {
      const data = await authAPI.login(username, password);
      setToken(data.access);
      sessionStorage.setItem('token', data.access);
      sessionStorage.setItem('refreshToken', data.refresh);
      sessionStorage.setItem('currentUsername', username); // 현재 로그인한 사용자명 저장
      
      // 사용자 정보 가져오기
      await fetchUserInfo();
      return { success: true };
    } catch (error) {
      return { success: false, error: '로그인에 실패했습니다.' };
    }
  };

  // 로그아웃 함수
  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('currentUsername');
  };

  // 사용자 정보 가져오기
  const fetchUserInfo = useCallback(async () => {
    try {
      const userData = await authAPI.getUserProfile();
      
      let currentUser;
      
      // /users/me 엔드포인트에서 직접 사용자 정보를 받은 경우
      if (userData.id && userData.username) {
        currentUser = userData;
      }
      // /users 목록에서 현재 사용자를 찾는 경우
      else if (userData.results && userData.results.length > 0) {
        // 현재 로그인한 사용자명으로 사용자 찾기
        const currentUsername = sessionStorage.getItem('currentUsername');
        if (currentUsername) {
          currentUser = userData.results.find(user => user.username === currentUsername);
        }
        // 현재 사용자를 찾지 못한 경우 fallback
        if (!currentUser) {
          currentUser = userData.results[0];
        }
      }
      
      if (currentUser) {
        const userInfo = {
          id: currentUser.id,
          username: currentUser.username,
          user_type: currentUser.is_superuser ? 'superuser' : (currentUser.is_staff ? 'staff' : 'user'),
          email: currentUser.email,
          project_roles: []
        };
        setUser(userInfo);
      } else {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      // // 임시로 테스트용 사용자 정보 설정 (API 오류 시)
      // const tempUser = {
      //   id: 1,
      //   username: 'admin',
      //   user_type: 'superuser',
      //   email: 'admin@example.com',
      //   project_roles: []
      // };
      // setUser(tempUser);
    }
  }, []);

  // 토큰 갱신
  const refreshToken = async () => {
    try {
      const refreshToken = sessionStorage.getItem('refreshToken');
      if (!refreshToken) return false;

      const response = await fetch('https://lib-editor.boinit.com/api/token/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access);
        sessionStorage.setItem('token', data.access);
        return true;
      }
    } catch (error) {
      console.error('토큰 갱신 실패:', error);
    }
    return false;
  };

  // 권한 확인 함수들
  const isSuperuser = () => user?.user_type === USER_TYPES.SUPERUSER;
  const isStaff = () => user?.user_type === USER_TYPES.STAFF || isSuperuser();
  const isUser = () => user?.user_type === USER_TYPES.USER || isStaff();

  // 프로젝트 권한 확인
  const hasProjectRole = (projectId, role) => {
    if (!user || !user.project_roles) return false;
    return user.project_roles.some(pr => 
      pr.project_id === projectId && pr.role === role
    );
  };

  const isProjectPM = (projectId) => hasProjectRole(projectId, PROJECT_ROLES.PM);
  const isProjectReviewer = (projectId) => hasProjectRole(projectId, PROJECT_ROLES.REVIEWER);
  const isProjectWorker = (projectId) => hasProjectRole(projectId, PROJECT_ROLES.WORKER);

  // 초기화 (포트폴리오 데모용 - 항상 임시 유저로 로그인)
  useEffect(() => {
    const initializeAuth = async () => {
      setUser({
        id: 1,
        username: 'demo',
        user_type: 'superuser',
        email: 'demo@local.dev',
        project_roles: []
      });
      setLoading(false);
    };

    initializeAuth();
  }, [token, fetchUserInfo]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshToken,
    isSuperuser,
    isStaff,
    isUser,
    hasProjectRole,
    isProjectPM,
    isProjectReviewer,
    isProjectWorker,
    USER_TYPES,
    PROJECT_ROLES
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 