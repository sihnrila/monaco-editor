import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectAPI, bookAPI } from '../services/api';
import './ProjectsPage.css';

const ProjectsPage = () => {
  console.log('ProjectsPage - 컴포넌트 렌더링 시작');
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('ProjectsPage - useEffect 실행');
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      console.log('ProjectsPage - 프로젝트 목록 가져오기 시작');
      const data = await projectAPI.getProjects();
      console.log('ProjectsPage - 프로젝트 목록 가져오기 성공:', data);
      
      // API 응답 구조 확인 및 처리
      let projectsList = [];
      if (data && data.results && Array.isArray(data.results)) {
        projectsList = data.results;
      } else if (Array.isArray(data)) {
        projectsList = data;
      } else {
        console.log('ProjectsPage - 예상치 못한 데이터 구조:', data);
        projectsList = [];
      }
      
      // 각 프로젝트의 도서 개수 가져오기
      const projectsWithBookCount = await Promise.all(
        projectsList.map(async (project) => {
          try {
            const booksData = await bookAPI.getBooks(project.id);
            const bookCount = booksData?.results?.length || booksData?.length || 0;
            return {
              ...project,
              bookCount: bookCount
            };
          } catch (error) {
            console.error(`프로젝트 ${project.id}의 도서 개수 가져오기 실패:`, error);
            return {
              ...project,
              bookCount: 0
            };
          }
        })
      );
      
      setProjects(projectsWithBookCount);
      setFilteredProjects(projectsWithBookCount);
    } catch (error) {
      console.error('ProjectsPage - 프로젝트 목록 가져오기 실패:', error);
      setError('프로젝트 목록을 불러오는데 실패했습니다.');
      setProjects([]);
      setFilteredProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    // navigate('/projects/new');
    window.open("https://lib-editor.boinit.com/admin/","_blank");
  };

  const handleProjectClick = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  // 검색 및 필터링 함수
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setCurrentPage(1); // 검색 시 첫 페이지로 이동
    filterProjects(term, statusFilter);
  };

  const handleStatusFilterChange = (e) => {
    const status = e.target.value;
    setStatusFilter(status);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
    filterProjects(searchTerm, status);
  };

  const filterProjects = (search, status) => {
    let filtered = projects;

    // 검색어 필터링
    if (search.trim()) {
      filtered = filtered.filter(project => 
        (project.title && project.title.toLowerCase().includes(search.toLowerCase())) ||
        (project.description && project.description.toLowerCase().includes(search.toLowerCase())) ||
        (project.slug && project.slug.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // 상태 필터링
    if (status !== 'all') {
      if (status === 'active') {
        filtered = filtered.filter(project => project.is_active === true);
      } else if (status === 'inactive') {
        filtered = filtered.filter(project => project.is_active === false);
      }
    }

    setFilteredProjects(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setFilteredProjects(projects);
    setCurrentPage(1);
  };

  // 페이지네이션 관련 함수들
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, endIndex);

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

  const getStatusText = (isActive) => {
    return isActive ? '활성' : '비활성';
  };

  const getStatusClass = (isActive) => {
    return isActive ? 'active' : 'inactive';
  };

  if (loading) {
    return (
      <div className="projects-page">
        <div className="loading">
          <span className="loading-icon" aria-label="loading">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-480Zm-400 0q0-88 34-163t93-130q59-55 136-83.5T508-879q17 2 27 14.5t7 29.5q-3 17-16.5 27t-30.5 9q-69-3-129.5 19.5T259-713q-46 44-72.5 103.5T160-480q0 134 93 227t227 93q69 0 128.5-26.5T712-259q46-48 68-109t19-127q-1-17 9-30.5t27-16.5q17-3 29.5 7t14.5 27q6 87-22.5 164T774-208q-57 62-133 95T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480Zm640-120q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z"/></svg>
          </span>
        </div>
      </div>
    );
  }

  console.log('ProjectsPage - projects:', projects);

  return (
    <div className="projects-page">
      {/* 헤더 */}
      <div className="projects-header">
        <h1>프로젝트 목록</h1>
        {isStaff() && (
          <button className="create-project-btn" onClick={handleCreateProject}>
            관리자 페이지 이동
          </button>
        )}
      </div>

      {/* 간단한 통계 정보 */}
      <div className="stats-section">
        <div className="stats-card">
          <div className="stat-item">
            <span className="stat-label">전체 프로젝트</span>
            <span className="stat-value">{projects.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">전체 도서</span>
            <span className="stat-value">{projects.reduce((total, p) => total + (p.bookCount || 0), 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">활성 프로젝트</span>
            <span className="stat-value">{projects.filter(p => p.is_active).length}</span>
          </div>
        </div>
      </div>

      {/* 검색 및 필터링 */}
      <div className="search-filter-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="프로젝트 제목, 설명, 슬러그로 검색..."
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
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
          
          {(searchTerm || statusFilter !== 'all') && (
            <button onClick={clearFilters} className="clear-filters-btn">
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* 프로젝트 그리드 */}
      <div className="projects-section">
        <div className="section-header">
          <h2>프로젝트 목록 ({filteredProjects.length}/{projects.length}개)</h2>
        </div>

        <div className="projects-grid">
          {currentProjects.map((project, index) => (
            <div 
              key={project.id} 
              className="project-card"
              onClick={() => handleProjectClick(project.id)}
            >
              <div className="project-header">
                <h3 className="project-title">{project.title || '제목 없음'}</h3>
                <div className="project-status-icon">
                  <span className="status-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"/></svg>
                  </span>
                </div>
              </div>
              
              <div className="project-info">
                <p className="project-description">
                  {project.description || '설명 없음'}
                </p>
              </div>

              <div className="project-stats">
                <span className="stat-tag quantity-tag">물량: {project.bookCount || 0}</span>
                <span className={`stat-tag status-tag ${getStatusClass(project.is_active)}`}>
                  {getStatusText(project.is_active)}
                </span>
                <span className="stat-tag progress-tag">0.00%</span>
                <span className="project-footer">
                  <button 
                    className="action-btn enter-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectClick(project.id);
                    }}
                  >
                    입장하기
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>

        {filteredProjects.length === 0 && projects.length > 0 && (
          <div className="empty-state">
            <p>검색 조건에 맞는 프로젝트가 없습니다.</p>
            <button onClick={clearFilters} className="clear-filters-btn">
              필터 초기화
            </button>
          </div>
        )}

        {projects.length === 0 && (
          <div className="empty-state">
            <p>등록된 프로젝트가 없습니다.</p>
            {user?.is_superuser && (
              <button className="create-project-btn" onClick={handleCreateProject}>
                첫 번째 프로젝트 생성하기
              </button>
            )}
          </div>
        )}

        {/* 페이지네이션 */}
        {filteredProjects.length > 0 && (
          <div className="pagination">
            {/* <div className="pagination-info">
              <span>
                {startIndex + 1}-{Math.min(endIndex, filteredProjects.length)} / {filteredProjects.length}개 항목
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

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default ProjectsPage; 