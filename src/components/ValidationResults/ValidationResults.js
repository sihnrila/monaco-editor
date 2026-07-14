import React, { useState, useEffect } from 'react';
import './ValidationResults.css';

const ValidationResults = ({ visible, onClose, onErrorClick }) => {
  const [validationErrors, setValidationErrors] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [viewMode, setViewMode] = useState('normal'); // minimized, normal, maximized
  const headerRef = React.useRef(null);
  const resizerRef = React.useRef(null);

  // 전역 validationErrors 상태를 구독
  useEffect(() => {
    const updateErrors = () => {
      if (window.validationErrors) {
        setValidationErrors(window.validationErrors);
      }
    };

    // 초기 로드
    updateErrors();

    // 주기적으로 업데이트 (1초마다)
    const interval = setInterval(updateErrors, 1000);

    return () => clearInterval(interval);
  }, []);

  // 드래그 핸들러
  const handleMouseDown = (e) => {
    if (e.target.closest('.validation-results-actions')) return;
    setIsDragging(true);
    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - startX,
        y: e.clientY - startY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 리사이즈 핸들러
  const handleResizeStart = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = size.height;

    const handleMouseMove = (e) => {
      const newHeight = startHeight + (e.clientY - startY);
      setSize(prev => ({
        ...prev,
        height: Math.max(200, Math.min(800, newHeight))
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 뷰 모드 토글
  const toggleViewMode = () => {
    switch (viewMode) {
      case 'minimized':
        setViewMode('normal');
        break;
      case 'normal':
        setViewMode('maximized');
        break;
      case 'maximized':
        setViewMode('minimized');
        break;
      default:
        setViewMode('normal');
    }
  };

  // 오류 클릭 핸들러
  const handleErrorClick = (error) => {
    if (onErrorClick) {
      onErrorClick(error);
    }
  };

  // 오류 그룹화 (파일별)
  const groupErrorsByFile = () => {
    const grouped = {};
    validationErrors.forEach(error => {
      const file = error.file || error.path || 'unknown';
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file].push(error);
    });
    return grouped;
  };

  if (!visible) return null;

  const getViewModeClass = () => {
    switch (viewMode) {
      case 'minimized': return 'minimized';
      case 'maximized': return 'maximized';
      default: return '';
    }
  };

  const groupedErrors = groupErrorsByFile();
  const totalErrors = validationErrors.length;

  return (
    <div 
      className={`validation-results-overlay ${getViewModeClass()} ${isDragging ? 'dragging' : ''}`}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: size.width,
        height: viewMode === 'minimized' ? 40 : size.height
      }}
    >
      <div className="validation-results-modal">
        <div 
          ref={headerRef}
          className={`validation-results-header ${getViewModeClass()}`}
          onMouseDown={handleMouseDown}
        >
          <div className="validation-results-header-left">
            <h2>적합성 검사 결과</h2>
          </div>
          <div className="validation-results-header-right">
            <div className="validation-results-stats">
              <span className="stat-label">총 오류:</span>
              <span className={`stat-value ${totalErrors > 0 ? 'error' : 'success'}`}>
                {totalErrors}
              </span>
            </div>
            <div className="validation-results-actions">
              <button onClick={toggleViewMode} className="btn btn-secondary btn-icon" title="토글">
                {viewMode === 'minimized' ? '⬆️' : viewMode === 'maximized' ? '⬇️' : '⬆️'}
              </button>
              <button onClick={onClose} className="btn btn-primary" title="닫기">
                ✕
              </button>
            </div>
          </div>
        </div>

        {viewMode !== 'minimized' && (
          <div className="validation-results-content">
            {totalErrors === 0 ? (
              <div className="no-errors">
                <div className="success-icon">✅</div>
                <div className="success-message">오류가 없습니다.</div>
              </div>
            ) : (
              <div className="errors-list">
                {Object.entries(groupedErrors).map(([file, errors]) => (
                  <div key={file} className="file-errors">
                    <div className="file-header">
                      <span className="file-name">📁 {file}</span>
                      <span className="error-count">({errors.length}개 오류)</span>
                    </div>
                    <div className="errors-table">
                      <table>
                        <thead>
                          <tr>
                            <th>줄</th>
                            <th>열</th>
                            <th>메시지</th>
                          </tr>
                        </thead>
                        <tbody>
                          {errors.map((error, index) => (
                            <tr 
                              key={index}
                              className="error-row clickable"
                              onClick={() => handleErrorClick(error)}
                              title="클릭하여 오류 위치로 이동"
                            >
                              <td className="line-number">{error.line}</td>
                              <td className="column-number">{error.column}</td>
                              <td className="error-message">
                                {error.message.replace(/^\[(ACCESSIBILITY|EPUB)\] /, '')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 리사이즈 핸들 */}
        <div 
          ref={resizerRef}
          className="validation-results-resizer"
          onMouseDown={handleResizeStart}
        />
      </div>
    </div>
  );
};

export default ValidationResults;

