import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectAPI, bookAPI } from '../services/api';
import './ProjectDetailPage.css';

const ProjectDetailPage = () => {
  const [project, setProject] = useState(null);
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { projectId } = useParams();
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('ProjectDetailPage - useEffect 실행, projectId:', projectId);
    fetchProjectData();
  }, [projectId]);


  const fetchProjectData = async () => {
    try {
      setLoading(true);
      console.log('ProjectDetailPage - 프로젝트 데이터 가져오기 시작');
      
      // 프로젝트 정보와 도서 목록을 병렬로 가져오기
      const [projectData, booksData] = await Promise.all([
        projectAPI.getProject(projectId),
        bookAPI.getBooks(projectId)
      ]);
      
      console.log('ProjectDetailPage - 프로젝트 데이터 가져오기 성공:', projectData);
      console.log('ProjectDetailPage - 도서 데이터 가져오기 성공:', booksData);
      
      setProject(projectData);
      const booksList = booksData.results || booksData || [];
      setBooks(booksList);
      setFilteredBooks(booksList);
    } catch (error) {
      console.error('ProjectDetailPage - 데이터 가져오기 실패:', error);
      setError('프로젝트 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = (bookId) => {
    // URL에서 어떤 책을 편집할지 명확히 표시
    console.log('📚 책 클릭:', { projectId, bookId });
    navigate(`/editor/${projectId}?bookId=${bookId}`);
  };

  const handleSettingsClick = () => {
    navigate(`/projects/${projectId}/settings`);
  };

  const handleBackClick = () => {
    navigate('/projects');
  };

  // 검색 및 필터링 함수
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
    filterBooks(term, statusFilter);
  };

  const handleStatusFilterChange = (e) => {
    const status = e.target.value;
    setStatusFilter(status);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
    filterBooks(searchTerm, status);
  };

  const filterBooks = (search, status) => {
    let filtered = books;

    // 검색어 필터링
    if (search.trim()) {
      filtered = filtered.filter(book => 
        (book.title && book.title.toLowerCase().includes(search.toLowerCase())) ||
        (book.filename && book.filename.toLowerCase().includes(search.toLowerCase())) ||
        (book.description && book.description.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // 상태 필터링
    if (status !== 'all') {
      filtered = filtered.filter(book => book.status === status);
    }

    setFilteredBooks(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setFilteredBooks(books);
    setCurrentPage(1);
  };

  // 페이지네이션 관련 함수들
  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBooks = filteredBooks.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const getStatusText = (status) => {
    const statusMap = {
      'worker_assignment_pending': '대기중',
      'auto_converting': '자동변환',
      'completed': '완료',
      'error': '오류'
    };
    return statusMap[status] || '대기중';
  };

  const getStatusClass = (status) => {
    return status || 'pending';
  };

  if (loading) {
    return (
      <div className="project-detail-page">
        <div className="loading">
          <span className="loading-icon" aria-label="loading">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-480Zm-400 0q0-88 34-163t93-130q59-55 136-83.5T508-879q17 2 27 14.5t7 29.5q-3 17-16.5 27t-30.5 9q-69-3-129.5 19.5T259-713q-46 44-72.5 103.5T160-480q0 134 93 227t227 93q69 0 128.5-26.5T712-259q46-48 68-109t19-127q-1-17 9-30.5t27-16.5q17-3 29.5 7t14.5 27q6 87-22.5 164T774-208q-57 62-133 95T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480Zm640-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z"/></svg>
          </span>
          <span>프로젝트 정보를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="project-detail-page">
        <div className="error-message">{error}</div>
        <button className="back-btn" onClick={handleBackClick}>
          프로젝트 목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-detail-page">
        <div className="error-message">프로젝트를 찾을 수 없습니다.</div>
        <button className="back-btn" onClick={handleBackClick}>
          프로젝트 목록으로 돌아가기
        </button>
      </div>
    );
  }

  // 파생 표시 데이터 (그리드 카드용)
  const completedBooksCount = books.filter(b => b.status === 'completed').length;
  const progressPercent = books.length > 0 ? ((completedBooksCount / books.length) * 100).toFixed(2) : '0.00';
  // 값은 사용자가 추후 입력할 예정이므로, 문자열이 아닌 경우는 공백 처리
  const toDisplay = (value) => (typeof value === 'string' ? value : '');
  console.log(project,"project!!!!!", project.memberships);
  const managerName = toDisplay(project.manager_name) || toDisplay(project.manager) || toDisplay(project.project_manager) || toDisplay(project.owner);
  const workerName = toDisplay(project.worker) || toDisplay(project.editor);
  const reviewerName = toDisplay(project.reviewer) || toDisplay(project.reviewer_name);
  project.memberships.map(member => {
    if(member.role_in_project === "worker"){
      toDisplay(member.role_in_project) || toDisplay(project.manager) || toDisplay(project.project_manager) || toDisplay(project.owner);
    }else if(member.role_in_project === "reviewer"){
    }else if(member.role_in_project === "manager"){ 
    }
    
  });
  
  const priorityText = project.priority || '보통';
  const statusTextForSettings = project.status || (project.is_active ? '활성' : '생성됨');
  const isActiveText = project.is_active ? '활성' : '비활성';
  const formatDate = (value) => {
    if (!value) return '지정 안됨';
    try {
      return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return String(value);
    }
  };

  return (
    <div className="project-detail-page">
      {/* 헤더 */}
      <div className="project-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleBackClick}>
            ← 목록으로
          </button>
          <h1>{project.title}</h1>
        </div>
        
        <div className="header-right" />
      </div>

      {/* 프로젝트 개요 그리드 */}
      <div className="project-info-section">
        <div className="project-info-grid">
          {/* 설명 */}
          <div className="info-card desc-card">
            <div className="info-card-title">설명</div>
            <div className="description-bubble">
              {project.description || '설명 없음'}
            </div>
          </div>

          {/* 구성원 */}
          <div className="info-card members-card">
            <div className="info-card-title">구성원</div>
            <div className="members-list">
              <div className="member-row">
                <span className="member-label">프로젝트 관리자:</span>
                <span className="chip">{managerName || ''}</span>
              </div>
              <div className="member-row">
                <span className="member-label">작업자:</span>
                <span className="chip">{workerName || ''}</span>
              </div>
              <div className="member-row">
                <span className="member-label">검수자:</span>
                <span className="chip">{reviewerName || ''}</span>
              </div>
              <div className="member-row">
                <span className="member-label">상태:</span>
                <span className="chip">{isActiveText}</span>
              </div>
            </div>
          </div>

          {/* 설정 */}
          <div className="info-card settings-card">
            <div className="settings-badge">설정</div>
            <div className="settings-list">
              <div className="setting-row"><span className="setting-label">프로젝트 ID:</span> <span className="setting-value">{project.id}</span></div>
              <div className="setting-row"><span className="setting-label">우선순위:</span> <span className="setting-value">{priorityText}</span></div>
              <div className="setting-row"><span className="setting-label">상태:</span> <span className="setting-value">{statusTextForSettings}</span></div>
              <div className="setting-row"><span className="setting-label">진행률:</span> <span className="setting-value">{progressPercent}%</span></div>
              <div className="setting-row"><span className="setting-label">시작일:</span> <span className="setting-value">{formatDate(project.start_date)}</span></div>
              <div className="setting-row"><span className="setting-label">예정일:</span> <span className="setting-value">{formatDate(project.due_date)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 게시판 스타일 도서 목록 */}
      <div className="books-section">
        <div className="section-header">
          <h2>도서 목록 ({filteredBooks.length}/{books.length}권)</h2>
        </div>

        {/* 검색 및 필터링 */}
        <div className="search-filter-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="도서 제목, 파일명으로 검색..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="clear-search-btn">
                ✕
              </button>
            )}
          </div>
          
          <div className="filter-controls">
            <select 
              value={statusFilter} 
              onChange={handleStatusFilterChange}
              className="status-filter"
            >
              <option value="all">모든 상태</option>
              <option value="pending">대기중</option>
              <option value="processing">처리중</option>
              <option value="completed">완료</option>
              <option value="error">오류</option>
            </select>
            
            {(searchTerm || statusFilter !== 'all') && (
              <button onClick={clearFilters} className="clear-filters-btn">
                필터 초기화
              </button>
            )}
          </div>
        </div>

        {/* 게시판 테이블 */}
        <div className="board-table">
          <div className="table-header">
            <div className="table-cell header-cell">NO</div>
            <div className="table-cell header-cell">파일명</div>
            <div className="table-cell header-cell">파일형식</div>
            <div className="table-cell header-cell">상태</div>
            <div className="table-cell header-cell">난이도</div>
            <div className="table-cell header-cell">작업자</div>
            <div className="table-cell header-cell">검수자</div>
            <div className="table-cell header-cell">생성일</div>
          </div>
          
          {currentBooks.map((book, index) => (
            console.log(book),
            <div key={book.id} className="table-row" onClick={() => handleBookClick(book.id)}>
              <div className="table-cell">
                {startIndex + index + 1}
              </div>
              <div className="table-cell title-cell">
                <div className="book-title">
                  {book.original_file_name || book.filename || '제목 없음'}
                </div>
              </div>
              <div className="table-cell">
                {book.original_file_name ? book.original_file_name.split('.').pop().toUpperCase() : 'EPUB'}
              </div>
              <div className="table-cell">
                <span className={`status-badge ${getStatusClass(book.status)}`}>
                  {getStatusText(book.status)}
                </span>
              </div>
              <div className="table-cell">
                {book.difficulty || '보통'}
              </div>
              <div className="table-cell">
                {book.worker || '미배정'}
              </div>
              <div className="table-cell">
                {book.reviewer || '미배정'}
              </div>
              <div className="table-cell">
                {book.modified_at ? new Date(book.modified_at).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          ))}
        </div>

        {filteredBooks.length === 0 && books.length > 0 && (
          <div className="empty-state">
            <p>검색 조건에 맞는 도서가 없습니다.</p>
            <button onClick={clearFilters} className="clear-filters-btn">
              필터 초기화
            </button>
          </div>
        )}

        {books.length === 0 && (
          <div className="empty-state">
            <p>등록된 도서가 없습니다.</p>
            {isStaff() && (
              <button className="upload-btn">
                첫 번째 도서 업로드하기
              </button>
            )}
          </div>
        )}

        {/* 페이지네이션 */}
        {filteredBooks.length > 0 && (
          <div className="pagination">
            {/* <div className="pagination-info">
              <span>
                {startIndex + 1}-{Math.min(endIndex, filteredBooks.length)} / {filteredBooks.length}개 항목
              </span>
            </div> */}
            
            <div className="pagination-controls">
              <button 
                className="pagination-btn prev"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                이전
              </button>
              
              <div className="page-numbers">
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    className={`page-number ${page === currentPage ? 'active' : ''} ${page === '...' ? 'ellipsis' : ''}`}
                    onClick={() => typeof page === 'number' && handlePageChange(page)}
                    disabled={page === '...'}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button 
                className="pagination-btn next"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetailPage; 