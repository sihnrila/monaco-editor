const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// CORS 설정
app.use(cors());
app.use(express.json());

// 파일 업로드를 위한 multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const workspaceId = req.body.workspaceId || 'default';
    const uploadPath = path.join(__dirname, 'uploads', workspaceId);
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // 원본 파일명 유지
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// 임시 계정 (로컬 개발용)
const TEMP_USERS = [
  { id: 1, username: 'admin', password: 'admin1234', is_superuser: true, is_staff: true, email: 'admin@local.dev' }
];

// 임시 토큰 생성 (로컬 개발용 - 검증 없음)
const makeToken = (username) => Buffer.from(JSON.stringify({ username, exp: Date.now() + 86400000 })).toString('base64');

// 로그인
app.post('/api/token', (req, res) => {
  const { username, password } = req.body;
  const user = TEMP_USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ detail: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  res.json({ access: makeToken(username), refresh: makeToken(username + '_refresh') });
});

// 토큰 갱신
app.post('/api/token/refresh', (req, res) => {
  res.json({ access: makeToken('admin') });
});

// 사용자 목록
app.get('/api/users', (req, res) => {
  const users = TEMP_USERS.map(({ password, ...u }) => u);
  res.json({ count: users.length, results: users });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: 'EPUB Viewer API Server' });
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// 파일 내용 API
app.get('/file-content', (req, res) => {
  const filePath = req.query.path;
  
  if (!filePath) {
    return res.status(400).json({ error: '파일 경로가 필요합니다.' });
  }

  const sampleContent = `// ${filePath} 파일의 내용
// 이 파일은 EPUB에서 추출된 파일입니다.

function sampleFunction() {
  console.log('Hello from ${filePath}');
}

const data = {
  path: filePath,
  content: '이것은 샘플 파일 내용입니다.',
  timestamp: new Date().toISOString()
};

export default data;`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(sampleContent);
});

// 이미지 업로드 API
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '이미지 파일이 없습니다.' });
    }

    const { workspaceId, path: imagePath } = req.body;
    const uploadedFile = req.file;

    console.log('📸 이미지 업로드:', {
      filename: uploadedFile.filename,
      originalname: uploadedFile.originalname,
      path: uploadedFile.path,
      workspaceId: workspaceId,
      imagePath: imagePath
    });

    // 상대 경로 생성 (워크스페이스 기준)
    const relativePath = imagePath || uploadedFile.originalname;

    res.json({
      success: true,
      message: '이미지가 성공적으로 업로드되었습니다.',
      data: {
        filename: uploadedFile.filename,
        originalname: uploadedFile.originalname,
        path: uploadedFile.path,
        relativePath: relativePath,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype
      }
    });

  } catch (error) {
    console.error('❌ 이미지 업로드 오류:', error);
    res.status(500).json({
      error: '이미지 업로드 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 파일 검증 API (POST 요청)
app.post('/api/books/:id/workspace/validate', (req, res) => {
  try {
    const { id } = req.params;
    const { file, relpath } = req.body;

    console.log('🔍 파일 검증 요청:', {
      workspaceId: id,
      relpath: relpath,
      fileSize: file ? file.length : 0
    });

    if (!file || !relpath) {
      return res.status(400).json({ 
        error: '필수 필드가 누락되었습니다.',
        required: ['file', 'relpath']
      });
    }

    // 파일 검증 로직
    const validationResult = validateFileContent(file, relpath);
    
    if (validationResult.isValid) {
      console.log('✅ 파일 검증 성공:', {
        workspaceId: id,
        relpath: relpath,
        validationMessage: validationResult.message
      });

      res.json({
        success: true,
        message: '파일 검증이 성공했습니다.',
        data: {
          workspaceId: id,
          relpath: relpath,
          fileSize: file.length,
          validationResult: validationResult,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.log('❌ 파일 검증 실패:', {
        workspaceId: id,
        relpath: relpath,
        validationErrors: validationResult.errors
      });

      res.status(400).json({
        success: false,
        message: '파일 검증에 실패했습니다.',
        error: validationResult.message,
        data: {
          workspaceId: id,
          relpath: relpath,
          fileSize: file.length,
          validationErrors: validationResult.errors,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('❌ 파일 검증 오류:', error);
    res.status(500).json({
      error: '파일 검증 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 파일 검증 헬퍼 함수
function validateFileContent(fileContent, filePath) {
  const errors = [];
  const ext = filePath.split('.').pop().toLowerCase();
  
  // 기본 검증
  if (!fileContent || fileContent.trim().length === 0) {
    errors.push('파일 내용이 비어있습니다.');
  }
  
  // 파일 크기 검증 (1MB 제한)
  if (fileContent.length > 1024 * 1024) {
    errors.push('파일 크기가 1MB를 초과합니다.');
  }
  
  // 파일 확장자별 검증
  switch (ext) {
    case 'html':
    case 'xhtml':
      // HTML 파일 검증
      if (!fileContent.includes('<html') && !fileContent.includes('<!DOCTYPE')) {
        errors.push('유효한 HTML 파일이 아닙니다.');
      }
      break;
      
    case 'css':
      // CSS 파일 검증 (기본적인 구문 검사)
      if (fileContent.includes('{') && !fileContent.includes('}')) {
        errors.push('CSS 구문 오류: 닫는 중괄호가 없습니다.');
      }
      break;
      
    case 'js':
      // JavaScript 파일 검증 (기본적인 구문 검사)
      try {
        // 간단한 구문 검사 (eval은 사용하지 않음)
        if (fileContent.includes('{') && !fileContent.includes('}')) {
          errors.push('JavaScript 구문 오류: 닫는 중괄호가 없습니다.');
        }
      } catch (e) {
        errors.push('JavaScript 구문 오류가 있습니다.');
      }
      break;
      
    case 'xml':
      // XML 파일 검증
      if (!fileContent.includes('<?xml') && !fileContent.includes('<root')) {
        errors.push('유효한 XML 파일이 아닙니다.');
      }
      break;
      
    default:
      // 기타 파일 타입은 기본 검증만
      break;
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length === 0 ? '파일 검증이 성공했습니다.' : '파일 검증에 실패했습니다.',
    errors: errors
  };
}

// 접근성 표준 검사 API (ACE)
app.post('/api/books/:id/ace', (req, res) => {
  try {
    const { id } = req.params;
    const { content, file } = req.body;
    console.log('🔍 ACE 접근성 검사 요청:', { bookId: id, file });

    const errors = [];
    const warnings = [];

    if (content) {
      // img 태그가 있는데 alt 속성이 없는 경우만 에러
      const imgWithoutAlt = content.match(/<img(?![^>]*\balt\s*=)[^>]*>/gi);
      if (imgWithoutAlt && imgWithoutAlt.length > 0) {
        errors.push({ line: 1, column: 1, message: '이미지에 alt 속성이 없습니다.', file: file || 'unknown', severity: 'error' });
      }
      if (!content.includes('lang=')) {
        warnings.push({ line: 1, column: 1, message: 'lang 속성이 누락되었습니다.', file: file || 'unknown', severity: 'warning' });
      }
    }

    const outcome = errors.length === 0 ? 'pass' : 'fail';
    console.log('✅ ACE 검사 완료:', { outcome, errors: errors.length, warnings: warnings.length });

    res.json({
      'earl:result': { 'earl:outcome': outcome },
      errors,
      warnings
    });
  } catch (error) {
    console.error('❌ ACE 검사 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 전자책 표준 검사 API (EPUBCheck)
app.post('/api/books/:id/epubcheck', (req, res) => {
  try {
    const { id } = req.params;
    const { content, file } = req.body;
    console.log('🔍 EPUBCheck 검사 요청:', { bookId: id, file });

    const errors = [];
    const warnings = [];

    if (content) {
      if (!content.includes('<?xml')) {
        warnings.push({ line: 1, column: 1, message: 'XML 선언이 없습니다.', file: file || 'unknown', severity: 'warning' });
      }
      if (!content.includes('<!DOCTYPE')) {
        warnings.push({ line: 1, column: 1, message: 'DOCTYPE 선언이 없습니다.', file: file || 'unknown', severity: 'warning' });
      }
    }

    const outcome = errors.length === 0 ? 'pass' : 'fail';
    console.log('✅ EPUBCheck 완료:', { outcome, errors: errors.length, warnings: warnings.length });

    res.json({
      'earl:result': { 'earl:outcome': outcome },
      errors,
      warnings
    });
  } catch (error) {
    console.error('❌ EPUBCheck 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 파일 적용 API (PUT 요청)
app.put('/api/books/:id/workspace/put', (req, res) => {
  try {
    const { id } = req.params;
    const { file, relpath } = req.body;

    console.log('📝 파일 적용 요청:', {
      workspaceId: id,
      relpath: relpath,
      fileSize: file ? file.length : 0
    });

    if (!file || !relpath) {
      return res.status(400).json({ 
        error: '필수 필드가 누락되었습니다.',
        required: ['file', 'relpath']
      });
    }

    // 실제 환경에서는 여기서 파일을 저장하거나 데이터베이스에 저장
    // 현재는 로그만 출력하고 성공 응답
    console.log('✅ 파일 적용 성공:', {
      workspaceId: id,
      relpath: relpath,
      contentPreview: file.substring(0, 100) + '...'
    });

    res.json({
      success: true,
      message: '파일이 성공적으로 적용되었습니다.',
      data: {
        workspaceId: id,
        relpath: relpath,
        fileSize: file.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 파일 적용 오류:', error);
    res.status(500).json({
      error: '파일 적용 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📱 React 앱: http://localhost:3000`);
  console.log(`🔧 API 서버: http://localhost:${PORT}`);
  console.log(`📋 사용 가능한 API:`);
  console.log(`   - GET /health`);
  console.log(`   - GET /file-content?path=<filepath>`);
  console.log(`   - POST /api/books/:id/workspace/validate (파일 검증)`);
  console.log(`   - PUT /api/books/:id/workspace/put (파일 적용)`);
  console.log(`   - POST /api/books/:id/ace (접근성 표준 검사)`);
  console.log(`   - POST /api/books/:id/epubcheck (전자책 표준 검사)`);
}); 