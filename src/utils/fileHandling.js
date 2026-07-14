// 파일 처리 관련 유틸리티 함수들

// 파일 다운로드
export const downloadFile = (content, filename, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 탭 표시 이름 가져오기
export const getTabDisplayName = (tab) => {
  if (!tab) return '';
  if (tab.name) return tab.name;
  if (tab.path) {
    const pathParts = tab.path.split('/');
    return pathParts[pathParts.length - 1];
  }
  return 'Untitled';
};

// 파일 확장자로 언어 타입 결정
export const getLanguageFromExtension = (filename) => {
  if (!filename) return 'text';
  
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const languageMap = {
    'html': 'html',
    'xhtml': 'xhtml', // XHTML은 xhtml 언어로 처리
    'htm': 'html',
    'css': 'css',
    'js': 'javascript',
    'javascript': 'javascript',
    'json': 'json',
    'xml': 'xml',
    'opf': 'xml',
    'ncx': 'xml',
    'txt': 'text',
    'md': 'markdown',
    'markdown': 'markdown'
  };
  
  return languageMap[extension] || 'text';
};

// 파일 크기 포맷팅
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// MIME 타입 가져오기
export const getMimeType = (extension) => {
  const mimeTypes = {
    // 이미지
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    
    // 텍스트
    'html': 'text/html',
    'htm': 'text/html',
    'xhtml': 'application/xhtml+xml',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    'txt': 'text/plain',
    
    // 문서
    'pdf': 'application/pdf',
    'epub': 'application/epub+zip',
    
    // 폰트
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'woff': 'font/woff',
    'woff2': 'font/woff2'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
};

// Base64 인코딩 유틸 제거 (사용하지 않음)