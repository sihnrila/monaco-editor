import React, { useEffect } from 'react';
import './VscodeSidebar.css';

const VscodeSidebar = ({
  visible,
  activeSidebarTab,
  setActiveSidebarTab,
  epubData,
  fileInputRef,
  handleFileUpload,
  fileTree,
  setFileTree,
  toc,
  handleTocItemClick,
  handleFileClick,
  getFileIcon,

  toggleFolder,
  searchQuery,
  setSearchQuery,
  searchOptions,
  setSearchOptions,
  searchResults,
  performSearch,
  handleSearchResultClick,
  runCode,
  autoCheckEnabled,
  setAutoCheckEnabled,
  runAutoCheck,
  togglePanel,
  saveCurrentFile,
  downloadCurrentFile,
  getCurrentTab,
  saveAllFiles,
  openTabs,
  toggleTheme,
  changeThemeMode,
  themeMode,
  
  // 추가된 props
  currentSelectedNode,
  setCurrentSelectedNode,
  setSelectedNode,
  createFolder,
  createFile,
  deleteNode,
  renameNode,
  handleContextMenu
}) => {

  // OEBPS 폴더 자동 펼침 처리 (useEffect로 분리)
  useEffect(() => {
    if (fileTree && fileTree.length > 0) {
      const ensureExpandedProps = (nodes) => {
        return nodes.map(node => {
          if (node.type === 'folder') {
            const updatedNode = {
              ...node,
              isExpanded: node.isExpanded !== undefined ? node.isExpanded : false
            };
            if (node.children) {
              updatedNode.children = ensureExpandedProps(updatedNode.children);
            }
            return updatedNode;
          }
          return node;
        });
      };

      const safeFileTree = ensureExpandedProps(fileTree);
      const oebpsFolder = safeFileTree.find(node => node.name === 'OEBPS');
      
      if (oebpsFolder && !oebpsFolder.isExpanded) {
        setFileTree(prevTree => {
          const updateNode = (nodes) => {
            return nodes.map(n => {
              if (n.name === 'OEBPS') {
                return { ...n, isExpanded: true };
              }
              if (n.children) {
                return { ...n, children: updateNode(n.children) };
              }
              return n;
            });
          };
          return updateNode(prevTree);
        });
      }
    }
  }, [fileTree, setFileTree]);

  // 파일 트리 렌더링 (VS Code 스타일)
  const renderFileTree = () => {
    if (!fileTree || fileTree.length === 0) {
      return (
        <div className="file-tree-empty" style={{padding: '10px', color: '#666', fontStyle: 'italic'}}>
          파일이 없습니다.
        </div>
      );
    }
    
    
    // images 폴더 특별 확인 (재귀적으로 찾기)
    const findImagesFolderRecursive = (nodes) => {
      for (const node of nodes) {
        if (node.name === 'images' || node.name === 'Images') {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = findImagesFolderRecursive(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const imagesFolder = findImagesFolderRecursive(fileTree);
    if (imagesFolder) {
    
    } else {
      
      // OEBPS 폴더 안의 하위 폴더들 확인
      const oebpsFolder = fileTree.find(node => node.name === 'OEBPS');
      if (oebpsFolder && oebpsFolder.children) {
       
      }
    }
    
    // 모든 폴더에 isExpanded 속성이 없으면 기본값 설정
    const ensureExpandedProps = (nodes) => {
      return nodes.map(node => {
        if (node.type === 'folder') {
          const updatedNode = {
            ...node,
            isExpanded: node.isExpanded !== undefined ? node.isExpanded : false
          };
          if (node.children) {
            updatedNode.children = ensureExpandedProps(node.children);
          }
          return updatedNode;
        }
        return node;
      });
    };
    
    // 안전한 파일 트리 (isExpanded 속성이 보장됨)
    const safeFileTree = ensureExpandedProps(fileTree);

    return (
      <div style={{padding: '12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', display: 'flex', flexDirection: 'column'}}>
        <div 
          className="file-tree-scroll"
          style={{
            fontSize: '13px',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '4px'
          }}
        >
          {safeFileTree.map((node, index) => (
            <div key={index}>
              <div 
                style={{
                  padding: '6px 8px',
                  marginBottom: '2px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  color: '#000000',
                  fontSize: '13px',
                  border: '1px solid transparent'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f7fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#2d3748';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.color = '#000000';
                }}
                onClick={() => {
                  if (node.type === 'folder') {
                    toggleFolder(node);
                  } else {
                    handleFileClick(node);
                  }
                }}
                onContextMenu={(e) => {
                  console.log('🔍🔍🔍 VscodeSidebar에서 우클릭 감지!');
                  handleContextMenu(e, node);
                }}
              >
                <span style={{fontSize: '14px', minWidth: '16px', textAlign: 'center'}}>
                  {node.type === 'folder' ? (
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {node.isExpanded ? 'folder_open' : 'folder'}
              </span>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {getFileIcon(node.name)}
              </span>
            )}
                </span>
                <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {node.name}
                </span>
                <span style={{
                  fontSize: '11px',
                  color: '#718096',
                  backgroundColor: '#edf2f7',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '500'
                }}>
                  {node.type}
                </span>
              </div>
              
              {node.type === 'folder' && node.children && node.children.length > 0 && node.isExpanded && (
                <div style={{marginLeft: '16px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px'}}>
                  {node.children.map((child, childIndex) => (
                    <div key={childIndex}>
                      <div 
                        style={{
                          padding: '4px 8px',
                          marginBottom: '1px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                          color: '#000000',
                          fontSize: '12px',
                          border: '1px solid transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f7fafc';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.color = '#4a5568';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.color = '#000000';
                        }}
                                                 onClick={() => {
                           if (child.type === 'folder') {
                             toggleFolder(child);
                           } else {
                             handleFileClick(child);
                           }
                         }}
                         onContextMenu={(e) => {
                           console.log('🔍🔍🔍 VscodeSidebar에서 하위 노드 우클릭 감지!');
                           handleContextMenu(e, child);
                         }}
                      >
                        <span style={{fontSize: '12px', minWidth: '14px', textAlign: 'center'}}>
                          {child.type === 'folder' ? (
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {child.isExpanded ? 'folder_open' : 'folder'}
              </span>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {getFileIcon(child.name)}
              </span>
            )}
                        </span>
                        <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                          {child.name}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: '#718096',
                          backgroundColor: '#edf2f7',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          fontWeight: '500'
                        }}>
                          {child.type}
                        </span>
                      </div>
                      
                      {/* 3단계: images 폴더의 자식들 (이미지 파일들) */}
                      {child.type === 'folder' && child.children && child.children.length > 0 && child.isExpanded && (
                        <div style={{marginLeft: '16px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px'}}>
                          {child.children.map((grandChild, grandChildIndex) => (
                            <div key={grandChildIndex}>
                              <div 
                                style={{
                                  padding: '3px 8px',
                                  marginBottom: '1px',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s ease',
                                  color: '#000000',
                                  fontSize: '11px',
                                  border: '1px solid transparent'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f7fafc';
                                  e.currentTarget.style.borderColor = '#e2e8f0';
                                  e.currentTarget.style.color = '#4a5568';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.borderColor = 'transparent';
                                  e.currentTarget.style.color = '#000000';
                                }}
                                                                 onClick={() => {
                                   if (grandChild.type === 'folder') {
                                     toggleFolder(grandChild);
                                   } else {
                                     handleFileClick(grandChild);
                                   }
                                 }}
                                 onContextMenu={(e) => {
                                   console.log('🔍🔍🔍 VscodeSidebar에서 3단계 노드 우클릭 감지!');
                                   handleContextMenu(e, grandChild);
                                 }}
                              >
                                <span style={{fontSize: '11px', minWidth: '12px', textAlign: 'center'}}>
                                  {grandChild.type === 'folder' ? (
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                {grandChild.isExpanded ? 'folder_open' : 'folder'}
              </span>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                {getFileIcon(grandChild.name)}
              </span>
            )}
                                </span>
                                <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                  {grandChild.name}
                                </span>
                                <span style={{
                                  fontSize: '9px',
                                  color: '#718096',
                                  backgroundColor: '#edf2f7',
                                  padding: '1px 3px',
                                  borderRadius: '2px',
                                  fontWeight: '500'
                                }}>
                                  {grandChild.type}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 목차 트리 렌더링 (VS Code 스타일)
  const renderTocTree = () => {
    if (!toc || toc.length === 0) {
      return (
        <div style={{padding: '10px', color: '#666', fontStyle: 'italic', textAlign: 'center'}}>
          목차가 없습니다.
        </div>
      );
    }

    const renderTocNode = (item, level = 0) => {
      return (
        <div key={item.id || item.href}>
          <div 
            style={{
              padding: '6px 8px',
              marginBottom: '2px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
              color: '#ffffff',
              fontSize: '13px',
              border: '1px solid transparent',
              marginLeft: `${level * 12}px`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f7fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.color = '#2d3748';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#ffffff';
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTocItemClick(item);
            }}
          >
            <span style={{fontSize: '14px', minWidth: '16px', textAlign: 'center'}}>
              📖
            </span>
            <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              {item.title || item.label || `Chapter ${item.id + 1}`}
            </span>
            {item.href && (
              <span style={{
                fontSize: '10px',
                color: '#718096',
                backgroundColor: '#edf2f7',
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: '500',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.href.split('/').pop()}
              </span>
            )}
          </div>
          {item.children && item.children.length > 0 && (
            <div style={{marginLeft: '8px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px'}}>
              {item.children.map(child => renderTocNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={{padding: '12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', display: 'flex', flexDirection: 'column'}}>
        <div style={{
          fontWeight: '600', 
          marginBottom: '12px', 
          color: '#1a1a1a',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0
        }}>
          <span style={{fontSize: '16px'}}>📚</span>
          목차
        </div>
        
        <div 
          className="file-tree-scroll"
          style={{
            fontSize: '13px',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: '4px'
          }}
        >
          {toc.map(item => renderTocNode(item))}
        </div>
      </div>
    );
  };

  return (
    <div className={`vscode-sidebar ${!visible ? 'hidden' : ''}`}>
      {/* <div className="vscode-sidebar-tabs">
        <button 
          className={`vscode-tab ${activeSidebarTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveSidebarTab('explorer')}
          title="탐색기 (Ctrl+Shift+E)"
        >
<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z"/></svg>        </button>
        <button 
          className={`vscode-tab ${activeSidebarTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveSidebarTab('search')}
          title="검색 (Ctrl+Shift+F)"
        >
<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>        </button>
        <button 
          className={`vscode-tab ${activeSidebarTab === 'run' ? 'active' : ''}`}
          onClick={() => setActiveSidebarTab('run')}
          title="실행 및 디버그 (Ctrl+Shift+D)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M480-200q66 0 113-47t47-113v-160q0-66-47-113t-113-47q-66 0-113 47t-47 113v160q0 66 47 113t113 47Zm-80-120h160v-80H400v80Zm0-160h160v-80H400v80Zm80 40Zm0 320q-65 0-120.5-32T272-240H160v-80h84q-3-20-3.5-40t-.5-40h-80v-80h80q0-20 .5-40t3.5-40h-84v-80h112q14-23 31.5-43t40.5-35l-64-66 56-56 86 86q28-9 57-9t57 9l88-86 56 56-66 66q23 15 41.5 34.5T688-640h112v80h-84q3 20 3.5 40t.5 40h80v80h-80q0 20-.5 40t-3.5 40h84v80H688q-32 56-87.5 88T480-120Z"/></svg>
        </button>
        <button 
          className={`vscode-tab ${activeSidebarTab === 'extensions' ? 'active' : ''}`}
          onClick={() => setActiveSidebarTab('extensions')}
          title="확장 (Ctrl+Shift+X)"
        >
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="m482-320 140-140q17-17 22-41.5t-5-47.5q-10-23-30-37t-45-14q-25 0-45 15.5T482-552q-18-17-37.5-32.5T400-600q-25 0-45.5 13.5T324-550q-10 23-4.5 47.5T342-460l140 140ZM370-80l-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm40-320Z"/></svg>
        </button> 
      </div>*/}
      
      <div className="vscode-sidebar-content">
        {activeSidebarTab === 'explorer' && (
          <div className="explorer-panel">
            <div className="panel-header">
              <h3>탐색기</h3>
              <div className="panel-actions">
                {/* <button 
                    className="panel-action-btn"
                    onClick={() => {
                      if (!currentSelectedNode) {
                        alert('먼저 폴더를 선택해주세요.');
                        return;
                      }
                      setSelectedNode(currentSelectedNode);
                      createFolder();
                    }}
                    title="새 폴더"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>folder</span>
                  </button>
                  <button 
                    className="panel-action-btn"
                    onClick={() => {
                      if (!currentSelectedNode) {
                        alert('먼저 폴더를 선택해주세요.');
                        return;
                      }
                      setSelectedNode(currentSelectedNode);
                      createFile();
                    }}
                    title="새 파일"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>note_add</span>
                  </button>
                  <button 
                    className="panel-action-btn"
                    onClick={() => {
                      if (!currentSelectedNode) {
                        alert('먼저 삭제할 항목을 선택해주세요.');
                        return;
                      }
                      setSelectedNode(currentSelectedNode);
                      deleteNode();
                    }}
                    title="삭제"
                  >
                    🗑️
                  </button>
                  <button 
                    className="panel-action-btn"
                    onClick={() => {
                      if (!currentSelectedNode) {
                        alert('먼저 이름을 변경할 항목을 선택해주세요.');
                        return;
                      }
                      setSelectedNode(currentSelectedNode);
                      renameNode();
                    }}
                    title="이름 변경"
                  >
                    ✏️
                  </button> */}
              </div>
            </div>
            
            <div className="explorer-content">
              {epubData ? (
                <div className="file-explorer">
                  <div className="explorer-section">
                    {/* <div className="section-header">
                      <span className="section-icon">📚</span>
                      <span className="section-title">EPUB 파일</span>
                    </div> */}
                    <div className="section-content">
                      {renderFileTree()}
                    </div>
                  </div>
                  
                  {/* <div className="explorer-section">
                    <div className="section-header">
                      <span className="section-icon">📖</span>
                      <span className="section-title">목차</span>
                    </div>
                    <div className="section-content">
                      {renderTocTree()}
                    </div>
                  </div> */}
                </div>
              ) : (
                <div className="empty-state">
                  도서가 없습니다.
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeSidebarTab === 'search' && (
          <div className="search-panel">
            <div className="panel-header">
              <h3>검색</h3>
            </div>
            <div className="search-content">
              <div className="search-input-container">
                <input 
                  type="text" 
                  placeholder="검색어를 입력하세요..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                />
                <button className="search-btn" onClick={performSearch}>
          <span className="material-symbols-outlined" style={{fontSize: '16px'}}>search</span>
        </button>
              </div>
              <div className="search-results">
                {searchResults.length > 0 ? (
                  <div className="search-results-list">
                    {searchResults.map((result, resultIndex) => (
                      <div key={resultIndex} className="search-result-file">
                        <div className="result-file-header">
                          <span className="result-file-name">{result.fileName}</span>
                          <span className="result-file-count">({result.totalMatches}개)</span>
                        </div>
                        {result.matches.map((match, matchIndex) => (
                          <div 
                            key={matchIndex} 
                            className="search-result-item"
                            onClick={() => handleSearchResultClick(result, match)}
                          >
                            <span className="result-line-number">{match.line}</span>
                            <span className="result-line-text">{match.lineText}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="no-results">검색 결과가 없습니다</div>
                ) : (
                  <div className="search-placeholder">검색어를 입력하고 Enter를 누르세요</div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {activeSidebarTab === 'run' && (
          <div className="run-panel">
            <div className="panel-header">
              <h3>실행 및 디버그</h3>
            </div>
            <div className="run-content">
              <div className="run-configurations">
                <div 
                  className="configuration-item"
                  onClick={runCode}
                  title="현재 탭의 코드를 실행합니다"
                >
                  <span className="material-symbols-outlined" style={{fontSize: '16px'}}>play_arrow</span>
                  <span className="config-name">코드 실행</span>
                </div>
                <div 
                  className="configuration-item"
                  onClick={() => {
                    setAutoCheckEnabled(!autoCheckEnabled);
                    if (!autoCheckEnabled) {
                      runAutoCheck();
                    }
                  }}
                  title="자동 코드 검사를 토글합니다"
                >
                  <span className="material-symbols-outlined" style={{fontSize: '16px'}}>auto_fix_high</span>
                  <span className="config-name">
                    자동 검사 {autoCheckEnabled ? '(활성)' : '(비활성)'}
                  </span>
                </div>
                <div 
                  className="configuration-item"
                  onClick={() => togglePanel('autoCheck')}
                  title="검사 결과를 표시합니다"
                >
                  <span className="material-symbols-outlined" style={{fontSize: '16px'}}>bug_report</span>
                  <span className="config-name">검사 결과 보기</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSidebarTab === 'extensions' && (
          <div className="extensions-panel">
            <div className="panel-header">
              <h3>확장</h3>
            </div>
            <div className="extensions-content">
              <div 
                className="extension-item"
                onClick={() => fileInputRef.current?.click()}
                title="EPUB 파일을 업로드합니다"
              >
                <span className="material-symbols-outlined" style={{fontSize: '16px'}}>book</span>
                <span className="extension-name">EPUB 뷰어</span>
              </div>
              <div 
                className="extension-item"
                onClick={() => {
                  setAutoCheckEnabled(!autoCheckEnabled);
                  if (!autoCheckEnabled) {
                    runAutoCheck();
                  }
                }}
                title="코드 품질 검사를 활성화/비활성화합니다"
              >
                <span className="material-symbols-outlined" style={{fontSize: '16px'}}>code</span>
                <span className="extension-name">
                  코드 검사 {autoCheckEnabled ? '(활성)' : '(비활성)'}
                </span>
              </div>
              <div 
                className="extension-item theme-selector"
                title="테마를 변경합니다"
              >
                <span className="material-symbols-outlined" style={{fontSize: '16px'}}>palette</span>
                <span className="extension-name">테마</span>
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
              </div>
              <div 
                className="extension-item"
                onClick={() => togglePanel('settings')}
                title="설정을 엽니다"
              >
                <span className="material-symbols-outlined" style={{fontSize: '16px'}}>settings</span>
                <span className="extension-name">설정</span>
              </div>
              <div 
                className="extension-item"
                onClick={() => togglePanel('help')}
                title="도움말을 엽니다"
              >
                <span className="extension-icon">◉</span>
                <span className="extension-name">도움말</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VscodeSidebar;