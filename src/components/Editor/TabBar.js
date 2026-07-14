import React from 'react';
import './TabBar.css';

const TabBar = ({ openTabs, activeTabId, onTabChange, onTabClose, getTabIcon }) => {
  return (
    <div className="tabs-container">
      <div className="tabs-list">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.filePath || tab.name} // 툴팁으로 전체 경로 표시
          >
            <span className="material-symbols-outlined" style={{fontSize: '14px'}} data-type={tab.type}>
              {getTabIcon(tab.type)}
            </span>
            <span className="tab-name">{tab.name}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              title="탭 닫기"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabBar;