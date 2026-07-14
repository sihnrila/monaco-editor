import React, { useState, useEffect, useRef } from 'react';
import logger from '../../utils/logger';
import './LogViewer.css';

const LogViewer = ({ onErrorClick, onToggle, clearAllErrorMarkers, getCurrentTab }) => {
  const [logs, setLogs] = useState([]);
  const [viewMode, setViewMode] = useState('minimized'); // 항상 minimized로 시작
  const [errorCount, setErrorCount] = useState(0);
  const [activeTab, setActiveTab] = useState(() => {
    // localStorage에서 저장된 활성 탭 읽어오기
    const savedTab = localStorage.getItem('logViewerActiveTab');
    const initialTab = savedTab || 'syntax'; // 기본값: 'syntax'
    console.log('🔍 LogViewer 초기 활성 탭:', savedTab, '→', initialTab);
    return initialTab;
  }); // syntax, epub, accessibility
  const [tabErrorCounts, setTabErrorCounts] = useState({ syntax: 0, epub: 0, accessibility: 0 });
  const refreshIntervalRef = useRef(null);

  // 로그 새로고침 (정리 없이)
  const refreshLogs = () => {
    try {
      // localStorage에서 로그를 다시 로드하여 최신 상태 유지
      //logger.loadFromStorage();
            
      // 자동 정리 함수 호출하지 않음
      logger.autoCleanErrors(); // 이 줄을 주석 처리
      
      // 모든 로그를 가져와서 필터링 (정리하지 않음)
      const allLogs = logger.getLogs();
      console.log(`🔍 refreshLogs - 전체 로그 개수: ${allLogs.length}`);
      
      // VALIDATION 카테고리 로그 상세 확인
      const validationLogs = allLogs.filter(log => log.category === 'VALIDATION');
      console.log(`🔍 VALIDATION 로그 개수: ${validationLogs.length}`);
      console.log(`🔍 VALIDATION 로그 상세:`, validationLogs.map(log => ({
        level: log.level,
        message: log.message.substring(0, 50) + '...',
        timestamp: log.timestamp
      })));
      
      console.log('🔍 LogViewer - 모든 로그:', allLogs.map(log => ({ 
        category: log.category, 
        level: log.level, 
        message: log.message.substring(0, 50) + '...' 
      })));
      
      // 모든 로그를 표시 (필터링하지 않음)
      const errorLogs = allLogs;
      
      console.log('🔍 LogViewer - 필터링된 로그:', errorLogs.map(log => ({ 
        category: log.category, 
        level: log.level, 
        message: log.message.substring(0, 50) + '...' 
      })));
      
      // 탭별로 로그 필터링 및 개수 계산
      let filteredLogs = [];
      let totalErrorCount = 0;
      
      // 각 탭별 오류 개수 계산
      const syntaxErrors = errorLogs.filter(log => log.category === 'VALIDATION');
      const epubErrors = errorLogs.filter(log => log.category === 'STANDARD_CHECK');
      const accessibilityErrors = errorLogs.filter(log => log.category === 'ACCESSIBILITY');
      
      console.log('🔍 LogViewer 필터링 결과:', {
        totalLogs: allLogs.length,
        errorLogs: errorLogs.length,
        syntaxErrors: syntaxErrors.length,
        epubErrors: epubErrors.length,
        accessibilityErrors: accessibilityErrors.length,
        allLogs: allLogs.map(log => ({ category: log.category, level: log.level, message: log.message.substring(0, 30) + '...' })),
        accessibilityLogs: allLogs.filter(log => log.category === 'ACCESSIBILITY').map(log => ({ category: log.category, level: log.level, message: log.message.substring(0, 30) + '...' }))
      });
      
      // 탭별 오류 개수 상태 업데이트
      setTabErrorCounts({
        syntax: syntaxErrors.length,
        epub: epubErrors.length,
        accessibility: accessibilityErrors.length
      });
      
      // 구문 오류가 0개일 때 에디터 하이라이트 지우기
      if (syntaxErrors.length === 0 && clearAllErrorMarkers) {
        console.log('🧹 구문 오류 0개 - 에디터 하이라이트 지우기');
        clearAllErrorMarkers();
      }
      
      console.log('🔍 LogViewer 현재 활성 탭:', activeTab);
      
      switch (activeTab) {
        case 'syntax':
          // 구문 오류: VALIDATION 카테고리
          filteredLogs = syntaxErrors;
          totalErrorCount = syntaxErrors.length;
          console.log('🔍 syntax 탭 선택됨, 로그 개수:', totalErrorCount);
          break;
        case 'epub':
          // 전자책 표준 오류: STANDARD_CHECK 카테고리
          filteredLogs = epubErrors;
          totalErrorCount = epubErrors.length;
          console.log('🔍 epub 탭 선택됨, 로그 개수:', totalErrorCount);
          break;
        case 'accessibility':
          // 접근성 표준 오류: ACCESSIBILITY 카테고리
          filteredLogs = accessibilityErrors;
          totalErrorCount = accessibilityErrors.length;
          console.log('🔍 accessibility 탭 선택됨, 로그 개수:', totalErrorCount);
          break;
        
      }
      
      setLogs(filteredLogs);
      setErrorCount(totalErrorCount);
    } catch (error) {
      console.error('❌ LogViewer 새로고침 오류:', error);
    }
  };

  // 오류 정보 추출
  const extractErrorInfo = (log) => {
    const data = log.data || {};
    return {
      line: parseInt(data.line) || 1,
      column: parseInt(data.column) || 1,
      offset: parseInt(data.offset) || 0,
      path: data.path || data.file || 'unknown',
      file: data.file || 'unknown',
      message: data.message || log.message,
      severity: data.severity || log.level,
      type: data.type || log.category
    };
  };

  // 로그 메시지 포맷팅
  const formatLogMessage = (log) => {
    if (log.data && log.data.error) {
      return `${log.message}: ${log.data.error}`;
    }
    return log.message;
  };

  // 오류 클릭 핸들러
  const handleErrorClick = (log) => {
    console.log('🔍 로그 클릭됨:', log.message.substring(0, 30) + '...');
    
    const errorInfo = extractErrorInfo(log);
    if (onErrorClick) {
      onErrorClick(errorInfo);
    }
  };



  // 토글 핸들러
  const handleToggle = () => {
    console.log(`🔍 토글 버튼 클릭됨, 현재 viewMode: ${viewMode}`);
    const newMode = viewMode === 'minimized' ? 'expanded' : 'minimized';
    console.log(`🔍 새로운 viewMode: ${newMode}`);
    setViewMode(newMode);
    console.log(`🔍 LogViewer 뷰 모드 변경: ${newMode}`);
    if (onToggle) {
      onToggle(newMode);
    }
  };

  // 컴포넌트 마운트/언마운트 시 로그 새로고침 설정
  useEffect(() => {
    console.log('🔒 LogViewer 마운트');
    
    // 전역 함수로 refreshLogs 노출 (Header에서 호출 가능하도록)
    window.refreshLogViewer = refreshLogs;
    console.log('🔗 refreshLogViewer 전역 함수 등록');

    return () => {
      // 전역 함수 제거
      delete window.refreshLogViewer;
    };
  }, []); // 컴포넌트 마운트 시에만 실행

  // activeTab이 변경될 때마다 실시간 새로고침 설정
  useEffect(() => {
    // 기존 인터벌 정리
    if (refreshIntervalRef.current) {
      console.log('🔒 LogViewer 인터벌 정리 (탭 변경)');
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    // 실시간 새로고침 활성화 (구문 오류 탭일 때만)
    refreshIntervalRef.current = setInterval(() => {
      console.log('🔄 LogViewer 현재 탭', "activeTab", activeTab);
      
      // 구문 오류 탭일 때만 자동 새로고침 실행
      if (activeTab === 'syntax') {
        refreshLogs();
      } else {
        console.log('⏸️ LogViewer 자동 새로고침 건너뜀 (다른 탭)');
      }
    }, 500); // 0.5초마다 새로고침

    return () => {
      if (refreshIntervalRef.current) {
        console.log('🔒 LogViewer 인터벌 정리 (useEffect cleanup)');
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [activeTab]); // activeTab이 변경될 때마다 실행

  // activeTab 변경 시 로그 새로고침 (뷰 모드는 유지)
  useEffect(() => { 
    console.log(`🔄 activeTab 변경됨: ${activeTab}`);
    
    // 탭 변경 시 로그를 다시 로드하되 정리하지 않음
    try {
      logger.loadFromStorage();
      console.log(`🔍 탭 변경으로 로그 로드: ${activeTab}`);
      
      // 현재 활성 탭에 맞는 로그만 필터링
      const allLogs = logger.getLogs();
      const syntaxErrors = allLogs.filter(log => log.category === 'VALIDATION');
      const epubErrors = allLogs.filter(log => log.category === 'STANDARD_CHECK');
      const accessibilityErrors = allLogs.filter(log => log.category === 'ACCESSIBILITY');
      
      // 탭별 오류 개수 상태 업데이트
      setTabErrorCounts({
        syntax: syntaxErrors.length,
        epub: epubErrors.length,
        accessibility: accessibilityErrors.length
      });
      
      // 구문 오류가 0개일 때 에디터 하이라이트 지우기
      if (syntaxErrors.length === 0 && clearAllErrorMarkers) {
        console.log('🧹 구문 오류 0개 - 에디터 하이라이트 지우기');
        clearAllErrorMarkers();
      }
      
      // 현재 활성 탭에 맞는 로그만 설정
      let filteredLogs = [];
      let totalErrorCount = 0;
      
      switch (activeTab) {
        case 'syntax':
          filteredLogs = syntaxErrors;
          totalErrorCount = syntaxErrors.length;
          break;
        case 'epub':
          filteredLogs = epubErrors;
          totalErrorCount = epubErrors.length;
          break;
        case 'accessibility':
          filteredLogs = accessibilityErrors;
          totalErrorCount = accessibilityErrors.length;
          break;
      }
      
      setLogs(filteredLogs);
      setErrorCount(totalErrorCount);
      
      console.log(`🔍 탭 변경 후 로그 개수: ${totalErrorCount}개 (${activeTab})`);
    } catch (error) {
      console.error('❌ 탭 변경 로그 새로고침 오류:', error);
    }
    

  }, []); // activeTab 의존성 제거하여 탭 변경 시 초기화 방지

  // 항상 표시하되, 오류가 없으면 최소화된 상태로 유지
  console.log(`🔍 LogViewer 렌더링 - viewMode: ${viewMode}, errorCount: ${errorCount}`);
  return (
    <div className="validation-results-overlay">
      <div className={`validation-results-modal ${viewMode}`}>
        <div className="log-viewer-header">
          <div className="header-left">
            <h3>적합성 검사 결과</h3>
          </div>
          <div className="header-right">
            <span className="error-label">오류:</span>
            <span className="error-count-badge">{errorCount}</span>
            <button 
              className="toggle-btn"
              onClick={handleToggle}
              title={viewMode === 'minimized' ? '펼치기' : '접기'}
            >
              {viewMode === 'minimized' ? '▲' : '▼'}
            </button>
          </div>
        </div>
        
        {/* 탭 메뉴 */}
        <div className="log-viewer-tabs">
          <button 
            className={`tab-btn ${activeTab === 'syntax' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('syntax');
              localStorage.setItem('logViewerActiveTab', 'syntax');
              
              // 수동으로 로그 업데이트
              try {
                const allLogs = logger.getLogs();
                const syntaxErrors = allLogs.filter(log => log.category === 'VALIDATION');
                setLogs(syntaxErrors);
                setErrorCount(syntaxErrors.length);
                console.log(`🔍 syntax 탭 수동 업데이트: ${syntaxErrors.length}개`);
                
                // 구문 오류가 0개일 때 에디터 하이라이트 지우기
                if (syntaxErrors.length === 0 && clearAllErrorMarkers) {
                  console.log('🧹 syntax 탭 클릭 - 구문 오류 0개, 에디터 하이라이트 지우기');
                  clearAllErrorMarkers();
                }
              } catch (error) {
                console.error('❌ syntax 탭 업데이트 오류:', error);
              }
            }}
          >
            구문 오류 {tabErrorCounts.syntax > 0 && `(${tabErrorCounts.syntax})`}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'epub' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('epub');
              localStorage.setItem('logViewerActiveTab', 'epub');
              
              // 수동으로 로그 업데이트
              try {
                const allLogs = logger.getLogs();
                const epubErrors = allLogs.filter(log => log.category === 'STANDARD_CHECK');
                setLogs(epubErrors);
                setErrorCount(epubErrors.length);
                console.log(`🔍 epub 탭 수동 업데이트: ${epubErrors.length}개`);
              } catch (error) {
                console.error('❌ epub 탭 업데이트 오류:', error);
              }
            }}
          >
            전자책 표준 오류 {tabErrorCounts.epub > 0 && `(${tabErrorCounts.epub})`}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'accessibility' ? 'active' : ''}`}
            onClick={() => {
              console.log('🔍 접근성 탭 클릭됨');
              setActiveTab('accessibility');
              localStorage.setItem('logViewerActiveTab', 'accessibility');
              
              // 수동으로 로그 업데이트
              try {
                const allLogs = logger.getLogs();
                const accessibilityErrors = allLogs.filter(log => log.category === 'ACCESSIBILITY');
                setLogs(accessibilityErrors);
                setErrorCount(accessibilityErrors.length);
                console.log(`🔍 accessibility 탭 수동 업데이트: ${accessibilityErrors.length}개`);
              } catch (error) {
                console.error('❌ accessibility 탭 업데이트 오류:', error);
              }
            }}
          >
            접근성 표준 오류 {tabErrorCounts.accessibility > 0 && `(${tabErrorCounts.accessibility})`}
          </button>
        </div>
        
        {viewMode === 'expanded' && (
          <div className="log-viewer-content">
            <table className="validation-table">
              <thead>
                <tr>
                  <th>파일</th>
                  <th>줄</th>
                  <th>오프셋</th>
                  <th>메시지</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const errorInfo = extractErrorInfo(log);
                  return (
                    <tr 
                      key={log.id} 
                      className="error-row"
                      onClick={() => handleErrorClick(log)}
                    >
                      <td className="file-cell">{errorInfo.file}</td>
                      <td className="line-cell">{errorInfo.line}</td>
                      <td className="offset-cell">{errorInfo.offset}</td>
                      <td className="message-cell">{formatLogMessage(log)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
