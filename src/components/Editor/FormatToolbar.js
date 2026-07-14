import React from 'react';
import './FormatToolbar.css';

const FormatToolbar = ({ 
  currentTab,
  onFormatText,
  onInsertHeading,
  onInsertParagraph,
  onInsertHorizontalRule,
  onInsertOrderedList,
  onInsertUnorderedList,
  onInsertBlockquote,
  onInsertSection,
  onInsertLink,
  onInsertImage,
  onInsertTable,
  onAlignText,
  onSetTextColor,
  onSetBackgroundColor,
  onSetFontSize,
  onInsertCodeBlock,
  onInsertInlineCode,
  onInsertRole,
  onGoToNextError,
  onGoToPrevError
}) => {
  // HTML/XHTML 파일이 아닌 경우 툴바를 숨김
  if (!currentTab || (currentTab.type !== 'html' && currentTab.type !== 'xhtml')) {
    return null;
  }

  const buttonStyle = {
    padding: '4px 8px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #5a5a5a',
    borderRadius: '4px',
    color: '#cccccc',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease'
  };

  const handleMouseEnter = (e) => {
    e.target.style.backgroundColor = '#4a4a4a';
    e.target.style.borderColor = '#6a6a6a';
  };

  const handleMouseLeave = (e) => {
    e.target.style.backgroundColor = '#3c3c3c';
    e.target.style.borderColor = '#5a5a5a';
  };

  return (
    <div className="format-toolbar" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      backgroundColor: '#2d2d30',
      borderBottom: '1px solid #3e3e42',
      flexShrink: 0,
      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap'
    }}>
      
      
     
      <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
      
      <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
        태그:
      </span>
      
      {[1, 2, 3, 4, 5, 6].map(level => (
        <button
          key={level}
          className="format-btn"
          onClick={() => onInsertHeading(level)}
          title={`제목 ${level} (Ctrl+${level})`}
          style={{ ...buttonStyle, fontWeight: 'bold' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          H{level}
        </button>
      ))}

      <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
      
      <button
        className="format-btn"
        onClick={onInsertParagraph}
        title="단락 (Ctrl+P)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        P
      </button>
      
      <button
        className="format-btn"
        onClick={onInsertHorizontalRule}
        title="구분선 (Ctrl+Shift+H)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        HR
      </button>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
      
      <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
        목록:
      </span>
      
      <button
        className="format-btn"
        onClick={onInsertOrderedList}
        title="순서 있는 목록 (Ctrl+Shift+O)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        OL
      </button>
      
      <button
        className="format-btn"
        onClick={onInsertUnorderedList}
        title="순서 없는 목록 (Ctrl+Shift+U)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        UL
      </button>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
      
      <button
        className="format-btn"
        onClick={onInsertBlockquote}
        title="인용구 (Ctrl+Shift+Q)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        blockquote
      </button>

      <button
        className="format-btn"                                                                                                                                                                                                                                                                                                                                                                                                  
        onClick={onInsertSection}
        title="섹션 (Ctrl+Shift+S)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        section
      </button>

      
     
      
    


     


      
      

  
      
  
      
      

      <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
      
      {/* <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
        역할:
      </span>
      
      <button
        className="format-btn"
        onClick={onInsertRole}
        title="역할 태그 (Ctrl+Shift+R)"
        style={buttonStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        👤
      </button> */}
    
    </div>
  );
};

export default FormatToolbar;