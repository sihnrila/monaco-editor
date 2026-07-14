export const DEFAULT_TEMPLATES = {
  html5_basic: {
    name: 'HTML5 기본',
    type: 'html',
    description: 'HTML5 기본 구조',
    content: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <h1>안녕하세요!</h1>
    <p>HTML5 기본 템플릿입니다.</p>
</body>
</html>`
  },
  bootstrap_responsive: {
    name: 'Bootstrap 반응형',
    type: 'html', 
    description: 'Bootstrap을 사용한 반응형 템플릿',
    content: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bootstrap 템플릿</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="#">사이트 이름</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="#">홈</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#">소개</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="#">연락처</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container mt-4">
        <div class="row">
            <div class="col-md-8">
                <h1>메인 콘텐츠</h1>
                <p class="lead">Bootstrap을 사용한 반응형 레이아웃입니다.</p>
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">카드 제목</h5>
                        <p class="card-text">카드 내용이 들어갑니다.</p>
                        <a href="#" class="btn btn-primary">자세히 보기</a>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <h3>사이드바</h3>
                <ul class="list-group">
                    <li class="list-group-item">메뉴 1</li>
                    <li class="list-group-item">메뉴 2</li>
                    <li class="list-group-item">메뉴 3</li>
                </ul>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`
  },
  responsive_css: {
    name: '반응형 CSS',
    type: 'css',
    description: '모바일 우선 반응형 CSS',
    content: `/* 모바일 우선 스타일 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Arial', sans-serif;
    line-height: 1.6;
    color: #333;
}

.container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* 모바일 스타일 (기본) */
.grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
}

/* 태블릿 스타일 */
@media (min-width: 768px) {
    .grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

/* 데스크톱 스타일 */
@media (min-width: 1024px) {
    .grid {
        grid-template-columns: repeat(3, 1fr);
    }
}`
  }
};

export const DEFAULT_SNIPPETS = {
  // HTML 스니펫들이 여기에 올 것입니다
};