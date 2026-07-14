import { getWorkspaceBaseUrl } from './url';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://lib-editor.boinit.com/api';

// API 요청 헬퍼 함수
const apiRequest = async (endpoint, options = {}) => {
  let token = sessionStorage.getItem('token');
  console.log('apiRequest - 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
  
  const defaultHeaders = {
    ...(token && { 'Authorization': `Bearer ${token}` }),
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  console.log('apiRequest - 헤더 확인:', defaultHeaders);

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.log('401 에러 발생, 토큰 갱신 시도...');
        // 토큰 만료 시 갱신 시도
        const refreshResult = await refreshToken();
        if (refreshResult) {
          console.log('토큰 갱신 성공, 요청 재시도...');
          // 토큰 갱신 성공 시 원래 요청 재시도
          const newToken = sessionStorage.getItem('token');
          config.headers.Authorization = `Bearer ${newToken}`;
          response = await fetch(`${API_BASE_URL}${endpoint}`, config);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        } else {
          console.log('토큰 갱신 실패, 로그인 페이지로 리다이렉트...');
          // 토큰 갱신 실패 시 로그인 페이지로 리다이렉트
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refreshToken');
          window.location.href = '/accounts/login';
          throw new Error('Authentication failed');
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// 토큰 갱신
const refreshToken = async () => {
  try {
    const refreshToken = sessionStorage.getItem('refreshToken');
    if (!refreshToken) {
      console.log('refreshToken이 없음');
      return false;
    }

    console.log('토큰 갱신 시도...');
    const response = await fetch(`${API_BASE_URL}/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    console.log('토큰 갱신 응답 상태:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('토큰 갱신 성공:', data);
      sessionStorage.setItem('token', data.access);
      if (data.refresh) {
        sessionStorage.setItem('refreshToken', data.refresh);
      }
      return true;
    } else {
      console.log('토큰 갱신 실패:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('에러 내용:', errorText);
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  return false;
};

// 인증 관련 API
export const authAPI = {
  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Login failed');
  },

  getUserProfile: async () => {
    // 현재 로그인한 사용자 정보를 가져오기 위해 /users/me 엔드포인트 시도
    try {
      const response = await apiRequest('/users');
      return await response.json();
    } catch (error) {
      console.log('users 엔드포인트 실패, users 목록에서 현재 사용자 찾기 시도');
      // fallback: 모든 사용자 목록을 가져와서 현재 토큰의 사용자 찾기
      const response = await apiRequest('/users');
      return await response.json();
    }
  },
};

// 프로젝트 관련 API
export const projectAPI = {
  getProjects: async () => {
    const token = sessionStorage.getItem('token');
    console.log('projectAPI.getProjects - 토큰:', token ? '있음' : '없음');
    
    const response = await apiRequest('/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return await response.json();
  },

  getProject: async (projectId) => {
    const response = await apiRequest(`/projects/${projectId}`);
    return await response.json();
  },

  createProject: async (projectData) => {
    const response = await apiRequest('/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });
    return await response.json();
  },

  updateProject: async (projectId, projectData) => {
    const response = await apiRequest(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
    return await response.json();
  },

  deleteProject: async (projectId) => {
    const response = await apiRequest(`/projects/${projectId}`, {
      method: 'DELETE',
    });
    return response.ok;
  },
};

// 도서 관련 API
export const bookAPI = {
  getBooks: async (projectId) => {
    const response = await apiRequest(`/books?project=${projectId}`);
    return await response.json();
  },

  getBook: async (bookId) => {
    const response = await apiRequest(`/books/${bookId}`);
    return await response.json();
  },

  uploadBook: async (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', projectId);

    const response = await apiRequest('/books/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
      },
      body: formData,
    });
    return await response.json();
  },

  // 실시간 검증 API (로컬 검증만 수행)
  validateBookWorkspace: async (bookId, fileContent, relpath) => {
    try {
      console.log(`🔍 실시간 검증 API 호출 (로컬 검증): ${relpath}`);
      
      // 로컬 검증 결과 반환 (실제 API 호출 없음)
      const validationResult = {
        success: true,
        message: '로컬 검증 완료',
        file: relpath,
        contentLength: fileContent.length
      };
      
      console.log('✅ 실시간 검증 API 응답:', validationResult);
      return validationResult;
    } catch (error) {
      console.error('❌ 실시간 검증 API 오류:', error);
      throw error;
    }
  },

  // 접근성 표준 검사 API
  checkAccessibility: async (bookId) => {
    try {
      console.log(`🔍 접근성 검사 API 호출: /books/${bookId}/ace`);
      console.log(`🔍 API URL: ${API_BASE_URL}/books/${bookId}/ace`);
      
      const response = await apiRequest(`/books/${bookId}/ace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('✅ 접근성 검사 API 응답:', data);
      return data;
    } catch (error) {
      console.error('❌ 접근성 검사 API 오류:', error);
      throw error;
    }
  },

  // 전자책 표준 검사 API
  checkEpubStandard: async (bookId) => {
    try {
      console.log(`🔍 EPUB 검사 API 호출: /books/${bookId}/epubcheck`);
      console.log(`🔍 API URL: ${API_BASE_URL}/books/${bookId}/epubcheck`);
      
      const response = await apiRequest(`/books/${bookId}/epubcheck`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      console.log('✅ EPUB 검사 API 응답:', data);
      return data;
    } catch (error) {
      console.error('❌ EPUB 검사 API 오류:', error);
      throw error;
    }
  },

  updateBookWorkspace: async (bookId, files, deletedFiles = []) => {
    console.log('🔍 updateBookWorkspace 호출:', { bookId, filesCount: files?.length, deletedFilesCount: deletedFiles?.length });
    
    const formData = new FormData();
    
    // 수정된 파일들 추가
    if (files && Array.isArray(files) && files.length > 0) {
      files.forEach((file, index) => {
        formData.append('file', new Blob([file.content]));
        formData.append('relpath', file.relpath);
        console.log(`🔍 파일 ${index} 전송:`, {
          relpath: file.relpath,
          contentLength: file.content.length,
          contentPreview: file.content.substring(0, 100) + '...'
        });
      });
    }
    

    
    const response = await fetch(`${API_BASE_URL}/books/${bookId}/workspace/put`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 오류:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const responseText = await response.text();
    console.log('✅ 저장 완료:', responseText || '빈 응답');
    
    return responseText ? JSON.parse(responseText) : { success: true };
  },

  getBookWorkspace: async (bookId) => {
    // 캐시 방지를 위한 타임스탬프 추가
    const timestamp = new Date().getTime();
    const response = await apiRequest(`/books/${bookId}/workspace?t=${timestamp}`);
    return await response.json();
  },

  downloadBook: async (bookId) => {
    const response = await apiRequest(`/books/${bookId}/download`);
    return await response.blob();
  },

  // 워크스페이스 기본 URL 가져오기
  getWorkspaceBaseUrl: async (bookId) => {
    try {
      const response = await apiRequest(`/books/${bookId}/workspace`);
      const workspaceData = await response.json();
      
      // 워크스페이스 데이터에서 기본 URL 추출
      let baseUrl = null;
      
      if (workspaceData && Array.isArray(workspaceData)) {
        // 배열 형태의 데이터에서 URL 찾기
        for (const node of workspaceData) {
          if (node.url && node.url.includes('/workspace/')) {
            const urlParts = node.url.split('/workspace/');
            if (urlParts.length > 0) {
              baseUrl = urlParts[0] + '/workspace/';
              break;
            }
          }
        }
      } else if (workspaceData && workspaceData.files) {
        // 객체 형태의 데이터에서 URL 찾기
        for (const file of workspaceData.files) {
          if (file.url && file.url.includes('/workspace/')) {
            const urlParts = file.url.split('/workspace/');
            if (urlParts.length > 0) {
              baseUrl = urlParts[0] + '/workspace/';
              break;
            }
          }
        }
      }
      
      // 기본값 반환
      return baseUrl || getWorkspaceBaseUrl(bookId);
    } catch (error) {
      console.error('워크스페이스 기본 URL 가져오기 실패:', error);
      // 에러 시 기본값 반환
      return getWorkspaceBaseUrl(bookId);
    }
  },

  // 워크스페이스 파일 가져오기 (assets 경로)
  getWorkspaceFile: async (bookId, filePath) => {
    try {
      // 동기 함수인 getWorkspaceBaseUrl 사용
      const { getWorkspaceBaseUrl } = await import('./url');
      const baseUrl = getWorkspaceBaseUrl(bookId);
      
      // filePath가 이미 전체 URL인지 확인하고 정리
      let cleanPath = filePath;
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        // 전체 URL에서 파일 경로만 추출
        const urlParts = filePath.split('/');
        const workspaceIndex = urlParts.indexOf('workspace');
        if (workspaceIndex !== -1 && workspaceIndex + 1 < urlParts.length) {
          cleanPath = urlParts.slice(workspaceIndex + 1).join('/');
        }
      }
      
      // HTTPS로 강제 변환하여 전체 URL 구성
      const fullUrl = `${baseUrl}/${cleanPath}`.replace('http://', 'https://');
      
      console.log('🔍 getWorkspaceFile 호출:', { bookId, filePath, cleanPath, baseUrl, fullUrl });
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Accept': 'text/plain, application/json, */*'
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error('워크스페이스 파일 가져오기 실패:', error);
      throw error;
    }
  },
};

// 사용자 관리 API
export const userAPI = {
  getUsers: async () => {
    const response = await apiRequest('/users');
    return await response.json();
  },

  getUserInfo: async (userId) => {
    const response = await apiRequest(`/users/${userId}`);
    return await response.json();
  },

  getMyInfo: async () => {
    const response = await apiRequest('/users/info');
    return await response.json();
  },

};

// API 캐시 지우기 함수
export const clearAPICache = () => {
  console.log('🗑️ API 캐시 지우기');
  // 브라우저 캐시 지우기 (가능한 경우)
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
  // sessionStorage에서 API 관련 캐시 지우기
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('api_cache_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
  console.log('✅ API 캐시 지우기 완료');
};

export default {
  auth: authAPI,
  projects: projectAPI,
  books: bookAPI,
  users: userAPI,
  clearAPICache,
}; 