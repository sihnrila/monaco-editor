import React, { useState } from 'react';
import { useBook } from '../../contexts/BookContext';
import logger from '../../utils/logger';
import { bookAPI } from '../../services/api';
import './Header.css';

const Header = ({
  vscodeSidebarVisible,
  toggleVscodeSidebar,
  fileInputRef,
  handleFileUpload,
  handleWorkspaceLoad,
  saveCurrentFile,
  downloadCurrentFile,
  getCurrentTab,
  applyFileToServer,
  validateAndSubmitFile,
  validateFileContent,
  submitFileContent,
  runStandardChecks,
  checkAccessibilityStandard,
  checkEpubStandard,
  panelStates,
  togglePanel,
  clearAllErrorMarkers,
  setLogViewerVisible,
  openTabs,
  fileTree,
  deletedFiles,
  setDeletedFiles
}) => {
  const { bookInfo, isLoading } = useBook();
  
  // 각 버튼별 독립적인 제출 상태
  const [isSubmittingTemp, setIsSubmittingTemp] = useState(false);
  const [isSubmittingServer, setIsSubmittingServer] = useState(false);
  const [isSubmittingStandard, setIsSubmittingStandard] = useState(false);
  const [isSubmittingAccessibility, setIsSubmittingAccessibility] = useState(false);
  return (
    <header>
      <div className="header-left">
        <button 
          className="menu-show-btn"
          onClick={toggleVscodeSidebar}
          title={vscodeSidebarVisible ? "사이드바 숨기기" : "사이드바 보이기"}
        >
          ☰
        </button>

        <div className="header-center">
            {isLoading ? (
              <div className="book-info-loading">
                <span>책 정보 로딩 중...</span>
              </div>
            ) : bookInfo ? (
              <div className="book-info">
                <span className="book-title">{bookInfo.original_file_name || '제목 없음'}</span>
                <div className="book-details">
                  <span className="book-id">ID: {bookInfo.id}</span>
                  {bookInfo.filename && (
                    <span className="book-filename">파일: {bookInfo.filename}</span>
                  )}
                </div>
              </div>
            ) : null} 
          </div>
      </div>
      
      <div className="header-right">

        <button 
          className={`header-btn ${isSubmittingTemp ? 'submitting' : ''}`}
          onClick={async () => {
            const currentTab = getCurrentTab();
            if (currentTab && !isSubmittingTemp) {
              setIsSubmittingTemp(true);
              
              try {
              // 저장되지 않은 파일인지 확인
              if (currentTab.isDirty) {
                const shouldApply = window.confirm(
                  `파일 "${currentTab.name}"이(가) 저장되지 않았습니다.\n적용하시겠습니까?`
                );
                if (!shouldApply) {
                  return;
                }
              }
              
              try {
                // 실시간 검증 시작
                console.log('🔍 실시간 검증 시작:', currentTab.name);
                
                // 검증 시작 시 기존 오류 정리
                logger.info('VALIDATION', `실시간 파일 검증 시작: ${currentTab.name}`, {
                  file: currentTab.name,
                  contentLength: currentTab.content.length,
                  timestamp: new Date().toISOString()
                });
                
                // 기존 검증 오류 하이라이트 제거 (모든 마커 제거)
                console.log('🔍 검증 시작 - 하이라이트 제거 시작');
                if (window.clearAllMarkers) {
                  console.log('🗑️ clearAllMarkers 호출');
                  window.clearAllMarkers();
                } else if (window.clearAllErrorMarkers) {
                  console.log('🗑️ clearAllErrorMarkers 호출');
                  window.clearAllErrorMarkers();
                }
                
                // view-line 하이라이트 제거
                if (window.clearViewLineHighlights) {
                  console.log('🗑️ clearViewLineHighlights 호출');
                  window.clearViewLineHighlights();
                }
                
                // 추가 강제 제거
                setTimeout(() => {
                  console.log('🔍 500ms 후 추가 하이라이트 제거');
                  if (window.clearAllMarkers) {
                    window.clearAllMarkers();
                  }
                  if (window.clearViewLineHighlights) {
                    window.clearViewLineHighlights();
                  }
                }, 500);
                
                // 현재 탭의 파일 정보로 검증만 실행
                const result = await validateFileContent(
                { 
                  name: currentTab.name, 
                  path: currentTab.path || currentTab.name 
                },
                currentTab.content,
                { 
                  content: currentTab.content, 
                  size: currentTab.content.length 
                }
              );
                
                if (result.success && (!result.details || result.details.length === 0)) {
                  console.log('✅ 실시간 검증 완료 - 오류 없음');
                  
                  // 디버깅: 현재 로그 상태 확인
                  console.log('🔍 현재 로그 상태:', logger.logs.filter(log => log.category === 'VALIDATION'));
                  
                  // 로그에 성공 기록 (먼저 추가)
                  logger.info('VALIDATION', `실시간 검증 완료: ${currentTab.name} (오류 없음)`, {
                    file: currentTab.name,
                    contentLength: currentTab.content.length,
                    validationTime: new Date().toISOString(),
                    status: 'SUCCESS'
                  });
                  
                  // 해결된 오류 로그 정리 (해당 파일만)
                  const cleanedCount = logger.cleanResolvedErrors(currentTab.name);
                  console.log(`🧹 정리된 오류 로그: ${cleanedCount}개`);
                  
                  // 검증 성공 시에도 하이라이트 제거 (강제 제거)
                  console.log('🔍 검증 성공 - 하이라이트 제거 시작');
                  if (window.clearAllMarkers) {
                    console.log('🗑️ clearAllMarkers 호출');
                    window.clearAllMarkers();
                  } else if (window.clearAllErrorMarkers) {
                    console.log('🗑️ clearAllErrorMarkers 호출');
                    window.clearAllErrorMarkers();
                  }
                  
                  // view-line 하이라이트 제거
                  if (window.clearViewLineHighlights) {
                    console.log('🗑️ clearViewLineHighlights 호출');
                    window.clearViewLineHighlights();
                  }
                  
                  // 추가 강제 제거
                  setTimeout(() => {
                    console.log('🔍 1초 후 추가 하이라이트 제거');
                    if (window.clearAllMarkers) {
                      window.clearAllMarkers();
                    }
                    if (window.clearViewLineHighlights) {
                      window.clearViewLineHighlights();
                    }
                  }, 1000);
                  
                  // LogViewer 새로고침 트리거 (성공 시에도)
                  if (window.refreshLogViewer) {
                    console.log('🔄 LogViewer 새로고침 트리거 (성공)');
                    window.refreshLogViewer();
                  }
                  
                  // 성공 토스트 팝업 표시
                  const notification = document.createElement('div');
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `✅ 실시간 검증 완료: ${currentTab.name} (오류 없음)`;
                  document.body.appendChild(notification);
                  setTimeout(() => {
                    if (notification.parentNode) {
                      notification.style.animation = 'slideOut 0.3s ease-in';
                      setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 100);
                    }
                  }, 3000);
                } else if (!result.success || (result.details && result.details.length > 0)) {
                  console.error('❌ 실시간 검증 실패:', result.error || `${result.details?.length || 0}개의 오류 발견`);
                  
                  // 로그에 실패 기록
                  const errorMessage = result.error || `${result.details?.length || 0}개의 검증 오류가 발견되었습니다.`;
                  logger.error('VALIDATION', `실시간 검증 실패: ${errorMessage}`, {
                    file: currentTab.name,
                    error: errorMessage,
                    validationTime: new Date().toISOString(),
                    status: 'FAILED',
                    errorCount: result.details?.length || 0
                  });
                  
                  // 에러 토스트 팝업 표시
                  const notification = document.createElement('div');
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `❌ 실시간 검증 실패: ${errorMessage}`;
                  document.body.appendChild(notification);
                  setTimeout(() => {
                    if (notification.parentNode) {
                      notification.style.animation = 'slideOut 0.3s ease-in';
                      setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 100);
                    }
                  }, 5000);
                  
                  // 상세 에러 정보가 있으면 에디터에 하이라이트 표시 및 로그에 추가
                  if (result.details && result.details.length > 0) {
                    console.log('📋 실시간 검증 오류 상세:', result.details);
                    
                    // 로그에 검증 오류 추가
                    result.details.forEach((error, index) => {
                      logger.error('VALIDATION', `실시간 검증 오류 ${index + 1}: ${error.message}`, {
                        line: parseInt(error.line) || 1,
                        column: parseInt(error.column) || 1,
                        offset: parseInt(error.offset) || 0,
                        path: currentTab.path || currentTab.name,
                        file: currentTab.name,
                        message: error.message,
                        severity: error.severity,
                        validationTime: new Date().toISOString(),
                        errorIndex: index + 1,
                        totalErrors: result.details.length
                      });
                    });
                    
                    // 에디터에 에러 마커 추가
                    if (window.addErrorMarkers) {
                      window.addErrorMarkers(result.details, currentTab.path || currentTab.name);
                    }
                    
                                      // 로그 뷰어 표시 및 새로고침
                  setLogViewerVisible(true);
                  
                  // LogViewer 새로고침 트리거
                  if (window.refreshLogViewer) {
                    console.log('🔄 LogViewer 새로고침 트리거');
                    window.refreshLogViewer();
                  }
                  }
                }
                
              } catch (error) {
                console.error('❌ 실시간 검증 중 예외 발생:', error);
                
                // 로그에 예외 기록
                logger.error('VALIDATION', `실시간 검증 중 예외 발생: ${error.message}`, {
                  file: currentTab.name,
                  error: error.message,
                  stack: error.stack,
                  validationTime: new Date().toISOString(),
                  status: 'EXCEPTION'
                });
                
                // 에러 토스트 팝업 표시
                const notification = document.createElement('div');
                notification.style.cssText = `
                  position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                  padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                  font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  animation: slideIn 0.3s ease-out;
                `;
                notification.textContent = `❌ 실시간 검증 실패: ${error.message}`;
                document.body.appendChild(notification);
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                  }
                }, 5000);
              }
            } catch (error) {
              console.error('임시저장 실패:', error);
              alert('임시저장 중 오류가 발생했습니다.');
              
              // 로그에 임시저장 실패 기록
              logger.error('VALIDATION', `임시저장 실패: ${error.message}`, {
                file: currentTab.name,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
              });
            } finally {
              setIsSubmittingTemp(false);
            }
            } else if (!currentTab) {
              alert('검증할 파일을 선택해주세요.');
            }
          }}
          disabled={!getCurrentTab() || isSubmittingTemp}
          title="임시저장"
        >
          {isSubmittingTemp ? '저장 중...' : '임시저장'}
        </button>

        
        <button 
          className={`header-btn ${isSubmittingServer ? 'submitting' : ''}`}
          onClick={async () => {
            const currentTab = getCurrentTab();
            if (currentTab && !isSubmittingServer) {
              // 저장되지 않은 파일인지 확인
              if (currentTab.isDirty) {
                const shouldSubmit = window.confirm(
                  `파일 "${currentTab.name}"이(가) 저장되지 않았습니다.\n제출하시겠습니까?`
                );
                if (!shouldSubmit) {
                  return;
                }
              }
              
              setIsSubmittingServer(true);
              
              // 제출 시작을 로그에 기록
              logger.info('SUBMISSION', `제출 시작: ${currentTab.name}`, {
                file: currentTab.name,
                path: currentTab.path || currentTab.name,
                bookId: bookInfo?.id || window.currentBookId || 1,
                contentLength: currentTab.content.length,
                isDirty: currentTab.isDirty
              });
              
              try {
                // 1단계: 파일 검증 실행 (주석 처리)
                /*
                console.log('🔍 1단계: 파일 검증 시작');
                const validationResult = await validateFileContent(
                { 
                  name: currentTab.name, 
                  path: currentTab.path || currentTab.name 
                },
                currentTab.content,
                { 
                  content: currentTab.content, 
                  size: currentTab.content.length 
                }
              );
                
                // 검증 실패 시 중단
                if (!validationResult.success || (validationResult.details && validationResult.details.length > 0)) {
                  console.error('❌ 파일 검증 실패:', validationResult.error || `${validationResult.details?.length || 0}개의 오류 발견`);
                  
                  // 검증 실패를 로그에 기록
                  const errorMessage = validationResult.error || `${validationResult.details?.length || 0}개의 검증 오류가 발견되었습니다.`;
                  logger.error('SUBMISSION', `제출 실패 - 검증 오류: ${errorMessage}`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    error: errorMessage,
                    details: validationResult.details || []
                  });
                  
                  // 상세 검증 오류들을 로그에 추가
                  if (validationResult.details && validationResult.details.length > 0) {
                    validationResult.details.forEach(error => {
                      logger.error('VALIDATION', `제출 시 검증 오류: ${error.message}`, {
                        file: currentTab.name,
                        path: currentTab.path || currentTab.name,
                        line: parseInt(error.line) || 1,
                        column: parseInt(error.column) || 1,
                        offset: parseInt(error.offset) || 0,
                        message: error.message,
                        severity: error.severity
                      });
                    });
                  }
                  
                  // 즉시 로그뷰어 표시 (강제)
                  console.log('🔍 검증 실패 - 로그뷰어 강제 표시');
                  console.log('🔍 setLogViewerVisible 함수:', typeof setLogViewerVisible);
                  setLogViewerVisible(true);
                  
                  // 추가 디버깅: 로그 상태 확인
                  setTimeout(() => {
                    console.log('🔍 1초 후 로그 상태 확인');
                    if (window.logger) {
                      const allLogs = window.logger.getLogs();
                      const errorLogs = allLogs.filter(log => log.level === 'ERROR');
                      console.log('🔍 현재 ERROR 로그 수:', errorLogs.length);
                      console.log('🔍 ERROR 로그들:', errorLogs);
                    }
                  }, 1000);
                  
                  // 에러 토스트 팝업 표시
                  const notification = document.createElement('div');
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `❌ 제출 실패: ${errorMessage}`;
                  document.body.appendChild(notification);
                  setTimeout(() => {
                    if (notification.parentNode) {
                      notification.style.animation = 'slideOut 0.3s ease-in';
                      setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                    }
                  }, 5000);
                  
                  // 로그 뷰어 표시 (강제)
                  console.log('🔍 검증 실패 - 로그뷰어 강제 표시');
                  setLogViewerVisible(true);
                  return;
                }
                
                console.log('✅ 파일 검증 완료');
                */
                
                console.log('🔍 구문 오류 검증 건너뜀 - 바로 파일 저장 시작');
                
                // 2단계: API로 파일 저장
                console.log('💾 2단계: API로 파일 저장 시작');
                const bookId = bookInfo?.id || window.currentBookId || 1; // 현재 책 ID
                
                // 워크스페이스 기준 상대경로 변환 함수
                const getWorkspaceRelpath = (nodePath) => {
                  console.log('🔍 경로 변환 전:', nodePath);
                  
                  // 전체 URL인 경우 처리
                  if (nodePath.includes('http://') || nodePath.includes('https://')) {
                    // URL에서 파일 경로만 추출
                    const urlParts = nodePath.split('/');
                    const workspaceIndex = urlParts.indexOf('workspace');
                    if (workspaceIndex !== -1 && workspaceIndex + 1 < urlParts.length) {
                      const relpath = urlParts.slice(workspaceIndex + 1).join('/');
                      console.log('🔍 URL에서 경로 추출:', relpath);
                      return relpath;
                    }
                  }
                  
                  // OEBPS 폴더가 빠진 경우 추가
                  if (nodePath && !nodePath.startsWith('OEBPS/') && !nodePath.startsWith('META-INF/') && nodePath !== 'mimetype') {
                    const relpath = `OEBPS/${nodePath}`;
                    console.log('🔍 OEBPS 폴더 추가:', relpath);
                    return relpath;
                  }
                  
                  // 이미 올바른 상대경로인 경우 그대로 반환
                  console.log('🔍 경로 변환 후 (변경 없음):', nodePath);
                  return nodePath;
                };
                
                // 간단한 접근: 열린 탭의 모든 파일을 수집 (수정 여부와 관계없이)
                const collectOpenTabFiles = () => {
                  const files = [];
                  console.log('🔍 열린 탭 파일들 수집 시작');
                  
                  openTabs.forEach((tab, index) => {
                    if (tab.content && tab.content.trim() !== '') {
                      const relpath = getWorkspaceRelpath(tab.path || tab.name);
                      files.push({
                        content: tab.content,
                        relpath: relpath
                      });
                      console.log(`✅ 열린 탭 파일 ${index}: ${relpath} (${tab.content.length} bytes)`);
                    }
                  });
                  
                  return files;
                };
                
                // 디버깅: 현재 상태 확인
                console.log('🔍 현재 openTabs:', openTabs);
                console.log('🔍 현재 fileTree:', fileTree);
                
                // 열린 탭의 모든 파일 수집
                const filesToSave = collectOpenTabFiles();
                
                // 간단화: 새로 추가된 파일 확인 로직 제거
                
                console.log('🔍 저장할 파일들:', filesToSave.length, '개');
                filesToSave.forEach((file, index) => {
                  console.log(`  ${index}: ${file.relpath} (${file.content.length} bytes)`);
                  console.log(`    내용 미리보기: ${file.content.substring(0, 200)}...`);
                });
                
                // 삭제된 파일들 확인
                console.log('🔍 삭제된 파일들:', deletedFiles);
                
                // 파일이 하나도 없고 삭제된 파일도 없으면 오류
                if (filesToSave.length === 0 && deletedFiles.length === 0) {
                  throw new Error('저장할 파일이 없습니다. 파일트리를 확인해주세요.');
                }
                
                try {
                  const saveResult = await bookAPI.updateBookWorkspace(
                    bookId,
                    filesToSave,
                    deletedFiles
                  );
                  
                  console.log('✅ 파일 저장 완료:', saveResult);
                  
                  // 저장 성공을 로그에 기록
                  logger.info('SUBMISSION', `파일 저장 성공: ${currentTab.name}`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    contentLength: currentTab.content.length,
                    saveResult: saveResult
                  });
                  
                  // 저장 성공 토스트 팝업 표시
                  const notification = document.createElement('div');
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `✅ 파일 저장 완료: ${currentTab.name}`;
                  document.body.appendChild(notification);
                  setTimeout(() => {
                    if (notification.parentNode) {
                      notification.style.animation = 'slideOut 0.3s ease-in';
                      setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                    }
                  }, 3000);
                  
                } catch (saveError) {
                  console.error('❌ 파일 저장 실패:', saveError);
                  
                  // 저장 실패를 로그에 기록
                  logger.error('SUBMISSION', `제출 실패 - 파일 저장 오류: ${saveError.message}`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    error: saveError.message,
                    stack: saveError.stack
                  });
                  
                  // 저장 실패 토스트 팝업 표시
                  const notification = document.createElement('div');
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `❌ 파일 저장 실패: ${saveError.message}`;
                  document.body.appendChild(notification);
                  setTimeout(() => {
                    if (notification.parentNode) {
                      notification.style.animation = 'slideOut 0.3s ease-in';
                      setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                    }
                  }, 5000);
                  
                  // 로그 뷰어 표시 (강제)
                  console.log('🔍 저장 실패 - 로그뷰어 강제 표시');
                  setLogViewerVisible(true);
                  return;
                }
                
                // 3단계 제거: 표준 검사 없이 파일 저장만 완료
                console.log('✅ 파일 저장 완료 - 표준 검사 생략');
                
                                  // 제출 완료를 로그에 기록
                  logger.info('SUBMISSION', `제출 완료 - 파일 저장 성공`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    contentLength: currentTab.content.length,
                    savedFiles: filesToSave.length,
                    deletedFiles: deletedFiles.length
                  });
                  
              } catch (error) {
                console.error('❌ 제출 과정 중 예외 발생:', error);
                
                // 제출 과정 중 예외를 로그에 기록
                logger.error('SUBMISSION', `제출 과정 중 예외 발생: ${error.message}`, {
                  file: currentTab?.name || 'unknown',
                  path: currentTab?.path || currentTab?.name || 'unknown',
                  bookId: bookInfo?.id || window.currentBookId || 1,
                  error: error.message,
                  stack: error.stack
                });
                
                // 에러 토스트 팝업 표시
                const notification = document.createElement('div');
                notification.style.cssText = `
                  position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                  padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                  font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  animation: slideIn 0.3s ease-out;
                `;
                notification.textContent = `❌ 제출 실패: ${error.message}`;
                document.body.appendChild(notification);
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                  }
                }, 5000);
                
                // 로그 뷰어 표시 (강제)
                console.log('🔍 제출 과정 예외 - 로그뷰어 강제 표시');
                setLogViewerVisible(true);
              } finally {
                setIsSubmittingServer(false);
              }
            } else if (!currentTab) {
              alert('제출할 파일을 선택해주세요.');
            }
          }}
          disabled={!getCurrentTab() || isSubmittingServer}
          title="서버저장"
        >
          {isSubmittingServer ? '저장 중...' : '서버저장'}
        </button>


        <button 
          className={`header-btn ${isSubmittingStandard ? 'submitting' : ''}`}
          onClick={async () => {
            const currentTab = getCurrentTab();
            if (currentTab && !isSubmittingStandard) {
              setIsSubmittingStandard(true);
              
              // 표준점검 시작을 로그에 기록
              logger.info('STANDARD_CHECK', `표준점검 시작: ${currentTab.name}`, {
                file: currentTab.name,
                path: currentTab.path || currentTab.name,
                bookId: bookInfo?.id || window.currentBookId || 1
              });
              
              try {
                const bookId = bookInfo?.id || window.currentBookId || 1;
                
                // /api/books/{id}/ace API 호출
                const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://lib-editor.boinit.com/api';
                console.log('🔍 표준점검 API 호출 시작:', `${API_BASE_URL}/books/${bookId}/ace`);
                // 토큰 가져오기
                const token = sessionStorage.getItem('token');
                const headers = {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                };
                
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                }
                
                const response = await fetch(`${API_BASE_URL}/books/${bookId}/ace`, {
                  method: 'POST', 
                  headers,
                  body: JSON.stringify({
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    content: currentTab.content
                  })
                });
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('✅ 표준점검 API 결과:', result);
                
                // earl:result의 earl:outcome 확인
                const earlResult = result['earl:result'];
                const earlOutcome = earlResult?.['earl:outcome'];
                
                console.log('🔍 earl:outcome 확인:', earlOutcome);
                
                                if (earlOutcome === 'pass') {
                  // 성공 결과를 로그에 기록
                  logger.info('STANDARD_CHECK', `표준점검 완료: ${currentTab.name}`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    result: result,
                    outcome: earlOutcome
                  });
                } else {
                  // earl:outcome이 pass가 아닌 경우 전체 결과를 로그에 추가
                  console.log('❌ 표준점검 실패 - earl:outcome이 pass가 아님:', earlOutcome);
                  
                  // 전체 결과를 표준점검 로그에 추가
                  logger.error('STANDARD_CHECK', `표준점검 실패: earl:outcome = ${earlOutcome}`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    outcome: earlOutcome,
                    fullResult: result
                  });
                  
                  // 결과의 세부 내용이 있으면 개별적으로 로그에 추가
                  if (result && typeof result === 'object') {
                    // 오류가 있는 경우
                    if (result.errors && result.errors.length > 0) {
                      result.errors.forEach((error, index) => {
                        logger.error('STANDARD_CHECK', `표준점검 오류 ${index + 1}: ${error.message || error}`, {
                          file: currentTab.name,
                          path: currentTab.path || currentTab.name,
                          bookId: bookId,
                          error: error,
                          errorIndex: index + 1,
                          totalErrors: result.errors.length
                        });
                      });
                    }
                    
                    // 경고가 있는 경우
                    if (result.warnings && result.warnings.length > 0) {
                      result.warnings.forEach((warning, index) => {
                        logger.warn('STANDARD_CHECK', `표준점검 경고 ${index + 1}: ${warning.message || warning}`, {
                          file: currentTab.name,
                          path: currentTab.path || currentTab.name,
                          bookId: bookId,
                          warning: warning,
                          warningIndex: index + 1,
                          totalWarnings: result.warnings.length
                        });
                      });
                    }
                    
                    // 기타 세부 정보가 있는 경우
                    if (result.details && result.details.length > 0) {
                      result.details.forEach((detail, index) => {
                        logger.error('STANDARD_CHECK', `표준점검 세부 오류 ${index + 1}: ${detail.message || detail}`, {
                          file: currentTab.name,
                          path: currentTab.path || currentTab.name,
                          bookId: bookId,
                          detail: detail,
                          detailIndex: index + 1,
                          totalDetails: result.details.length
                        });
                      });
                    }
                  }
                }
                
                // 로그뷰어는 항상 표시되므로 별도 호출 불필요
                
                // 토스트 팝업 표시 (earl:outcome에 따라 다름)
                const notification = document.createElement('div');
                if (earlOutcome === 'pass') {
                  // 성공 토스트 팝업 표시
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `✅ 표준점검 완료: ${currentTab.name}`;
                } else {
                  // 실패 토스트 팝업 표시
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `❌ 표준점검 실패: ${currentTab.name} (earl:outcome = ${earlOutcome})`;
                }
                
                document.body.appendChild(notification);
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                  }
                }, earlOutcome === 'pass' ? 3000 : 5000);
                
              } catch (error) {
                console.error('❌ 표준점검 실패:', error);
                
                // 실패를 로그에 기록
                logger.error('STANDARD_CHECK', `표준점검 실패: ${error.message}`, {
                  file: currentTab.name,
                  path: currentTab.path || currentTab.name,
                  bookId: bookInfo?.id || window.currentBookId || 1,
                  error: error.message,
                  stack: error.stack
                });
                
                                 // 로그뷰어는 항상 표시되므로 별도 호출 불필요
                 
                 // 에러 토스트 팝업 표시
                const notification = document.createElement('div');
                notification.style.cssText = `
                  position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                  padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                  font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  animation: slideIn 0.3s ease-out;
                `;
                notification.textContent = `❌ 표준점검 실패: ${error.message}`;
                document.body.appendChild(notification);
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                  }
                }, 5000);
              } finally {
                setIsSubmittingStandard(false);
              }
            } else if (!currentTab) {
              alert('표준점검할 파일을 선택해주세요.');
            }
          }}
          disabled={!getCurrentTab() || isSubmittingStandard}
          title="표준점검"
        >
          {isSubmittingStandard ? '점검 중...' : '표준점검'}
        </button>

        <button 
          className={`header-btn ${isSubmittingAccessibility ? 'submitting' : ''}`}
          onClick={async () => {
            const currentTab = getCurrentTab();
            if (currentTab && !isSubmittingAccessibility) {
              setIsSubmittingAccessibility(true);
              
              // 접근성 점검 시작을 로그에 기록
              logger.info('ACCESSIBILITY', `접근성 점검 시작: ${currentTab.name}`, {
                file: currentTab.name,
                path: currentTab.path || currentTab.name,
                bookId: bookInfo?.id || window.currentBookId || 1
              });
              
              try {
                const bookId = bookInfo?.id || window.currentBookId || 1;
                
                // /api/books/{id}/epubcheck API 호출
                const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://lib-editor.boinit.com/api';
                console.log('🔍 접근성 점검 API 호출 시작:', `${API_BASE_URL}/books/${bookId}/epubcheck`);
                // 토큰 가져오기
                const token = sessionStorage.getItem('token');
                const headers = {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                };
                
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                }
                
                const response = await fetch(`${API_BASE_URL}/books/${bookId}/epubcheck`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    content: currentTab.content
                  })
                });
                
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('✅ 접근성 점검 API 결과:', result);
                
                // messages 배열 확인
                const messages = result.messages || [];
                console.log('🔍 접근성 점검 메시지 개수:', messages.length);
                console.log('🔍 접근성 점검 메시지 내용:', messages);
                
                if (messages.length === 0) {
                  // 성공 결과를 로그에 기록 (ERROR로 추가하여 로그 뷰어에 표시)
                  logger.error('ACCESSIBILITY', `접근성 점검 완료: ${currentTab.name}`, {
                    file: currentTab.name,
                    path: currentTab.path || currentTab.name,
                    bookId: bookId,
                    result: result
                  });
                } else {
                  // 메시지가 있는 경우 각각을 로그에 추가
                  messages.forEach((message, index) => {
                    const { ID, severity, message: messageText, locations } = message;
                    
                    console.log(`📋 접근성 점검 메시지 ${index + 1}:`, {
                      ID,
                      severity,
                      message: messageText,
                      locations: locations?.length || 0
                    });
                    
                    // severity에 따라 다른 로그 레벨 사용
                    const logData = {
                      file: currentTab.name,
                      path: currentTab.path || currentTab.name,
                      bookId: bookId,
                      messageId: ID,
                      severity: severity,
                      message: messageText,
                      locations: locations,
                      messageIndex: index + 1,
                      totalMessages: messages.length
                    };
                    
                    // 모든 severity를 ERROR로 처리하여 로그 뷰어에 표시되도록 함
                    console.log('🔍 ACCESSIBILITY 로그 추가:', `접근성 점검 [${severity}] [${ID}]: ${messageText}`);
                    logger.error('ACCESSIBILITY', `접근성 점검 [${severity}] [${ID}]: ${messageText}`, logData);
                  });
                }
                
                // 메시지가 있으면 로그 뷰어 표시하고 접근성 탭으로 전환
                if (messages.length > 0) {
                  console.log('🔍 접근성 점검 오류 발견, 로그 뷰어 표시');
                  console.log('🔍 메시지 개수:', messages.length);
                  console.log('🔍 메시지 내용:', messages);
                  setLogViewerVisible(true);
                  
                  // 접근성 탭으로 전환하기 위해 localStorage에 설정 저장
                  localStorage.setItem('logViewerActiveTab', 'accessibility');
                  console.log('🔍 접근성 탭으로 전환 설정 저장됨');
                }
                
                // 토스트 팝업 표시 (messages 개수에 따라 다름)
                const notification = document.createElement('div');
                if (messages.length === 0) {
                  // 성공 토스트 팝업 표시
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `✅ 접근성 점검 완료: ${currentTab.name}`;
            } else {
                  // 실패 토스트 팝업 표시
                  const errorCount = messages.filter(m => m.severity === 'ERROR').length;
                  const warningCount = messages.filter(m => m.severity === 'WARNING').length;
                  
                  notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                    padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                    font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideIn 0.3s ease-out;
                  `;
                  notification.textContent = `❌ 접근성 점검 실패: ${currentTab.name} (오류: ${errorCount}, 경고: ${warningCount})`;
                }
                
                document.body.appendChild(notification);
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                  }
                }, messages.length === 0 ? 3000 : 5000);
                
              } catch (error) {
                console.error('❌ 접근성 점검 실패:', error);
                
                // 실패를 로그에 기록
                logger.error('ACCESSIBILITY', `접근성 점검 실패: ${error.message}`, {
                  file: currentTab.name,
                  path: currentTab.path || currentTab.name,
                  bookId: bookInfo?.id || window.currentBookId || 1,
                  error: error.message,
                  stack: error.stack
                });
                
                // 에러 토스트 팝업 표시
                const notification = document.createElement('div');
                notification.style.cssText = `
                  position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
                  padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
                  font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  animation: slideIn 0.3s ease-out;
                `;
                notification.textContent = `❌ 접근성 점검 실패: ${error.message}`;
                document.body.appendChild(notification);
                setTimeout(() => {
                  if (notification.parentNode) {
                    notification.style.animation = 'slideOut 0.3s ease-in';
                    setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
                  }
                }, 5000);
              } finally {
                setIsSubmittingAccessibility(false);
              }
            } else if (!currentTab) {
              alert('접근성 점검할 파일을 선택해주세요.');
            }
          }}
          disabled={!getCurrentTab() || isSubmittingAccessibility}
          title="접근성 점검"
        >
          {isSubmittingAccessibility ? '점검 중...' : '접근성 점검'}
        </button>
      

      
        
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>
    </header>
  );
};

export default Header;