import React from 'react';
import './AccordionSidebar.css';

const AccordionSidebar = ({
  sidebarWidth,
  accordionState,
  toggleAccordion,
  toc,
  handleTocItemClick,
  fileTree,
  renderFolderTree,
  sidebarResizerRef
}) => {
  return (
    <div className="accordion-sidebar" style={{ width: `${sidebarWidth}px` }}>
      {/* 파일 구조 아코디언 */}
      <div className="accordion-section">
        <div 
          className="accordion-header"
          onClick={() => toggleAccordion('files')}
        >
          <span className="accordion-icon">
            <span className="material-symbols-outlined" style={{fontSize: '16px'}}>folder</span>
          </span>
                      <span className="accordion-title">파일 구조</span>
          <span className="accordion-count">({fileTree.length})</span>
        </div>
        {accordionState.files && (
          <div className="accordion-content">
            <div className="folder-list">
              {fileTree.length > 0 ? (
                renderFolderTree(fileTree)
              ) : (
                <div className="folder-empty">
                  <div className="empty-message">
                    <span className="material-symbols-outlined" style={{fontSize: '16px', verticalAlign: 'middle', marginRight: '4px'}}>upload_file</span> EPUB 파일을 업로드하면<br />
                    파일 구조가 표시됩니다
                    <small>EPUB 파일을 선택해주세요</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 사이드바 리사이저 */}
      <div 
        ref={sidebarResizerRef}
        className="sidebar-resizer"
        title="사이드바 너비 조정"
      ></div>
    </div>
  );
};

export default AccordionSidebar;