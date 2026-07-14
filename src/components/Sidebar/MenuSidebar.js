import React from 'react';
import './MenuSidebar.css';

const MenuSidebar = ({
  visible,
  collapsed,
  toggleCollapse,
  toggleSidebar,
  panelStates,
  togglePanel,
  autoCheckEnabled,
  setAutoCheckEnabled,
  fileInputRef,
  isLoading,
  runCode,
  saveCurrentFile,
  downloadCurrentFile,
  getCurrentTab,
  saveAllFiles,
  openTabs,
  toggleTheme,
  changeThemeMode,
  themeMode
}) => {
  if (!visible) return null;

  return (
    <div className={`menu-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="menu-sidebar-header">
        <h3 className="menu-title">메뉴</h3>
        <button 
          className="menu-toggle-btn"
          onClick={toggleCollapse}
          title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
        >
          {collapsed ? '▶' : '◀'}
        </button>
        <button 
          className="menu-close-btn"
          onClick={toggleSidebar}
          title="메뉴 숨기기"
        >
          ✕
        </button>
      </div>
      
      <div className="menu-content">
        <div className="menu-section">
          <h4 className="menu-section-title">레이아웃</h4>
          <button 
            className={`menu-btn ${panelStates.sidebar ? 'active' : ''}`}
            onClick={() => togglePanel('sidebar')}
            title={panelStates.sidebar ? "사이드바 숨기기" : "사이드바 보이기"}
          >
            <span className="material-symbols-outlined" style={{fontSize: '16px'}}>home</span>
            {!collapsed && <span className="menu-text">사이드바</span>}
          </button>
          <button 
            className={`menu-btn ${panelStates.preview ? 'active' : ''}`}
            onClick={() => togglePanel('preview')}
            title={panelStates.preview ? "미리보기 숨기기" : "미리보기 보이기"}
          >
            <span className="menu-icon">●</span>
            {!collapsed && <span className="menu-text">미리보기</span>}
          </button>
        </div>

        <div className="menu-section">
          <h4 className="menu-section-title">기능</h4>
          <button 
            className={`menu-btn ${autoCheckEnabled ? 'active' : ''}`}
            onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
            title={autoCheckEnabled ? "자동 검사 비활성화" : "자동 검사 활성화"}
          >
            <span className="menu-icon">◆</span>
            {!collapsed && <span className="menu-text">자동검사</span>}
          </button>
          <button 
            className={`menu-btn ${panelStates.autoCheck ? 'active' : ''}`}
            onClick={() => togglePanel('autoCheck')}
            title={panelStates.autoCheck ? "검사 결과 숨기기" : "검사 결과 보이기"}
          >
            <span className="menu-icon">■</span>
            {!collapsed && <span className="menu-text">검사결과</span>}
          </button>
          <button 
            className={`menu-btn ${panelStates.settings ? 'active' : ''}`}
            onClick={() => togglePanel('settings')}
            title={panelStates.settings ? "설정 숨기기" : "설정 보이기"}
          >
            <span className="menu-icon">▲</span>
            {!collapsed && <span className="menu-text">설정</span>}
          </button>
          <button 
            className={`menu-btn ${panelStates.help ? 'active' : ''}`}
            onClick={() => togglePanel('help')}
            title={panelStates.help ? "도움말 숨기기" : "도움말 보이기"}
          >
            <span className="menu-icon">◆</span>
            {!collapsed && <span className="menu-text">도움말</span>}
          </button>
        </div>

        <div className="menu-section">
          <h4 className="menu-section-title">파일</h4>
          <button 
            className="menu-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="EPUB 파일 업로드"
          >
            <span className="material-symbols-outlined" style={{fontSize: '16px'}}>
              {isLoading ? 'hourglass_empty' : 'download'}
            </span>
            {!collapsed && <span className="menu-text">EPUB 업로드</span>}
          </button>
          <button 
            className="menu-btn"
            onClick={runCode}
            title="코드 실행"
          >
            <span className="menu-icon">◆</span>
            {!collapsed && <span className="menu-text">실행</span>}
          </button>
          <button 
            className="menu-btn"
            onClick={saveCurrentFile}
            disabled={!getCurrentTab()}
            title="현재 파일 저장 (Ctrl+S)"
          >
            <span className="menu-icon">💾</span>
            {!collapsed && <span className="menu-text">저장</span>}
          </button>
          <button 
            className="menu-btn"
            onClick={downloadCurrentFile}
            disabled={!getCurrentTab()}
            title="현재 파일 다운로드"
          >
            <span className="material-symbols-outlined" style={{fontSize: '16px'}}>file_download</span>
            {!collapsed && <span className="menu-text">다운로드</span>}
          </button>
          <button 
            className="menu-btn"
            onClick={saveAllFiles}
            disabled={openTabs.length === 0}
            title="모든 파일 ZIP으로 저장"
          >
            <span className="menu-icon">▲</span>
            {!collapsed && <span className="menu-text">전체 저장</span>}
          </button>
        </div>

        <div className="menu-section">
          <h4 className="menu-section-title">테마</h4>
          <div className="menu-btn theme-selector" title="테마 변경">
            <span className="material-symbols-outlined" style={{fontSize: '16px'}}>palette</span>
            {!collapsed && <span className="menu-text">테마</span>}
            {!collapsed && (
              <div className="theme-dropdown">
                <div 
                  className="theme-option"
                  onClick={() => changeThemeMode('light')}
                  style={{
                    backgroundColor: themeMode === 'light' ? '#007acc' : 'transparent',
                    color: themeMode === 'light' ? 'white' : 'inherit'
                  }}
                >
                  <span className="material-symbols-outlined" style={{fontSize: '14px'}}>light_mode</span> 라이트
                </div>
                <div 
                  className="theme-option"
                  onClick={() => changeThemeMode('dark')}
                  style={{
                    backgroundColor: themeMode === 'dark' ? '#007acc' : 'transparent',
                    color: themeMode === 'dark' ? 'white' : 'inherit'
                  }}
                >
                  <span className="material-symbols-outlined" style={{fontSize: '14px'}}>dark_mode</span> 다크
                </div>
                <div 
                  className="theme-option"
                  onClick={() => changeThemeMode('system')}
                  style={{
                    backgroundColor: themeMode === 'system' ? '#007acc' : 'transparent',
                    color: themeMode === 'system' ? 'white' : 'inherit'
                  }}
                >
                  <span className="material-symbols-outlined" style={{fontSize: '14px'}}>computer</span> 시스템
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuSidebar;