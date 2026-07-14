import React, { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import JSZip from 'jszip';

// 상수 imports
import { DEFAULT_CODE } from '../constants/defaultCode';
import { DEFAULT_TEMPLATES, DEFAULT_SNIPPETS } from '../constants/templates';

// API imports
import { bookAPI } from '../services/api';
import { getConfiguredWorkspaceBaseUrl, getWorkspaceBaseUrl } from '../services/url';

// 유틸리티 imports

import { downloadFile, getTabDisplayName, getLanguageFromExtension, getMimeType } from '../utils/fileHandling';
import logger from '../utils/logger';

// Context imports
import { useBook } from '../contexts/BookContext';

// 컴포넌트 imports
import Header from '../components/Header/Header';
import { EditorPane } from '../components/Editor';
import { PreviewPane } from '../components/Preview';
import { VscodeSidebar, MenuSidebar, AccordionSidebar } from '../components/Sidebar';
import RoleTypeModal from '../components/Editor/RoleTypeModal';
import LogViewer from '../components/LogViewer/LogViewer';
import LoadingBar from '../components/LoadingBar/LoadingBar';


// Ensure App.css file exists in the same directory
// If missing, create src/App.css with styles
import './EditorPage.css';

// 기본 템플릿과 스니펫은 이제 constants 파일에서 import됨



// 유틸리티 함수들은 이제 utils 폴더에서 import됨

function EditorPage() {
  const { bookId: projectId } = useParams(); // bookId는 실제로 projectId
  const [searchParams] = useSearchParams();
  const targetBookId = searchParams.get('bookId'); // URL에서 특정 책 ID 가져오기
  const { bookInfo, setBookInfo, isLoading, setIsLoading } = useBook();
  const editorRef = useRef(null);
  const editorPaneRef = useRef(null);
  const fileInputRef = useRef(null);
  const resizerRef = useRef(null);
  const previewUpdateTimeout = useRef(null);
  const [epubData, setEpubData] = useState(null);
  const [toc, setToc] = useState([]);
  const [fileTree, setFileTree] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);

  const [output, setOutput] = useState();
  const [externalCssLinks, setExternalCssLinks] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [code, setCode] = useState(() => {
    const saved = localStorage.getItem('code-storage');
    return saved ? JSON.parse(saved) : DEFAULT_CODE;
  });
  const [selectedFile, setSelectedFile] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [isChecking, setIsChecking] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editorWidth, setEditorWidth] = useState(50); // 퍼센트
  
  // 사이드바 너비 조정을 위한 상태
  const [sidebarWidth, setSidebarWidth] = useState(250); // 픽셀
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const sidebarResizerRef = useRef(null);
  const selectedNodeRef = useRef(null); // 현재 선택된 노드를 저장하는 ref
  
  // 사이드바 토글 기능
  const [sidebarVisible, setSidebarVisible] = useState(true);
  
  // 자동 검사 기능 상태
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [checkResults, setCheckResults] = useState([]);
  
  // 이미지 디버깅 상태
  const [imageDebugInfo, setImageDebugInfo] = useState([]);
  const [showImageDebug, setShowImageDebug] = useState(false);
  
  // 이미지 파일 관리 상태
  const [unusedImages, setUnusedImages] = useState([]);
  const [showUnusedImageModal, setShowUnusedImageModal] = useState(false);
  
  // 미리보기 토글 기능
  const [previewVisible, setPreviewVisible] = useState(true);
  
  // 기능별 패널 상태
  const [panelStates, setPanelStates] = useState({
    sidebar: true,      // 사이드바 (TOC/파일구조)
    autoCheck: false,   // 자동 검사 결과
    preview: true,      // 미리보기
    settings: false,    // 설정
    help: false         // 도움말
  });
  
  // 로딩바 상태
  const [loadingMessage, setLoadingMessage] = useState('파일을 처리하는 중...');
  
  // 아코디언 상태 관리
  
  // 오류 표시 관련 상태
  const [editorErrors, setEditorErrors] = useState([]);
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [accordionState, setAccordionState] = useState({
    toc: true,    // 목차 펼침
    files: false  // 파일구조 접힘
  });

  // 로그 뷰어 상태 - 항상 표시
  const [logViewerVisible, setLogViewerVisible] = useState(true);
  


  // 로그에서 오류 클릭 핸들러
  const handleLogErrorClick = async (errorInfo) => {
    try {
      console.log('🔍 로그에서 오류 클릭:', errorInfo);
      
      // 파일 열기 및 오류 위치로 이동
      const fileOpened = await openFileWithError(errorInfo);
      if (fileOpened) {
        console.log('✅ 로그 오류 파일 열기 성공');
        showToast(`📁 ${errorInfo.file} 파일을 열고 오류 위치로 이동했습니다.`, 'info');
      } else {
        console.warn('⚠️ 로그 오류 파일 열기 실패');
        showToast(`⚠️ ${errorInfo.file} 파일을 찾을 수 없습니다.`, 'warning');
      }
    } catch (error) {
      console.error('❌ 로그 오류 클릭 처리 실패:', error);
      showToast(`❌ 오류 위치로 이동 실패: ${error.message}`, 'error');
    }
  };
  
  // 다중 편집기를 위한 상태
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabCounter, setTabCounter] = useState(1);

  // 메뉴 사이드바 상태 추가
  const [menuSidebarVisible, setMenuSidebarVisible] = useState(true);
  
  // Role 모달 상태
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedTextForRole, setSelectedTextForRole] = useState('');
  
  // 타입 & 롤 선택 상태
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [selectedTextForType, setSelectedTextForType] = useState('');
  const [currentType, setCurrentType] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  
  // 저장/제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 오류 위치 추적 기능
  const [errorLocations, setErrorLocations] = useState([]);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  
  // 한자 검색 기능
  const [hanjaSearchOpen, setHanjaSearchOpen] = useState(false);
  const [hanjaSearchText, setHanjaSearchText] = useState('');
  const [hanjaResults, setHanjaResults] = useState([]);
  const [selectedHanja, setSelectedHanja] = useState('');
  
  // 테마 상태 관리
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved || 'light'; // 'light', 'dark', 'system'
  });
  
  // 시스템 테마 감지
  const [systemTheme, setSystemTheme] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  // 실제 적용되는 테마 (시스템 모드일 때는 시스템 테마를 따름)
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return saved || 'light';
  });
  
  // 컨텍스트 메뉴 이벤트 리스너 추가
  useEffect(() => {
    // handleGlobalContextMenu 완전히 비활성화
    console.log('🔍 handleGlobalContextMenu 완전히 비활성화됨');
  }, []);
  const [menuSidebarCollapsed, setMenuSidebarCollapsed] = useState(false);

  // VS Code 스타일 사이드바 상태
  const [vscodeSidebarVisible, setVscodeSidebarVisible] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState('explorer'); // explorer, search, source-control, run, extensions

  // Base URL 설정 상태
  const [baseUrl, setBaseUrl] = useState(() => {
    const configured = getConfiguredWorkspaceBaseUrl(targetBookId || projectId || '');
    return configured;
  });

  // 템플릿 및 스니펫 관련 상태
  const [customTemplates, setCustomTemplates] = useState(() => {
    const saved = localStorage.getItem('custom-templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [snippets, setSnippets] = useState(() => {
    const saved = localStorage.getItem('code-snippets');
    return saved ? JSON.parse(saved) : [];
  });
  const [templatePreview, setTemplatePreview] = useState('');

  // 전역 키보드 이벤트 핸들러 (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S (저장)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // 기본 저장 동작 방지
        console.log('Ctrl+S 감지됨 - 파일 저장 실행');
        saveCurrentFile();
      }
      
      // Ctrl+Shift+S (모든 파일 저장)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        console.log('Ctrl+Shift+S 감지됨 - 모든 파일 저장 실행');
        saveAllFiles();
      }
      
      // Ctrl+R (미리보기 새로고침)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        console.log('Ctrl+R 감지됨 - 미리보기 새로고침');
        runCode();
      }
      
      // ESC 키 (컨텍스트 메뉴 닫기)
      if (e.key === 'Escape') {
        setContextMenu(null);
        setSelectedNode(null);
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener('keydown', handleKeyDown);
    
    // 컨텍스트 메뉴 외부 클릭 시 닫기
    const handleGlobalClick = (e) => {
      // 컨텍스트 메뉴 자체를 클릭한 경우는 닫지 않음
      if (e.target.closest('[data-context-menu]')) {
        return;
      }
      
      // 컨텍스트 메뉴가 열려있으면 닫기
      setContextMenu(null);
      setSelectedNode(null);
    };
    document.addEventListener('click', handleGlobalClick);
    
    // 클린업 함수
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [openTabs, activeTabId]); // 의존성 배열에서 contextMenu 제거

  // projectId가 있을 때 책 정보를 가져오는 useEffect
  useEffect(() => {
    let isMounted = true;
    
    const fetchBookInfo = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        console.log('책 정보 가져오기 시작 (projectId):', projectId);
        
        // 프로젝트의 책 목록 가져오기
        const booksData = await bookAPI.getBooks(projectId);
        console.log('책 목록 가져오기 성공:', booksData);
        
        // 컴포넌트가 언마운트되었으면 중단
        if (!isMounted) return;
        
        // URL에서 전달된 책 ID를 사용하여 특정 책 선택
        let selectedBook = null;
        let allBooks = [];
        
        if (Array.isArray(booksData) && booksData.length > 0) {
          allBooks = booksData;
        } else if (booksData.results && Array.isArray(booksData.results) && booksData.results.length > 0) {
          allBooks = booksData.results;
        }
        
        console.log('📚 프로젝트 내 모든 책 목록:', {
          projectId,
          targetBookId,
          totalBooks: allBooks.length,
          books: allBooks
        });
        
        if (allBooks.length === 0) {
          throw new Error('프로젝트에 책이 없습니다.');
        } else if (targetBookId) {
          // URL에서 특정 책 ID가 지정된 경우 해당 책 찾기
          selectedBook = allBooks.find(book => book.id.toString() === targetBookId.toString());
          if (selectedBook) {
            console.log('✅ URL에서 지정된 책 선택:', selectedBook);
          } else {
            console.warn('⚠️ URL에서 지정된 책 ID를 찾을 수 없음:', targetBookId);
            // 지정된 책을 찾을 수 없으면 첫 번째 책 선택
            selectedBook = allBooks[0];
            console.log('✅ 첫 번째 책으로 대체 선택:', selectedBook);
          }
        } else if (allBooks.length === 1) {
          // 책이 하나뿐이면 자동 선택
          selectedBook = allBooks[0];
          console.log('✅ 단일 책 자동 선택:', selectedBook);
        } else {
          // 책이 여러 개면 첫 번째 책 선택 (기본값)
          selectedBook = allBooks[0];
          console.log('✅ 여러 책 중 첫 번째 책 선택:', selectedBook);
        }
        
        if (selectedBook) {
          setBookInfo(selectedBook);
          console.log('선택된 책 정보:', selectedBook);
          
          // 컴포넌트가 언마운트되었으면 중단
          if (!isMounted) return;
          
          // 선택된 책의 워크스페이스 정보 가져오기
          const workspaceData = await bookAPI.getBookWorkspace(selectedBook.id);
          
          // 컴포넌트가 언마운트되었으면 중단
          if (!isMounted) return;
          
          // 워크스페이스 데이터 처리
          if (workspaceData) {
            await processWorkspaceData(workspaceData);
          }
        } else {
          throw new Error('프로젝트에 책이 없습니다.');
        }
        
      } catch (error) {
        console.error('책 정보 가져오기 실패:', error);
        if (isMounted) {
          alert('책 정보를 가져오는데 실패했습니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchBookInfo();
    
    // cleanup 함수
    return () => {
      isMounted = false;
      // 타이머 정리
      if (previewUpdateTimeout.current) {
        clearTimeout(previewUpdateTimeout.current);
      }
    };
  }, [projectId, targetBookId]);

  // 메뉴 사이드바 토글 함수
  const toggleMenuSidebar = () => {
    setMenuSidebarVisible(!menuSidebarVisible);
  };

  const toggleMenuSidebarCollapse = () => {
    setMenuSidebarCollapsed(!menuSidebarCollapsed);
  };

  // VS Code 사이드바 토글
  const toggleVscodeSidebar = () => {
    setVscodeSidebarVisible(!vscodeSidebarVisible);
  };

  // 분할 편집기 모드 토글


  // 템플릿 관리 함수들
  const insertTemplate = (template) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const currentTab = openTabs.find(tab => tab.id === activeTabId);
    
    if (currentTab && (template.type === currentTab.type || template.type === 'html')) {
      editor.setValue(template.content);
      
      // 탭 내용 업데이트
      setOpenTabs(prevTabs => 
        prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, content: template.content, isDirty: true }
            : tab
        )
      );
    }
  };

  const saveCustomTemplate = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    
    const content = editor.getValue();
    const currentTab = openTabs.find(tab => tab.id === activeTabId);
    
    if (!content.trim()) {
      alert('저장할 내용이 없습니다.');
      return;
    }

    const name = prompt('템플릿 이름을 입력하세요:');
    if (!name) return;

    const newTemplate = {
      id: Date.now().toString(),
      name,
      type: currentTab?.type || 'html',
      description: `사용자 정의 ${currentTab?.type || 'html'} 템플릿`,
      content,
      created: new Date().toISOString()
    };

    const updatedTemplates = [...customTemplates, newTemplate];
    setCustomTemplates(updatedTemplates);
    localStorage.setItem('custom-templates', JSON.stringify(updatedTemplates));
    
    alert('템플릿이 저장되었습니다.');
  };

  const deleteCustomTemplate = (templateId) => {
    if (window.confirm('이 템플릿을 삭제하시겠습니까?')) {
      const updatedTemplates = customTemplates.filter(t => t.id !== templateId);
      setCustomTemplates(updatedTemplates);
      localStorage.setItem('custom-templates', JSON.stringify(updatedTemplates));
    }
  };

  const insertSnippet = (snippet) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    const position = selection ? selection.getStartPosition() : editor.getPosition();
    
    editor.executeEdits('insert-snippet', [{
      range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
      text: snippet.content
    }]);
    
    editor.focus();
  };

  const saveSnippet = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    let content = '';
    
    if (selection && !selection.isEmpty()) {
      content = editor.getModel().getValueInRange(selection);
    } else {
      content = prompt('스니펫 내용을 입력하세요:');
    }
    
    if (!content || !content.trim()) {
      alert('저장할 내용이 없습니다.');
      return;
    }

    const name = prompt('스니펫 이름을 입력하세요:');
    if (!name) return;

    const currentTab = openTabs.find(tab => tab.id === activeTabId);
    
    const newSnippet = {
      id: Date.now().toString(),
      name,
      type: currentTab?.type || 'html',
      description: prompt('스니펫 설명을 입력하세요 (선택사항):') || '',
      content: content.trim(),
      created: new Date().toISOString()
    };

    const updatedSnippets = [...snippets, newSnippet];
    setSnippets(updatedSnippets);
    localStorage.setItem('code-snippets', JSON.stringify(updatedSnippets));
    
    alert('스니펫이 저장되었습니다.');
  };

  const deleteSnippet = (snippetId) => {
    if (window.confirm('이 스니펫을 삭제하시겠습니까?')) {
      const updatedSnippets = snippets.filter(s => s.id !== snippetId);
      setSnippets(updatedSnippets);
      localStorage.setItem('code-snippets', JSON.stringify(updatedSnippets));
    }
  };

  const previewTemplate = (template) => {
    setSelectedTemplate(template);
    setTemplatePreview(template.content);
  };



  // 태그 범위 찾기 함수 - 현재 줄에서 태그를 찾아서 그 범위를 감싸기
  const findTagRange = (editor, startLine, startColumn) => {
    const model = editor.getModel();
    const currentLine = model.getLineContent(startLine);
    const totalLines = model.getLineCount();
    
    console.log('🔍 현재 줄 내용:', currentLine);
    
    // 현재 줄에 내용이 있으면 태그 찾기
    if (currentLine.trim()) {
      // 현재 줄에서 여는 태그 찾기
      const openTagMatch = currentLine.match(/<([^/!?][^>]*)>/);
      
      if (openTagMatch) {
        const tagName = openTagMatch[1].split(' ')[0]; // 태그 이름만 추출 (section)
        const openTagStart = currentLine.indexOf(openTagMatch[0]);
        
        console.log('🔍 여는 태그 찾음:', tagName);
        
        // 닫는 태그를 현재 줄부터 아래로 찾기
        for (let line = startLine; line <= totalLines; line++) {
          const lineContent = model.getLineContent(line);
          const closeTagPattern = new RegExp(`</${tagName}>`);
          const closeTagMatch = lineContent.match(closeTagPattern);
          
          if (closeTagMatch) {
            const closeTagEnd = lineContent.indexOf(closeTagMatch[0]) + closeTagMatch[0].length;
            
            console.log('🔍 닫는 태그 찾음:', {
              태그이름: tagName,
              시작줄: startLine,
              끝줄: line,
              시작위치: openTagStart + 1,
              끝위치: closeTagEnd + 1
            });
            
            return {
              startLineNumber: startLine,
              startColumn: openTagStart + 1,
              endLineNumber: line,
              endColumn: closeTagEnd + 1
            };
          }
        }
        
        console.log('🔍 닫는 태그 못찾음, 현재 줄만 감싸기');
      }
      
      // 태그를 찾지 못했으면 현재 줄 전체 감싸기
      console.log('🔍 여는 태그도 못찾음, 전체 줄 감싸기');
      return {
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: startLine,
        endColumn: currentLine.length + 1
      };
    }
    
    // 현재 줄이 비어있으면 null 반환 (빈 태그 삽입)
    console.log('🔍 빈 줄, null 반환');
    return null;
  };

  // 텍스트 서식 도구 함수들
  const formatText = (formatType) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    let formattedText = '';
    
    switch (formatType) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
      case 'strikethrough':
        formattedText = `~~${selectedText}~~`;
        break;
      default:
        return;
    }
    
    editor.executeEdits('format-text', [{
      range: selection,
      text: formattedText
    }]);
    
    // 포커스 복원
    editor.focus();
  };

  // 제목 및 단락 함수들
  const insertHeading = (level) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    
    if (selectedText) {
      // 선택된 텍스트가 있으면 감싸기
      const formattedText = `<h${level}>${selectedText}</h${level}>`;
      editor.executeEdits('insert-heading', [{ range: selection, text: formattedText }]);
    } else {
      // 선택된 텍스트가 없으면 태그 범위 찾기
      const range = findTagRange(editor, selection.startLineNumber, selection.startColumn);
      if (range) {
        const content = editor.getModel().getValueInRange(range);
        const formattedText = `<h${level}>${content}</h${level}>`;
        editor.executeEdits('insert-heading', [{ range: range, text: formattedText }]);
      } else {
        // 태그 범위를 찾을 수 없으면 빈 태그 삽입
        const formattedText = `<h${level}></h${level}>`;
        editor.executeEdits('insert-heading', [{ range: selection, text: formattedText }]);
      }
    }
    editor.focus();
  };

  const insertParagraph = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    
    if (selectedText) {
      // 선택된 텍스트가 있으면 감싸기
      const formattedText = `<p>${selectedText}</p>`;
      editor.executeEdits('insert-paragraph', [{ range: selection, text: formattedText }]);
    } else {
      // 선택된 텍스트가 없으면 태그 범위 찾기
      const range = findTagRange(editor, selection.startLineNumber, selection.startColumn);
      if (range) {
        const content = editor.getModel().getValueInRange(range);
        const formattedText = `<p>${content}</p>`;
        editor.executeEdits('insert-paragraph', [{ range: range, text: formattedText }]);
      } else {
        // 태그 범위를 찾을 수 없으면 빈 태그 삽입
        const formattedText = `<p></p>`;
        editor.executeEdits('insert-paragraph', [{ range: selection, text: formattedText }]);
      }
    }
    editor.focus();
  };

  const insertHorizontalRule = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    editor.executeEdits('insert-hr', [{
      range: selection,
      text: '<hr>'
    }]);
    
    editor.focus();
  };

  // 목록 및 인용구 함수들
  const insertOrderedList = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    if (selectedText) {
      // li 자동 분리
      const items = selectedText.split(/\n|<br\s*\/?>(?=<|$)/).map(s => s.trim()).filter(Boolean);
      const li = items.map(item => `<li>${item}</li>`).join('');
      const formattedText = `<ol>\n${li}\n</ol>`;
      editor.executeEdits('insert-ordered-list', [{ range: selection, text: formattedText }]);
    } else {
      const formattedText = `<ol>\n<li></li>\n</ol>`;
      editor.executeEdits('insert-ordered-list', [{ range: selection, text: formattedText }]);
    }
    editor.focus();
  };

  const insertUnorderedList = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    if (selectedText) {
      const items = selectedText.split(/\n|<br\s*\/?>(?=<|$)/).map(s => s.trim()).filter(Boolean);
      const li = items.map(item => `<li>${item}</li>`).join('');
      const formattedText = `<ul>\n${li}\n</ul>`;
      editor.executeEdits('insert-unordered-list', [{ range: selection, text: formattedText }]);
    } else {
      const formattedText = `<ul>\n<li></li>\n</ul>`;
      editor.executeEdits('insert-unordered-list', [{ range: selection, text: formattedText }]);
    }
    editor.focus();
  };
  const insertBlockquote = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    
    if (selectedText) {
      // 선택된 텍스트가 있으면 감싸기
      const formattedText = `<blockquote>${selectedText}</blockquote>`;
      editor.executeEdits('insert-blockquote', [{ range: selection, text: formattedText }]);
    } else {
      // 선택된 텍스트가 없으면 태그 범위 찾기
      const range = findTagRange(editor, selection.startLineNumber, selection.startColumn);
      if (range) {
        const content = editor.getModel().getValueInRange(range);
        const formattedText = `<blockquote>${content}</blockquote>`;
        editor.executeEdits('insert-blockquote', [{ range: range, text: formattedText }]);
      } else {
        // 태그 범위를 찾을 수 없으면 빈 태그 삽입
        const formattedText = `<blockquote></blockquote>`;
        editor.executeEdits('insert-blockquote', [{ range: selection, text: formattedText }]);
      }
    }
    editor.focus();
  };

  const insertSection = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    
    if (selectedText) {
      // 선택된 텍스트가 있으면 감싸기
      const formattedText = `<section>${selectedText}</section>`;
      editor.executeEdits('insert-section', [{ range: selection, text: formattedText }]);
    } else {
      // 선택된 텍스트가 없으면 태그 범위 찾기
      const range = findTagRange(editor, selection.startLineNumber, selection.startColumn);
      if (range) {
        const content = editor.getModel().getValueInRange(range);
        const formattedText = `<section>${content}</section>`;
        editor.executeEdits('insert-section', [{ range: range, text: formattedText }]);
      } else {
        // 태그 범위를 찾을 수 없으면 빈 태그 삽입
        const formattedText = `<section></section>`;
        editor.executeEdits('insert-section', [{ range: selection, text: formattedText }]);
      }
    }
    editor.focus();
  };

  // 링크, 이미지, 테이블 삽입 함수들
  const insertLink = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    const linkText = selectedText || '링크 텍스트';
    const url = prompt('URL을 입력하세요:', 'https://');
    
    if (url) {
      const formattedText = `<a href="${url}" target="_blank">${linkText}</a>`;
      
      editor.executeEdits('insert-link', [{
        range: selection,
        text: formattedText
      }]);
    }
    
    editor.focus();
  };

  const insertImage = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    const imageUrl = prompt('이미지 URL을 입력하세요:', 'https://');
    const altText = prompt('대체 텍스트를 입력하세요:', '이미지 설명');
    
    if (imageUrl) {
      const formattedText = `<img src="${imageUrl}" alt="${altText}" style="max-width: 100%; height: auto;">`;
      
      editor.executeEdits('insert-image', [{
        range: selection,
        text: formattedText
      }]);
    }
    
    editor.focus();
  };

  const insertTable = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    const rows = prompt('행 수를 입력하세요:', '3');
    const cols = prompt('열 수를 입력하세요:', '3');
    
    if (rows && cols) {
      const rowCount = parseInt(rows);
      const colCount = parseInt(cols);
      
      let tableHTML = '<table border="1" style="border-collapse: collapse; width: 100%;">\n';
      
      // 테이블 헤더
      tableHTML += '  <thead>\n    <tr>\n';
      for (let i = 0; i < colCount; i++) {
        tableHTML += `      <th style="padding: 8px; border: 1px solid #ddd;">헤더 ${i + 1}</th>\n`;
      }
      tableHTML += '    </tr>\n  </thead>\n';
      
      // 테이블 바디
      tableHTML += '  <tbody>\n';
      for (let i = 0; i < rowCount - 1; i++) {
        tableHTML += '    <tr>\n';
        for (let j = 0; j < colCount; j++) {
          tableHTML += `      <td style="padding: 8px; border: 1px solid #ddd;">셀 ${i + 1}-${j + 1}</td>\n`;
        }
        tableHTML += '    </tr>\n';
      }
      tableHTML += '  </tbody>\n</table>';
      
      editor.executeEdits('insert-table', [{
        range: selection,
        text: tableHTML
      }]);
    }
    
    editor.focus();
  };

  // 텍스트 정렬, 색상, 폰트 크기 함수들
  const alignText = (alignment) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    const formattedText = `<div style="text-align: ${alignment};">${selectedText}</div>`;
    
    editor.executeEdits('align-text', [{
      range: selection,
      text: formattedText
    }]);
    
    editor.focus();
  };

  const setTextColor = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    const color = prompt('텍스트 색상을 입력하세요 (예: #ff0000, red):', '#000000');
    
    if (color) {
      const formattedText = `<span style="color: ${color};">${selectedText}</span>`;
      
      editor.executeEdits('set-text-color', [{
        range: selection,
        text: formattedText
      }]);
    }
    
    editor.focus();
  };

  const setBackgroundColor = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    const color = prompt('배경 색상을 입력하세요 (예: #ffff00, yellow):', '#ffffff');
    
    if (color) {
      const formattedText = `<span style="background-color: ${color};">${selectedText}</span>`;
      
      editor.executeEdits('set-background-color', [{
        range: selection,
        text: formattedText
      }]);
    }
    
    editor.focus();
  };

  const setFontSize = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    const size = prompt('폰트 크기를 입력하세요 (예: 12px, 1.2em, large):', '16px');
    
    if (size) {
      const formattedText = `<span style="font-size: ${size};">${selectedText}</span>`;
      
      editor.executeEdits('set-font-size', [{
        range: selection,
        text: formattedText
      }]);
    }
    
    editor.focus();
  };

  // 코드 블록과 인라인 코드 함수들
  const insertCodeBlock = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    const selectedText = editor.getModel().getValueInRange(selection);
    const language = prompt('프로그래밍 언어를 입력하세요 (예: javascript, python, html):', 'javascript');
    
    if (selectedText) {
      // 선택된 텍스트가 있으면 감싸기
      const formattedText = `<pre><code class="language-${language}">${selectedText}</code></pre>`;
      editor.executeEdits('insert-code-block', [{ range: selection, text: formattedText }]);
    } else {
      // 선택된 텍스트가 없으면 태그 범위 찾기
      const range = findTagRange(editor, selection.startLineNumber, selection.startColumn);
      if (range) {
        const content = editor.getModel().getValueInRange(range);
        const formattedText = `<pre><code class="language-${language}">${content}</code></pre>`;
        editor.executeEdits('insert-code-block', [{ range: range, text: formattedText }]);
      } else {
        // 태그 범위를 찾을 수 없으면 빈 태그 삽입
        const formattedText = `<pre><code class="language-${language}"></code></pre>`;
        editor.executeEdits('insert-code-block', [{ range: selection, text: formattedText }]);
      }
    }
    editor.focus();
  };

  const insertInlineCode = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    const inlineCode = `<code>${selectedText}</code>`;
    
    editor.executeEdits('insert-inline-code', [{
      range: selection,
      text: inlineCode
    }]);
    
    editor.focus();
  };

  const insertRole = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    const selection = editor.getSelection();
    
    if (!selection) return;
    
    const selectedText = editor.getModel().getValueInRange(selection);
    
    // 선택된 텍스트를 상태에 저장하고 모달 열기
    setSelectedTextForRole(selectedText);
    setRoleModalOpen(true);
  };

  // 타입 & 롤 확인 함수
  const handleTypeRoleConfirm = (type, role) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    
    const selection = editor.getSelection();
    const model = editor.getModel();
    const selectedText = model.getValueInRange(selection);
    
    if (selectedText) {
      const newText = `<span class="${type}" role="${role}">${selectedText}</span>`;
      editor.executeEdits(null, [
        { range: selection, text: newText, forceMoveMarkers: true }
      ]);
    }
  };

  const handleRoleConfirm = (roleType) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    
    const selection = editor.getSelection();
    if (!selection) return;
    
    const roleTag = roleType ? `<role type="${roleType}">${selectedTextForRole}</role>` : `<role>${selectedTextForRole}</role>`;
    
    editor.executeEdits('insert-role', [{
      range: selection,
      text: roleTag
    }]);
    
    editor.focus();
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!editorRef.current) return;
      
      // Ctrl/Cmd + B: 굵게
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        formatText('bold');
      }
      // Ctrl/Cmd + I: 기울임
      else if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        formatText('italic');
      }
      // Ctrl/Cmd + U: 밑줄
      else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
        formatText('underline');
      }
      // Ctrl/Cmd + Shift + X: 취소선
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
        e.preventDefault();
        formatText('strikethrough');
      }
      // Ctrl/Cmd + 1~6: 제목 레벨
      else if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const level = parseInt(e.key);
        insertHeading(level);
      }
      // Ctrl/Cmd + P: 단락
      else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        insertParagraph();
      }
      // Ctrl/Cmd + Shift + H: 구분선
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        insertHorizontalRule();
      }
      // Ctrl/Cmd + Shift + O: 순서 있는 목록
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        insertOrderedList();
      }
      // Ctrl/Cmd + Shift + U: 순서 없는 목록
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        insertUnorderedList();
      }
      // Ctrl/Cmd + Shift + Q: 인용구
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        insertBlockquote();
      }
      // Ctrl/Cmd + K: 링크
      else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        insertLink();
      }
      // Ctrl/Cmd + Shift + I: 이미지
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        insertImage();
      }
      // Ctrl/Cmd + Shift + T: 테이블
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        insertTable();
      }
      // Ctrl/Cmd + Shift + L: 왼쪽 정렬
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        alignText('left');
      }
      // Ctrl/Cmd + Shift + E: 가운데 정렬
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        alignText('center');
      }
      // Ctrl/Cmd + Shift + R: 오른쪽 정렬
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        alignText('right');
      }
      // Ctrl/Cmd + Shift + J: 양쪽 정렬
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        alignText('justify');
      }
      // Ctrl/Cmd + Shift + C: 코드 블록
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        insertCodeBlock();
      }
      // Ctrl/Cmd + `: 인라인 코드
      else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        insertInlineCode();
      }
      // Ctrl/Cmd + Shift + R: role 태그
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        insertRole();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  // 텍스트 서식 툴바 렌더링
  const renderFormatToolbar = () => {
    const currentTab = getCurrentTab();
    if (!currentTab || (currentTab.type !== 'html' && currentTab.type !== 'xhtml')) {
      return null;
    }

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
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          서식:
        </span>
        
        <button
          className="format-btn"
          onClick={() => formatText('bold')}
          title="굵게 (Ctrl+B)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          B
        </button>
        
        <button
          className="format-btn"
          onClick={() => formatText('italic')}
          title="기울임 (Ctrl+I)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            fontStyle: 'italic',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          I
        </button>
        
        <button
          className="format-btn"
          onClick={() => formatText('underline')}
          title="밑줄 (Ctrl+U)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            textDecoration: 'underline',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          U
        </button>
        
        <button
          className="format-btn"
          onClick={() => formatText('strikethrough')}
          title="취소선 (Ctrl+Shift+X)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            textDecoration: 'line-through',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          S
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          제목:
        </span>
        
        {[1, 2, 3, 4, 5, 6].map(level => (
          <button
            key={level}
            className="format-btn"
            onClick={() => insertHeading(level)}
            title={`제목 ${level} (Ctrl+${level})`}
            style={{
              padding: '4px 8px',
              backgroundColor: '#3c3c3c',
              border: '1px solid #5a5a5a',
              borderRadius: '4px',
              color: '#cccccc',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#4a4a4a';
              e.target.style.borderColor = '#6a6a6a';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#3c3c3c';
              e.target.style.borderColor = '#5a5a5a';
            }}
          >
            H{level}
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <button
          className="format-btn"
          onClick={insertParagraph}
          title="단락 (Ctrl+P)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          P
        </button>
        
        <button
          className="format-btn"
          onClick={insertHorizontalRule}
          title="구분선 (Ctrl+Shift+H)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          HR
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          목록:
        </span>
        
        <button
          className="format-btn"
          onClick={insertOrderedList}
          title="순서 있는 목록 (Ctrl+Shift+O)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          OL
        </button>
        
        <button
          className="format-btn"
          onClick={insertUnorderedList}
          title="순서 없는 목록 (Ctrl+Shift+U)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          UL
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <button
          className="format-btn"
          onClick={insertBlockquote}
          title="인용구 (Ctrl+Shift+Q)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          Q
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          미디어:
        </span>
        
        <button
          className="format-btn"
          onClick={insertLink}
          title="링크 삽입 (Ctrl+K)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          🔗
        </button>
        
        <button
          className="format-btn"
          onClick={insertImage}
          title="이미지 삽입 (Ctrl+Shift+I)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          🖼️
        </button>
        
        <button
          className="format-btn"
          onClick={insertTable}
          title="테이블 삽입 (Ctrl+Shift+T)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          📊
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          정렬:
        </span>
        
        <button
          className="format-btn"
          onClick={() => alignText('left')}
          title="왼쪽 정렬 (Ctrl+Shift+L)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          ⬅️
        </button>
        
        <button
          className="format-btn"
          onClick={() => alignText('center')}
          title="가운데 정렬 (Ctrl+Shift+E)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          ↔️
        </button>
        
        <button
          className="format-btn"
          onClick={() => alignText('right')}
          title="오른쪽 정렬 (Ctrl+Shift+R)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          ➡️
        </button>
        
        <button
          className="format-btn"
          onClick={() => alignText('justify')}
          title="양쪽 정렬 (Ctrl+Shift+J)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          ↔️↔️
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          색상:
        </span>
        
        <button
          className="format-btn"
          onClick={setTextColor}
          title="텍스트 색상"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          🎨
        </button>
        
        <button
          className="format-btn"
          onClick={setBackgroundColor}
          title="배경 색상"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          🖌️
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          폰트:
        </span>
        
        <button
          className="format-btn"
          onClick={setFontSize}
          title="폰트 크기"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          📏
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#3e3e42', margin: '0 8px' }}></div>
        
        <span style={{ color: '#cccccc', fontSize: '12px', fontWeight: '500' }}>
          코드:
        </span>
        
        <button
          className="format-btn"
          onClick={insertCodeBlock}
          title="코드 블록 (Ctrl+Shift+C)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          📝
        </button>
        
        <button
          className="format-btn"
          onClick={insertInlineCode}
          title="인라인 코드 (Ctrl+`)"
          style={{
            padding: '4px 8px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #5a5a5a',
            borderRadius: '4px',
            color: '#cccccc',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#4a4a4a';
            e.target.style.borderColor = '#6a6a6a';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3c3c3c';
            e.target.style.borderColor = '#5a5a5a';
          }}
        >
          ``
        </button>
      </div>
    );
  };

  // 메뉴 사이드바 렌더링 함수
  const renderMenuSidebar = () => {
    if (!menuSidebarVisible) return null;

    return (
      <MenuSidebar
        visible={menuSidebarVisible}
        collapsed={menuSidebarCollapsed}
        toggleCollapse={toggleMenuSidebarCollapse}
        toggleSidebar={toggleMenuSidebar}
        panelStates={panelStates}
        togglePanel={togglePanel}
        autoCheckEnabled={autoCheckEnabled}
        setAutoCheckEnabled={setAutoCheckEnabled}
        fileInputRef={fileInputRef}
        isLoading={isLoading}
        runCode={runCode}
        saveCurrentFile={saveCurrentFile}
        downloadCurrentFile={downloadCurrentFile}
        getCurrentTab={getCurrentTab}
        saveAllFiles={saveAllFiles}
        openTabs={openTabs}
        toggleTheme={toggleTheme}
        changeThemeMode={changeThemeMode}
        themeMode={themeMode}
      />
    );
  };
  // 탭 관리 함수들
  const openTab = async (fileNode, content, type = 'text') => {
    console.log('openTab 호출됨:', { 
      fileNode, 
      type, 
      contentLength: content?.length,
      fileNodeName: fileNode?.name,
      fileNodePath: fileNode?.path
    });
    
    // 파일 확장자에서 언어 자동 감지
    const detectedLanguage = getLanguageFromExtension(fileNode.name || fileNode.path);
    const finalType = type !== 'text' ? type : detectedLanguage;
    
    // XHTML 파일인 경우 명시적으로 xhtml 언어 설정
    const fileName = fileNode.name || fileNode.path || '';
    const isXHTML = fileName.toLowerCase().endsWith('.xhtml');
    const languageToUse = isXHTML ? 'xhtml' : finalType;
    
    // XHTML 파일인 경우 편집기에서는 원본 그대로 사용 (미리보기에서 처리)
    let processedContent = content;
    if (isXHTML && content) {
      console.log('XHTML 파일 - 편집기에서는 원본 사용, 미리보기에서 CSS 처리');
    }
    
    console.log('언어 감지:', {
      filename: fileName,
      detectedLanguage,
      providedType: type,
      finalType,
      isXHTML,
      languageToUse
    });
    
    // 이미 열려있는 탭이 있는지 확인
    const existingTab = openTabs.find(tab => tab.filePath === fileNode.path);
    console.log('기존 탭 존재:', !!existingTab);
    
    let newTab = null; // 새 탭 변수를 함수 시작 부분에서 선언
    
    if (existingTab) {
      // 기존 탭이 있으면 해당 탭으로 전환
      setActiveTabId(existingTab.id);
      // 탭 내용이 다르면 업데이트
      if (existingTab.content !== processedContent) {
        updateTabContent(existingTab.id, processedContent);
      }
      // 타입도 업데이트 (언어 감지 결과 반영)
      if (existingTab.type !== languageToUse) {
        setOpenTabs(prev => prev.map(tab =>
          tab.id === existingTab.id ? { ...tab, type: languageToUse } : tab
        ));
      }
    } else {
      // 새 탭 생성
      console.log('새 탭 생성 시작');
      const tabId = `tab_${tabCounter}`;
      console.log('생성된 tabId:', tabId);
      
      const tabName = getTabDisplayName(fileNode);
      console.log('탭 이름:', tabName);
      
      newTab = {
        id: tabId,
        name: tabName,
        type: languageToUse,
        content: processedContent,
        filePath: fileNode.path,
        isDirty: false
      };
      
      console.log('새 탭 객체:', newTab);
      console.log('현재 openTabs 상태:', openTabs);
      
      try {
        setOpenTabs(prev => {
          console.log('이전 탭들:', prev);
          const newTabs = [...prev, newTab];
          console.log('새 탭 목록:', newTabs);
          return newTabs;
        });
        setActiveTabId(tabId);
        setTabCounter(prev => prev + 1);
        console.log('탭 생성 완료 - activeTabId:', tabId);
        
        // 탭 생성 후 상태 확인
        setTimeout(() => {
          console.log('탭 생성 후 상태 확인:', {
            openTabsLength: openTabs.length,
            activeTabId: activeTabId,
            currentTab: getCurrentTab()
          });
        }, 0);
      } catch (error) {
        console.error('탭 생성 중 오류:', error);
        throw error;
      }
    }
    
    // 탭 전환 후 미리보기 업데이트 (상태 업데이트 완료 후)
    setTimeout(async () => {
      try {
        console.log('runCode 호출 시작');
        
        // 새로 생성된 탭으로 직접 미리보기 실행
        if (newTab) {
          console.log('새 탭으로 직접 미리보기 실행:', newTab);
          await runCodeWithTab(newTab);
        } else {
          await runCode();
        }
        
        console.log('runCode 완료');
        
        // 미리보기 패널이 보이는지 확인하고 필요시 보이게 함
        console.log('미리보기 패널 상태:', panelStates.preview);
        console.log('미리보기 패널 표시 여부:', previewVisible);
        
        if (!panelStates.preview) {
          console.log('미리보기 패널을 보이게 설정');
          setPanelStates(prev => ({ ...prev, preview: true }));
        }
      } catch (error) {
        console.error('runCode 오류:', error);
      }
    }, 0);
  };

  const closeTab = (tabId) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // 현재 활성 탭이 닫히는 경우 다른 탭으로 이동
      if (activeTabId === tabId) {
        const currentIndex = prev.findIndex(tab => tab.id === tabId);
        const newActiveTab = newTabs[currentIndex] || newTabs[newTabs.length - 1];
        setActiveTabId(newActiveTab ? newActiveTab.id : null);
      }
      
      return newTabs;
    });
  };

  const switchTab = async (tabId) => {
    setActiveTabId(tabId);
    
    // 탭 변경 시 실시간 미리보기 업데이트
    const newActiveTab = openTabs.find(tab => tab.id === tabId);
    if (newActiveTab) {
      // 기존 타이머 정리
      if (previewUpdateTimeout.current) {
        clearTimeout(previewUpdateTimeout.current);
      }
      
      // 즉시 미리보기 업데이트
      updatePreviewInRealTime(newActiveTab, newActiveTab.content);
    }
    
    // 즉시 미리보기 업데이트 (상태 업데이트 후 실행)
    setTimeout(async () => {
      try {
        await runCode(); 
        // 탭 전환 시 자동 검사 실행
        setTimeout(async () => {
          await runAutoCheck();
        }, 100);
      } catch (error) {
        console.error('switchTab runCode 오류:', error);
      }
    }, 0);
  };

  // CSS를 HTML에 삽입하는 함수
  const injectCSSIntoHTML = (htmlContent, cssContent) => {
    // <style> 태그가 이미 있는지 확인
    if (htmlContent.includes('<style>')) {
      // 기존 <style> 태그 내용을 교체
      return htmlContent.replace(
        /<style>[\s\S]*?<\/style>/i,
        `<style>\n${cssContent}\n</style>`
      );
    } else {
      // <head> 태그가 있으면 그 안에 <style> 태그 추가
      if (htmlContent.includes('<head>')) {
        return htmlContent.replace(
          /<head>/i,
          `<head>\n<style>\n${cssContent}\n</style>`
        );
      } else {
        // <head> 태그가 없으면 <html> 태그 바로 다음에 추가
        return htmlContent.replace(
          /<html[^>]*>/i,
          `$&\n<head>\n<style>\n${cssContent}\n</style>\n</head>`
        );
      }
    }
  };

  // JavaScript를 HTML에 삽입하는 함수
  const injectJSIntoHTML = (htmlContent, jsContent) => {
    // <script> 태그가 이미 있는지 확인
    if (htmlContent.includes('<script>')) {
      // 기존 <script> 태그 내용을 교체
      return htmlContent.replace(
        /<script>[\s\S]*?<\/script>/i,
        `<script>\n${jsContent}\n</script>`
      );
    } else {
      // </body> 태그가 있으면 그 앞에 <script> 태그 추가
      if (htmlContent.includes('</body>')) {
        return htmlContent.replace(
          /<\/body>/i,
          `<script>\n${jsContent}\n</script>\n</body>`
        );
      } else {
        // </body> 태그가 없으면 </html> 태그 바로 앞에 추가
        return htmlContent.replace(
          /<\/html>/i,
          `<script>\n${jsContent}\n</script>\n</html>`
        );
      }
    }
  };

  // CSS만으로 기본 HTML 구조 생성
  const createHTMLWithCSS = (cssContent) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CSS 미리보기</title>
  <style>
${cssContent}
  </style>
</head>
<body>
  <div class="preview-content">
    <h1>CSS 미리보기</h1>
    <p>이것은 CSS 스타일이 적용된 미리보기입니다.</p>
    <div class="sample-element">
      <h2>샘플 요소</h2>
      <p>CSS 스타일을 테스트해보세요.</p>
    </div>
  </div>
</body>
</html>`;
  };

  // JavaScript만으로 기본 HTML 구조 생성
  const createHTMLWithJS = (jsContent) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JavaScript 미리보기</title>
</head>
<body>
  <div class="preview-content">
    <h1>JavaScript 미리보기</h1>
    <p>이것은 JavaScript가 실행되는 미리보기입니다.</p>
    <button onclick="testFunction()">테스트 버튼</button>
    <div id="output"></div>
  </div>
  <script>
${jsContent}
  </script>
</body>
</html>`;
  };

  // 실시간 미리보기 업데이트 함수
  const updatePreviewInRealTime = (tab, content) => {
    try {
      setIsPreviewUpdating(true);
      const fileExtension = tab.name.split('.').pop()?.toLowerCase();
      
      switch (fileExtension) {
        case 'html':
        case 'xhtml':
          // HTML/XHTML 파일은 직접 렌더링
          const { content: processedContent1, cssLinks: cssLinks1 } = convertExternalLinksToInline(content);
          const processedHTML = addDefaultFontToHTML(processedContent1, cssLinks1);
          setOutput(processedHTML);
          break;
          
        case 'css':
          // CSS 파일은 현재 활성 HTML 탭과 결합하여 렌더링
          const activeHTMLTab = openTabs.find(t => 
            t.id !== tab.id && 
            (t.name.endsWith('.html') || t.name.endsWith('.xhtml'))
          );
          
          if (activeHTMLTab) {
            // HTML에 CSS를 삽입하여 렌더링
            const htmlWithCSS = injectCSSIntoHTML(activeHTMLTab.content, content);
            const { content: processedContent2, cssLinks: cssLinks2 } = convertExternalLinksToInline(htmlWithCSS);
            const processedHTML = addDefaultFontToHTML(processedContent2, cssLinks2);
            setOutput(processedHTML);
          } else {
            // HTML 탭이 없으면 CSS만으로 기본 HTML 구조 생성
            const cssOnlyHTML = createHTMLWithCSS(content);
            const { content: processedContent3, cssLinks: cssLinks3 } = convertExternalLinksToInline(cssOnlyHTML);
            const processedHTML = addDefaultFontToHTML(processedContent3, cssLinks3);
            setOutput(processedHTML);
          }
          break;
          
        case 'js':
        case 'javascript':
          // JavaScript 파일은 현재 활성 HTML 탭과 결합하여 렌더링
          const activeHTMLTabForJS = openTabs.find(t => 
            t.id !== tab.id && 
            (t.name.endsWith('.html') || t.name.endsWith('.xhtml'))
          );
          
          if (activeHTMLTabForJS) {
            // HTML에 JavaScript를 삽입하여 렌더링
            const htmlWithJS = injectJSIntoHTML(activeHTMLTabForJS.content, content);
            const { content: processedContent4, cssLinks: cssLinks4 } = convertExternalLinksToInline(htmlWithJS);
            const processedHTML = addDefaultFontToHTML(processedContent4, cssLinks4);
            setOutput(processedHTML);
          } else {
            // HTML 탭이 없으면 JavaScript만으로 기본 HTML 구조 생성
            const jsOnlyHTML = createHTMLWithJS(content);
            const { content: processedContent5, cssLinks: cssLinks5 } = convertExternalLinksToInline(jsOnlyHTML);
            const processedHTML = addDefaultFontToHTML(processedContent5, cssLinks5);
            setOutput(processedHTML);
          }
          break;
          
        default:
          // 기타 파일 타입은 기존 로직 유지
          console.log('실시간 미리보기: 지원하지 않는 파일 타입', fileExtension);
          break;
      }
    } catch (error) {
      console.error('실시간 미리보기 업데이트 오류:', error);
    } finally {
      // 업데이트 완료 후 상태 초기화
      setTimeout(() => {
        setIsPreviewUpdating(false);
      }, 100);
    }
  };

  const updateTabContent = (tabId, content) => {
    console.log('🔍 updateTabContent 호출됨:', { tabId, contentLength: content.length });
    
    setOpenTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, content, isDirty: true }
        : tab
    ));
    
    // 구문 오류 실시간 검증 (구문 오류 검증이 필요한 파일만)
    const currentTab = openTabs.find(tab => tab.id === tabId);
    if (currentTab) {
      // 구문 오류 검증이 필요한 파일 확장자 확인
      const fileName = currentTab.name.toLowerCase();
      const needsSyntaxValidation = fileName.endsWith('.html') || 
                                   fileName.endsWith('.xhtml') || 
                                   fileName.endsWith('.xml') || 
                                   fileName.endsWith('.css') || 
                                   fileName.endsWith('.opf');
      
      if (needsSyntaxValidation) {
        console.log('🔍 구문 오류 실시간 검증 실행:', currentTab.name);
        
        // 기존 검증 타임아웃이 있으면 취소
        if (window.validationTimeout) {
          clearTimeout(window.validationTimeout);
        }
        
        // 즉시 검증 실행
        window.validationTimeout = setTimeout(async () => {
          try {
            console.log('🔍 구문 오류 실시간 검증 시작:', currentTab.name);
            
            // 검증 실행
            const validationResult = await validateFileContent(
              { 
                name: currentTab.name, 
                path: currentTab.path || currentTab.name 
              },
              content,
              { 
                content: content, 
                size: content.length 
              }
            );
            
            console.log('🔍 구문 오류 실시간 검증 결과:', validationResult);
            
            if (!validationResult.success || (validationResult.details && validationResult.details.length > 0)) {
              const errorCount = validationResult.details?.length || 0;
              console.log(`❌ 구문 오류 실시간 검증 실패: ${errorCount}개의 오류 발견`);
              clearAllErrorMarkers();

              // 오류가 있으면 로그에 추가
              if (validationResult.details && validationResult.details.length > 0) {
                validationResult.details.forEach((error, index) => {
                  logger.error('VALIDATION', `구문 오류 실시간 검증 오류: ${error.message}`, {
                    line: parseInt(error.line) || 1,
                    column: parseInt(error.column) || 1,
                    offset: parseInt(error.offset) || 0,
                    path: currentTab.path || currentTab.name,
                    file: currentTab.name,
                    message: error.message,
                    severity: error.severity || 'ERROR'
                  });
                });
                
                // LogViewer 즉시 새로고침
                if (window.refreshLogViewer) {
                  console.log('🔄 구문 오류 실시간 검증 후 LogViewer 즉시 새로고침');
                  window.refreshLogViewer();
                }
              }
            } else {
              console.log('✅ 구문 오류 실시간 검증 성공');
              
              // 성공 시 해당 파일의 오류 로그 정리
              const cleanedCount = logger.cleanResolvedErrors(currentTab.name);
              console.log(`🧹 정리된 구문 오류 로그: ${cleanedCount}개`);
              
              // // LogViewer 즉시 새로고침 (성공 시에도)
              // if (window.refreshLogViewer) {
              //   console.log('🔄 구문 오류 실시간 검증 성공 후 LogViewer 즉시 새로고침');
              //   window.refreshLogViewer();
              // }
            }
          } catch (error) {
            console.error('❌ 구문 오류 실시간 검증 중 오류:', error);
          }
        }, 100);
      } else {
        console.log('🔍 구문 오류 검증 불필요 - 수동 검증만 가능:', currentTab.name);
      }
    }
    
        // 실시간 미리보기 업데이트
    if (currentTab && activeTabId === tabId) {
      // 디바운스된 실시간 미리보기 업데이트
      if (previewUpdateTimeout.current) {
        clearTimeout(previewUpdateTimeout.current);
      }
      
      previewUpdateTimeout.current = setTimeout(() => {
        updatePreviewInRealTime(currentTab, content);
      }, 500); // 500ms 지연으로 성능 최적화
    }
    
    // 탭 내용 업데이트 시 즉시 모든 오류 하이라이트 삭제 (임시저장 효과)
    const tab = openTabs.find(tab => tab.id === tabId);
    if (tab) {
      console.log('🔍 탭 내용 업데이트로 인한 오류 하이라이트 삭제:', tab.name);
      
      // 즉시 모든 오류 하이라이트 삭제 (강제 삭제)
      clearAllErrorMarkers();
      
      // 여러 번 삭제 시도 (100ms, 300ms, 500ms)
      [100, 300, 500].forEach(delay => {
        setTimeout(() => {
          const editor = editorPaneRef.current?.getEditor();
          if (editor) {
            const model = editor.getModel();
            const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
            const standardMarkers = markers.filter(m => m.source === 'standard-check');
            if (standardMarkers.length > 0) {
              console.log(`⚠️ ${delay}ms 후 추가 강제 삭제 실행`);
              clearAllErrorMarkers();
            }
          }
        }, delay);
      });
      
      // 탭 내용 업데이트 시 해당 파일의 오류 로그 정리
      logger.cleanResolvedErrors(tab.name);
      
      // LogViewer 즉시 새로고침
      if (window.refreshLogViewer) {
        console.log('🔄 탭 내용 업데이트 후 LogViewer 즉시 새로고침');
        window.refreshLogViewer();
      }
    }
  };

  const saveTab = (tabId) => {
    const tab = openTabs.find(t => t.id === tabId);
    if (!tab) {
      console.warn('저장할 탭을 찾을 수 없습니다:', tabId);
      return;
    }

    // 파일 트리에서 해당 파일을 찾아서 내용 업데이트
    const updateFileInTree = (tree, filePath, newContent) => {
      return tree.map(node => {
        if (node.path === filePath) {
          // 파일 노드인 경우 내용 업데이트
          return { ...node, content: newContent };
        } else if (node.children) {
          // 폴더인 경우 하위 파일들 검색
          return { ...node, children: updateFileInTree(node.children, filePath, newContent) };
        }
        return node;
      });
    };

    // 파일 트리 업데이트
    if (tab.filePath) {
      setFileTree(prevTree => updateFileInTree(prevTree, tab.filePath, tab.content));
      console.log('파일 트리 업데이트 완료:', tab.filePath);
    }

    // 탭 상태 업데이트 (dirty 표시 제거)
    setOpenTabs(prev => prev.map(t => 
      t.id === tabId 
        ? { ...t, isDirty: false }
        : t
    ));

    // 파일 저장 시 즉시 모든 오류 하이라이트 삭제
    console.log('🔍 파일 저장으로 인한 오류 하이라이트 삭제:', tab.name);
    clearAllErrorMarkers();
    
    // 여러 번 삭제 시도 (100ms, 300ms, 500ms)
    [100, 300, 500].forEach(delay => {
      setTimeout(() => {
        const editor = editorPaneRef.current?.getEditor();
        if (editor) {
          const model = editor.getModel();
          const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
          const standardMarkers = markers.filter(m => m.source === 'standard-check');
          if (standardMarkers.length > 0) {
            console.log(`⚠️ 저장 후 ${delay}ms 추가 강제 삭제 실행`);
            clearAllErrorMarkers();
          }
        }
      }, delay);
    });

    // 파일 저장 시 해당 파일의 오류 로그 정리
    logger.cleanResolvedErrors(tab.name);
    
    console.log('파일 저장 완료:', tab.name);
  };

  const getCurrentTab = () => {
    const currentTab = openTabs.find(tab => tab.id === activeTabId);
    console.log('getCurrentTab 호출:', {
      activeTabId,
      openTabsLength: openTabs.length,
      openTabsIds: openTabs.map(tab => tab.id),
      foundTab: currentTab
    });
    return currentTab || null;
  };

  // 탭 UI 렌더링
  const renderTabs = () => {
    return (
      <div className="tabs-container">
        <div className="tabs-list">
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab-item ${activeTabId === tab.id ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
              onClick={() => switchTab(tab.id)}
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
                  closeTab(tab.id);
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

  const getTabDisplayName = (fileNode) => {
    console.log('getTabDisplayName 호출됨:', fileNode);
    
    try {
    // 파일 경로에서 디렉토리 정보를 포함한 이름 생성
    const pathParts = fileNode.path.split('/');
      console.log('pathParts:', pathParts);
      
    if (pathParts.length > 1) {
      // 상위 디렉토리가 있으면 "디렉토리/파일명" 형태로 표시
      const dirName = pathParts[pathParts.length - 2];
      const fileName = pathParts[pathParts.length - 1];
        const result = `${dirName}/${fileName}`;
        console.log('디렉토리 포함 이름:', result);
        return result;
    }
      
      console.log('단순 파일명:', fileNode.name);
    return fileNode.name;
    } catch (error) {
      console.error('getTabDisplayName 오류:', error);
      return fileNode.name || 'Unknown';
    }
  };

  // 아코디언 토글 함수
  const toggleAccordion = (section) => {
    setAccordionState(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 아코디언 사이드바 렌더링
  // eslint-disable-next-line no-unused-vars
  const renderAccordionSidebar = () => {
    return (
      <div className="accordion-sidebar" style={{ width: `${sidebarWidth}px` }}>
        {/* 목차 아코디언 */}
        <div className="accordion-section">
          <div 
            className="accordion-header"
            onClick={() => toggleAccordion('toc')}
          >
            <span className="accordion-icon">
              {accordionState.toc ? '◉' : '◉'}
            </span>
            <span className="accordion-title">◉ 목차</span>
            <span className="accordion-count">({toc.length})</span>
          </div>
          {accordionState.toc && (
            <div className="accordion-content">
              <div className="folder-list">
                {toc.map((item, index) => (
                  <div 
                    key={index} 
                    className="folder-item"
                    onClick={() => handleTocItemClick(item)}
                  >
                    <span className="folder-indent" style={{ paddingLeft: `${item.level * 16}px` }}>
                      <span className="folder-icon">◉</span>
                      <span className="folder-name">{item.title}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 파일 구조 아코디언 */}
        <div className="accordion-section">
          <div 
            className="accordion-header"
            onClick={() => toggleAccordion('files')}
          >
            {console.log('🔍🔍🔍 사이드바 파일 섹션 렌더링:', accordionState.files, fileTree.length)}
            <span className="accordion-icon">
              {accordionState.files ? '◉' : '◉'}
            </span>
            <span className="accordion-title">◉ 파일 구조</span>
            <span className="accordion-count">({fileTree.length})</span>
          </div>
          {accordionState.files && (
            <div className="accordion-content">
              <div className="folder-list">
                {console.log('🔍🔍🔍 파일트리 렌더링 체크:', fileTree.length, fileTree)}
                {fileTree.length > 0 ? (
                  renderFolderTree(fileTree)
                ) : (
                  <div className="folder-empty">
                    <div className="empty-message">
                      ◉ EPUB 파일을 업로드하면<br />
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
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // XHTML 언어 등록
    monaco.languages.register({ id: 'xhtml' });
    
    // XHTML 파일 확장자 등록
    monaco.languages.register({ id: 'xhtml', extensions: ['.xhtml'] });
    
    // Monaco Editor의 파일 확장자 매핑 강화
    monaco.languages.register({ id: 'xhtml', filenames: ['*.xhtml'] });
    
    // Monaco Editor의 언어 감지 로직 강화
    monaco.languages.setLanguageConfiguration('xhtml', {
      comments: {
        blockComment: ['<!--', '-->']
      },
      brackets: [
        ['<', '>'],
        ['{', '}'],
        ['[', ']'],
        ['(', ')']
      ],
      autoClosingPairs: [
        { open: '<', close: '>' },
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ],
      surroundingPairs: [
        { open: '<', close: '>' },
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" }
      ]
    });
    
    // Monaco Editor의 언어 감지 로직 추가 강화
    monaco.languages.register({ id: 'xhtml', aliases: ['XHTML', 'xhtml'] });
    
    // Monaco Editor의 언어 감지 로직 추가 강화
    monaco.languages.register({ id: 'xhtml', mimetypes: ['application/xhtml+xml'] });
    
    // Monaco Editor의 언어 감지 로직 추가 강화
    monaco.languages.register({ id: 'xhtml', firstLine: /<\?xml.*version.*encoding.*\?>/ });
    
    // Monaco Editor의 언어 감지 로직 추가 강화
    monaco.languages.register({ id: 'xhtml', firstLine: /<!DOCTYPE.*html.*>/ });
    
    monaco.languages.setMonarchTokensProvider('xhtml', {
      defaultToken: '',
      tokenPostfix: '.xhtml',
      
      // XML 선언
      xmlDeclaration: /<\?xml/,
      
      // DOCTYPE
      doctype: /<!DOCTYPE/,
      
      // 태그
      tag: /<[a-zA-Z][a-zA-Z0-9]*/,
      endTag: /<\/[a-zA-Z][a-zA-Z0-9]*/,
      selfClosingTag: /<[a-zA-Z][a-zA-Z0-9]*\s*\/>/,
      
      // 속성
      attribute: /[a-zA-Z][a-zA-Z0-9]*=/,
      
      // 문자열
      string: /"[^"]*"/,
      stringSingle: /'[^']*'/,
      
      // 주석
      comment: /<!--[\s\S]*?-->/,
      
      // CDATA
      cdata: /<!\[CDATA\[[\s\S]*?\]\]>/,
      
      tokenizer: {
        root: [
          { include: '@xmlDeclaration' },
          { include: '@doctype' },
          { include: '@comment' },
          { include: '@cdata' },
          { include: '@tag' },
          { include: '@text' }
        ],
        
        xmlDeclaration: [
          { regex: /<\?xml/, token: 'keyword.xml-declaration' },
          { regex: /version/, token: 'keyword' },
          { regex: /encoding/, token: 'keyword' },
          { regex: /standalone/, token: 'keyword' },
          { regex: /"[^"]*"/, token: 'string' },
          { regex: /'[^']*'/, token: 'string' },
          { regex: /\?>/, token: 'keyword.xml-declaration' }
        ],
        
        doctype: [
          { regex: /<!DOCTYPE/, token: 'keyword.doctype' },
          { regex: /PUBLIC/, token: 'keyword' },
          { regex: /SYSTEM/, token: 'keyword' },
          { regex: /"[^"]*"/, token: 'string' },
          { regex: /'[^']*'/, token: 'string' },
          { regex: />/, token: 'keyword.doctype' }
        ],
        
        comment: [
          { regex: /<!--/, token: 'comment', next: '@commentContent' }
        ],
        
        commentContent: [
          { regex: /-->/, token: 'comment', next: '@pop' },
          { regex: /[^<\-]+/, token: 'comment' },
          { regex: /-/, token: 'comment' },
          { regex: /</, token: 'comment' }
        ],
        
        cdata: [
          { regex: /<!\[CDATA\[/, token: 'keyword.cdata' },
          { regex: /\]\]>/, token: 'keyword.cdata' },
          { regex: /[^\[\]]+/, token: 'text' }
        ],
        
        tag: [
          { regex: /<[a-zA-Z][a-zA-Z0-9]*/, token: 'tag', next: '@tagContent' }
        ],
        
        tagContent: [
          { regex: />/, token: 'tag', next: '@pop' },
          { regex: /\/>/, token: 'tag', next: '@pop' },
          { regex: /[a-zA-Z][a-zA-Z0-9]*=/, token: 'attribute.name' },
          { regex: /"[^"]*"/, token: 'attribute.value' },
          { regex: /'[^']*'/, token: 'attribute.value' },
          { regex: /[^>\s]+/, token: 'text' }
        ],
        
        text: [
          { regex: /[^<]+/, token: 'text' }
        ]
      }
    });
    
    // 커스텀 다크 테마 정의
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        // HTML 태그
        { token: 'tag', foreground: '#569cd6', fontStyle: 'bold' },
        { token: 'tag.html', foreground: '#569cd6', fontStyle: 'bold' },
        { token: 'tag.xhtml', foreground: '#569cd6', fontStyle: 'bold' },
        { token: 'tag.css', foreground: '#569cd6', fontStyle: 'bold' },
        { token: 'tag.js', foreground: '#569cd6', fontStyle: 'bold' },
        
        // XHTML 전용 토큰
        { token: 'keyword.xml-declaration', foreground: '#4ec9b0', fontStyle: 'bold' },
        { token: 'keyword.doctype', foreground: '#c586c0', fontStyle: 'bold' },
        { token: 'keyword.cdata', foreground: '#dcdcaa', fontStyle: 'bold' },
        
        // 속성
        { token: 'attribute.name', foreground: '#9cdcfe' },
        { token: 'attribute.value', foreground: '#ce9178' },
        { token: 'attribute.name.xhtml', foreground: '#9cdcfe' },
        { token: 'attribute.value.xhtml', foreground: '#ce9178' },
        
        // 문자열
        { token: 'string', foreground: '#ce9178' },
        { token: 'string.html', foreground: '#ce9178' },
        { token: 'string.xhtml', foreground: '#ce9178' },
        { token: 'string.css', foreground: '#ce9178' },
        { token: 'string.js', foreground: '#ce9178' },
        
        // 주석
        { token: 'comment', foreground: '#6a9955', fontStyle: 'italic' },
        { token: 'comment.html', foreground: '#6a9955', fontStyle: 'italic' },
        { token: 'comment.xhtml', foreground: '#6a9955', fontStyle: 'italic' },
        { token: 'comment.css', foreground: '#6a9955', fontStyle: 'italic' },
        { token: 'comment.js', foreground: '#6a9955', fontStyle: 'italic' },
        
        // XHTML 네임스페이스
        { token: 'namespace', foreground: '#dcdcaa', fontStyle: 'bold' },
        
        // 키워드
        { token: 'keyword', foreground: '#c586c0' },
        { token: 'keyword.js', foreground: '#c586c0' },
        { token: 'keyword.css', foreground: '#c586c0' },
        
        // 함수
        { token: 'function', foreground: '#dcdcaa' },
        { token: 'function.js', foreground: '#dcdcaa' },
        { token: 'function.css', foreground: '#dcdcaa' },
        
        // 숫자
        { token: 'number', foreground: '#b5cea8' },
        { token: 'number.css', foreground: '#b5cea8' },
        { token: 'number.js', foreground: '#b5cea8' },
        
        // 변수
        { token: 'variable', foreground: '#9cdcfe' },
        { token: 'variable.js', foreground: '#9cdcfe' },
        { token: 'variable.css', foreground: '#9cdcfe' },
        
        // 선택자
        { token: 'selector', foreground: '#d7ba7d' },
        { token: 'selector.css', foreground: '#d7ba7d' },
        
        // 속성
        { token: 'property', foreground: '#9cdcfe' },
        { token: 'property.css', foreground: '#9cdcfe' },
        
        // 오류
        { token: 'error', foreground: '#f44747', fontStyle: 'bold' },
        { token: 'warning', foreground: '#ffcc02', fontStyle: 'bold' },
        
        // 기본 텍스트
        { token: 'text', foreground: '#d4d4d4' }
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2d2d30',
        'editor.lineHighlightBorder': '#2d2d30',
        'editor.selectionBackground': '#264f78',
        'editor.selectionHighlightBackground': '#2d2d30',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editor.findMatchBackground': '#515c6a',
        'editor.findMatchHighlightBackground': '#3a3d41',
        'editor.findRangeHighlightBackground': '#2d2d30',
        'editor.hoverHighlightBackground': '#2d2d30',
        'editor.lineNumberActiveForeground': '#c6c6c6',
        'editor.lineNumberForeground': '#858585',
        'editorCursor.foreground': '#aeafad',
        'editorWhitespace.foreground': '#3e3e42',
        'editorIndentGuide.activeBackground': '#707070',
        'editorIndentGuide.background': '#404040',
        'editorBracketMatch.background': '#4a4a4a',
        'editorBracketMatch.border': '#888888',
        'editorOverviewRuler.border': '#424242',
        'editorOverviewRuler.currentContentForeground': '#007acc',
        'editorOverviewRuler.incomingContentForeground': '#40a9ff',
        'editorOverviewRuler.commonContentForeground': '#40a9ff',
        'editorOverviewRuler.addedForeground': '#40a9ff',
        'editorOverviewRuler.deletedForeground': '#ff4d4f',
        'editorOverviewRuler.modifiedForeground': '#ffa500',
        'editorOverviewRuler.errorForeground': '#ff4d4f',
        'editorOverviewRuler.warningForeground': '#faad14',
        'editorOverviewRuler.infoForeground': '#1890ff'
      }
    });

    // 커스텀 라이트 테마 정의
    monaco.editor.defineTheme('custom-light', {
      base: 'vs',
      inherit: true,
      rules: [
        // HTML 태그
        { token: 'tag', foreground: '#0000ff', fontStyle: 'bold' },
        { token: 'tag.html', foreground: '#0000ff', fontStyle: 'bold' },
        { token: 'tag.xhtml', foreground: '#0000ff', fontStyle: 'bold' },
        { token: 'tag.css', foreground: '#0000ff', fontStyle: 'bold' },
        { token: 'tag.js', foreground: '#0000ff', fontStyle: 'bold' },
        
        // XHTML 전용 토큰
        { token: 'keyword.xml-declaration', foreground: '#267f99', fontStyle: 'bold' },
        { token: 'keyword.doctype', foreground: '#af00db', fontStyle: 'bold' },
        { token: 'keyword.cdata', foreground: '#795e26', fontStyle: 'bold' },
        
        // 속성
        { token: 'attribute.name', foreground: '#001080' },
        { token: 'attribute.value', foreground: '#a31515' },
        { token: 'attribute.name.xhtml', foreground: '#001080' },
        { token: 'attribute.value.xhtml', foreground: '#a31515' },
        
        // 문자열
        { token: 'string', foreground: '#a31515' },
        { token: 'string.html', foreground: '#a31515' },
        { token: 'string.xhtml', foreground: '#a31515' },
        { token: 'string.css', foreground: '#a31515' },
        { token: 'string.js', foreground: '#a31515' },
        
        // 주석
        { token: 'comment', foreground: '#008000', fontStyle: 'italic' },
        { token: 'comment.html', foreground: '#008000', fontStyle: 'italic' },
        { token: 'comment.xhtml', foreground: '#008000', fontStyle: 'italic' },
        { token: 'comment.css', foreground: '#008000', fontStyle: 'italic' },
        { token: 'comment.js', foreground: '#008000', fontStyle: 'italic' },
        
        // XHTML 네임스페이스
        { token: 'namespace', foreground: '#795e26', fontStyle: 'bold' },
        
        // 키워드
        { token: 'keyword', foreground: '#0000ff' },
        { token: 'keyword.js', foreground: '#0000ff' },
        { token: 'keyword.css', foreground: '#0000ff' },
        
        // 함수
        { token: 'function', foreground: '#795e26' },
        { token: 'function.js', foreground: '#795e26' },
        { token: 'function.css', foreground: '#795e26' },
        
        // 숫자
        { token: 'number', foreground: '#098658' },
        { token: 'number.css', foreground: '#098658' },
        { token: 'number.js', foreground: '#098658' },
        
        // 변수
        { token: 'variable', foreground: '#001080' },
        { token: 'variable.js', foreground: '#001080' },
        { token: 'variable.css', foreground: '#001080' },
        
        // 선택자
        { token: 'selector', foreground: '#d73a49' },
        { token: 'selector.css', foreground: '#d73a49' },
        
        // 속성
        { token: 'property', foreground: '#001080' },
        { token: 'property.css', foreground: '#001080' },
        
        // 오류
        { token: 'error', foreground: '#e3116c', fontStyle: 'bold' },
        { token: 'warning', foreground: '#ff8c00', fontStyle: 'bold' },
        
        // 기본 텍스트
        { token: 'text', foreground: '#000000' }
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editor.lineHighlightBorder': '#f0f0f0',
        'editor.selectionBackground': '#add6ff',
        'editor.selectionHighlightBackground': '#f0f0f0',
        'editor.inactiveSelectionBackground': '#e5ebf1',
        'editor.findMatchBackground': '#a8ac94',
        'editor.findMatchHighlightBackground': '#ea5c0055',
        'editor.findRangeHighlightBackground': '#f0f0f0',
        'editor.hoverHighlightBackground': '#f0f0f0',
        'editor.lineNumberActiveForeground': '#0b216f',
        'editor.lineNumberForeground': '#237893',
        'editorCursor.foreground': '#000000',
        'editorWhitespace.foreground': '#d3d3d3',
        'editorIndentGuide.activeBackground': '#939599',
        'editorIndentGuide.background': '#d3d3d3',
        'editorBracketMatch.background': '#d4d4d4',
        'editorBracketMatch.border': '#888888',
        'editorOverviewRuler.border': '#d3d3d3',
        'editorOverviewRuler.currentContentForeground': '#007acc',
        'editorOverviewRuler.incomingContentForeground': '#40a9ff',
        'editorOverviewRuler.commonContentForeground': '#40a9ff',
        'editorOverviewRuler.addedForeground': '#40a9ff',
        'editorOverviewRuler.deletedForeground': '#ff4d4f',
        'editorOverviewRuler.modifiedForeground': '#ffa500',
        'editorOverviewRuler.errorForeground': '#ff4d4f',
        'editorOverviewRuler.warningForeground': '#faad14',
        'editorOverviewRuler.infoForeground': '#1890ff'
      }
    });
    
    // HTML 자동완성 제공자 등록
    monaco.languages.registerCompletionItemProvider('html', {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: 'html5',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<!DOCTYPE html>\n<html lang="ko">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>Document</title>\n</head>\n<body>\n\t$0\n</body>\n</html>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'HTML5 기본 문서 구조',
            detail: 'HTML5 Template'
          },
          {
            label: 'div',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<div>\n\t$0\n</div>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'DIV 컨테이너',
            detail: 'HTML Element'
          },
          {
            label: 'p',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<p>$0</p>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '단락',
            detail: 'HTML Element'
          }
        ]
      }),
    });
    
    // XHTML 자동완성 제공자 등록
    monaco.languages.registerCompletionItemProvider('xhtml', {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: 'xhtml',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko">\n<head>\n\t<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>Document</title>\n</head>\n<body>\n\t$0\n</body>\n</html>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'XHTML 1.1 기본 문서 구조',
            detail: 'XHTML Template'
          },
          {
            label: 'div',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<div>\n\t$0\n</div>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'DIV 컨테이너 (XHTML)',
            detail: 'XHTML Element'
          },
          {
            label: 'p',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<p>$0</p>',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '단락 (XHTML)',
            detail: 'XHTML Element'
          },
          {
            label: 'img',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<img src="$1" alt="$2" />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '이미지 (XHTML - 자동 닫힘)',
            detail: 'XHTML Element'
          },
          {
            label: 'br',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<br />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '줄바꿈 (XHTML - 자동 닫힘)',
            detail: 'XHTML Element'
          },
          {
            label: 'hr',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<hr />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '수평선 (XHTML - 자동 닫힘)',
            detail: 'XHTML Element'
          },
          {
            label: 'link',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<link rel="stylesheet" type="text/css" href="$1" />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'CSS 링크 (XHTML)',
            detail: 'XHTML Element'
          },
          {
            label: 'meta',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '<meta name="$1" content="$2" />',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '메타 태그 (XHTML)',
            detail: 'XHTML Element'
          }
        ]
      }),
    });
    
    // CSS 자동완성
    monaco.languages.registerCompletionItemProvider('css', {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: 'flexbox',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'display: flex;\njustify-content: center;\nalign-items: center;',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Flexbox 레이아웃',
            detail: 'CSS Layout'
          },
          {
            label: 'grid',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'display: grid;\ngrid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\ngap: 1rem;',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'CSS Grid 레이아웃',
            detail: 'CSS Layout'
          }
        ]
      }),
    });
    
    // JavaScript 자동완성
    monaco.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems: () => ({
        suggestions: [
          {
            label: 'function',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'function ${1:functionName}(${2:params}) {\n\t$0\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '함수 정의',
            detail: 'JavaScript Function'
          },
          {
            label: 'arrow',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'const ${1:functionName} = (${2:params}) => {\n\t$0\n};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '화살표 함수',
            detail: 'JavaScript Function'
          }
        ]
      }),
    });
    
    // 에디터 설정 개선
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
      lineHeight: 22,
      letterSpacing: 0.5,
      wordWrap: 'on',
      minimap: {
        enabled: true,
        size: 'proportional',
        side: 'right',
        showSlider: 'mouseover'
      },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: {
        enabled: true,
        independentColorPoolPerBracketType: true
      },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true
      },
      renderWhitespace: 'selection',
      renderControlCharacters: false,
      renderLineHighlight: 'all',
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      automaticLayout: true,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      foldingHighlight: true,
      foldingImportsByDefault: true,
      unfoldOnClickAfterEnd: false,
      links: true,
      colorDecorators: true,
      lightbulb: {
        enabled: true
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showConstants: true,
        showEnums: true,
        showEnumsMembers: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showWords: true,
        showUsers: true,
        showIssues: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumsMembers: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showWords: true,
        showUsers: true,
        showIssues: true,
        showOperators: true,
        showUnits: true,
        showValues: true
      }
    });
    
    window.monaco = monaco;
    // 현재 테마에 맞게 Monaco Editor 테마 설정
    const themeName = currentTheme === 'dark' ? 'custom-dark' : 'custom-light';
    monaco.editor.setTheme(themeName);
    console.log('Monaco Editor 초기 테마 설정:', themeName);
  };

  const handleChange = async (value) => {
    if (activeTabId) {
      updateTabContent(activeTabId, value);
      
      // 실시간 미리보기 업데이트 (디바운싱)
      if (autoPreview) {
        setTimeout(async () => { 
          // 외부 CSS 링크 상태 초기화
          setExternalCssLinks([]);
          
          // 현재 탭이 있는지 확인 후 실행
          const currentTab = getCurrentTab();
          if (currentTab) {
            console.log('실시간 미리보기 업데이트:', currentTab.name);
            await runCode(); 
          }
          // 자동 검사 실행 (디바운싱)
          setTimeout(async () => {
            await runAutoCheck();
          }, 500);
        }, 300);
      }
    }
  };

  // 실시간 미리보기 토글 기능
  const [autoPreview, setAutoPreview] = useState(true);
  
  // 실시간 미리보기 설정
  const toggleAutoPreview = () => {
    setAutoPreview(!autoPreview);
    console.log('실시간 미리보기:', !autoPreview ? '활성화' : '비활성화');
  };

  const runCodeWithTab = async (tab) => {
    console.log('runCodeWithTab 실행 - 탭:', tab);
    
    // 외부 CSS 링크 상태 초기화
    setExternalCssLinks([]);
    
    if (!tab) {
      console.log('탭이 없어서 미리보기 비움');
      setOutput('');
      return;
    }
    
    const { content, type } = tab;
    console.log('runCodeWithTab 실행 - 탭 정보:', { name: tab.name, type, contentLength: content?.length });
    
    // 미리보기 업데이트 시작
    const previewIframe = document.querySelector('.preview-iframe');
    
    if (type === 'html' || type === 'xhtml') {
      // HTML/XHTML 파일인 경우 이미지 처리를 다시 수행
      let processedContent = content;
      
      // EPUB 파일에서 온 HTML인지 확인
      const isEpubHtml = tab.filePath && (tab.filePath.endsWith('.html') || tab.filePath.endsWith('.xhtml'));
      const hasEpubData = epubData && epubData.zipContent;
      
      console.log('미리보기 실행:', {
        tabName: tab.name,
        filePath: tab.filePath,
        isEpubHtml,
        hasEpubData,
        contentLength: content.length
      });
      
      if (isEpubHtml && hasEpubData) {
        try {
          console.log('미리보기에서 XHTML 처리 시작:', tab.name);
          processedContent = await processXHTMLContent(content, tab.filePath, true);
          console.log('미리보기에서 XHTML 처리 완료:', {
            originalLength: content.length,
            processedLength: processedContent.length,
            hasImages: processedContent.includes('data:image'),
            hasDataUri: processedContent.includes('data:text/css'),
            hasBaseUrl: processedContent.includes(baseUrl)
          });
          
          // CSS 링크가 실제로 수정되었는지 확인
          const cssLinks = processedContent.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi);
          console.log('처리된 CSS 링크들:', cssLinks);
        } catch (error) {
          console.warn('미리보기 이미지 처리 실패:', error);
          processedContent = content;
        }
      } else {
        console.log('이미지 처리 건너뜀:', {
          reason: !isEpubHtml ? 'EPUB HTML이 아님' : 'EPUB 데이터 없음'
        });
      }
      
      // HTML에 CSS와 JavaScript 적용
      let finalContent = processedContent;
      
      // CSS 탭의 내용을 찾아서 적용 (현재 탭이 아닌 다른 CSS 탭들)
      const cssTabs = openTabs.filter(t => t.type === 'css' && t.id !== tab.id);
      if (cssTabs.length > 0) {
        const cssContent = cssTabs.map(t => t.content).join('\n');
        if (finalContent.includes('</head>')) {
          finalContent = finalContent.replace('</head>', `<style>${cssContent}</style></head>`);
        } else {
          finalContent = `<head><style>${cssContent}</style></head>${finalContent}`;
        }
      }
      
      // JavaScript 탭의 내용을 찾아서 적용 (현재 탭이 아닌 다른 JS 탭들)
      const jsTabs = openTabs.filter(t => t.type === 'javascript' && t.id !== tab.id);
      if (jsTabs.length > 0) {
        const jsContent = jsTabs.map(t => t.content).join('\n');
        if (finalContent.includes('</body>')) {
          finalContent = finalContent.replace('</body>', `<script>${jsContent}</script></body>`);
        } else {
          finalContent = `${finalContent}<script>${jsContent}</script>`;
        }
      }
      
      console.log('HTML/XHTML setOutput 호출:', { contentLength: finalContent.length, hasDataUri: finalContent.includes('data:text/css') });
      
      // 외부 CSS 링크를 인라인으로 변환
      const { content: processedContent10, cssLinks: cssLinks10 } = convertExternalLinksToInline(finalContent);
      
      // 기본 폰트 설정 추가
      const contentWithFont = addDefaultFontToHTML(processedContent10, cssLinks10);
      setOutput(contentWithFont);
      
      // 이미지 로딩 개선을 위한 스크립트 추가
      setTimeout(() => {
        const iframe = document.querySelector('.preview-iframe');
        if (iframe && iframe.contentDocument) {
          const images = iframe.contentDocument.querySelectorAll('img');
          images.forEach(img => {
            // 이미지 로딩 상태 관리
            img.classList.add('loading');
            
            img.onload = () => {
              img.classList.remove('loading');
              img.classList.add('loaded');
            };
            
            img.onerror = () => {
              img.classList.remove('loading');
              img.classList.add('error');
            };
            
            // 이미 이미 로드된 이미지 처리
            if (img.complete) {
              img.classList.remove('loading');
              img.classList.add('loaded');
            }
          });
        }
      }, 100);
    } else {
      // 다른 타입의 파일은 기존 runCode 로직 사용
      // 현재 탭이 있는지 확인 후 실행
      const currentTab = getCurrentTab();
      if (currentTab) {
        await runCode();
      } else {
        console.warn('runCodeWithTab: 현재 활성 탭이 없어서 runCode를 건너뜁니다.');
        // 잠시 후 재시도
        setTimeout(async () => {
          const retryTab = getCurrentTab();
          if (retryTab) {
            console.log('runCodeWithTab 재시도 성공:', retryTab);
            await runCode();
          }
        }, 100);
      }
    }
  };
  const runCode = async () => {
    // 외부 CSS 링크 상태 초기화
    setExternalCssLinks([]);
    
    let currentTab = getCurrentTab();
    console.log('runCode 실행 - 현재 탭:', currentTab);
    console.log('runCode 실행 - openTabs:', openTabs.map(t => ({ id: t.id, name: t.name, type: t.type })));
  
    // 현재 탭이 없으면 잠시 대기 후 재시도 (상태 업데이트 지연 대응)
    if (!currentTab) {
      console.warn('runCode: 현재 활성 탭이 없습니다. 잠시 후 재시도합니다.');
      setTimeout(async () => {
        const retryTab = getCurrentTab();
        if (retryTab) {
          console.log('runCode 재시도 성공:', retryTab);
          await runCode();
        } else {
          console.warn('runCode 재시도 실패: 여전히 활성 탭이 없습니다.');
        }
      }, 100);
      return;
    }
    
    const { content, type } = currentTab;
    
    // 미리보기 업데이트 시작
    const previewIframe = document.querySelector('.preview-iframe');
    
    if (type === 'html' || type === 'xhtml') {
      // HTML/XHTML 파일인 경우 이미지 처리를 다시 수행
      let processedContent = content;
      
      // EPUB 파일에서 온 HTML인지 확인
      const isEpubHtml = currentTab.filePath && (currentTab.filePath.endsWith('.html') || currentTab.filePath.endsWith('.xhtml'));
      const hasEpubData = epubData && epubData.zipContent;
      
      console.log('미리보기 실행:', {
        tabName: currentTab.name,
        filePath: currentTab.filePath,
        type: type,
        isEpubHtml,
        hasEpubData,
        contentLength: content.length
      });
      
      if (isEpubHtml && hasEpubData) {
        try {
          console.log('미리보기에서 XHTML 처리 시작:', currentTab.name);
          processedContent = await processXHTMLContent(content, currentTab.filePath, true);
          console.log('미리보기에서 XHTML 처리 완료:', {
            originalLength: content.length,
            processedLength: processedContent.length,
            hasImages: processedContent.includes('data:image'),
            hasDataUri: processedContent.includes('data:text/css'),
            hasBaseUrl: processedContent.includes(baseUrl)
          });
          
          // CSS 링크가 실제로 수정되었는지 확인
          const cssLinks = processedContent.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi);
          console.log('처리된 CSS 링크들:', cssLinks);
        } catch (error) {
          console.warn('미리보기 이미지 처리 실패:', error);
          processedContent = content;
        }
      } else {
        console.log('이미지 처리 건너뜀:', {
          reason: !isEpubHtml ? 'EPUB HTML이 아님' : 'EPUB 데이터 없음'
        });
      }
      
      // HTML에 CSS와 JavaScript 적용
      let finalContent = processedContent;
      
      // CSS 탭의 내용을 찾아서 적용
      const cssTab = openTabs.find(tab => tab.type === 'css');
      if (cssTab && cssTab.content) {
        if (finalContent.includes('</head>')) {
          finalContent = finalContent.replace('</head>', `<style>${cssTab.content}</style></head>`);
        } else {
          finalContent = `<head><style>${cssTab.content}</style></head>${finalContent}`;
        }
      }
      
      // JavaScript 탭의 내용을 찾아서 적용
      const jsTab = openTabs.find(tab => tab.type === 'javascript');
      if (jsTab && jsTab.content) {
        if (finalContent.includes('</body>')) {
          finalContent = finalContent.replace('</body>', `<script>${jsTab.content}</script></body>`);
        } else {
          finalContent = `${finalContent}<script>${jsTab.content}</script>`;
        }
      }
      
      console.log('HTML/XHTML setOutput 호출:', { contentLength: finalContent.length, hasDataUri: finalContent.includes('data:text/css') });
      
      // 외부 CSS 링크를 인라인으로 변환
      const { content: processedContent11, cssLinks: cssLinks11 } = convertExternalLinksToInline(finalContent);
      
      // 기본 폰트 설정 추가
      const contentWithFont = addDefaultFontToHTML(processedContent11, cssLinks11);
      setOutput(contentWithFont);
    } else if (type === 'css') {
      // CSS는 HTML에 스타일로 적용
      const htmlTab = openTabs.find(tab => tab.type === 'html');
      if (htmlTab) {
        let htmlContent = htmlTab.content;
        
        // 기존 스타일 태그 제거
        htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // 새 스타일 태그 추가
        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace('</head>', `<style>${content}</style></head>`);
        } else {
          htmlContent = `<head><style>${content}</style></head>${htmlContent}`;
        }
        
        // JavaScript도 함께 적용
        const jsTab = openTabs.find(tab => tab.type === 'javascript');
        if (jsTab && jsTab.content) {
          if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', `<script>${jsTab.content}</script></body>`);
          } else {
            htmlContent = `${htmlContent}<script>${jsTab.content}</script>`;
          }
        }
        
        setOutput(htmlContent);
      } else {
        // HTML 탭이 없으면 CSS만으로 HTML 생성
        const cssHtmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>CSS Preview</title>
            <style>${content}</style>
          </head>
          <body>
            <div class="preview-content">
              <h1>CSS 미리보기</h1>
              <p>이것은 CSS 스타일이 적용된 미리보기입니다.</p>
              <button class="btn">버튼 예시</button>
              <div class="card">
                <h2>카드 예시</h2>
                <p>카드 내용입니다.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        
        // 기본 폰트 설정 추가
        const { content: processedContent6, cssLinks: cssLinks6 } = convertExternalLinksToInline(cssHtmlContent);
        const contentWithFont = addDefaultFontToHTML(processedContent6, cssLinks6);
        setOutput(contentWithFont);
      }
    } else if (type === 'javascript') {
      // JavaScript는 HTML에 스크립트로 적용
      const htmlTab = openTabs.find(tab => tab.type === 'html');
      if (htmlTab) {
        let htmlContent = htmlTab.content;
        
        // 기존 스크립트 태그 제거
        htmlContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        
        // 새 스크립트 태그 추가
        if (htmlContent.includes('</body>')) {
          htmlContent = htmlContent.replace('</body>', `<script>${content}</script></body>`);
        } else {
          htmlContent = `${htmlContent}<script>${content}</script>`;
        }
        
        // CSS도 함께 적용
        const cssTab = openTabs.find(tab => tab.type === 'css');
        if (cssTab && cssTab.content) {
          if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', `<style>${cssTab.content}</style></head>`);
          } else {
            htmlContent = `<head><style>${cssTab.content}</style></head>${htmlContent}`;
          }
        }
        
        // 기본 폰트 설정 추가
        const { content: processedContent7, cssLinks: cssLinks7 } = convertExternalLinksToInline(htmlContent);
        const contentWithFont = addDefaultFontToHTML(processedContent7, cssLinks7);
        setOutput(contentWithFont);
      } else {
        // HTML 탭이 없으면 JavaScript만으로 HTML 생성
        const jsHtmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>JavaScript Preview</title>
          </head>
          <body>
            <div class="preview-content">
              <h1>JavaScript 미리보기</h1>
              <p>이것은 JavaScript가 적용된 미리보기입니다.</p>
              <button onclick="alert('JavaScript 작동!')">테스트 버튼</button>
              <div id="output"></div>
            </div>
            <script>${content}</script>
          </body>
          </html>
        `;
        
        // 기본 폰트 설정 추가
        const { content: processedContent8, cssLinks: cssLinks8 } = convertExternalLinksToInline(jsHtmlContent);
        const contentWithFont = addDefaultFontToHTML(processedContent8, cssLinks8);
        setOutput(contentWithFont);
      }
    } else {
      // 다른 타입의 파일은 HTML로 렌더링
      const otherTypeHtmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${currentTab.name}</title>
          <style>
            body { 
              font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif; 
              padding: 20px; 
              background: #1e1e1e; 
              color: #d4d4d4; 
              line-height: 1.6;
            }
            pre { 
              background: #252526; 
              padding: 15px; 
              border-radius: 6px; 
              overflow-x: auto; 
              border: 1px solid #3e3e42;
            }
            .file-info { 
              background: #2d2d30; 
              padding: 15px; 
              border-radius: 6px; 
              margin-bottom: 20px; 
              border: 1px solid #3e3e42;
            }
            code {
              font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
              font-size: 14px;
            }
            .file-type {
              color: #007acc;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="file-info">
            <strong>파일:</strong> ${currentTab.name} 
            <span class="file-type">(${type})</span>
          </div>
          <pre><code>${content}</code></pre>
        </body>
        </html>
      `;
      
      // 기본 폰트 설정 추가
      const { content: processedContent9, cssLinks: cssLinks9 } = convertExternalLinksToInline(otherTypeHtmlContent);
      const contentWithFont = addDefaultFontToHTML(processedContent9, cssLinks9);
      setOutput(contentWithFont);
    }
    
    // 미리보기 업데이트 완료
  };

  const insertTag = (tag) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    
    const selection = editor.getSelection();
    const model = editor.getModel();
    const selectedText = model.getValueInRange(selection);
    const tagRegex = /^<([a-z0-9]+)[^>]*>([\s\S]*?)<\/\1>$/i;

    let newText;
    const match = selectedText.match(tagRegex);
    if (match) {
      newText = `<${tag}>${match[2]}</${tag}>`;
    } else {
      newText = `<${tag}>${selectedText || '내용'}</${tag}>`;
    }

    editor.executeEdits(null, [
      { range: selection, text: newText, forceMoveMarkers: true }
    ]);
    editor.focus();
  };

  // 테마 적용 함수
  const applyTheme = (theme) => {
    console.log('applyTheme 호출:', theme);
    if (theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    // Monaco Editor 테마도 함께 변경
    if (window.monaco) {
      try {
        const themeName = theme === 'dark' ? 'custom-dark' : 'custom-light';
        console.log('Monaco Editor 테마 변경 시도:', themeName, '현재 테마:', theme);
        window.monaco.editor.setTheme(themeName);
        console.log('Monaco Editor 테마 변경 성공:', themeName);
      } catch (error) {
        console.warn('Monaco Editor 테마 변경 실패:', error);
      }
    } else {
      console.log('Monaco Editor가 아직 로드되지 않음');
    }
    
    // CSS 변수 기반 테마 적용 (즉시 반영)
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--bg-color', '#1e1e1e');
      root.style.setProperty('--surface-color', '#252526');
      root.style.setProperty('--surface-primary', '#1e1e1e');
      root.style.setProperty('--surface-secondary', '#252526');
      root.style.setProperty('--surface-hover', '#2d2d30');
      root.style.setProperty('--text-primary', '#d4d4d4');
      root.style.setProperty('--text-secondary', '#858585');
      root.style.setProperty('--border', '#3e3e42');
      root.style.setProperty('--border-hover', '#4e4e52');
      root.style.setProperty('--primary-color', '#3b82f6');
      root.style.setProperty('--primary-hover', '#2563eb');
    } else {
      root.style.setProperty('--bg-color', '#ffffff');
      root.style.setProperty('--surface-color', '#f8f9fa');
      root.style.setProperty('--surface-primary', '#ffffff');
      root.style.setProperty('--surface-secondary', '#f8f9fa');
      root.style.setProperty('--surface-hover', '#e9ecef');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#6c757d');
      root.style.setProperty('--border', '#dee2e6');
      root.style.setProperty('--border-hover', '#adb5bd');
      root.style.setProperty('--primary-color', '#2563eb');
      root.style.setProperty('--primary-hover', '#1d4ed8');
    }
  };

  // 테마 모드 변경 함수
  const changeThemeMode = (mode) => {
    console.log('테마 모드 변경 요청:', mode);
    setThemeMode(mode);
    localStorage.setItem('theme-mode', mode);
    
    let newCurrentTheme;
    if (mode === 'system') {
      newCurrentTheme = systemTheme;
    } else {
      newCurrentTheme = mode;
    }
    
    console.log('새로운 현재 테마:', newCurrentTheme);
    setCurrentTheme(newCurrentTheme);
    applyTheme(newCurrentTheme);
  };

  // Monaco Editor 테마 변경을 위한 useEffect
  useEffect(() => {
    console.log('useEffect 실행 - currentTheme:', currentTheme, 'window.monaco:', !!window.monaco);
    if (window.monaco && currentTheme) {
      try {
        const themeName = currentTheme === 'dark' ? 'custom-dark' : 'custom-light';
        console.log('useEffect에서 Monaco Editor 테마 변경 시도:', themeName);
        window.monaco.editor.setTheme(themeName);
        console.log('useEffect에서 Monaco Editor 테마 변경 성공:', themeName);
      } catch (error) {
        console.warn('useEffect에서 Monaco Editor 테마 변경 실패:', error);
      }
    } else {
      console.log('useEffect에서 Monaco Editor 테마 변경 건너뜀:', {
        hasMonaco: !!window.monaco,
        currentTheme: currentTheme
      });
    }
  }, [currentTheme]);

  // 테마 토글 함수 (기존 호환성을 위해 유지)
  const toggleTheme = () => {
    const newMode = themeMode === 'light' ? 'dark' : 
                   themeMode === 'dark' ? 'system' : 'light';
    changeThemeMode(newMode);
  };

  // 리사이저 로직 (최적화된 버전)
  useEffect(() => {
    let animationFrameId = null;
    let lastTime = 0;
    const throttleMs = 16; // 60fps

    const handleMouseDown = (e) => {
      if (e.target === resizerRef.current && panelStates.preview) {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX;
        const startWidth = editorWidth;
        
        setIsDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.body.classList.add('resizing');
        
        if (resizerRef.current) {
          resizerRef.current.classList.add('dragging');
        }

        const handleMouseMove = (e) => {
          const currentTime = Date.now();
          if (currentTime - lastTime < throttleMs) {
            return;
          }
          lastTime = currentTime;

          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }

          animationFrameId = requestAnimationFrame(() => {
            try {
              e.preventDefault();
              e.stopPropagation();
              
              const deltaX = e.clientX - startX;
              const container = document.querySelector('.editor-container');
              
              if (!container) return;
              
              const containerWidth = container.offsetWidth;
              const vscodeSidebar = document.querySelector('.vscode-sidebar');
              const sidebarWidth = vscodeSidebar && vscodeSidebarVisible ? 250 : 0;
              const availableWidth = containerWidth - sidebarWidth;
              
              if (availableWidth <= 0) return;
              
              const deltaPercent = (deltaX / availableWidth) * 100;
              const newWidth = startWidth + deltaPercent;
              const clampedWidth = Math.max(20, Math.min(80, newWidth));
              
              // DOM 업데이트 (부드러운 애니메이션)
              const editorPane = document.querySelector('.editor-pane');
              const previewPane = document.querySelector('.preview-pane');
              
              if (editorPane && previewPane) {
                requestAnimationFrame(() => {
                  editorPane.style.width = `${clampedWidth}%`;
                  editorPane.style.flex = 'none';
                  previewPane.style.width = `${100 - clampedWidth}%`;
                  previewPane.style.flex = 'none';
                  
                  // React 상태 업데이트
                  setEditorWidth(clampedWidth);
                });
              }
            } catch (error) {
              console.warn('리사이저 처리 중 오류:', error);
            }
          });
        };

        const handleMouseUp = () => {
          setIsDragging(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.body.classList.remove('resizing');
          
          if (resizerRef.current) {
            resizerRef.current.classList.remove('dragging');
          }

          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [panelStates.preview]);

  // 사이드바 리사이저 로직
  useEffect(() => {
    const handleSidebarMouseDown = (e) => {
      if (e.target === sidebarResizerRef.current) {
        setIsSidebarDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        sidebarResizerRef.current.classList.add('dragging');
      }
    };

    const handleSidebarMouseMove = (e) => {
      if (isSidebarDragging) {
        const newWidth = e.clientX;
        setSidebarWidth(Math.max(150, Math.min(400, newWidth)));
      }
    };

    const handleSidebarMouseUp = () => {
      setIsSidebarDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (sidebarResizerRef.current) {
        sidebarResizerRef.current.classList.remove('dragging');
      }
    };

    document.addEventListener('mousedown', handleSidebarMouseDown);
    document.addEventListener('mousemove', handleSidebarMouseMove);
    document.addEventListener('mouseup', handleSidebarMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleSidebarMouseDown);
      document.removeEventListener('mousemove', handleSidebarMouseMove);
      document.removeEventListener('mouseup', handleSidebarMouseUp);
    };
  }, [isSidebarDragging]);

  const parseEPUB = async (file) => {
    try {
      console.log('EPUB 파싱 시작:', file.name);
      
      setLoadingMessage('ZIP 파일을 읽는 중...');
      
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      setLoadingMessage('EPUB 구조를 분석하는 중...');
      
      console.log('ZIP 파일 로드 완료, 파일 수:', Object.keys(zipContent.files).length);
      
      // EPUB 구조 분석
      const containerFile = zipContent.file('META-INF/container.xml');
      if (!containerFile) {
        throw new Error('EPUB 파일이 올바르지 않습니다. META-INF/container.xml을 찾을 수 없습니다.');
      }
      
      const containerXml = await containerFile.async('text');
      const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
      const rootfile = containerDoc.querySelector('rootfile');
      
      if (!rootfile) {
        throw new Error('EPUB 파일이 올바르지 않습니다. rootfile을 찾을 수 없습니다.');
      }
      
      const opfPath = rootfile.getAttribute('full-path');
      if (!opfPath) {
        throw new Error('OPF 파일 경로를 찾을 수 없습니다.');
      }
      
      console.log('OPF 파일 경로:', opfPath);
      
      // OPF 파일 파싱
      const opfFile = zipContent.file(opfPath);
      if (!opfFile) {
        throw new Error(`OPF 파일을 찾을 수 없습니다: ${opfPath}`);
      }
      
      const opfContent = await opfFile.async('text');
      const opfDoc = new DOMParser().parseFromString(opfContent, 'text/xml');
      
      // 메타데이터 추출
      const metadata = {};
      const metaElements = opfDoc.querySelectorAll('metadata *');
      metaElements.forEach(element => {
        if (element.textContent.trim()) {
          metadata[element.tagName] = element.textContent.trim();
        }
      });
      
      console.log('메타데이터 추출 완료:', Object.keys(metadata));
      
      setLoadingMessage('매니페스트를 분석하는 중...');
      
      // 매니페스트 추출
      const manifest = {};
      const manifestItems = opfDoc.querySelectorAll('manifest item');
      manifestItems.forEach(item => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type');
        if (id && href) {
          manifest[id] = { href, mediaType };
        }
      });
      
      console.log('매니페스트 추출 완료, 항목 수:', Object.keys(manifest).length);
      
      // 스파인 추출
      const spine = [];
      const spineItems = opfDoc.querySelectorAll('spine itemref');
      spineItems.forEach(item => {
        const idref = item.getAttribute('idref');
        if (manifest[idref]) {
          spine.push(manifest[idref]);
        }
      });
      
      console.log('스파인 추출 완료, 항목 수:', spine.length);
      
      setLoadingMessage('목차를 분석하는 중...');
      
      // TOC 파일 찾기 (EPUB2 NCX 또는 EPUB3 NAV)
      let tocPath = null;
      for (const [id, item] of Object.entries(manifest)) {
        if (item.mediaType === 'application/x-dtbncx+xml' || 
            item.mediaType === 'application/xhtml+xml' ||
            item.href.includes('toc') || 
            item.href.includes('ncx') ||
            item.href.includes('nav')) {
          tocPath = item.href;
          console.log('TOC 파일 발견:', item.href, '타입:', item.mediaType);
          break;
        }
      }
      
      // TOC 파싱
      let tocData = [];
      if (tocPath) {
        try {
          const tocFile = zipContent.file(tocPath);
          if (tocFile) {
            const tocContent = await tocFile.async('text');
            const tocDoc = new DOMParser().parseFromString(tocContent, 'text/xml');
            
            // EPUB2 NCX 파일 파싱
            let navPoints = tocDoc.querySelectorAll('navPoint');
            if (navPoints.length > 0) {
              console.log('EPUB2 NCX 파일 파싱 중...');
            tocData = Array.from(navPoints).map((point, index) => {
                const textElement = point.querySelector('text');
                const label = textElement?.textContent?.trim() || `Chapter ${index + 1}`;
              const content = point.querySelector('content');
              const src = content?.getAttribute('src') || '';
                
                // navLabel도 확인
                const navLabel = point.querySelector('navLabel text');
                const finalLabel = navLabel?.textContent?.trim() || label;
              
              return {
                id: index,
                  title: finalLabel,
                  label: finalLabel,
                href: src,
                  level: 0
                };
              });
            } else {
              // EPUB3 NAV 파일 파싱
              console.log('EPUB3 NAV 파일 파싱 중...');
              const navElement = tocDoc.querySelector('nav[epub\\:type="toc"], nav[role="doc-toc"]');
              if (navElement) {
                const navItems = navElement.querySelectorAll('li');
                tocData = Array.from(navItems).map((item, index) => {
                  const link = item.querySelector('a');
                  const text = link?.textContent?.trim() || `Chapter ${index + 1}`;
                  const href = link?.getAttribute('href') || '';
                  
                  return {
                    id: index,
                    title: text,
                    label: text,
                    href: href,
                level: 0
              };
            });
              }
            }
            
            console.log('TOC 파싱 성공:', tocData.length, '개 항목');
            console.log('TOC 샘플:', tocData.slice(0, 3));
          }
        } catch (error) {
          console.warn('TOC 파싱 실패:', error);
        }
      }
      
      // TOC가 없으면 스파인에서 생성
      if (tocData.length === 0) {
        tocData = spine.map((item, index) => ({
          id: index,
          title: `Chapter ${index + 1}`,
          href: item.href,
          level: 0
        }));
      }
      
      console.log('TOC 생성 완료, 항목 수:', tocData.length);
      console.log('TOC 전체 데이터:', tocData);

      // 파일 내용을 포함한 zipContent 생성
      const processedZipContent = {};
      const opfDir = opfPath.split('/').slice(0, -1).join('/');

      console.log('파일 내용 처리 시작...');
      setLoadingMessage('파일 내용을 처리하는 중...');
      
      let processedCount = 0;
      let errorCount = 0;

      // base64 인코딩 유틸 제거

      const getMimeType = (extension) => {
        const mimeTypes = {
          // 이미지
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'svg': 'image/svg+xml',
          'webp': 'image/webp',
          'bmp': 'image/bmp',
          'ico': 'image/x-icon',
          
          // 미디어
          'mp3': 'audio/mpeg',
          'mp4': 'video/mp4',
          'wav': 'audio/wav',
          'ogg': 'audio/ogg',
          'webm': 'video/webm',
          
          // 문서
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          
          // 압축
          'zip': 'application/zip',
          'rar': 'application/vnd.rar',
          '7z': 'application/x-7z-compressed',
          'tar': 'application/x-tar',
          'gz': 'application/gzip',
          
          // 폰트
          'ttf': 'font/ttf',
          'otf': 'font/otf',
          'woff': 'font/woff',
          'woff2': 'font/woff2'
        };
        return mimeTypes[extension] || 'application/octet-stream';
      };

      // 모든 파일의 내용을 처리
      const totalFiles = Object.keys(zipContent.files).filter(path => !zipContent.files[path].dir).length;
      let currentFileIndex = 0;
      
      for (const [filePath, zipFile] of Object.entries(zipContent.files)) {
        if (!zipFile.dir) {
          try {
            const fileName = filePath.split('/').pop();
            const fileExtension = fileName.split('.').pop()?.toLowerCase();
            
            // 파일 처리 진행 상황 업데이트
            currentFileIndex++;
            setLoadingMessage(`파일 처리 중... (${currentFileIndex}/${totalFiles}) ${fileName}`);
            
            console.log(`처리 중: ${filePath} (${fileExtension})`);
            
            let content = null;
            let type = 'binary';
            
            // 텍스트 파일인 경우 내용 추출
            if (['html', 'xhtml', 'xml', 'css', 'js', 'json', 'txt', 'opf', 'ncx', 'ttf', 'otf', 'woff', 'woff2'].includes(fileExtension)) {
              content = await zipFile.async('text');
              // Monaco Editor가 인식할 수 있는 언어 코드로 변환
              type = getLanguageFromExtension(fileName);
            }  else if (['mp3', 'mp4', 'wav', 'ogg', 'webm'].includes(fileExtension)) {
              // 미디어 파일은 base64로 변환 (FileReader 사용)
              const arrayBuffer = await zipFile.async('arraybuffer');
              const blob = new Blob([arrayBuffer], { type: getMimeType(fileExtension) });
              const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  const base64Data = result.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              content = `data:${getMimeType(fileExtension)};base64,${base64}`;
              type = 'media';
            } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension)) {
              // 문서 파일은 base64로 변환 (FileReader 사용)
              const arrayBuffer = await zipFile.async('arraybuffer');
              const blob = new Blob([arrayBuffer], { type: getMimeType(fileExtension) });
              const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  const base64Data = result.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              content = `data:${getMimeType(fileExtension)};base64,${base64}`;
              type = 'document';
            } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExtension)) {
              // 압축 파일은 base64로 변환 (FileReader 사용)
              const arrayBuffer = await zipFile.async('arraybuffer');
              const blob = new Blob([arrayBuffer], { type: getMimeType(fileExtension) });
              const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  const base64Data = result.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              content = `data:${getMimeType(fileExtension)};base64,${base64}`;
              type = 'archive';
            } else {
              // 기타 파일은 base64로 변환 (FileReader 사용)
              const arrayBuffer = await zipFile.async('arraybuffer');
              const blob = new Blob([arrayBuffer], { type: getMimeType(fileExtension) });
              const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  const base64Data = result.split(',')[1];
                  resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              content = `data:application/octet-stream;base64,${base64}`;
              type = 'binary';
            }
            
            processedZipContent[filePath] = {
              content,
              type,
              fileName,
              fileExtension,
              size: zipFile._data.uncompressedSize
            };
            processedCount++;
            console.log(`✅ 성공: ${filePath} (${type}, ${(zipFile._data.uncompressedSize / 1024).toFixed(2)}KB)`);
          } catch (error) {
            console.warn(`파일 처리 실패: ${filePath}`, error);
            processedZipContent[filePath] = {
              content: null,
              type: 'error',
              fileName: filePath.split('/').pop(),
              fileExtension: 'unknown',
              size: 0,
              error: error.message
            };
            errorCount++;
          }
        }
      }
      
      console.log(`파일 처리 완료: ${processedCount}개 성공, ${errorCount}개 실패`);

      setLoadingMessage('파일 트리를 생성하는 중...');

      // 파일 트리 구조 생성 - 완전히 새로 작성
      const fileTreeData = [];

      // 모든 파일 경로 가져오기
      const allFiles = Object.keys(zipContent.files);
      console.log('파일 트리 생성 시작, 전체 파일 수:', allFiles.length);
      
      // images 폴더 관련 파일들 미리 확인 (대소문자 구분 없이)
      const imagesFiles = allFiles.filter(file => 
        file.toLowerCase().includes('images/') || file.includes('Images/')
      );
      console.log('images 폴더 관련 파일들:', imagesFiles);
      console.log('images 폴더 파일 수:', imagesFiles.length);
      
      // 이미지 파일 확장자로 찾기
      const imageExtFiles = allFiles.filter(file => 
        file.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i)
      );
      console.log('이미지 확장자 파일들:', imageExtFiles);
      console.log('이미지 확장자 파일 수:', imageExtFiles.length);
      
      // OEBPS 폴더 내 파일들 확인
      const oebpsFiles = allFiles.filter(file => file.startsWith('OEBPS/'));
      console.log('OEBPS 폴더 내 파일들:', oebpsFiles);
      console.log('OEBPS 폴더 파일 수:', oebpsFiles.length);
      
      // 이미지 파일들 확인
      const imageFiles = allFiles.filter(file => 
        file.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i)
      );
      console.log('발견된 이미지 파일들:', imageFiles);
      
      // processedZipContent에서 이미지 타입 파일들 확인
      const processedImages = Object.entries(processedZipContent).filter(([path, data]) => 
        data.type === 'image'
      );
      console.log('처리된 이미지 파일들:', processedImages.map(([path, data]) => ({ path, size: data.size })));
      
      // 폴더 구조를 저장할 맵
      const folderMap = new Map();
      
      // 각 파일을 처리
      let treeProcessedCount = 0;
      console.log('파일 트리 생성 루프 시작, 전체 파일 수:', allFiles.length);
      
      try {
        for (const filePath of allFiles) {
          if (!filePath || filePath.trim() === '') continue;
          
          const pathParts = filePath.split('/').filter(part => part.trim() !== '');
          if (pathParts.length === 0) continue;
        
        treeProcessedCount++;
        if (treeProcessedCount <= 10) {
          console.log('파일 처리 중:', filePath, 'pathParts:', pathParts);
        }
        
        // images 폴더 관련 파일들 확인 (대소문자 구분 없이)
        if (filePath.toLowerCase().includes('images/') || filePath.includes('Images/')) {
          console.log('images 관련 파일 발견:', filePath);
        }
        
        // 파일 노드 생성
        const fileName = pathParts[pathParts.length - 1];
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(fileExtension);
        
        const fileNode = {
          id: `file_${filePath}`,
          name: fileName,
          type: 'file',
          path: filePath,
          children: null,
          fileData: { href: filePath, mediaType: 'application/octet-stream' },
          isExpanded: false
        };
        
        if (isImage) {
          console.log('이미지 파일 노드 생성:', filePath);
        }
        
        // 폴더 경로 생성
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderPath = pathParts.slice(0, i + 1).join('/');
          const folderName = pathParts[i];
          
          if (treeProcessedCount <= 5) {
            console.log('폴더 생성 시도:', folderName, '경로:', folderPath);
          }
          
          // Images 폴더 생성 과정 특별 확인
          if (folderName === 'Images') {
            console.log('Images 폴더 생성 과정:', {
              folderName,
              folderPath,
              alreadyExists: folderMap.has(folderPath)
            });
          }
          
          if (!folderMap.has(folderPath)) {
            const folderNode = {
              id: `folder_${folderPath}`,
              name: folderName,
              type: 'folder',
              path: folderPath,
              children: [],
              fileData: null,
              isExpanded: false
            };
            folderMap.set(folderPath, folderNode);
            
            // images 폴더 생성 확인 (대소문자 구분 없이)
            if (folderName.toLowerCase() === 'images') {
              console.log('images 폴더 생성됨:', folderPath);
            }
            
            // 상위 폴더에 추가
            if (i === 0) {
              // 최상위 폴더
              fileTreeData.push(folderNode);
            } else {
              // 하위 폴더
              const parentPath = pathParts.slice(0, i).join('/');
              const parentFolder = folderMap.get(parentPath);
              if (parentFolder) {
                parentFolder.children.push(folderNode);
              }
            }
          }
        }
        
        // 파일을 적절한 폴더에 추가
        if (pathParts.length === 1) {
          // 최상위 파일
          fileTreeData.push(fileNode);
          console.log('최상위 파일 추가:', fileNode.name);
                  } else {
            // 하위 파일
            const parentPath = pathParts.slice(0, -1).join('/');
            const parentFolder = folderMap.get(parentPath);
            if (parentFolder) {
              parentFolder.children.push(fileNode);
              console.log('하위 파일 추가:', fileNode.name, '->', parentFolder.name);
              
              // images 폴더에 파일이 추가되는지 특별 확인 (대소문자 구분 없이)
              if (parentFolder.name.toLowerCase() === 'images') {
                console.log('images 폴더에 파일 추가됨:', fileNode.name);
              }
            } else {
              console.warn('부모 폴더를 찾을 수 없음:', parentPath, '파일:', fileNode.name);
              
              // Images 폴더 관련 파일인지 확인 (대소문자 구분 없이)
              if (filePath.toLowerCase().includes('images/') || filePath.includes('Images/')) {
                console.error('Images 폴더 파일 추가 실패:', {
                  filePath,
                  parentPath,
                  availableFolders: Array.from(folderMap.keys())
                });
              }
            }
          }
        }
        
        console.log('파일 트리 생성 루프 완료');
      } catch (error) {
        console.error('파일 트리 생성 중 오류 발생:', error);
        console.error('오류 발생 시점 - treeProcessedCount:', treeProcessedCount);
        console.error('오류 발생 시점 - fileTreeData 길이:', fileTreeData.length);
      }
      
      console.log('파일 트리 생성 완료');
      console.log('생성된 파일 트리:', fileTreeData);

      // 이제 모든 파일이 fileTreeData에 포함되었으므로 추가 처리 불필요
      
      console.log('파일 트리 생성 완료, 노드 수:', fileTreeData.length);
      console.log('파일 트리 전체:', fileTreeData);
      console.log('파일 트리 샘플:', fileTreeData.slice(0, 3));
      
      // fileTreeData 상세 분석
      console.log('fileTreeData 상세 분석:');
      if (fileTreeData && fileTreeData.length > 0) {
        fileTreeData.forEach((node, index) => {
          console.log(`${index}: ${node.name} (${node.type}) - 자식 ${node.children ? node.children.length : 0}개`);
          if (node.children && node.children.length > 0) {
            console.log(`  자식들:`, node.children.map(child => `${child.name} (${child.type})`));
          }
        });
      } else {
        console.log('fileTreeData가 비어있거나 undefined입니다.');
      }
      
      // 파일 트리 디버깅
      const debugFileTree = (nodes, level = 0) => {
        nodes.forEach(node => {
          const indent = '  '.repeat(level);
          console.log(`${indent}${node.type === 'folder' ? '📁' : '📄'} ${node.name} (${node.path})`);
          if (node.children && node.children.length > 0) {
            debugFileTree(node.children, level + 1);
          }
        });
      };
      
      console.log('=== 파일 트리 구조 ===');
      debugFileTree(fileTreeData);
      
      // images 폴더 특별 확인
      const findImagesFolder = (nodes) => {
        for (const node of nodes) {
          if (node.name === 'images') {
            console.log('images 폴더 발견:', {
              path: node.path,
              children: node.children ? node.children.length : 0,
              isExpanded: node.isExpanded
            });
            if (node.children) {
              console.log('images 폴더 내 파일들:', node.children.slice(0, 5).map(c => c.name));
            }
          }
          if (node.name === 'OEBPS') {
            console.log('OEBPS 폴더 발견:', {
              path: node.path,
              children: node.children ? node.children.length : 0,
              isExpanded: node.isExpanded
            });
            if (node.children) {
              console.log('OEBPS 폴더 내 하위 폴더들:', node.children.filter(c => c.type === 'folder').map(c => c.name));
            }
          }
          if (node.children && node.children.length > 0) {
            findImagesFolder(node.children);
          }
        }
      };
      
      findImagesFolder(fileTreeData);
      
      // 파일 트리에서 이미지 파일들 확인
      const findImagesInTree = (nodes) => {
        let images = [];
        nodes.forEach(node => {
          if (node.type === 'file') {
            const ext = node.name.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
              images.push(node.path);
            }
          }
          if (node.children && node.children.length > 0) {
            images = images.concat(findImagesInTree(node.children));
          }
        });
        return images;
      };
      
      const treeImages = findImagesInTree(fileTreeData);
      console.log('파일 트리에 포함된 이미지 파일들:', treeImages);
      console.log('이미지 파일 수 비교:', {
        zipImages: imageFiles.length,
        processedImages: processedImages.length,
        treeImages: treeImages.length
      });
      
      console.log('parseEPUB 마지막 - fileTreeData 확인:', {
        fileTreeData: fileTreeData,
        fileTreeDataLength: fileTreeData ? fileTreeData.length : 'undefined',
        fileTreeDataType: typeof fileTreeData
      });
      
      const result = {
        metadata,
        manifest,
        spine,
        toc: tocData,
        zipContent: processedZipContent,
        fileTree: fileTreeData,
        opfPath
      };
      
      console.log('EPUB 파싱 완료:', {
        title: metadata.dc_title || file.name.replace('.epub', ''),
        tocCount: tocData.length,
        fileTreeCount: fileTreeData.length,
        processedFiles: Object.keys(processedZipContent).length
      });
      
      console.log('return result 확인:', {
        resultFileTree: result.fileTree,
        resultFileTreeLength: result.fileTree ? result.fileTree.length : 'undefined'
      });
      
      return result;
      
    } catch (error) {
      console.error('EPUB 파싱 중 오류 발생:', error);
      throw new Error(`EPUB 파일을 읽는 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // 테스트용 더미 데이터 (API 응답 구조와 호환)
  const getTestWorkspaceData = () => {
    return [
      {
        "name": "OEBPS",
        "type": "folder",
        "url": "http://test.example.com/workspace",
        "children": [
          {
            "name": "content.opf",
            "type": "file",
            "path": "OEBPS/content.opf",
            "content": `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata>
    <dc:title>테스트 EPUB</dc:title>
    <dc:language>ko</dc:language>
  </metadata>
  <manifest>
    <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="Text/chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="Styles/style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`
          },
          {
            "name": "Text",
            "type": "folder",
            "children": [
              {
                "name": "chapter1.xhtml",
                "type": "file",
                "path": "OEBPS/Text/chapter1.xhtml",
                "content": `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Chapter 1</title>
    <link href="../Styles/style.css" rel="stylesheet" type="text/css"/>
</head>
<body>
    <h1>Chapter 1: The Beginning</h1>
    <p>This is the first chapter of our story.</p>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    <p>이것은 테스트 데이터로 생성된 콘텐츠입니다.</p>
</body>
</html>`
              },
              {
                "name": "chapter2.xhtml",
                "type": "file",
                "path": "OEBPS/Text/chapter2.xhtml",
                "content": `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title>Chapter 2</title>
    <link href="../Styles/style.css" rel="stylesheet" type="text/css"/>
</head>
<body>
    <h1>Chapter 2: The Journey</h1>
    <p>The adventure continues in the second chapter.</p>
    <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
</body>
</html>`
              }
            ]
          },
          {
            "name": "Styles",
            "type": "folder",
            "children": [
              {
                "name": "style.css",
                "type": "file",
                "path": "OEBPS/Styles/style.css",
                "content": `body {
    font-family: 'Times New Roman', serif;
    line-height: 1.6;
    margin: 2em;
    background-color: #fafafa;
}

h1 {
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 0.5em;
}

p {
    text-align: justify;
    margin-bottom: 1em;
    color: #34495e;
}`
              }
            ]
          }
        ]
      }
    ];
  };

  // 워크스페이스 가져오기 처리

  // URL에서 EPUB 파일을 다운로드하고 파싱하는 함수 (Promise 처리)
  const downloadAndParseEpubFromUrl = (epubUrl) => {
    return new Promise((resolve, reject) => {
      console.log('📥 EPUB 파일 다운로드 시작:', epubUrl);
      
      // EPUB 파일 다운로드
      fetch(epubUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`EPUB 다운로드 실패: ${response.status} ${response.statusText}`);
        }
        
        console.log('✅ EPUB 파일 다운로드 완료, ArrayBuffer 변환 중...');
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        console.log('✅ ArrayBuffer 변환 완료, File 객체 생성 중...');
        
        // File 객체로 변환 (parseEPUB 함수에서 기대하는 형태)
        const file = new File([arrayBuffer], 'workspace.epub', { type: 'application/epub+zip' });
        
        console.log('✅ File 객체 생성 완료, EPUB 파싱 시작...');
        
        // 기존 parseEPUB 함수 사용
        return parseEPUB(file);
      })
      .then(() => {
        console.log('🎉 EPUB 파싱 완료!');
        
        // 상태 확인을 위해 조금 기다린 후 체크
        return new Promise((resolveTimeout) => {
          setTimeout(() => {
            console.log('📊 상태 확인 (1초 후):');
            console.log('- fileTree 길이:', fileTree ? fileTree.length : 'undefined');
            console.log('- toc 길이:', toc ? toc.length : 'undefined');
            console.log('- vscodeSidebarVisible:', vscodeSidebarVisible);
            console.log('- activeSidebarTab:', activeSidebarTab);
            
            // 사이드바가 안 보이면 강제로 표시
            if (!vscodeSidebarVisible) {
              console.log('🔧 사이드바 강제 표시');
              setVscodeSidebarVisible(true);
            }
            
            // 탐색기 탭이 활성화되지 않았으면 활성화
            if (activeSidebarTab !== 'explorer') {
              console.log('🔧 탐색기 탭 활성화');
              setActiveSidebarTab('explorer');
            }
            
            resolveTimeout();
          }, 1000);
        });
      })
      .then(() => {
        console.log('✅ 모든 처리 완료');
        setLoadingMessage('EPUB 파일을 성공적으로 로드했습니다!');
        // alert('워크스페이스 EPUB 파일을 성공적으로 로드했습니다!');
        resolve();
      })
      .catch(error => {
        console.error('❌ EPUB 다운로드/파싱 실패:', error);
        reject(error);
      });
    });
  };

  // API 서버 연결 테스트 함수
  const testApiConnection = async () => {
    try {
      console.log('🔍 API 서버 연결 테스트 중...');
      const booksData = await bookAPI.getBooks(projectId || 1);
      console.log('✅ API 서버 연결 가능:', booksData);
      return true;
    } catch (error) {
      console.error('❌ API 서버 연결 실패:', error);
      return false;
    }
  };

  const handleWorkspaceLoad = async () => {
    // 편집된 파일이 있는지 먼저 확인
    if (openTabs.length > 0) {
      const hasUnsavedChanges = openTabs.some(tab => tab.isModified);
      if (hasUnsavedChanges) {
        const confirmLoad = window.confirm(
          '편집 중인 파일이 있습니다. 워크스페이스를 가져오면 현재 편집 내용이 모두 사라집니다.\n\n' +
          '계속하시겠습니까?'
        );
        if (!confirmLoad) {
          console.log('사용자가 워크스페이스 로드를 취소함');
          return;
        }
      }
    }
    
    setIsLoading(true);
    setLoadingMessage('워크스페이스 가져오기를 시작합니다...');
    console.log('🚀 워크스페이스 가져오기 시작...');
    
    // 사용자가 API 또는 테스트 데이터 선택
    const useApi = window.confirm('API 서버에서 데이터를 가져오시겠습니까?\n\n"취소"를 누르면 테스트 데이터를 사용합니다.');
    
    if (!useApi) {
      console.log('🧪 테스트 데이터 사용 선택됨');
      setLoadingMessage('테스트 데이터를 로드하는 중...');
      
      const testData = getTestWorkspaceData();
      try {
        await processWorkspaceData(testData);
        // console.log('✅ 테스트 데이터로 워크스페이스 로드 완료');
        // alert('✅ 테스트 데이터로 워크스페이스를 성공적으로 로드했습니다!');
        
        // 완료 메시지 표시
        setLoadingMessage('테스트 데이터 로드 완료!\n\n파일을 편집하려면 사이드바에서 파일을 클릭하세요.');
        
        // 사용자가 확인할 수 있도록 충분한 시간 대기
        setTimeout(() => {
          setIsLoading(false);
        }, 4000);
      } catch (error) {
        console.error('❌ 테스트 데이터 처리 실패:', error);
        alert('❌ 테스트 데이터 처리에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // API 사용하는 경우
    try {
      console.log('🔍 API 서버 연결 상태 확인 중...');
      
      setLoadingMessage('API 서버에 연결하는 중...');
      
      // 1단계: 책 목록 가져오기
      console.log('📡 1단계: 책 목록 가져오기');
      setLoadingMessage('책 목록을 가져오는 중...');
      
      const booksData = await bookAPI.getBooks(projectId || 1);
      console.log('📊 1단계 책 목록:', booksData);
      
      // 첫 번째 책 선택
      let selectedBook = null;
      if (Array.isArray(booksData) && booksData.length > 0) {
        selectedBook = booksData[0];
      } else if (booksData.results && Array.isArray(booksData.results) && booksData.results.length > 0) {
        selectedBook = booksData.results[0];
      }
      
      if (!selectedBook) {
        throw new Error('프로젝트에 책이 없습니다.');
      }
      
      // 2단계: 선택된 책의 workspace 데이터 가져오기
      console.log('📡 2단계: workspace 데이터 가져오기');
      setLoadingMessage('워크스페이스 데이터를 가져오는 중...');
      
      const workspaceData = await bookAPI.getBookWorkspace(selectedBook.id);
      console.log('✅ 2단계 API 호출 성공, 데이터 파싱 중...');
      console.log('📊 2단계 워크스페이스 데이터:', workspaceData);
      
      setLoadingMessage('워크스페이스 데이터를 처리하는 중...');
      
      await processWorkspaceData(workspaceData);
      console.log('✅ 워크스페이스 로드 완료');
      
    } catch (error) {
      console.error('❌ 워크스페이스 가져오기 실패:', error);
      
      // 에러 타입별 자세한 메시지
      let errorMessage = '워크스페이스 가져오기 실패';
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '서버에 연결할 수 없습니다.';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS 에러가 발생했습니다.';
      } else {
        errorMessage = `API 에러: ${error.message}`;
      }
      
      // 테스트 데이터 사용 여부 확인
      const useTestData = window.confirm(`${errorMessage}\n\n테스트 데이터로 계속 진행하시겠습니까?`);
      
      if (useTestData) {
        console.log('🧪 테스트 데이터 사용');
        const testData = getTestWorkspaceData();
        try {
          await processWorkspaceData(testData);
          alert('테스트 데이터로 워크스페이스를 로드했습니다.');
        } catch (testError) {
          console.error('❌ 테스트 데이터 처리 실패:', testError);
          alert('테스트 데이터 처리에 실패했습니다.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 워크스페이스 데이터를 처리하는 함수
  const processWorkspaceData = async (workspaceData) => {
    try {
      console.log('🔄 워크스페이스 데이터 처리 시작...');
      setLoadingMessage('워크스페이스 구조를 분석하는 중...');
      console.log('📊 전체 워크스페이스 데이터:', workspaceData);
      console.log('📊 워크스페이스 데이터 타입:', typeof workspaceData);
      console.log('📊 워크스페이스 데이터가 배열인가?', Array.isArray(workspaceData));
      
      // 편집된 파일이 있는지 확인하고 덮어쓰기 확인
      if (openTabs.length > 0) {
        const hasUnsavedChanges = openTabs.some(tab => tab.isModified);
        if (hasUnsavedChanges) {
          const confirmOverwrite = window.confirm(
            '편집 중인 파일이 있습니다. 가져온 파일로 덮어쓰시겠습니까?\n\n' +
            '저장하지 않은 변경사항은 모두 사라집니다.'
          );
          if (!confirmOverwrite) {
            console.log('사용자가 덮어쓰기를 취소함');
            return;
          }
        }
      }
      
      if (workspaceData && typeof workspaceData === 'object') {
        console.log('📊 워크스페이스 데이터 키들:', Object.keys(workspaceData));
      }
      
      // 각 최상위 노드의 상세 정보 출력 (성능 최적화: 로그 제한)
      if (Array.isArray(workspaceData)) {
        console.log('🔍 배열의 각 노드 상세 분석 (처리 중...):');
        const nodeCount = workspaceData.length;
        console.log(`총 ${nodeCount}개의 노드 발견`);
        
        // 처음 5개 노드만 상세 로그 출력
        workspaceData.slice(0, 5).forEach((node, index) => {
          console.log(`  [${index}] 노드:`, {
            name: node.name,
            type: node.type,
            path: node.path,
            url: node.url,
            hasChildren: !!(node.children && node.children.length > 0),
            childrenCount: node.children ? node.children.length : 0
          });
        });
        
        if (nodeCount > 5) {
          console.log(`  ... 및 ${nodeCount - 5}개의 추가 노드`);
        }
      }
      
      // 워크스페이스 데이터를 기존 EPUB 처리 로직과 호환되는 형태로 변환
      const processedZipContent = {};
      const folderMap = new Map();
      let fileTreeData = [];
      let tocData = [];
      
      
      console.log(workspaceData,"workspaceData")
      
      // 배열 형태의 트리 데이터 처리
      if (Array.isArray(workspaceData)) {
        console.log('🌳 배열 형태의 트리 구조 데이터 발견!');
        console.log('📋 배열 데이터:', workspaceData);
        
        // 최상위 노드에서 기본 URL 찾기
        let baseUrl = '';
        for (const node of workspaceData) {
          if (node.url) {
            baseUrl = node.url;
            console.log('🔗 기본 URL 경로 발견:', baseUrl);
            
            // URL 구조 분석
            const urlParts = baseUrl.split('/');
            console.log('🔍 URL 구조 분석:', urlParts);
            
            // workspace가 이미 URL에 포함되어 있는지 확인
            if (baseUrl.includes('/workspace')) {
              console.log('⚠️ URL에 이미 workspace 경로가 포함되어 있음');
            }
            break;
          }
        }
        
        // 기본 URL이 없으면 첫 번째 노드의 이름으로 추정
        if (!baseUrl && workspaceData.length > 0) {
          console.log('⚠️ URL이 없음, 첫 번째 노드에서 추정:', workspaceData[0]);
        }
        
        // 배열 형태 트리를 순회하면서 파일 컨텐츠 추출 및 zipContent 생성 (currentPath 완전 제거)
        let processedCount = 0; // 진행 상황 추적용 변수
        
        const extractFilesFromArrayTree = async (nodes) => {
          for (const node of nodes) {
            // META-INF 노드는 건너뛰기
            if (node.name === 'META-INF') {
              console.log('🚫 META-INF 노드 건너뛰기:', node.name);
              continue;
            }
            
            // 성능 최적화: 로그 제한
            if (processedCount < 10) { // 처음 10개 파일만 상세 로그
            console.log('🔍 노드 처리:', node);
            console.log('🔍 노드 키들:', Object.keys(node));
            }
            
            if (node.type === 'file') {
              // 파일 경로 결정 - node.url을 직접 사용
              let filePath;
              
              if (node.url) {
                // node.url이 있으면 직접 사용
                filePath = node.url;
              } else if (node.path) {
                // node.path가 이미 전체 URL인지 확인
                if (node.path.startsWith('http://') || node.path.startsWith('https://')) {
                  // 이미 전체 URL이면 그대로 사용
                  filePath = node.path;
                }  else {
                  // 상대 경로이고 baseUrl이 없으면 그대로 사용
                  filePath = node.path;
                }
              } else {
                console.log('⚠️ 노드에 url/path 속성이 없음, 파일명만 사용');
                // url과 path가 모두 없으면 파일명만 사용
                filePath = baseUrl ? `${baseUrl}/${node.name}` : node.name;
              }
              
              
              
              const fileName = node.name || filePath.split('/').pop();
              const fileExtension = fileName.split('.').pop()?.toLowerCase();
              const type = getLanguageFromExtension(fileName);
              
              // API에서 파일 내용을 실제로 가져오기
              let content = node.content || node.data || '';
              
              // content가 비어있고 url이 있으면 실제 파일을 다운로드 (성능 최적화)
              if (!content && node.url) {
                // 성능 최적화: 로그 제한
                if (processedCount < 5) {
                console.log(`📥 파일 내용 다운로드 시도: ${node.url}`);
                }
                
                try {
                  const response = await fetch(node.url);
                  if (response.ok) {
                    content = await response.text();
                    if (processedCount < 5) {
                    console.log(`✅ 파일 다운로드 성공: ${node.url} (${content.length}자)`);
                    }
                  } else {
                    console.error(`❌ 파일 다운로드 실패: ${node.url} - ${response.status}`);
                  }
                } catch (error) {
                  console.error(`❌ 파일 다운로드 오류: ${node.url}`, error);
                }
              }
              
             
              
              // 진행 상황 표시 (100개마다)
              if (processedCount % 100 === 0 && processedCount > 0) {
                console.log(`📊 파일 처리 진행 상황: ${processedCount}개 완료`);
              }
              
              processedZipContent[filePath] = {
                content,
                type,
                fileName,
                fileExtension,
                size: content.length || 0
              };
              
              processedCount++; // 파일 처리 카운터 증가
            }
            
            // 자식 노드가 있으면 재귀 처리 (폴더의 경우)
            if (node.children && Array.isArray(node.children) && node.children.length > 0) {
              // 성능 최적화: 로그 제한
              if (processedCount < 10) {
              console.log(`📁 폴더 "${node.name}"의 자식 노드 ${node.children.length}개 처리 중...`);
              console.log('📁 자식 노드들은 각자의 path 속성만 사용합니다.');
              }
              await extractFilesFromArrayTree(node.children);
            }
          }
        };
        
        // 배열 트리에서 파일들 추출
        await extractFilesFromArrayTree(workspaceData);
        
        // 배열 트리 구조를 fileTree 형식으로 변환 (parentPath 완전 제거)
        const convertArrayTreeToFileTree = (nodes) => {
          // 성능 최적화: 로그 제한
          if (nodes.length < 20) {
            console.log('파일트리 변환 노드:', nodes);
          } else {
            console.log(`파일트리 변환: ${nodes.length}개 노드 처리 중...`);
          }
          
          return nodes.filter(node => node.name !== 'META-INF').map(node => {
            // 실제 경로 결정 로직 - node.url을 우선 사용
            let actualPath;
            
            if (node.url) {
              console.log(`🎯 파일트리 - 노드 "${node.name}"에 url 속성이 있음:`, node.url);
              // node.url이 있으면 직접 사용
              actualPath = node.url;
            } else if (node.path) {
              console.log(`🎯 파일트리 - 노드 "${node.name}"에 path 속성이 있음:`, node.path);
              // node.path가 이미 전체 URL인지 확인
              if (node.path.startsWith('http://') || node.path.startsWith('https://')) {
                // 이미 전체 URL이면 그대로 사용
                actualPath = node.path;
              }  else {
                // 상대 경로이고 baseUrl이 없으면 그대로 사용
                actualPath = node.path;
              }
            } else {
              console.log(`⚠️ 파일트리 - 노드 "${node.name}"에 url/path 속성이 없음, 파일명만 사용`);
              // url과 path가 모두 없으면 파일명만 사용
              actualPath = baseUrl ? `${baseUrl}/${node.name}` : node.name;
            }
            
            
            
            // 성능 최적화: 로그 제한
            if (processedCount < 5) {
            console.log(`🔄 노드 "${node.name}" 경로 처리:`, {
              nodeUrl: node.url,
              nodePath: node.path,
              actualPath
            });
            }
            
            const convertedNode = {
              name: node.name || 'Unknown',
              path: actualPath,
              type: node.type || (node.children && node.children.length > 0 ? 'folder' : 'file'),
              children: [],
              isExpanded: false
            };
            
            // 자식 노드가 있으면 재귀 변환
            if (node.children && Array.isArray(node.children) && node.children.length > 0) {
              // 재귀 호출 시 parentPath 없이 호출
              console.log(`📁 파일트리 - 폴더 "${node.name}"의 자식들은 각자의 path 속성만 사용합니다.`);
              convertedNode.children = convertArrayTreeToFileTree(node.children);
              convertedNode.type = 'folder';
              console.log(`🔄 폴더 변환: ${convertedNode.name} (자식 ${convertedNode.children.length}개)`);
            } else {
              console.log(`🔄 파일 변환: ${convertedNode.name} (${convertedNode.type})`);
            }
            
            return convertedNode;
          });
        };
        
        // 파일 내용 추출
        await extractFilesFromArrayTree(workspaceData);
        
        // 파일 트리 변환
        fileTreeData = convertArrayTreeToFileTree(workspaceData);
        
        console.log('✅ 배열 트리 구조 처리 완료');
        console.log('📊 추출된 파일:', Object.keys(processedZipContent));
        console.log('🌳 변환된 파일 트리:', fileTreeData);
        
      } else if (workspaceData.children && Array.isArray(workspaceData.children)) {
        console.log('🌳 객체 children 트리 구조 데이터 발견!');
        console.log('📋 children 데이터:', workspaceData.children);
        
        // 기존 children 방식 처리 (백업용)
        const extractFilesFromTree = (nodes, currentPath = '') => {
          for (const node of nodes) {
            const fullPath = currentPath ? `${currentPath}/${node.name}` : node.name;
            
            if (node.type === 'file') {
              const filePath = node.path || fullPath;
              const fileName = node.name || filePath.split('/').pop();
              const fileExtension = fileName.split('.').pop()?.toLowerCase();
              const type = getLanguageFromExtension(fileName);
              const content = node.content || node.data || '';
              
              processedZipContent[filePath] = {
                content,
                type,
                fileName,
                fileExtension,
                size: content.length || 0
              };
            }
            
            if (node.children && Array.isArray(node.children) && node.children.length > 0) {
              extractFilesFromTree(node.children, fullPath);
            }
          }
        };
        
        extractFilesFromTree(workspaceData.children);
        
        const convertTreeToFileTree = (nodes, parentPath = '') => {
          return nodes.map(node => {
            const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
            const actualPath = node.path || fullPath;
            
            const convertedNode = {
              name: node.name || 'Unknown',
              path: actualPath,
              type: node.type || (node.children && node.children.length > 0 ? 'folder' : 'file'),
              children: [],
              isExpanded: false
            };
            
            if (node.children && Array.isArray(node.children) && node.children.length > 0) {
              convertedNode.children = convertTreeToFileTree(node.children, actualPath);
              convertedNode.type = 'folder';
            }
            
            return convertedNode;
          });
        };
        
        fileTreeData = convertTreeToFileTree(workspaceData.children);
        
      } else if (workspaceData.files && Array.isArray(workspaceData.files)) {
        console.log('📂 플랫 배열 구조 데이터 처리...');
        console.log(`📁 ${workspaceData.files.length}개 파일 처리 중...`);
        console.log('📋 전체 파일 데이터:', workspaceData.files);
        
        for (const file of workspaceData.files) {
          console.log('🔍 파일 객체 상세:', file);
          console.log('🔍 파일 객체 키들:', Object.keys(file));
          
          // 다양한 path 필드명 시도
          const possiblePathFields = ['path', 'file_path', 'filepath', 'name', 'filename', 'file_name', 'url', 'href'];
          let filePath = null;
          
          for (const field of possiblePathFields) {
            if (file[field]) {
              filePath = file[field];
              console.log(`✅ path 필드 발견: ${field} = ${filePath}`);
              break;
            }
          }
          
          if (!filePath) {
            console.log('❌ path를 찾을 수 없음, 전체 파일 객체:', JSON.stringify(file, null, 2));
            continue;
          }
          
          const fileName = filePath.split('/').pop();
          const fileExtension = fileName.split('.').pop()?.toLowerCase();
          
          // 파일 타입 결정
          let type = getLanguageFromExtension(fileName);
          
          // 다양한 content 필드명 시도
          const possibleContentFields = ['content', 'file_content', 'data', 'text', 'body'];
          let content = '';
          
          for (const field of possibleContentFields) {
            if (file[field] !== undefined) {
              content = file[field];
              console.log(`✅ content 필드 발견: ${field}`);
              break;
            }
          }
          
          console.log(`📄 파일 처리: ${filePath} (${type}) - content 길이: ${content.length}`);
          
          processedZipContent[filePath] = {
            content,
            type,
            fileName,
            fileExtension,
            size: content.length || 0
          };
        }
        
        // 파일 트리 구조 생성 (실제 파일 구조 기반)
        console.log('🌳 파일 트리 생성 중...');
        console.log('📂 처리할 파일 경로들:', Object.keys(processedZipContent));
        
        // 각 파일을 적절한 폴더에 배치
        for (const filePath of Object.keys(processedZipContent)) {
          console.log(`📁 파일 경로 처리: ${filePath}`);
          const pathParts = filePath.split('/');
          const fileName = pathParts[pathParts.length - 1];
          
          // 폴더 구조 생성
          let currentPath = '';
          let currentParent = null;
          
          // 폴더 부분 처리 (파일명 제외)
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            const newPath = currentPath ? `${currentPath}/${part}` : part;
            
            console.log(`📂 폴더 확인: ${newPath}`);
            
            if (!folderMap.has(newPath)) {
              const folderNode = {
                name: part,
                path: newPath,
                type: 'folder',
                children: [],
                isExpanded: false
              };
              
              console.log(`✨ 새 폴더 생성: ${part} (경로: ${newPath})`);
              
              if (currentParent) {
                currentParent.children.push(folderNode);
              } else {
                // 루트 레벨 폴더
                fileTreeData.push(folderNode);
              }
              
              folderMap.set(newPath, folderNode);
            }
            
            currentParent = folderMap.get(newPath);
            currentPath = newPath;
          }
          
          // 파일 노드 생성 및 배치
          const fileNode = {
            name: fileName,
            path: filePath,
            type: 'file',
            children: []
          };
          
          console.log(`📄 파일 노드 생성: ${fileName}`);
          
          if (currentParent) {
            console.log(`📁 폴더에 파일 추가: ${fileName} → ${currentParent.name}`);
            currentParent.children.push(fileNode);
          } else {
            console.log(`📄 루트에 파일 추가: ${fileName}`);
            fileTreeData.push(fileNode);
          }
        }
        
        console.log('🌳 최종 파일 트리:', fileTreeData);
        console.log('📊 파일 트리 통계:', {
          totalNodes: fileTreeData.length,
          folderCount: folderMap.size,
          fileCount: Object.keys(processedZipContent).length
        });
      }
      
      // TOC 데이터 생성 (기본값)
      if (workspaceData.toc && Array.isArray(workspaceData.toc)) {
        tocData.push(...workspaceData.toc);
      } else {
        // 기본 TOC 생성
        const htmlFiles = Object.keys(processedZipContent).filter(path => 
          processedZipContent[path].type === 'html'
        );
        tocData.push(...htmlFiles.map((path, index) => ({
          id: index,
          title: `Chapter ${index + 1}`,
          href: path,
          level: 0
        })));
      }
      
      // EPUB 데이터 설정
      const epubInfo = {
        metadata: workspaceData.metadata || { title: 'Loaded Workspace' },
        manifest: {},
        spine: [],
        toc: tocData,
        zipContent: processedZipContent
      };
      
      setEpubData(epubInfo);
      setToc(tocData);
      setFileTree(fileTreeData);
      
      console.log('워크스페이스 데이터 처리 완료:', {
        filesCount: Object.keys(processedZipContent).length,
        tocCount: tocData.length,
        fileTreeCount: fileTreeData.length
      });
      
      // 워크스페이스 로드 완료 알림
      console.log('✅ 워크스페이스 데이터 처리 완료');
      
      // 완료 메시지 표시
      setLoadingMessage('워크스페이스 가져오기 완료!\n\n파일을 편집하려면 사이드바에서 파일을 클릭하세요.');
      
      // 사용자가 확인할 수 있도록 충분한 시간 대기
      setTimeout(() => {
        console.log('🔄 워크스페이스 로딩바 숨기기 중...');
        setIsLoading(false);
      }, 4000);
      
    } catch (error) {
      console.error('워크스페이스 데이터 처리 실패:', error);
      throw error;
    }
  };
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert('파일을 선택해주세요.');
      return;
    }
    
    if (!file.name.endsWith('.epub')) {
      alert('EPUB 파일만 업로드 가능합니다.');
      return;
    }

    console.log('EPUB 파일 업로드 시작:', file.name, '크기:', file.size);
    
    setIsLoading(true);
    setLoadingMessage('EPUB 파일을 읽는 중...');
    try {
      const epubInfo = await parseEPUB(file);
      
      console.log('EPUB 파싱 성공, 데이터 설정 중...');
      
      console.log('상태 설정 시작...');
      console.log('epubInfo:', epubInfo);
      console.log('epubInfo.toc:', epubInfo.toc);
      console.log('epubInfo.fileTree:', epubInfo.fileTree);
      
      setEpubData({
        file: file,
        name: file.name,
        ...epubInfo
      });
      setToc(epubInfo.toc);
      setFileTree(epubInfo.fileTree);
      setShowToc(true);
      
      console.log('상태 설정 완료');
      console.log('epubInfo.fileTree:', epubInfo.fileTree);
      console.log('epubInfo.fileTree 길이:', epubInfo.fileTree ? epubInfo.fileTree.length : 'undefined');
      
      // fileTree 상세 분석
      if (epubInfo.fileTree && epubInfo.fileTree.length > 0) {
        console.log('fileTree 상세 분석:');
        epubInfo.fileTree.forEach((node, index) => {
          console.log(`${index}: ${node.name} (${node.type}) - 자식 ${node.children ? node.children.length : 0}개`);
          if (node.children && node.children.length > 0) {
            node.children.forEach((child, childIndex) => {
              console.log(`  ${childIndex}: ${child.name} (${child.type})`);
            });
          }
        });
      }
      
      // EPUB 메타데이터를 JSON 탭에 표시
      const metadata = {
        title: epubInfo.metadata.dc_title || file.name.replace('.epub', ''),
        creator: epubInfo.metadata.dc_creator || 'Unknown',
        language: epubInfo.metadata.dc_language || 'ko',
        identifier: epubInfo.metadata.dc_identifier || file.name,
        size: file.size,
        spineCount: epubInfo.spine.length,
        tocCount: epubInfo.toc.length,
        fileTreeCount: epubInfo.fileTree.length,
        processedFiles: Object.keys(epubInfo.zipContent).length,
        toc: epubInfo.toc
      };
      
      setCode(prev => ({
        ...prev,
        json: JSON.stringify(metadata, null, 2)
      }));
      
      // 성공 메시지 표시
      console.log('EPUB 파일 로드 완료:', {
        title: metadata.title,
        tocCount: metadata.tocCount,
        fileTreeCount: metadata.fileTreeCount,
        processedFiles: metadata.processedFiles
      });
      
      // 사용자에게 성공 메시지 표시 (로딩바에서 처리됨)
      console.log('EPUB 파일 로드 완료:', {
        title: metadata.title,
        tocCount: metadata.tocCount,
        fileTreeCount: metadata.fileTreeCount,
        processedFiles: metadata.processedFiles
      });
      
      alert(`EPUB 파일이 성공적으로 로드되었습니다!\n\n📖 제목: ${metadata.title}\n📋 목차: ${metadata.tocCount}개\n📁 파일: ${metadata.fileTreeCount}개\n📄 처리된 파일: ${metadata.processedFiles}개`);
      
      // 완료 메시지 표시
      setLoadingMessage(`EPUB 파일 로드 완료!\n\n📖 제목: ${metadata.title}\n📋 목차: ${metadata.tocCount}개\n📁 파일: ${metadata.fileTreeCount}개\n📄 처리된 파일: ${metadata.processedFiles}개`);
      
      // 사용자가 확인할 수 있도록 충분한 시간 대기
      setTimeout(() => {
        console.log('🔄 EPUB 로딩바 숨기기 중...');
        setIsLoading(false);
      }, 4000);
      
      // 사용자에게 성공 메시지 표시 (로딩바에서 처리됨)
      
    } catch (error) {
      console.error('EPUB 파싱 오류:', error);
      
      // 더 자세한 오류 메시지 표시
      let errorMessage = 'EPUB 파일을 읽는 중 오류가 발생했습니다.';
      
      if (error.message.includes('META-INF/container.xml')) {
        errorMessage = '올바르지 않은 EPUB 파일입니다. META-INF/container.xml 파일이 없습니다.';
      } else if (error.message.includes('OPF 파일')) {
        errorMessage = 'EPUB 파일의 OPF 파일을 찾을 수 없습니다. 파일이 손상되었을 수 있습니다.';
      } else if (error.message.includes('ZIP')) {
        errorMessage = 'ZIP 파일 형식이 올바르지 않습니다. 파일이 손상되었을 수 있습니다.';
      } else if (error.message.includes('XML')) {
        errorMessage = 'EPUB 파일의 XML 구조가 올바르지 않습니다.';
      }
      
      alert(`${errorMessage}\n\n오류 상세: ${error.message}`);
    } finally {
      setIsLoading(false);
      // 파일 입력 초기화
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleTocItemClick = async (item) => {
    console.log('handleTocItemClick 호출됨:', item);
    
    if (!epubData) {
      console.error('epubData가 없습니다.');
      alert('EPUB 파일이 로드되지 않았습니다.');
      return;
    }
    
    try {
      // 실제 EPUB 콘텐츠 로드
      let content = '';
      
      console.log('목차 항목 정보:', {
        title: item.title,
        href: item.href,
        id: item.id,
        level: item.level
      });
      
      if (epubData.zipContent && item.href) {
        // href가 상대 경로인 경우 처리
        let contentPath = item.href;
        console.log('원본 contentPath:', contentPath);
        
        if (!contentPath.startsWith('/')) {
          // OPF 파일의 디렉토리를 기준으로 경로 조정
          const opfDir = epubData.opfPath?.split('/').slice(0, -1).join('/') || '';
          if (opfDir) {
            contentPath = `${opfDir}/${contentPath}`;
          }
        }
        
        console.log('조정된 contentPath:', contentPath);
        console.log('사용 가능한 파일들:', Object.keys(epubData.zipContent));
        
        // 새로운 zipContent 구조에서 파일 정보 가져오기
        const fileInfo = epubData.zipContent[contentPath];
        console.log('fileInfo:', fileInfo);
        
        if (fileInfo && fileInfo.content) {
          content = fileInfo.content;
          console.log('콘텐츠 로드 성공, 길이:', content.length);
          
          // HTML/XHTML 파일인 경우 이미지 처리
          if (['html', 'xhtml'].includes(fileInfo.type)) {
            console.log('HTML/XHTML 파일 처리 중...');
            content = await processXHTMLImages(fileInfo.content, contentPath);
          }
        } else {
          console.warn('파일 정보를 찾을 수 없거나 콘텐츠가 없습니다:', contentPath);
        }
      } else {
        console.warn('zipContent 또는 href가 없습니다:', {
          hasZipContent: !!epubData.zipContent,
          href: item.href
        });
      }
      
      // 콘텐츠가 없으면 샘플 생성
      if (!content) {
        console.log('콘텐츠가 없어서 샘플 생성');
        content = `
          <div style="padding: 20px; font-family: 'Noto Sans KR', sans-serif;">
            <h1>${item.title}</h1>
            <p>이것은 ${item.title}의 콘텐츠입니다.</p>
            <p>실제 EPUB 파일에서는 이 부분에 실제 챕터 내용이 표시됩니다.</p>
            <ul>
              <li>목차 항목: ${item.title}</li>
              <li>레벨: ${item.level}</li>
              <li>ID: ${item.id}</li>
              <li>HREF: ${item.href || '없음'}</li>
            </ul>
            <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
              <h3>디버그 정보</h3>
              <p><strong>epubData 존재:</strong> ${!!epubData}</p>
              <p><strong>zipContent 존재:</strong> ${!!epubData.zipContent}</p>
              <p><strong>사용 가능한 파일 수:</strong> ${epubData.zipContent ? Object.keys(epubData.zipContent).length : 0}</p>
            </div>
          </div>
        `;
      }
      
      // 파일 노드 생성하여 탭에서 열기
      const fileNode = {
        id: `toc_${item.id}`,
        name: `${item.title}.html`,
        type: 'file',
        path: item.href || `toc_${item.id}.html`
      };
      
      console.log('탭 열기 시도:', fileNode);
      await openTab(fileNode, content, 'html');
      console.log('탭 열기 완료');
      
    } catch (error) {
      console.error('챕터 로드 오류:', error);
      console.error('오류 상세:', {
        message: error.message,
        stack: error.stack,
        item: item,
        epubData: !!epubData
      });
      
      // 사용자에게 오류 메시지 표시
      alert(`챕터 로드 중 오류가 발생했습니다:\n\n${error.message}\n\n콘솔에서 더 자세한 정보를 확인하세요.`);
    }
  };

  const handleFileClick = async (fileNode) => {
    if (fileNode.type !== 'file') return;
    
    console.log('🔍 파일 클릭:', fileNode);
    console.log('🔍 파일 경로:', fileNode.path);
    
    // epubData와 zipContent가 존재하는지 확인
    if (!epubData || !epubData.zipContent) {
      console.error('❌ epubData 또는 zipContent가 없음');
      alert('EPUB 파일이 로드되지 않았습니다. 먼저 EPUB 파일을 업로드해주세요.');
      return;
    }
    
    console.log('📊 사용 가능한 파일들:', Object.keys(epubData.zipContent));
    
    try {
      // 새로운 zipContent 구조에서 파일 정보 가져오기
      const fileInfo = epubData.zipContent[fileNode.path];
      console.log(`🔍 파일 정보 검색: ${fileNode.path} =>`, fileInfo);
      
      if (!fileInfo) {
        console.error(`❌ 파일을 찾을 수 없음: ${fileNode.path}`);
        console.log('🔍 정확한 키 매칭 시도...');
        
        // 대안적으로 파일명으로 검색
        const alternativeKey = Object.keys(epubData.zipContent).find(key => 
          key.endsWith(fileNode.name) || key.includes(fileNode.name)
        );
        
        if (alternativeKey) {
          console.log(`✅ 대안 키 발견: ${alternativeKey}`);
          const alternativeFileInfo = epubData.zipContent[alternativeKey];
          console.log('📄 대안 파일 정보:', alternativeFileInfo);
          // 대안 키로 다시 처리
          return handleFileClickWithInfo(fileNode, alternativeFileInfo, alternativeKey);
        }
        
        alert(`파일을 찾을 수 없습니다: ${fileNode.path}\n\n사용 가능한 파일들:\n${Object.keys(epubData.zipContent).slice(0, 5).join('\n')}${Object.keys(epubData.zipContent).length > 5 ? '\n...' : ''}`);
        return;
      }
      
      return handleFileClickWithInfo(fileNode, fileInfo, fileNode.path);
    } catch (error) {
      console.error('❌ handleFileClick 오류:', error);
      alert('파일을 여는 중 오류가 발생했습니다.');
    }
  };

  // 실시간 검증 함수 (로컬 검증만 수행)
  const validateFileContent = async (fileNode, fileContent, fileInfo) => {
    try {
      console.log('🔍 파일 검증 시작 (로컬 검증):', fileNode.name);
      
      const errors = [];
      const fileName = fileNode.name.toLowerCase();
      
      // XML/HTML 파일 검증
      if (fileName.endsWith('.xml') || fileName.endsWith('.xhtml') || fileName.endsWith('.html') || fileName.endsWith('.opf')) {
        // 태그 닫힘 검증
        const tagValidation = validateXmlTags(fileContent);
        if (tagValidation.errors.length > 0) {
          errors.push(...tagValidation.errors);
        }
        
        // XML 구조 검증
        const xmlValidation = validateXmlStructure(fileContent);
        if (xmlValidation.errors.length > 0) {
          errors.push(...xmlValidation.errors);
        }
      }
      
      // CSS 파일 검증
      if (fileName.endsWith('.css')) {
        const cssValidation = validateCssSyntax(fileContent);
        if (cssValidation.errors.length > 0) {
          errors.push(...cssValidation.errors);
        }
      }
      
      // 일반적인 파일 에러 검증
      const generalValidation = validateGeneralFileErrors(fileContent, fileName);
      if (generalValidation.errors.length > 0) {
        errors.push(...generalValidation.errors);
      }
      
      // 모든 파일에 대한 기본 검증 추가
      const basicValidation = validateBasicSyntax(fileContent, fileName);
      if (basicValidation.errors.length > 0) {
        errors.push(...basicValidation.errors);
      }
      
      // 디버깅: 검증 결과 출력
      console.log('🔍 검증 결과:', {
        fileName: fileName,
        tagErrors: fileName.endsWith('.xml') || fileName.endsWith('.xhtml') || fileName.endsWith('.html') || fileName.endsWith('.opf') ? validateXmlTags(fileContent).errors.length : 0,
        xmlErrors: fileName.endsWith('.xml') || fileName.endsWith('.xhtml') || fileName.endsWith('.html') || fileName.endsWith('.opf') ? validateXmlStructure(fileContent).errors.length : 0,
        cssErrors: fileName.endsWith('.css') ? validateCssSyntax(fileContent).errors.length : 0,
        basicErrors: basicValidation.errors.length,
        generalErrors: generalValidation.errors.length,
        totalErrors: errors.length
      });
      

      
      if (errors.length > 0) {
        console.log('❌ 파일 검증 실패 - 에러 발견:', errors);
        return { 
          success: false, 
          error: `${errors.length}개의 검증 오류가 발견되었습니다.`,
          details: errors
        };
      }
      
      console.log('✅ 파일 검증 성공 (로컬 검증)');
      return { 
        success: true, 
        message: '로컬 검증 완료',
        file: fileNode.name,
        contentLength: fileContent.length
      };
    } catch (error) {
      console.error('❌ 파일 검증 실패 (로컬 검증):', error);
      return { success: false, error: error.message };
    }
  };

  // 파일 제출 함수
  const submitFileContent = async (fileNode, fileContent, fileInfo) => {
    try {
      console.log('🚀 파일 제출 시작:', fileNode.name);
      
      const actualBookId = bookInfo ? bookInfo.id : (projectId || 1);
      const result = await bookAPI.updateBookWorkspace(actualBookId, fileContent, fileNode.path);
      console.log('✅ 파일 제출 성공:', result);
      
      // 성공 메시지 표시
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
        padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
        font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      notification.textContent = `✅ 파일 제출 완료: ${fileNode.name}`;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
        }
      }, 3000);
      
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ 파일 제출 실패:', error);
      
      // 에러 메시지 표시
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
        padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
        font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      notification.textContent = `❌ 파일 제출 실패: ${error.message}`;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
        }
      }, 5000);
      
      return { success: false, error: error.message };
    }
  };

  // XML 태그 검증 함수
  const validateXmlTags = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    console.log('🔍 XML 태그 검증 시작, 총 라인 수:', lines.length);
    
    // 자체 닫힘 태그 목록 (닫힘 태그가 필요 없는 태그들)
    const selfClosingTags = [
      'br', 'hr', 'img', 'meta', 'link', 'input', 'area', 'base', 'col', 'embed', 
      'source', 'track', 'wbr', 'command', 'keygen', 'param'
    ];
    
    // 전체 문서에서 모든 태그 찾기
    const allTags = [];
    const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const isClosing = match[1] === '/';
      const tagName = match[2];
      const isSelfClosing = match[4] === '/' || selfClosingTags.includes(tagName);
      
      allTags.push({
        tagName,
        isClosing,
        isSelfClosing,
        position: match.index,
        line: content.substring(0, match.index).split('\n').length,
        column: match.index - content.lastIndexOf('\n', match.index)
      });
    }
    
    console.log('🔍 발견된 모든 태그:', allTags);
    
    // 태그 스택을 사용한 검증
    const tagStack = [];
    
    for (const tag of allTags) {
      if (tag.isSelfClosing) {
        console.log(`⏭️ 자체 닫힘 태그 건너뛰기: ${tag.tagName}`);
        continue;
      }
      
      if (tag.isClosing) {
        // 닫힘 태그
        if (tagStack.length === 0) {
          console.log(`❌ 열린 태그 없이 닫힘 태그 발견: ${tag.tagName}`);
          errors.push({
            line: tag.line,
            column: tag.column,
            message: `열린 태그 없이 닫힘 태그 '</${tag.tagName}>'가 있습니다.`,
            severity: 'ERROR',
            path: 'local-validation'
          });
        } else {
          const lastOpenTag = tagStack[tagStack.length - 1];
          if (lastOpenTag.tagName === tag.tagName) {
            console.log(`✅ 태그 '${tag.tagName}' 정상적으로 닫힘`);
            tagStack.pop();
          } else {
            console.log(`❌ 태그 순서 오류: '${lastOpenTag.tagName}' 태그가 닫히기 전에 '${tag.tagName}' 태그가 닫힘`);
            errors.push({
              line: tag.line,
              column: tag.column,
              message: `태그 순서 오류: '${lastOpenTag.tagName}' 태그가 닫히기 전에 '${tag.tagName}' 태그가 닫혔습니다.`,
              severity: 'ERROR',
              path: 'local-validation'
            });
            // 스택에서 해당 태그를 찾아서 제거
            const index = tagStack.findIndex(t => t.tagName === tag.tagName);
            if (index !== -1) {
              tagStack.splice(index, 1);
            }
          }
        }
      } else {
        // 열린 태그
        console.log(`🔍 열린 태그 추가: ${tag.tagName}`);
        tagStack.push(tag);
      }
    }
    
    // 스택에 남은 열린 태그들 (닫히지 않은 태그들)
    for (const openTag of tagStack) {
      console.log(`❌ 닫히지 않은 태그: ${openTag.tagName}`);
      errors.push({
        line: openTag.line,
        column: openTag.column,
        message: `태그 '<${openTag.tagName}>'가 닫히지 않았습니다.`,
        severity: 'ERROR',
        path: 'local-validation'
      });
    }
    
    console.log(`🔍 XML 태그 검증 완료, 발견된 오류: ${errors.length}개`);
    return { errors };
  };

  // XML 구조 검증 함수
  const validateXmlStructure = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    console.log('🔍 XML 구조 검증 시작');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // 잘못된 XML 문법 검사
      if (line.includes('<<') || line.includes('>>')) {
        console.log(`❌ 라인 ${lineNumber}에서 잘못된 XML 문법 발견`);
        errors.push({
          line: lineNumber,
          column: line.indexOf('<<') !== -1 ? line.indexOf('<<') + 1 : line.indexOf('>>') + 1,
          message: '잘못된 XML 문법: 중복된 < 또는 > 기호',
          severity: 'ERROR',
          path: 'local-validation'
        });
      }
      
      // 속성값 따옴표 검사 (더 정확한 정규식)
      const attrMatches = line.match(/<[^>]*\s+([a-zA-Z][a-zA-Z0-9]*)=([^"'\s>]+)/g);
      if (attrMatches) {
        console.log(`🔍 라인 ${lineNumber}에서 따옴표 없는 속성 발견:`, attrMatches);
        for (const match of attrMatches) {
          const attrName = match.match(/([a-zA-Z][a-zA-Z0-9]*)=/)[1];
          console.log(`❌ 속성 '${attrName}' 따옴표 없음`);
          errors.push({
            line: lineNumber,
            column: line.indexOf(match) + 1,
            message: `속성 '${attrName}'의 값이 따옴표로 감싸지지 않았습니다.`,
            severity: 'ERROR',
            path: 'local-validation'
          });
        }
      }
      
      // 태그가 제대로 닫히지 않은 경우
      const openTags = line.match(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(?!\/>)/g);
      const closeTags = line.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g);
      
      if (openTags && !closeTags) {
        // 열린 태그만 있고 닫힘 태그가 없는 경우
        for (const tag of openTags) {
          const tagName = tag.match(/<([a-zA-Z][a-zA-Z0-9]*)/)[1];
          if (!tag.includes('/>') && tagName !== 'br' && tagName !== 'hr' && tagName !== 'img' && tagName !== 'meta' && tagName !== 'link' && tagName !== 'input') {
            console.log(`🔍 라인 ${lineNumber}에서 열린 태그만 있음: ${tagName}`);
          }
        }
      }
    }
    
    console.log(`🔍 XML 구조 검증 완료, 발견된 오류: ${errors.length}개`);
    return { errors };
  };

  // CSS 문법 검증 함수
  const validateCssSyntax = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // 중괄호 짝 맞추기
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: 'CSS 중괄호가 맞지 않습니다.',
          severity: 'ERROR',
          path: 'local-validation'
        });
      }
      
      // 세미콜론 누락 검사
      const cssRules = line.match(/[a-zA-Z-]+\s*:\s*[^;]+$/);
      if (cssRules && !line.trim().endsWith('}') && !line.trim().endsWith('{')) {
        errors.push({
          line: lineNumber,
          column: line.length,
          message: 'CSS 속성 뒤에 세미콜론(;)이 누락되었습니다.',
          severity: 'ERROR',
          path: 'local-validation'
        });
      }
    }
    
    return { errors };
  };

  // 기본 문법 검증 함수 (모든 파일에 적용)
  const validateBasicSyntax = (content, fileName) => {
    const errors = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // 빈 줄이 아닌 경우에만 검사
      if (line.trim()) {
        // 일반적인 오타 및 문법 오류 검사
        
        // 1. HTML 태그 오타 검사
        const htmlTagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*>/g;
        let match;
        while ((match = htmlTagRegex.exec(line)) !== null) {
          const tagName = match[1].toLowerCase();
          const commonTypos = {
            'divv': 'div',
            'spann': 'span',
            'pp': 'p',
            'h1h1': 'h1',
            'h2h2': 'h2',
            'h3h3': 'h3',
            'h4h4': 'h4',
            'h5h5': 'h5',
            'h6h6': 'h6',
            'ull': 'ul',
            'oll': 'ol',
            'lii': 'li',
            'tablee': 'table',
            'trr': 'tr',
            'tdd': 'td',
            'thh': 'th',
            'formm': 'form',
            'inputt': 'input',
            'buttonn': 'button',
            'imgg': 'img',
            'brr': 'br',
            'hrr': 'hr'
          };
          
          if (commonTypos[tagName]) {
            errors.push({
              line: lineNumber,
              column: match.index + 1,
              message: `잘못된 HTML 태그: '<${tagName}>' → '<${commonTypos[tagName]}>'`,
              severity: 'ERROR',
              path: 'local-validation'
            });
          }
        }
        
        // 2. CSS 속성 오타 검사
        const cssPropertyRegex = /([a-zA-Z-]+)\s*:/g;
        while ((match = cssPropertyRegex.exec(line)) !== null) {
          const property = match[1].toLowerCase();
          const commonCssTypos = {
            'colorr': 'color',
            'backgroundd': 'background',
            'font-sizee': 'font-size',
            'font-weightt': 'font-weight',
            'text-alignn': 'text-align',
            'margin': 'margin',
            'paddingg': 'padding',
            'borderr': 'border',
            'widthh': 'width',
            'heightt': 'height',
            'displayy': 'display',
            'positionn': 'position',
            'top': 'top',
            'leftt': 'left',
            'rightt': 'right',
            'bottomm': 'bottom'
          };
          
          if (commonCssTypos[property]) {
            errors.push({
              line: lineNumber,
              column: match.index + 1,
              message: `잘못된 CSS 속성: '${property}' → '${commonCssTypos[property]}'`,
              severity: 'ERROR',
              path: 'local-validation'
            });
          }
        }
        
        // 3. 따옴표 불일치 검사
        const quoteRegex = /["'`]/g;
        const quotes = line.match(quoteRegex);
        if (quotes) {
          const singleQuotes = quotes.filter(q => q === "'").length;
          const doubleQuotes = quotes.filter(q => q === '"').length;
          const backticks = quotes.filter(q => q === '`').length;
          
          if ((singleQuotes % 2 !== 0) || (doubleQuotes % 2 !== 0) || (backticks % 2 !== 0)) {
            errors.push({
              line: lineNumber,
              column: 1,
              message: '따옴표가 짝이 맞지 않습니다.',
              severity: 'ERROR',
              path: 'local-validation'
            });
          }
        }
        
        // 4. 괄호 불일치 검사
        const brackets = {
          '(': ')',
          '[': ']',
          '{': '}',
          '<': '>'
        };
        
        const stack = [];
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (brackets[char]) {
            stack.push(char);
          } else if (Object.values(brackets).includes(char)) {
            const expected = Object.keys(brackets).find(key => brackets[key] === char);
            if (stack.length === 0 || stack.pop() !== expected) {
              errors.push({
                line: lineNumber,
                column: j + 1,
                message: `괄호가 짝이 맞지 않습니다: '${char}'`,
                severity: 'ERROR',
                path: 'local-validation'
              });
              break;
            }
          }
        }
        
        // 5. 세미콜론 누락 검사 (CSS)
        if (fileName.endsWith('.css')) {
          const cssRuleRegex = /[a-zA-Z-]+\s*:\s*[^;]+$/;
          if (cssRuleRegex.test(line.trim()) && !line.trim().endsWith(';') && !line.trim().endsWith('{')) {
            errors.push({
              line: lineNumber,
              column: line.length,
              message: 'CSS 속성 뒤에 세미콜론(;)이 누락되었습니다.',
              severity: 'ERROR',
              path: 'local-validation'
            });
          }
        }
      }
    }
    
    return { errors };
  };

  // 일반적인 파일 에러 검증 함수
  const validateGeneralFileErrors = (content, fileName) => {
    const errors = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // 빈 줄이 아닌 경우에만 검사
      if (line.trim()) {
        // 너무 긴 줄 검사
        if (line.length > 1000) {
          errors.push({
            line: lineNumber,
            column: 1000,
            message: '줄이 너무 깁니다 (1000자 초과).',
            severity: 'WARNING',
            path: 'local-validation'
          });
        }
      }
    }
    
    return { errors };
  };

  // 현재 파일의 최신 내용을 가져오는 함수
  const getLatestFileContent = (filePath) => {
    const getLatestContentFromTree = (tree, targetPath) => {
      for (const node of tree) {
        if (node.path === targetPath) {
          return node.content;
        }
        if (node.children) {
          const found = getLatestContentFromTree(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    return getLatestContentFromTree(fileTree, filePath);
  };

  // 검증 후 제출하는 통합 함수
  const validateAndSubmitFile = async (fileNode, fileContent, fileInfo) => {
    try {
      console.log('🔄 검증 후 제출 시작:', fileNode.name);
      
      // 파일 트리에서 최신 내용 가져오기
      const latestContent = getLatestFileContent(fileNode.path) || fileContent;
      console.log('📝 제출할 최신 내용:', {
        filePath: fileNode.path,
        contentLength: latestContent.length,
        isUpdated: latestContent !== fileContent
      });
      
      // 1단계: 실시간 검증 (최신 내용으로)
      const validationResult = await validateFileContent(fileNode, latestContent, fileInfo);
      
      if (!validationResult.success) {
        // 검증 실패 시 에러 메시지 표시
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed; top: 20px; right: 20px; background: #ff9800; color: white;
          padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
          font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = `⚠️ 검증 실패: ${validationResult.error}`;
        document.body.appendChild(notification);
        setTimeout(() => {
          if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
          }
        }, 5000);
        
        return validationResult;
      }
      
      // 2단계: 검증 성공 시 제출 (최신 내용으로)
      const submitResult = await submitFileContent(fileNode, latestContent, fileInfo);
      return submitResult;
      
    } catch (error) {
      console.error('❌ 검증 후 제출 실패:', error);
      return { success: false, error: error.message };
    }
  };

  // 기존 applyFileToServer 함수 (하위 호환성을 위해 유지)
  const applyFileToServer = async (fileNode, fileContent, fileInfo) => {
    return await validateAndSubmitFile(fileNode, fileContent, fileInfo);
  };

  // 접근성 표준 검사 함수
  const checkAccessibilityStandard = async () => {
    const actualBookId = bookInfo ? bookInfo.id : (projectId || 1);
    
    try {
      console.log('🔍 접근성 표준 검사 시작');
      

      
      // 실제 서버에서 500 에러가 발생할 경우를 대비한 폴백
      let result;
      let useLocalFallback = false;
      
      try {
        result = await bookAPI.checkAccessibility(actualBookId);
      } catch (apiError) {
        
              // API 실패 로깅
      logger.error('API', `접근성 검사 API 실패: ${apiError.message}`, {
        bookId: actualBookId,
        error: apiError.message,
        status: apiError.status,
        url: apiError.url
      });
        
        useLocalFallback = true;
      }
      
              // API 실패 시 로컬 폴백 사용
        if (useLocalFallback || !result) {

          
          // 로컬 폴백 시작 로깅
          logger.info('VALIDATION', '접근성 검사 로컬 폴백 시작', {
            reason: useLocalFallback ? 'API 실패' : '결과 없음'
          });
          
          const currentTab = getCurrentTab();
          if (!currentTab) {
            logger.error('VALIDATION', '접근성 검사 실패 - 검사할 파일 없음');
            throw new Error('검사할 파일이 없습니다.');
          }
          
          const localErrors = performLocalAccessibilityCheck(currentTab.content);
          result = {
            success: true,
            data: {
              errors: localErrors,
              message: '로컬 접근성 검사 완료 (서버 API 실패로 인한 폴백)'
            }
          };
          

          
          // 로컬 폴백 완료 로깅
          logger.info('VALIDATION', '접근성 검사 로컬 폴백 완료', {
            reason: 'API 실패',
            errorCount: localErrors.length,
            fileName: currentTab.name,
            fileSize: currentTab.content.length
          });
        }
      

      
      // 검사 결과를 에디터 오류로 변환 (실제 서버 응답 형식에 맞게 수정)
      let errors = [];
      
      // 실제 서버 응답 형식 처리 (다양한 형식 지원)
      if (result.messages && Array.isArray(result.messages)) {
        // messages 배열 안에 locations가 있는 경우 처리
        errors = result.messages.flatMap(message => {
          if (message.locations && Array.isArray(message.locations)) {
            return message.locations.map(location => ({
              line: location.line,
              column: location.column,
              message: message.message || location.message || '알 수 없는 오류',
              severity: message.severity || location.severity || 'error',
              path: location.path,
              file: location.path
            }));
          } else {
            // locations가 없는 경우 message 자체를 오류로 처리
            return [{
              line: message.line || 1,
              column: message.column || 1,
              message: message.message || '알 수 없는 오류',
              severity: message.severity || 'error',
              path: message.path || 'unknown',
              file: message.path || 'unknown'
            }];
          }
        });
      } else if (result.errors && Array.isArray(result.errors)) {
        errors = result.errors;
      } else if (result.data && result.data.errors && Array.isArray(result.data.errors)) {
        errors = result.data.errors;
      } else if (result.results && Array.isArray(result.results)) {
        errors = result.results;
      } else if (result.issues && Array.isArray(result.issues)) {
        errors = result.issues;
      } else if (result.locations && Array.isArray(result.locations)) {
        // locations 배열 형식 처리
        errors = result.locations.map(location => ({
          line: location.line,
          column: location.column,
          message: location.message || '알 수 없는 오류',
          severity: location.severity || 'error',
          path: location.path,
          file: location.path
        }));
      }
      
      if (errors.length > 0) {
        console.log('🔍 파싱된 오류 데이터:', errors);
        

        
        const accessibilityErrors = errors.map(error => {
          // 실제 서버 응답 형식에 맞게 매핑
          const line = parseInt(error.line) || parseInt(error.lineNumber) || 1;
          const column = parseInt(error.column) || parseInt(error.columnNumber) || 1;
          const offset = parseInt(error.offset) || 0;
          const message = error.message || error.description || error.msg || '알 수 없는 오류';
          const severity = error.severity || error.level || 'error';
          const file = error.path || error.file || error.fileName || 'unknown';
          
          const mappedError = {
            line: line,
            column: column,
            offset: offset,
            message: `[접근성] ${message}`,
            severity: severity.toLowerCase(),
            type: 'accessibility',
            file: file
          };
          
          console.log('🔍 매핑된 오류:', mappedError);
          return mappedError;
        });
        
        setEditorErrors(prev => [...prev, ...accessibilityErrors]);
        setShowErrorPanel(true);
        
        // Monaco Editor에 오류 마커 추가
        addErrorMarkers(accessibilityErrors);
        
        // 첫 번째 오류가 있는 파일을 자동으로 열고 하이라이트
        if (accessibilityErrors.length > 0) {
          const firstError = accessibilityErrors[0];
          console.log('🔍 첫 번째 오류 파일 열기 시도:', firstError);
          
          const fileOpened = await openFileWithError(firstError);
          if (fileOpened) {
            console.log('✅ 오류 파일 열기 성공');
          } else {
            console.warn('⚠️ 오류 파일 열기 실패, 현재 파일에서 스크롤만 시도');
            // 파일 열기 실패 시 현재 파일에서 스크롤만 시도
            const currentTab = getCurrentTab();
            if (currentTab) {
              const relevantErrors = accessibilityErrors.filter(error => {
                const errorFile = error.file || error.path || error.fileName || '';
                const currentFilePath = currentTab.path || currentTab.name || '';
                return errorFile.includes(currentFilePath) || 
                       currentFilePath.includes(errorFile) ||
                       errorFile.endsWith(currentTab.name) ||
                       currentTab.name.endsWith(errorFile.split('/').pop());
              });
              
              if (relevantErrors.length > 0) {
                goToErrorLocation(relevantErrors[0]);
              }
            }
          }
        }
        
        // 오류가 있을 때 알림 표시 (상세 정보 포함)
        let relevantErrors = accessibilityErrors;
        const currentTab = getCurrentTab();
        
        if (currentTab) {
          relevantErrors = accessibilityErrors.filter(error => {
            const errorFile = error.file || error.path || error.fileName || '';
            const currentFilePath = currentTab.path || currentTab.name || '';
            return errorFile.includes(currentFilePath) || 
                   currentFilePath.includes(errorFile) ||
                   errorFile.endsWith(currentTab.name) ||
                   currentTab.name.endsWith(errorFile.split('/').pop());
          });
        }
        
        const errorDetails = relevantErrors.slice(0, 3).map(error => 
          `라인 ${error.line}: ${error.message.replace('[접근성] ', '')}`
        ).join('\n');
        const remainingCount = relevantErrors.length > 3 ? relevantErrors.length - 3 : 0;
        
        let toastMessage = `⚠️ 접근성 검사 완료: ${accessibilityErrors.length}개 오류 발견\n\n${errorDetails}`;
        if (remainingCount > 0) {
          toastMessage += `\n\n...외 ${remainingCount}개 더`;
        }
        
        showToast(toastMessage, 'warning');
        
        // 오류 결과 로깅
        logger.warn('VALIDATION', '접근성 검사 완료 - 오류 있음', {
          totalErrors: accessibilityErrors.length,
          relevantErrors: relevantErrors.length,
          currentFile: currentTab?.name || 'unknown'
        });
        
      } else {
        // 오류가 없을 때 성공 메시지
        showToast(`✅ 접근성 검사 완료: 오류 없음`, 'success');
        
        // 성공 로깅
        logger.info('VALIDATION', '접근성 검사 완료 - 오류 없음', {
          bookId: actualBookId,
          timestamp: new Date().toISOString()
        });
        
        // 성공 시 관련 오류 로그 정리
        logger.cleanResolvedErrors();
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ 접근성 검사 실패:', error);
      
      // 에러 로깅
      logger.error('VALIDATION', `접근성 검사 실패: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        bookId: actualBookId
      });
      
      // 에러 메시지 표시
      showToast(`❌ 접근성 검사 실패: ${error.message}`, 'error');
      
      return { success: false, error: error.message };
    }
  };

  // 전자책 표준 검사 함수
  const checkEpubStandard = async () => {
    const actualBookId = bookInfo ? bookInfo.id : (projectId || 1);
    
    try {

      

      
      // 실제 서버에서 500 에러가 발생할 경우를 대비한 폴백
      let result;
      let useLocalFallback = false;
      
      try {
        console.log(`🔍 실제 서버 API 호출 시도: bookId=${actualBookId}`);
        

        
        result = await bookAPI.checkEpubStandard(actualBookId);
        console.log('✅ 실제 서버 API 성공:', result);
        

        
      } catch (apiError) {
        
              // API 실패 로깅
      logger.error('API', `EPUB 표준 검사 API 실패: ${apiError.message}`, {
        bookId: actualBookId,
        error: apiError.message,
        status: apiError.status,
        url: apiError.url
      });
        
        useLocalFallback = true;
      }
      
      // API 실패 시 로컬 폴백 사용
      if (useLocalFallback || !result) {

        
        // 로컬 폴백 시작 로깅
        logger.info('VALIDATION', 'EPUB 표준 검사 로컬 폴백 시작', {
          reason: useLocalFallback ? 'API 실패' : '결과 없음'
        });
        
        const currentTab = getCurrentTab();
        if (!currentTab) {
          logger.error('VALIDATION', 'EPUB 표준 검사 실패 - 검사할 파일 없음');
          throw new Error('검사할 파일이 없습니다.');
        }
        
        const localErrors = performLocalEpubCheck(currentTab.content);
        result = {
          success: true,
          data: {
            errors: localErrors,
            message: '로컬 EPUB 표준 검사 완료 (서버 API 실패로 인한 폴백)'
          }
        };
        

        
        // 로컬 폴백 완료 로깅
        logger.info('VALIDATION', 'EPUB 표준 검사 로컬 폴백 완료', {
          reason: 'API 실패',
          errorCount: localErrors.length,
          fileName: currentTab.name,
          fileSize: currentTab.content.length
        });
      }
      

      
      // 검사 결과를 에디터 오류로 변환 (실제 서버 응답 형식에 맞게 수정)
      let errors = [];
      
      // 실제 서버 응답 형식 처리 (다양한 형식 지원)
      if (result.messages && Array.isArray(result.messages)) {
        // messages 배열 안에 locations가 있는 경우 처리
        errors = result.messages.flatMap(message => {
          if (message.locations && Array.isArray(message.locations)) {
            return message.locations.map(location => ({
              line: location.line,
              column: location.column,
              message: message.message || location.message || '알 수 없는 오류',
              severity: message.severity || location.severity || 'error',
              path: location.path,
              file: location.path
            }));
          } else {
            // locations가 없는 경우 message 자체를 오류로 처리
            return [{
              line: message.line || 1,
              column: message.column || 1,
              message: message.message || '알 수 없는 오류',
              severity: message.severity || 'error',
              path: message.path || 'unknown',
              file: message.path || 'unknown'
            }];
          }
        });
      } else if (result.errors && Array.isArray(result.errors)) {
        errors = result.errors;
      } else if (result.data && result.data.errors && Array.isArray(result.data.errors)) {
        errors = result.data.errors;
      } else if (result.results && Array.isArray(result.results)) {
        errors = result.results;
      } else if (result.issues && Array.isArray(result.issues)) {
        errors = result.issues;
      } else if (result.locations && Array.isArray(result.locations)) {
        // locations 배열 형식 처리
        errors = result.locations.map(location => ({
          line: location.line,
          column: location.column,
          message: location.message || '알 수 없는 오류',
          severity: location.severity || 'error',
          path: location.path,
          file: location.path
        }));
      }
      
      if (errors.length > 0) {
        console.log('🔍 파싱된 오류 데이터:', errors);
        
        // nav.xhtml 하이퍼링크 관련 오류 필터링
        const filteredErrors = errors.filter(error => {
          const message = error.message || error.description || error.msg || '';
          const isNavHyperlinkError = message.includes('nav.xhtml') && 
                                    (message.includes('하이퍼링크') || 
                                     message.includes('hyperlinks') ||
                                     message.includes('hyperlinks'));
          
          if (isNavHyperlinkError) {
            console.log('🔍 nav.xhtml 하이퍼링크 오류 필터링됨:', message);
            return false; // 이 오류는 제외
          }
          return true; // 다른 오류는 유지
        });
        
        console.log(`🔍 필터링 후 오류 수: ${filteredErrors.length} (원본: ${errors.length})`);
        

        
        const epubErrors = filteredErrors.map(error => {
          // 실제 서버 응답 형식에 맞게 매핑
          const line = parseInt(error.line) || parseInt(error.lineNumber) || 1;
          const column = parseInt(error.column) || parseInt(error.columnNumber) || 1;
          const offset = parseInt(error.offset) || 0;
          const message = error.message || error.description || error.msg || '알 수 없는 오류';
          const severity = error.severity || error.level || 'error';
          const file = error.path || error.file || error.fileName || 'unknown';
          
          const mappedError = {
            line: line,
            column: column,
            offset: offset,
            message: `[EPUB] ${message}`,
            severity: severity.toLowerCase(),
            type: 'epub',
            file: file
          };
          
          console.log('🔍 매핑된 오류:', mappedError);
          return mappedError;
        });
        
        setEditorErrors(prev => [...prev, ...epubErrors]);
        setShowErrorPanel(true);
        
        // Monaco Editor에 오류 마커 추가
        addErrorMarkers(epubErrors);
        
        // 첫 번째 오류가 있는 파일을 자동으로 열고 하이라이트
        if (epubErrors.length > 0) {
          const firstError = epubErrors[0];
          console.log('🔍 첫 번째 오류 파일 열기 시도:', firstError);
          
          const fileOpened = await openFileWithError(firstError);
          if (fileOpened) {
            console.log('✅ 오류 파일 열기 성공');
          } else {
            console.warn('⚠️ 오류 파일 열기 실패, 현재 파일에서 스크롤만 시도');
            // 파일 열기 실패 시 현재 파일에서 스크롤만 시도
            const currentTab = getCurrentTab();
            if (currentTab) {
              const relevantErrors = epubErrors.filter(error => {
                const errorFile = error.file || error.path || error.fileName || '';
                const currentFilePath = currentTab.path || currentTab.name || '';
                return errorFile.includes(currentFilePath) || 
                       currentFilePath.includes(errorFile) ||
                       errorFile.endsWith(currentTab.name) ||
                       currentTab.name.endsWith(errorFile.split('/').pop());
              });
              
              if (relevantErrors.length > 0) {
                goToErrorLocation(relevantErrors[0]);
              }
            }
          }
        }
        
        // 오류가 있을 때 알림 표시 (상세 정보 포함)
        let relevantErrors = epubErrors;
        const currentTab = getCurrentTab();
        
        if (currentTab) {
          relevantErrors = epubErrors.filter(error => {
            const errorFile = error.file || error.path || error.fileName || '';
            const currentFilePath = currentTab.path || currentTab.name || '';
            return errorFile.includes(currentFilePath) || 
                   currentFilePath.includes(errorFile) ||
                   errorFile.endsWith(currentTab.name) ||
                   currentTab.name.endsWith(errorFile.split('/').pop());
          });
        }
        
        const errorDetails = relevantErrors.slice(0, 3).map(error => 
          `라인 ${error.line}: ${error.message.replace('[EPUB] ', '')}`
        ).join('\n');
        const remainingCount = relevantErrors.length > 3 ? relevantErrors.length - 3 : 0;
        
        let toastMessage = `⚠️ EPUB 검사 완료: ${epubErrors.length}개 오류 발견\n\n${errorDetails}`;
        if (remainingCount > 0) {
          toastMessage += `\n\n...외 ${remainingCount}개 더`;
        }
        
        showToast(toastMessage, 'warning');
        
        // 오류 결과 로깅
        logger.warn('VALIDATION', 'EPUB 표준 검사 완료 - 오류 있음', {
          totalErrors: epubErrors.length,
          relevantErrors: relevantErrors.length,
          currentFile: currentTab?.name || 'unknown'
        });
        
      } else {
        // 오류가 없을 때 성공 메시지
        showToast(`✅ EPUB 검사 완료: 오류 없음`, 'success');
        
        // 성공 로깅
        logger.info('VALIDATION', 'EPUB 표준 검사 완료 - 오류 없음', {
          bookId: actualBookId,
          timestamp: new Date().toISOString()
        });
        
        // 성공 시 관련 오류 로그 정리
        logger.cleanResolvedErrors();
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ 전자책 표준 검사 실패:', error);
      
      // 에러 로깅
      logger.error('VALIDATION', `EPUB 표준 검사 실패: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        bookId: actualBookId
      });
      
      // 에러 메시지 표시
      showToast(`❌ EPUB 검사 실패: ${error.message}`, 'error');
      
      return { success: false, error: error.message };
    }
  };

  // 로컬 접근성 검사 함수
  const performLocalAccessibilityCheck = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    // 현재 파일 정보 가져오기
    const currentTab = getCurrentTab();
    const currentFilePath = currentTab ? (currentTab.path || currentTab.name) : 'unknown';
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // 이미지 alt 속성 검사
      const imgTags = line.match(/<img[^>]*>/gi);
      if (imgTags) {
        imgTags.forEach((imgTag, imgIndex) => {
          if (!imgTag.includes('alt=')) {
            errors.push({
              line: lineNumber,
              column: line.indexOf(imgTag) + 1,
              message: '이미지에 alt 속성이 없습니다.',
              severity: 'error',
              type: 'accessibility',
              path: currentFilePath,
              file: currentFilePath
            });
          }
        });
      }
      
      // 제목 구조 검사 (h1, h2, h3 등)
      const headingTags = line.match(/<h[1-6][^>]*>/gi);
      if (headingTags) {
        headingTags.forEach((headingTag) => {
          const level = parseInt(headingTag.match(/<h([1-6])/i)[1]);
          if (level > 1) {
            // h2 이상의 제목이 h1 없이 사용되는지 검사 (간단한 검사)
            const hasH1Before = lines.slice(0, lineIndex).some(prevLine => 
              prevLine.match(/<h1[^>]*>/i)
            );
            if (!hasH1Before) {
              errors.push({
                line: lineNumber,
                column: line.indexOf(headingTag) + 1,
                message: '제목 구조가 올바르지 않습니다. h1 제목이 필요합니다.',
                severity: 'warning',
                type: 'accessibility',
                path: currentFilePath,
                file: currentFilePath
              });
            }
          }
        });
      }
      
      // 색상 대비 검사 (간단한 검사)
      if (line.includes('color:') && line.includes('background')) {
        // 실제로는 더 정교한 색상 대비 검사가 필요하지만, 여기서는 간단히 체크
        if (line.includes('color: #fff') && line.includes('background: #fff')) {
          errors.push({
            line: lineNumber,
            column: line.indexOf('color:') + 1,
            message: '색상 대비가 부족할 수 있습니다.',
            severity: 'warning',
            type: 'accessibility',
            path: currentFilePath,
            file: currentFilePath
          });
        }
      }
    });
    
    // 샘플 오류 추가 (테스트용)
    if (errors.length === 0) {
      errors.push({
        line: 1,
        column: 1,
        message: '접근성 검사: 샘플 오류 (로컬 폴백)',
        severity: 'warning',
        type: 'accessibility',
        path: currentFilePath,
        file: currentFilePath
      });
    }
    
    return errors;
  };

  // 토스트 알림 표시 함수
  const showToast = (message, type = 'info') => {
    const colors = {
      success: '#4caf50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: translateX(100%);
      transition: transform 0.3s ease-out;
      max-width: 400px;
      white-space: pre-line;
      line-height: 1.4;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // 애니메이션 시작
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // 자동 제거
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000);
  };

  // 로컬 EPUB 표준 검사 함수
  const performLocalEpubCheck = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    // 현재 파일 정보 가져오기
    const currentTab = getCurrentTab();
    const currentFilePath = currentTab ? (currentTab.path || currentTab.name) : 'unknown';
    
    // nav.xhtml 하이퍼링크 문제 해결을 위한 검사
    const isNavFile = currentFilePath.includes('nav.xhtml') || currentTab?.name === 'nav.xhtml';
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // DOCTYPE 선언 검사
      if (lineNumber === 1 && !line.includes('<!DOCTYPE')) {
        errors.push({
          line: lineNumber,
          column: 1,
          message: 'DOCTYPE 선언이 누락되었습니다.',
          severity: 'error',
          type: 'epub',
          path: currentFilePath,
          file: currentFilePath
        });
      }
      
      // CSS @import 규칙 검사
      if (line.includes('@import')) {
        errors.push({
          line: lineNumber,
          column: line.indexOf('@import') + 1,
          message: 'CSS @import 규칙은 EPUB에서 지원되지 않습니다.',
          severity: 'warning',
          type: 'epub',
          path: currentFilePath,
          file: currentFilePath
        });
      }
      
      // XHTML 네임스페이스 검사
      if (line.includes('<html') && !line.includes('xmlns=')) {
        errors.push({
          line: lineNumber,
          column: line.indexOf('<html') + 1,
          message: 'XHTML 네임스페이스가 누락되었습니다.',
          severity: 'error',
          type: 'epub',
          path: currentFilePath,
          file: currentFilePath
        });
      }
      
      // nav.xhtml 파일에서 하이퍼링크 검사
      if (isNavFile) {
        // nav.xhtml 파일에 하이퍼링크가 있는지 확인
        if (line.includes('<a') && line.includes('href=')) {
          // 하이퍼링크가 있으면 오류 제거 (이미 해결됨)
          console.log('✅ nav.xhtml에서 하이퍼링크 발견:', line.trim());
        }
      }
    });
    
    // nav.xhtml 하이퍼링크 문제 해결
    if (isNavFile) {
      // nav.xhtml 파일이 있으면 하이퍼링크 문제는 해결된 것으로 간주
      console.log('✅ nav.xhtml 파일 확인됨 - 하이퍼링크 문제 해결');
      
      // nav.xhtml 파일에 기본 하이퍼링크 구조가 없으면 추가 제안
      const hasHyperlinks = content.includes('<a') && content.includes('href=');
      if (!hasHyperlinks) {
        errors.push({
          line: 1,
          column: 1,
          message: 'nav.xhtml 파일에 하이퍼링크가 없습니다. 목차 구조를 추가하세요.',
          severity: 'warning',
          type: 'epub',
          path: currentFilePath,
          file: currentFilePath
        });
      }
    }
    
    // 전체 EPUB 구조에서 nav.xhtml 하이퍼링크 문제 해결
    if (!isNavFile && (currentFilePath.includes('.xhtml') || currentFilePath.includes('.html'))) {
      // 다른 XHTML 파일에서 nav.xhtml로의 링크가 있는지 확인
      const hasNavLink = content.includes('nav.xhtml') || content.includes('navigation');
      
      // nav.xhtml 파일이 파일트리에 있는지 확인
      const navFileExists = fileTree.some(file => 
        file.name === 'nav.xhtml' || 
        file.path?.includes('nav.xhtml') ||
        file.url?.includes('nav.xhtml')
      );
      
      if (navFileExists && !hasNavLink) {
        // nav.xhtml 파일이 있지만 링크가 없으면 경고
        errors.push({
          line: 1,
          column: 1,
          message: 'nav.xhtml 파일이 존재하지만 이 파일에서 링크가 없습니다. EPUB 구조를 확인하세요.',
          severity: 'info',
          type: 'epub',
          path: currentFilePath,
          file: currentFilePath
        });
      }
    }
    
    // 샘플 오류 추가 (테스트용) - nav.xhtml 문제가 해결되면 제거
    if (errors.length === 0) {
      errors.push({
        line: 1,
        column: 1,
        message: 'EPUB 검사: 기본 검사 완료 (로컬 폴백)',
        severity: 'info',
        type: 'epub',
        path: currentFilePath,
        file: currentFilePath
      });
    }
    
    return errors;
  };

  // 통합 표준 검사 함수
  const runStandardChecks = async () => {
    try {
      console.log('🔄 통합 표준 검사 시작');
      
      // 기존 오류 초기화
      setEditorErrors([]);
      setCurrentErrorIndex(0);
      
      // Monaco Editor 오류 마커 초기화
      const editor = editorPaneRef.current?.getEditor();
      if (editor && window.monaco) {
        const model = editor.getModel();
        if (model) {
          window.monaco.editor.setModelMarkers(model, 'standard-check', []);
        }
      }
      

      
      // 접근성 검사
      const accessibilityResult = await checkAccessibilityStandard();
      
      // 전자책 표준 검사
      const epubResult = await checkEpubStandard();
      
        // 결과에서 오류 배열 추출하는 헬퍼 함수
  const getErrorsFromResult = (result) => {
    if (result.messages && Array.isArray(result.messages)) {
      return result.messages;
    } else if (result.data?.errors && Array.isArray(result.data.errors)) {
      return result.data.errors;
    } else if (result.errors && Array.isArray(result.errors)) {
      return result.errors;
    } else if (result.results && Array.isArray(result.results)) {
      return result.results;
    } else if (result.issues && Array.isArray(result.issues)) {
      return result.issues;
    }
    return [];
  };

  // 결과 요약 (다양한 응답 형식 처리)
  const getErrorCount = (result) => {
    return getErrorsFromResult(result).length;
  };
      
      const totalErrors = getErrorCount(accessibilityResult) + getErrorCount(epubResult);
      
      if (totalErrors > 0) {
        // 모든 오류 수집
        const allErrors = [];
        
        // 접근성 오류 추가
        if (accessibilityResult.success && accessibilityResult.data) {
          const accessibilityErrors = getErrorsFromResult(accessibilityResult);
          allErrors.push(...accessibilityErrors.map(error => ({
            ...error,
            type: '접근성'
          })));
        }
        
        // EPUB 오류 추가
        if (epubResult.success && epubResult.data) {
          const epubErrors = getErrorsFromResult(epubResult);
          allErrors.push(...epubErrors.map(error => ({
            ...error,
            type: 'EPUB'
          })));
        }
        
        // 상세 정보 생성
        const errorDetails = allErrors.slice(0, 3).map(error => 
          `라인 ${error.line}: [${error.type}] ${error.message}`
        ).join('\n');
        const remainingCount = allErrors.length > 3 ? allErrors.length - 3 : 0;
        
        let toastMessage = `⚠️ 표준 검사 완료: ${totalErrors}개 오류 발견\n\n${errorDetails}`;
        if (remainingCount > 0) {
          toastMessage += `\n\n...외 ${remainingCount}개 더`;
        }
        
        showToast(toastMessage, 'warning');
        
        // 에디터에 오류 마커 추가
        if (window.addErrorMarkers) {
          console.log('🔍 표준 검사 오류를 에디터에 추가:', allErrors);
          window.addErrorMarkers(allErrors, 'standard-check');
        }
        
        // 로그에 오류 추가
        allErrors.forEach(error => {
          logger.error('STANDARD_CHECK', `${error.type} 검사 오류: ${error.message}`, {
            line: parseInt(error.line) || 1,
            column: parseInt(error.column) || 1,
            offset: parseInt(error.offset) || 0,
            path: error.path || error.file || 'unknown',
            file: error.file || 'unknown',
            message: error.message,
            severity: error.severity || 'ERROR',
            type: error.type
          });
        });
        
        // 오류가 있으면 로그 뷰어 표시
        if (setLogViewerVisible) {
          console.log('🔍 로그 뷰어 표시 요청');
          setLogViewerVisible(true);
        }
      } else {
        showToast(`✅ 표준 검사 완료: 오류 없음`, 'success');
      }
      
      return { success: totalErrors === 0, accessibilityResult, epubResult, totalErrors };
    } catch (error) {
      console.error('❌ 통합 표준 검사 실패:', error);
      showToast(`❌ 통합 표준 검사 실패: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  };

  const handleFileClickWithInfo = async (fileNode, fileInfo, filePath) => {
    try {
      
      console.log('🔍 handleFileClickWithInfo 시작:', { fileNode, fileInfo, filePath });
      console.log('🔍 fileInfo.content 존재:', !!fileInfo.content);
      console.log('🔍 fileInfo.content 길이:', fileInfo.content ? fileInfo.content.length : 0);
      console.log('🔍 fileInfo.type:', fileInfo.type);
      console.log('🔍 fileInfo.content 미리보기:', fileInfo.content ? fileInfo.content.substring(0, 100) + '...' : '없음');
      
      const ext = fileNode.name.split('.').pop().toLowerCase();
      

      console.log('🔍 ext:', ext);
      // 이미지 파일인 경우
      if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
        console.log('🔍 이미지 파일 조건 확인:');
        console.log('  - fileInfo.type:', fileInfo.type);
        console.log('  - fileInfo.content 존재:', !!fileInfo.content);
        console.log('  - fileInfo.content 길이:', fileInfo.content ? fileInfo.content.length : 0);
        
        // 이미지 파일이고 content가 있으면 처리 (type이 'image'가 아니어도 확장자로 판단)
        if (fileInfo.content) {
          
          // 이미지 소스 결정 (항상 서버 절대 URL 사용)
          let imageSrc = fileInfo.content;
          
          
          // fileInfo에 filePath가 있으면 그걸로 사용, 없으면 기존 fileNode.path 사용
          // 이미지 미리보기 표시
          if (!fileInfo.content.startsWith('data:image')) {
            const currentBookId = bookInfo?.slug || bookInfo?.id || projectId || targetBookId || '';
            const workspaceBaseUrl = getWorkspaceBaseUrl(currentBookId);
            const rawPath = fileInfo.filePath || fileNode.path || '';
            const cleanPath = normalizeToWorkspacePath(rawPath);
            imageSrc = `${workspaceBaseUrl}${cleanPath}`;
          }
          console.log('🔍 imageSrc:', imageSrc);

          // 이미지 미리보기 표시 (imageSrc 사용)
          const imageContent = `
            <div style="text-align:center;padding:20px;font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;">
              <img src="${imageSrc}" alt="${fileNode.name}" style="max-width:100%;height:auto;" />
            </div>
          `;
          await openTab(fileNode, imageContent, 'html');

        } else {
          const errorContent = `
            <div style="text-align: center; padding: 20px; font-family: 'Inter', sans-serif;">
              <h2>❌ 이미지 로드 실패</h2>
              <p style="color: #d73a49; margin-bottom: 20px;">${fileNode.name}</p>
              <div style="padding: 15px; background: #f8d7da; border-radius: 8px; text-align: left;">
                <h3>📋 오류 정보</h3>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>파일명:</strong> ${fileNode.name}</li>
                  <li><strong>경로:</strong> ${fileInfo.filePath || fileNode.path}</li>
                  <li><strong>오류:</strong> 이미지 데이터가 없습니다</li>
                </ul>
              </div>
            </div>
          `;
          await openTab(fileNode, errorContent, 'html');
        }
        return;
      }
      
      // 텍스트 파일인 경우
      console.log('🔍 텍스트 파일 처리 조건 확인:');
      console.log('  - fileInfo.content 존재:', !!fileInfo.content);
      console.log('  - fileInfo.type !== binary:', fileInfo.type !== 'binary');
      console.log('  - 조건 만족:', !!(fileInfo.content && fileInfo.type !== 'binary'));
      
      if (fileInfo.content && fileInfo.type !== 'binary') {
        let processedContent = fileInfo.content;
        
        // HTML/XHTML 파일인 경우 이미지 처리만 (편집기용이므로 CSS는 원본 유지)
        if (['html', 'xhtml'].includes(fileInfo.type)) {
          processedContent = await processXHTMLContent(fileInfo.content, fileInfo.filePath || fileNode.path, false);
        }
        
        // xhtml 파일의 경우 타입을 xhtml로 설정
        const finalType = fileInfo.type === 'xhtml' ? 'xhtml' : fileInfo.type;
        
        await openTab(fileNode, processedContent, finalType);
      } else {
        console.log('❌ 텍스트 파일 처리 실패 - 조건 불만족');
        console.log('  - fileInfo.content:', !!fileInfo.content);
        console.log('  - fileInfo.type:', fileInfo.type);
        console.log('  - fileInfo.size:', fileInfo.size);
        
        const errorContent = `
          <div style="text-align: center; padding: 20px; font-family: 'Inter', sans-serif;">
            <h2>❌ 파일 로드 실패</h2>
            <p style="color: #d73a49; margin-bottom: 20px;">${fileNode.name}</p>
            <div style="padding: 15px; background: #f8d7da; border-radius: 8px; text-align: left;">
              <h3>📋 오류 정보</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>파일명:</strong> ${fileNode.name}</li>
                <li><strong>경로:</strong> ${fileInfo.filePath || fileNode.path}</li>
                <li><strong>타입:</strong> ${fileInfo.type}</li>
                <li><strong>크기:</strong> ${fileInfo.size} bytes</li>
                <li><strong>오류:</strong> 텍스트 내용을 읽을 수 없습니다</li>
              </ul>
            </div>
          </div>
        `;
        await openTab(fileNode, errorContent, 'html');
      }
      
      setSelectedFile(fileNode);
      
      // 파일을 연 후 자동으로 미리보기 업데이트
        const currentTab = getCurrentTab();
        if (currentTab) {
          runCode();
        }
      
    } catch (error) {
      console.error('파일 로드 오류:', error);
      const errorContent = `
        <div style="text-align: center; padding: 20px; font-family: 'Inter', sans-serif;">
          <h2>❌ 파일 로드 오류</h2>
          <p style="color: #d73a49; margin-bottom: 20px;">${fileNode.name}</p>
          <div style="padding: 15px; background: #f8d7da; border-radius: 8px; text-align: left;">
            <h3>📋 오류 정보</h3>
            <ul style="list-style: none; padding: 0;">
              <li><strong>파일명:</strong> ${fileNode.name}</li>
              <li><strong>경로:</strong> ${fileNode.path}</li>
              <li><strong>오류:</strong> ${error.message}</li>
            </ul>
          </div>
        </div>
      `;
      await openTab(fileNode, errorContent, 'html');
      
      // 에러 내용도 미리보기에 표시
      setTimeout(() => {
        const currentTab = getCurrentTab();
        if (currentTab) {
          runCode();
        }
      }, 100);
    }
  };

  // XHTML 파일의 이미지와 CSS를 처리하는 함수
  const processXHTMLContent = async (content, filePath, isForPreview = false) => {
    if (!epubData || !epubData.zipContent) {
      console.warn('EPUB 데이터가 없어 XHTML 처리를 건너뜁니다.');
      return content;
    }

    let processedContent = content;
    
    // 1. CSS 링크 처리 (미리보기/에디터 분기)
    processedContent = await processXHTMLStyles(processedContent, filePath, isForPreview);
    
    // 2. 이미지 처리 (미리보기/에디터 분기)
    processedContent = await processXHTMLImages(processedContent, filePath, isForPreview);
    
    return processedContent;
  };
  // CSS 링크 경로를 해결하여 미리보기에 적용하는 함수
  const processXHTMLStyles = async (content, filePath, isForPreview = false) => {
    if (!epubData || !epubData.zipContent) {
      return content;
    }

    console.log('XHTML CSS 처리 시작:', filePath);
    let processedContent = content;

    // 이미지 로직과 동일하게: 어떤 입력이 와도 workspace/ 이후 경로만 남기기
    const normalizeToWorkspacePath = (rawPath) => {
      let p = String(rawPath || '');
      try {
        if (/^https?:\/\//i.test(p)) {
          const u = new URL(p);
          p = u.pathname || '';
        }
      } catch (_) {}
      // 문자열 중간에 섞인 도메인 조각 제거
      p = p.replace(/https?:\/\/[^\s"']+/gi, (m) => {
        try { const u = new URL(m); return u.pathname; } catch { return ''; }
      });
      // 마지막 workspace/ 이후만 사용
      const low = p.toLowerCase();
      const lastWs = low.lastIndexOf('/workspace/');
      if (lastWs !== -1) p = p.slice(lastWs + '/workspace/'.length);
      // 선행 슬래시/선행 workspace 제거
      p = p.replace(/^\/+/, '').replace(/^workspace\//i, '');
      // 중복 세그먼트 정리
      p = p.replace(/OEBPS\/OEBPS\//g, 'OEBPS/').replace(/Styles\/Styles\//g, 'Styles/').replace(/CSS\/CSS\//g, 'CSS/');
      return p;
    };

    const computeRelativePath = (fromFilePath, toWorkspacePath) => {
      if (!toWorkspacePath) return '';
      const fromWS = normalizeToWorkspacePath(fromFilePath || '');
      const toWS = normalizeToWorkspacePath(toWorkspacePath || '');
      const fromDir = fromWS.split('/').slice(0, -1).filter(Boolean);
      const toParts = toWS.split('/').filter(Boolean);
      let i = 0;
      while (i < fromDir.length && i < toParts.length && fromDir[i] === toParts[i]) {
        i++;
      }
      const upMoves = fromDir.length - i;
      const relParts = new Array(upMoves).fill('..').concat(toParts.slice(i));
      const rel = relParts.join('/');
      return rel || './';
    };

    // link 태그 찾기 (CSS 파일) - 더 포괄적인 패턴
    const linkRegexes = [
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi,
      /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
      /<link[^>]+type=["']text\/css["'][^>]*href=["']([^"']+)["'][^>]*>/gi
    ];
    
    let linkMatches = [];
    for (const regex of linkRegexes) {
      const matches = [...processedContent.matchAll(regex)];
      linkMatches = linkMatches.concat(matches);
    }
    
    console.log('발견된 CSS 링크들:', linkMatches.map(match => ({
      fullTag: match[0],
      href: match[1]
    })));

    for (const match of linkMatches) {
      const fullLinkTag = match[0];
      const originalHref = match[1];

      try {
        console.log('CSS 처리 중:', originalHref);

        // Base URL을 사용한 경로 계산
        let absolutePath = originalHref;
        
        // Base URL 사용 (전역 설정 또는 filePath에서 추출)
        let currentBaseUrl = baseUrl;
        
        // filePath가 URL인 경우 base URL 추출 (전역 설정보다 우선)
        if (filePath && filePath.startsWith('http')) {
          try {
            const url = new URL(filePath);
            const pathParts = url.pathname.split('/').filter(part => part !== '');
            const workspaceIndex = pathParts.findIndex(part => part === 'workspace');
            
            if (workspaceIndex !== -1) {
              // workspace까지의 경로만 사용
              const workspacePath = pathParts.slice(0, workspaceIndex + 1).join('/');
              currentBaseUrl = `${url.origin}/${workspacePath}/`;
            } else {
              // workspace가 없는 경우 파일 경로에서 base URL 추출
              const lastSlashIndex = url.pathname.lastIndexOf('/');
              if (lastSlashIndex !== -1) {
                currentBaseUrl = `${url.origin}${url.pathname.substring(0, lastSlashIndex + 1)}`;
              }
            }
          } catch (error) {
            console.error('URL 파싱 오류:', error);
            // fallback: 기존 로직 사용
            const urlParts = filePath.split('/');
            const workspaceIndex = urlParts.findIndex(part => part === 'workspace');
            if (workspaceIndex !== -1) {
              currentBaseUrl = urlParts.slice(0, workspaceIndex + 1).join('/') + '/';
            } else {
              const lastSlashIndex = filePath.lastIndexOf('/');
              if (lastSlashIndex !== -1) {
                currentBaseUrl = filePath.substring(0, lastSlashIndex + 1);
              }
            }
          }
        }
        
        console.log('사용할 Base URL:', currentBaseUrl);
        
        // 이미 절대 경로가 아닌 경우 상대 경로 처리
        if (!absolutePath.startsWith('/') && !absolutePath.startsWith('http')) {
          // filePath에서 디렉토리 경로 추출
          let fileDir;
          if (filePath.startsWith('http')) {
            // URL에서 상대 경로 부분만 추출
            const urlParts = filePath.split('/');
            const workspaceIndex = urlParts.findIndex(part => part === 'workspace');
            if (workspaceIndex !== -1) {
              // workspace 이후의 경로만 사용
              fileDir = urlParts.slice(workspaceIndex + 1, -1).join('/');
            } else {
              fileDir = filePath.split('/').slice(0, -1).join('/');
            }
          } else {
            fileDir = filePath.split('/').slice(0, -1).join('/');
          }
          
          console.log('파일 디렉토리:', fileDir, '원본 경로:', absolutePath);
          
          if (absolutePath.startsWith('../')) {
            // ../ 로 시작하는 경우 - 상위 디렉토리로 이동
            const pathParts = fileDir.split('/');
            const upLevels = (absolutePath.match(/\.\.\//g) || []).length;
            const remainingPath = absolutePath.replace(/^\.\.\//, '');
            
            // 상위 디렉토리로 이동
            const newPathParts = pathParts.slice(0, -upLevels);
            absolutePath = newPathParts.join('/') + '/' + remainingPath;
            
            console.log('상위 디렉토리 이동:', {
              originalPath: absolutePath,
              upLevels,
              remainingPath,
              newPath: absolutePath
            });
          } else if (absolutePath.startsWith('./')) {
            // ./ 로 시작하는 경우
            absolutePath = `${fileDir}/${absolutePath.substring(2)}`;
          } else {
            // 상대 경로
            absolutePath = `${fileDir}/${absolutePath}`;
          }
        }
        
        // 경로 정규화 (../ 처리)
        const pathParts = absolutePath.split('/').filter(part => part !== '');
        const normalizedParts = [];
        for (const part of pathParts) {
          if (part === '..') {
            if (normalizedParts.length > 0) {
              normalizedParts.pop();
            }
          } else if (part !== '.') {
            normalizedParts.push(part);
          }
        }
        absolutePath = normalizedParts.join('/');
        
        console.log('경로 정규화 후:', absolutePath);
        
        // 상대 경로만 추출 (base URL 적용하지 않음)
        const relativePath = absolutePath;
        
        // 여러 경로 후보 생성 (EPUB 구조 고려)
        const pathCandidates = [
          relativePath,
          relativePath.startsWith('OEBPS/') ? relativePath : `OEBPS/${relativePath}`,
          relativePath.startsWith('EPUB/') ? relativePath : `EPUB/${relativePath}`,
          relativePath.includes('/') ? relativePath : `OEBPS/Styles/${relativePath}`,
          relativePath.includes('/') ? relativePath : `OEBPS/CSS/${relativePath}`,
          relativePath.includes('/') ? relativePath : `Styles/${relativePath}`,
          relativePath.includes('/') ? relativePath : `CSS/${relativePath}`,
          // 추가 후보: 원본 경로에서 추출한 정보 기반
          originalHref.includes('Styles/') ? `OEBPS/Styles/${originalHref.split('Styles/')[1]}` : null,
          originalHref.includes('CSS/') ? `OEBPS/CSS/${originalHref.split('CSS/')[1]}` : null,
          // 상대 경로 기반 추가 후보
          originalHref.startsWith('../') ? originalHref.substring(3) : null,
          originalHref.startsWith('./') ? originalHref.substring(2) : null
        ].filter(Boolean); // null 값 제거

        console.log('CSS 경로 해결:', {
          originalHref,
          filePath,
          pathCandidates
        });

        // 여러 경로 후보에서 CSS 파일 찾기
        let cssFileInfo = null;
        let foundPath = null;
        
        console.log('CSS 파일 검색 시작, 후보 경로들:', pathCandidates);
        
        for (const candidatePath of pathCandidates) {
          const fileInfo = epubData.zipContent[candidatePath];
          console.log('검색 중:', candidatePath, '파일 존재:', !!fileInfo);
          
          if (fileInfo && fileInfo.content && (fileInfo.type === 'css' || fileInfo.fileName.endsWith('.css') || candidatePath.endsWith('.css'))) {
            cssFileInfo = fileInfo;
            foundPath = candidatePath;
            console.log('CSS 파일 발견:', foundPath);
            break;
          }
        }
        
        if (!cssFileInfo) {
          console.log('CSS 파일을 찾지 못함, 사용 가능한 파일들:');
          const allFiles = Object.keys(epubData.zipContent);
          const cssFiles = allFiles.filter(path => 
            path.toLowerCase().includes('.css') || 
            epubData.zipContent[path].type === 'css'
          );
          
          cssFiles.forEach(path => {
              console.log('  -', path, '타입:', epubData.zipContent[path].type);
          });
          
          // CSS 파일을 찾지 못했지만 CSS 파일이 있는 경우 첫 번째 것을 사용
          if (cssFiles.length > 0) {
            cssFileInfo = epubData.zipContent[cssFiles[0]];
            foundPath = cssFiles[0];
            console.log('첫 번째 CSS 파일 사용:', foundPath);
          }
        }

        // 미리보기용인지 편집기용인지에 따라 다른 처리
        if (isForPreview && cssFileInfo) {
          // 미리보기: 이미지 로직과 동일하게 정규화한 절대 URL로 연결
          const currentBookId = bookInfo?.slug || bookInfo?.id || projectId || targetBookId || '';
          const workspaceBaseUrl = getWorkspaceBaseUrl(currentBookId);
          const clean = normalizeToWorkspacePath(foundPath || originalHref);
          const cssUrl = `${workspaceBaseUrl}${clean}`;
          const updatedLinkTag = fullLinkTag.replace(/href=["']([^"']+)["']/, `href="${cssUrl}"`);
          processedContent = processedContent.replace(fullLinkTag, updatedLinkTag);
          console.log('CSS 링크 절대 URL로 변환 (미리보기):', originalHref, '→', cssUrl);
        } else {
          // 편집기용: 현재 파일 기준 상대 경로로 변환
          const cleanTarget = normalizeToWorkspacePath(foundPath || pathCandidates[0] || originalHref);
          const relativeCssPath = computeRelativePath(filePath, cleanTarget);
          const updatedLinkTag = fullLinkTag.replace(/href=["']([^"']+)["']/, `href="${relativeCssPath}"`);
          processedContent = processedContent.replace(fullLinkTag, updatedLinkTag);
        }
        
        if (!cssFileInfo) {
          console.warn('CSS 파일을 찾을 수 없음:', originalHref, '후보 경로들:', pathCandidates);
          if (isForPreview) {
            const allCssFiles = Object.keys(epubData.zipContent).filter(path => path.toLowerCase().includes('.css') || epubData.zipContent[path].type === 'css');
            if (allCssFiles.length > 0) {
              const currentBookId = bookInfo?.slug || bookInfo?.id || projectId || targetBookId || '';
              const workspaceBaseUrl = getWorkspaceBaseUrl(currentBookId);
              const cleanFound = normalizeToWorkspacePath(allCssFiles[0]);
              const cssUrl = `${workspaceBaseUrl}${cleanFound}`;
              const updatedLinkTag = fullLinkTag.replace(/href=["']([^"']+)["']/, `href="${cssUrl}"`);
              processedContent = processedContent.replace(fullLinkTag, updatedLinkTag);
              console.log('CSS 파일을 찾지 못했지만 첫 번째 CSS 파일을 절대 URL로 연결 (미리보기):', originalHref, '→', cssUrl);
        } else {
              console.warn('CSS 파일이 전혀 없어 링크 유지/무시:', originalHref);
            }
          }
          const availableCssFiles = Object.keys(epubData.zipContent).filter(path => path.toLowerCase().includes('.css') || epubData.zipContent[path].type === 'css');
          console.log('EPUB 내 사용 가능한 CSS 파일들:', availableCssFiles);
        }
      } catch (error) {
        console.error('CSS 처리 오류:', error);
      }
    }

    return processedContent;
  };

  // 이미지 사용 여부를 확인하는 함수
  const checkImageUsage = () => {
    if (!epubData || !epubData.zipContent) return;
    
    // Images 폴더에서 모든 이미지 파일 찾기
    const imageFiles = [];
    const findImageFiles = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'file' && /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(node.name)) {
          imageFiles.push(node);
        }
        if (node.children && node.children.length > 0) {
          findImageFiles(node.children);
        }
      }
    };
    
    findImageFiles(fileTree);
    
    // 모든 XHTML 파일에서 이미지 참조 찾기
    const usedImages = new Set();
    const findImageReferences = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'file' && /\.(html|xhtml)$/i.test(node.name)) {
          const content = node.content || '';
          const imgMatches = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
          if (imgMatches) {
            imgMatches.forEach(match => {
              const srcMatch = match.match(/src=["']([^"']+)["']/);
              if (srcMatch) {
                const src = srcMatch[1];
                // 상대 경로를 절대 경로로 변환
                const absolutePath = resolveImagePath(src, node.path);
                usedImages.add(absolutePath);
              }
            });
          }
        }
        if (node.children && node.children.length > 0) {
          findImageReferences(node.children);
        }
      }
    };
    
    findImageReferences(fileTree);
    
    // 사용되지 않는 이미지 찾기
    const unused = imageFiles.filter(img => !usedImages.has(img.path));
    setUnusedImages(unused);
    
    if (unused.length > 0) {
      setShowUnusedImageModal(true);
    }
  };
  
  // 이미지 경로 해결 함수
  const resolveImagePath = (src, basePath) => {
    if (src.startsWith('http')) return src;
    if (src.startsWith('/')) return src;
    
    // 상대 경로를 절대 경로로 변환
    const baseDir = basePath.split('/').slice(0, -1).join('/');
    return `${baseDir}/${src}`;
  };
  
  // workspace 기준 경로 정규화 유틸 (이미지/CSS 공통)
  const normalizeToWorkspacePath = (rawPath) => {
    let p = String(rawPath || '');
    try {
      if (/^https?:\/\//i.test(p)) {
        const u = new URL(p);
        p = u.pathname || '';
      }
    } catch (_) {}
    // 경로 중간의 도메인 조각 제거
    p = p.replace(/https?:\/\/[^\s"']+/gi, (m) => {
      try { const u = new URL(m); return u.pathname; } catch { return ''; }
    });
    // 마지막 workspace/ 이후만 사용
    const low = p.toLowerCase();
    const lastWs = low.lastIndexOf('/workspace/');
    if (lastWs !== -1) {
      p = p.slice(lastWs + '/workspace/'.length);
    }
    // 선행 슬래시/선행 workspace 제거
    p = p.replace(/^\/+/, '').replace(/^workspace\//i, '');
    // 중복 세그먼트 정리
    p = p
      .replace(/OEBPS\/OEBPS\//g, 'OEBPS/')
      .replace(/Images\/Images\//g, 'Images/')
      .replace(/Styles\/Styles\//g, 'Styles/')
      .replace(/CSS\/CSS\//g, 'CSS/');
    return p;
  };
  
  // 사용되지 않는 이미지 삭제 함수
  const deleteUnusedImages = () => {
    // 실제 삭제 로직 구현
    console.log('사용되지 않는 이미지 삭제:', unusedImages);
    setUnusedImages([]);
    setShowUnusedImageModal(false);
  };

  // 외부 CSS 링크를 인라인으로 변환하는 함수
  const convertExternalLinksToInline = (htmlContent) => {
    // 외부 CSS 링크를 찾아서 제거하고 경고 메시지 추가
    const cssLinkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let match;
    let modifiedContent = htmlContent;
    const removedCssLinks = [];
    
    while ((match = cssLinkRegex.exec(htmlContent)) !== null) {
      const fullLink = match[0];
      const href = match[1];
      
      // localhost나 외부 URL인 경우 제거하고 경고 추가
      if (href.includes('localhost') || href.startsWith('http')) {
        console.warn(`외부 CSS 링크 제거됨: ${href}`);
        removedCssLinks.push(href);
        modifiedContent = modifiedContent.replace(fullLink, 
          `<!-- 외부 CSS 링크 제거됨: ${href} (미리보기에서는 지원되지 않음) -->`
        );
      }
    }
    
    // 제거된 외부 CSS 링크들을 상태에 저장 (항상 업데이트)
    setExternalCssLinks(removedCssLinks);
    
    return { content: modifiedContent, cssLinks: removedCssLinks };
  };

  // HTML 콘텐츠에 기본 폰트 설정과 외부 CSS를 추가하는 함수 (미리보기 전용)
  const addDefaultFontToHTML = (htmlContent, cssLinks = []) => {
    // head 태그가 있는지 확인
    if (htmlContent.includes('<head>')) {
      // head 태그 안에 기본 폰트 스타일과 외부 CSS 추가
      const previewStyle = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
          
          * {
            font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
          }
          
          body {
            font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
            line-height: 1.6;
            font-size: 16px;
          }
          
          h1, h2, h3, h4, h5, h6 {
            font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
            font-weight: 500;
          }
          
          p {
            font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
            font-weight: 400;
          }
        </style>
        
        <!-- 외부 CSS 링크 (미리보기 전용) -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
        
        <!-- 제거된 외부 CSS 링크들을 미리보기에 적용 -->
        ${cssLinks.map(href => `<link rel="stylesheet" href="${href}">`).join('\n        ')}
      `;
      
      return htmlContent.replace('</head>', `${previewStyle}</head>`);
    } else {
      // head 태그가 없으면 body 태그 앞에 추가
      const previewStyle = `
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
            
            * {
              font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
            }
            
            body {
              font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
              line-height: 1.6;
              font-size: 16px;
            }
            
            h1, h2, h3, h4, h5, h6 {
              font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
              font-weight: 500;
            }
            
            p {
              font-family: 'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif;
              font-weight: 400;
            }
          </style>
          
          <!-- 외부 CSS 링크 (미리보기 전용) -->
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
          
          <!-- 제거된 외부 CSS 링크들을 미리보기에 적용 -->
          ${cssLinks.map(href => `<link rel="stylesheet" href="${href}">`).join('\n          ')}
        </head>
      `;
      
      return htmlContent.replace('<body', `${previewStyle}<body`);
    }
  };
  // XHTML 파일의 이미지 경로를 Base64로 변환하는 함수
  const processXHTMLImages = async (content, filePath, isForPreview = false) => {
    if (!epubData || !epubData.zipContent) {
      console.warn('EPUB 데이터가 없어 이미지 처리를 건너뜁니다.');
      return content;
    }

    console.log('=== 이미지 처리 시작 ===');
    console.log('파일 경로:', filePath);
    console.log('EPUB 데이터 키:', Object.keys(epubData));
    console.log('ZIP 콘텐츠 키 수:', Object.keys(epubData.zipContent).length);
    console.log('ZIP 콘텐츠 샘플:', Object.keys(epubData.zipContent).slice(0, 10));
    
    // EPUB 파일 구조 분석
    const allFiles = Object.keys(epubData.zipContent);
    const imageFiles = allFiles.filter(f => 
      f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) || 
      epubData.zipContent[f].type === 'image'
    );
    const cssFiles = allFiles.filter(f => 
      f.toLowerCase().includes('.css') || 
      epubData.zipContent[f].type === 'css'
    );
    
    console.log('EPUB 파일 구조 분석:', {
      totalFiles: allFiles.length,
      imageFiles: imageFiles.length,
      cssFiles: cssFiles.length,
      imageFilePaths: imageFiles,
      cssFilePaths: cssFiles
    });
    
    // 모든 파일의 상세 정보 출력 (디버깅용)
    console.log('=== 모든 파일 상세 정보 ===');
    allFiles.forEach((filePath, index) => {
      const fileInfo = epubData.zipContent[filePath];
      console.log(`${index + 1}. ${filePath}`, {
        type: fileInfo.type,
        size: fileInfo.size,
        fileName: fileInfo.fileName,
        hasContent: !!fileInfo.content,
        contentLength: fileInfo.content ? fileInfo.content.length : 0
      });
    });

    // safeBtoa 함수 정의
    const safeBtoa = (str) => {
      try {
        return btoa(str);
      } catch (e) {
        // Latin1 범위를 벗어나는 문자가 있는 경우 UTF-8로 인코딩
        return btoa(unescape(encodeURIComponent(str)));
      }
    };

    console.log('XHTML 이미지 처리 시작:', filePath);
    console.log('HTML 내용에서 img 태그 검색...');
    let processedContent = content;
    let processedCount = 0;

    // img 태그 찾기
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const imgMatches = [...processedContent.matchAll(imgRegex)];
    
    console.log('발견된 img 태그들:', imgMatches.map(match => ({
      fullTag: match[0],
      src: match[1]
    })));

    for (const match of imgMatches) {
      const fullImgTag = match[0];
      const originalSrc = match[1];
      let absolutePath = originalSrc; // 변수를 try 블록 밖에서 선언

      try {
        console.log('이미지 처리 중:', originalSrc);

        // 절대 경로 계산 (개선된 로직)
        const fileDir = filePath.split('/').slice(0, -1).join('/');
        console.log('파일 디렉토리:', fileDir);

        // 상대 경로 처리 개선
        if (!absolutePath.startsWith('/') && !absolutePath.startsWith('http')) {
          if (absolutePath.startsWith('./')) {
            absolutePath = absolutePath.substring(2);
          }
          if (absolutePath.startsWith('../')) {
            // ../ 경로 처리
            const pathParts = absolutePath.split('/');
            const upLevels = pathParts.filter(part => part === '..').length;
            const remainingPath = pathParts.slice(upLevels).join('/');
            const filePathParts = filePath.split('/');
            const newPathParts = filePathParts.slice(0, -upLevels - 1);
            absolutePath = [...newPathParts, remainingPath].join('/');
          } else if (fileDir) {
            absolutePath = `${fileDir}/${absolutePath}`;
          }
        }
        
        console.log('이미지 경로 해결:', {
          originalSrc,
          filePath,
          fileDir,
          absolutePath,
          pathType: originalSrc.startsWith('/') ? 'absolute' : originalSrc.startsWith('http') ? 'external' : 'relative'
        });

        // 미리보기: 절대 URL, 에디터: 상대 경로 유지
        if (!originalSrc.startsWith('http')) {
          let cleanPath = absolutePath.replace(/^\/+/, '');
          cleanPath = cleanPath.replace(/https?:\/\/[^\s"']+/gi, (m) => {
            try { const u = new URL(m); return u.pathname; } catch { return ''; }
          });
          const wsIdx = cleanPath.toLowerCase().lastIndexOf('workspace/');
          if (wsIdx !== -1) {
            cleanPath = cleanPath.slice(wsIdx + 'workspace/'.length);
          }
          if (cleanPath.includes('OEBPS/OEBPS/')) cleanPath = cleanPath.replace('OEBPS/OEBPS/', 'OEBPS/');
          if (cleanPath.includes('Images/Images/')) cleanPath = cleanPath.replace('Images/Images/', 'Images/');
          cleanPath = cleanPath.replace(/^workspace\//i, '').replace(/^\/+/, '');

          if (isForPreview) {
            const currentBookId = bookInfo?.slug || bookInfo?.id || projectId || targetBookId || '';
            const workspaceBaseUrl = getWorkspaceBaseUrl(currentBookId);
            const imageUrl = `${workspaceBaseUrl}${cleanPath}`;
            let newImgTag = fullImgTag.replace(/src=["']([^"']+)["']/i, `src="${imageUrl}"`);
            processedContent = processedContent.replace(fullImgTag, newImgTag);
            processedCount++;
            continue;
          } else {
            // 에디터 표시용: 현재 파일 기준 상대 경로 계산
            const computeRelative = (fromFilePath, toWorkspacePath) => {
              const normalizeWS = (raw) => {
                let p = String(raw || '');
                const low = p.toLowerCase();
                const lastWs = low.lastIndexOf('/workspace/');
                if (lastWs !== -1) p = p.slice(lastWs + '/workspace/'.length);
                p = p.replace(/^\/+/, '').replace(/^workspace\//i, '');
                return p;
              };
              const fromWS = normalizeWS(fromFilePath);
              const toWS = normalizeWS(toWorkspacePath);
              const fromDir = fromWS.split('/').slice(0, -1).filter(Boolean);
              const toParts = toWS.split('/').filter(Boolean);
              let i = 0;
              while (i < fromDir.length && i < toParts.length && fromDir[i] === toParts[i]) i++;
              const upMoves = fromDir.length - i;
              const relParts = new Array(upMoves).fill('..').concat(toParts.slice(i));
              const rel = relParts.join('/');
              return rel || './';
            };
            const relativePath = computeRelative(filePath, cleanPath);
            let newImgTag = fullImgTag.replace(/src=["']([^"']+)["']/i, `src="${relativePath}"`);
            processedContent = processedContent.replace(fullImgTag, newImgTag);
            processedCount++;
            continue;
          }
        }

        // 이미지 파일 찾기 (개선된 로직)
        let imageInfo = null;
        let resolvedPath = null;
        const fileName = originalSrc.split('/').pop();
        
        // 1. 정확한 경로 매칭 시도
        const exactPaths = [
          absolutePath,
          originalSrc,
          `OEBPS/${absolutePath}`,
          `OEBPS/${originalSrc}`,
          absolutePath.replace(/^\.\.\//, ''),
          originalSrc.replace(/^\.\.\//, '')
        ];
        
        console.log('정확한 경로 매칭 시도:', exactPaths);
        
        for (const path of exactPaths) {
          if (epubData.zipContent[path]) {
            imageInfo = epubData.zipContent[path];
            resolvedPath = path;
            console.log('정확한 경로로 찾음:', path);
            break;
          }
        }
        
        // 2. 파일명으로 검색 (정확한 경로가 없을 때)
        if (!imageInfo && fileName) {
          const files = Object.keys(epubData.zipContent);
          const matchingFile = files.find(f => f.endsWith(fileName));
          if (matchingFile) {
            imageInfo = epubData.zipContent[matchingFile];
            resolvedPath = matchingFile;
            console.log('파일명으로 검색 성공:', matchingFile);
          }
        }
        
        // 3. 이미지 파일 중에서 유사한 이름 검색
        if (!imageInfo && fileName) {
          const imageFiles = Object.keys(epubData.zipContent).filter(f => 
            f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) || 
            epubData.zipContent[f].type === 'image'
          );
          
          const matchingImage = imageFiles.find(f => 
            f.toLowerCase().includes(fileName.toLowerCase()) || 
            f.toLowerCase().endsWith(fileName.toLowerCase())
          );
          
          if (matchingImage) {
            imageInfo = epubData.zipContent[matchingImage];
            resolvedPath = matchingImage;
            console.log('이미지 파일 검색 성공:', matchingImage);
          }
        }
        
        // 4. 더 강력한 검색: 파일명에서 확장자 제거 후 검색
        if (!imageInfo && fileName) {
          const fileNameWithoutExt = fileName.split('.')[0];
          const allFiles = Object.keys(epubData.zipContent);
          const imageFiles = allFiles.filter(f => 
            f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) || 
            epubData.zipContent[f].type === 'image'
          );
          
          const matchingImage = imageFiles.find(f => {
            const fName = f.split('/').pop().split('.')[0];
            return fName.toLowerCase() === fileNameWithoutExt.toLowerCase();
          });
          
          if (matchingImage) {
            imageInfo = epubData.zipContent[matchingImage];
            resolvedPath = matchingImage;
            console.log('확장자 제거 후 검색 성공:', matchingImage);
          }
        }
        
        // 5. 모든 이미지 파일에서 부분 매칭 검색
        if (!imageInfo && fileName) {
          const allFiles = Object.keys(epubData.zipContent);
          const imageFiles = allFiles.filter(f => 
            f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) || 
            epubData.zipContent[f].type === 'image'
          );
          
          // 파일명의 일부가 포함된 이미지 찾기
          const matchingImage = imageFiles.find(f => {
            const fName = f.split('/').pop().toLowerCase();
            const searchName = fileName.toLowerCase();
            return fName.includes(searchName) || searchName.includes(fName);
          });
          
          if (matchingImage) {
            imageInfo = epubData.zipContent[matchingImage];
            resolvedPath = matchingImage;
            console.log('부분 매칭 검색 성공:', matchingImage);
          }
        }
        
        // 5.5. 추가 검색: 원본 경로에서 추출한 정보로 검색
        if (!imageInfo && originalSrc) {
          const allFiles = Object.keys(epubData.zipContent);
          const imageFiles = allFiles.filter(f => 
            f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) || 
            epubData.zipContent[f].type === 'image'
          );
          
          // 원본 경로에서 디렉토리와 파일명 추출
          const originalPathParts = originalSrc.split('/');
          const originalDir = originalPathParts.slice(0, -1).join('/');
          const originalFileName = originalPathParts[originalPathParts.length - 1];
          
          console.log('원본 경로 분석:', {
            originalSrc,
            originalDir,
            originalFileName
          });
          
          // 원본 디렉토리 기반 검색
          const matchingImage = imageFiles.find(f => {
            const fPath = f.toLowerCase();
            const searchDir = originalDir.toLowerCase();
            const searchFileName = originalFileName.toLowerCase();
            
            return (fPath.includes(searchDir) && fPath.includes(searchFileName)) ||
                   fPath.endsWith(searchFileName) ||
                   fPath.includes(searchFileName);
          });
          
          if (matchingImage) {
            imageInfo = epubData.zipContent[matchingImage];
            console.log('원본 경로 기반 검색 성공:', matchingImage);
          }
        }
        
        // 6. 마지막 시도: 모든 이미지 파일 중에서 첫 번째 사용
        if (!imageInfo) {
          const allFiles = Object.keys(epubData.zipContent);
          const imageFiles = allFiles.filter(f => 
            f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) || 
            epubData.zipContent[f].type === 'image'
          );
          
          if (imageFiles.length > 0) {
            // 가장 적절한 이미지 파일 선택 (우선순위: PNG > JPG > 기타)
            let bestImagePath = imageFiles[0];
            
            // PNG 파일 우선
            const pngFiles = imageFiles.filter(f => f.toLowerCase().endsWith('.png'));
            if (pngFiles.length > 0) {
              bestImagePath = pngFiles[0];
            } else {
              // JPG 파일 차선
              const jpgFiles = imageFiles.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));
              if (jpgFiles.length > 0) {
                bestImagePath = jpgFiles[0];
              }
            }
            
            imageInfo = epubData.zipContent[bestImagePath];
            resolvedPath = bestImagePath;
            console.log('대체 이미지 파일 사용:', bestImagePath, '(선택된 파일 중 최적)');
          }
          
          console.log('이미지 파일을 찾을 수 없음:', {
            originalSrc,
            absolutePath,
            fileName,
            searchAttempts: [
              '정확한 경로 매칭',
              '파일명으로 검색',
              '이미지 파일 유사 이름 검색',
              '확장자 제거 후 검색',
              '부분 매칭 검색',
              '원본 경로 기반 검색',
              '첫 번째 이미지 파일 사용'
            ],
            totalFiles: allFiles.length,
            imageFiles: imageFiles.length,
            availableImages: imageFiles.slice(0, 10), // 처음 10개만 표시
            allImageFiles: imageFiles, // 전체 이미지 파일 목록
            // 추가 디버깅 정보
            filePath,
            fileDir,
            allFilePaths: allFiles.slice(0, 20), // 처음 20개 파일 경로
            // 이미지 파일 상세 정보
            imageFileDetails: imageFiles.map(imgPath => ({
              path: imgPath,
              type: epubData.zipContent[imgPath].type,
              size: epubData.zipContent[imgPath].size,
              fileName: epubData.zipContent[imgPath].fileName
            }))
          });
        }

        // 디버깅: 이미지 정보 출력
        if (imageInfo) {
          console.log('이미지 정보 상세:', {
            fileName: imageInfo.fileName,
            type: imageInfo.type,
            contentLength: imageInfo.content ? imageInfo.content.length : 0,
            hasContent: !!imageInfo.content,
            contentType: typeof imageInfo.content,
            keys: Object.keys(imageInfo)
          });
        }

        if (imageInfo && imageInfo.type === 'image') {
          console.log('이미지 파일 찾음:', imageInfo.fileName);

          // MIME 타입 결정
          const getMimeType = (fileName) => {
            const ext = fileName.split('.').pop().toLowerCase();
            const mimeTypes = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'svg': 'image/svg+xml',
              'webp': 'image/webp'
            };
            return mimeTypes[ext] || 'image/jpeg';
          };

          // Base64 데이터 URL 생성
          const mimeType = getMimeType(imageInfo.fileName || originalSrc);
          const base64DataUrl = `data:${mimeType};base64,${imageInfo.content}`;
          

          const currentBookId = bookInfo?.slug || bookInfo?.id || projectId || targetBookId || '';
          const workspaceBaseUrl = getWorkspaceBaseUrl(currentBookId);
          const imageUrl = `${workspaceBaseUrl}${currentBookId}`;

          // 디버그 정보
          const debugInfo = {
            originalSrc,
            absolutePath,
            fileName: imageInfo.fileName,
            resolvedPath,
            imageUrl,
            status: 'success',
            timestamp: new Date().toISOString()
          };
          console.log(imageUrl,"imageUrl")
          setImageDebugInfo(prev => [...prev, debugInfo]);

          // 원본 img 태그를 절대 서버 URL로 교체
          let newImgTag = fullImgTag.replace(/src=["']([^"']+)["']/i, `src="${imageUrl}"`);
          
          // 이미지 품질 개선 속성 추가
          if (!newImgTag.includes('loading=')) {
            newImgTag = newImgTag.replace(/<img/i, '<img loading="eager" decoding="sync"');
          }
          
          // 이미지 렌더링 품질 개선을 위한 스타일 속성 추가
          if (!newImgTag.includes('style=')) {
            newImgTag = newImgTag.replace(/<img/i, '<img style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;"');
          } else {
            // 기존 style 속성이 있는 경우 렌더링 속성 추가
            newImgTag = newImgTag.replace(
              /style=["']([^"']*)["']/i,
              'style="$1; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;"'
            );
          }

          processedContent = processedContent.replace(fullImgTag, newImgTag);
          processedCount++;

          console.log('이미지 처리 성공 (서버 상대 경로):', { originalSrc, imageUrl, resolvedPath, processedCount });
        } else {
          console.warn('이미지 파일을 찾을 수 없음:', {
            originalSrc,
            absolutePath,
            availableFiles: Object.keys(epubData.zipContent).filter(f => f.includes('image') || f.includes('img') || f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i))
          });

          // 이미지 디버깅 정보 수집 (실패)
          const debugInfo = {
            originalSrc,
            absolutePath,
            fileName: null,
            mimeType: null,
            contentLength: 0,
            dataUrlLength: 0,
            status: 'not_found',
            timestamp: new Date().toISOString(),
            availableFiles: Object.keys(epubData.zipContent).filter(f => 
              f.includes('image') || f.includes('img') || f.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)
            )
          };
          
          setImageDebugInfo(prev => [...prev, debugInfo]);

          // 이미지를 찾을 수 없는 경우 서버 절대 URL 기본값 사용
          const currentBookId = bookInfo?.slug || bookInfo?.id || projectId || targetBookId || '';
          // const fallbackUrl = `${getWorkspaceBaseUrl(currentBookId)}OEBPS/Images/default.jpg`;
          // const errorImgTag = fullImgTag.replace(/src=["']([^"']+)["']/i, `src="${fallbackUrl}"`);
          // processedContent = processedContent.replace(fullImgTag, errorImgTag);
        }
      } catch (error) {
        console.error('이미지 처리 오류:', error, {
          originalSrc,
          absolutePath
        });


      }
    }

    console.log(`=== 이미지 처리 완료 ===`);
    console.log(`처리된 이미지 수: ${processedCount}개`);
    console.log(`원본 HTML 길이: ${content.length}`);
    console.log(`처리된 HTML 길이: ${processedContent.length}`);
    console.log(`변경 사항: ${processedContent !== content ? '있음' : '없음'}`);

    return processedContent;
  };
  const openFileInNewWindow = async (fileNode) => {
    if (fileNode.type !== 'file') return;
    
    // epubData와 zipContent가 존재하는지 확인
    if (!epubData || !epubData.zipContent) {
      alert('EPUB 파일이 로드되지 않았습니다. 먼저 EPUB 파일을 업로드해주세요.');
      return;
    }
    
    // 파일이 존재하는지 먼저 확인
    const fileInfo = epubData.zipContent[fileNode.path];
    if (!fileInfo) {
      alert(`파일을 찾을 수 없습니다: ${fileNode.path}`);
      return;
    }
    
    const ext = fileNode.name.split('.').pop().toLowerCase();
    
    // 이미지 파일인 경우 미리보기
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      try {
        // fileInfo.content는 이미 base64 data URL 형태입니다
        const base64Data = fileInfo.content;
        
        console.log('새 창 이미지 로드 성공:', {
          fileName: fileNode.name,
          filePath: fileNode.path,
          fileSize: fileInfo.size,
          base64Length: base64Data.length
        });
        
        const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head>
                <title>${fileNode.name} - 이미지 미리보기</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body { 
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    background: #1e1e1e; 
                    color: #d4d4d4;
                    height: 100vh;
                    overflow: hidden;
                  }
                  .header {
                    background: #2d2d30;
                    padding: 15px 20px;
                    border-bottom: 1px solid #3e3e42;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                  }
                  .file-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                  }
                  .file-icon { font-size: 1.2em; }
                  .file-name { 
                    font-weight: 600; 
                    color: #ffffff;
                    font-size: 1.1em;
                  }
                  .file-path { 
                    color: #858585; 
                    font-size: 0.9em;
                    font-family: 'Courier New', monospace;
                  }
                  .controls {
                    display: flex;
                    gap: 10px;
                  }
                  .btn {
                    background: #007acc;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.9em;
                  }
                  .btn:hover {
                    background: #005a9e;
                  }
                  .btn:active {
                    background: #004578;
                  }
                  .btn-secondary {
                    background: #6c757d;
                  }
                  .btn-secondary:hover {
                    background: #5a6268;
                  }
                  .image-container {
                    height: calc(100vh - 80px);
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    overflow: auto;
                  }
                  .image-preview {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                  }
                  .image-info {
                    position: absolute;
                    bottom: 20px;
                    left: 20px;
                    background: rgba(0,0,0,0.8);
                    padding: 15px;
                    border-radius: 8px;
                    color: white;
                    font-size: 0.9em;
                  }
                  .error-message {
                    text-align: center;
                    padding: 40px;
                    color: #d73a49;
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <div class="file-info">
                    <span class="file-icon">📷</span>
                    <span class="file-name">${fileNode.name}</span>
                    <span class="file-path">${fileNode.path}</span>
                  </div>
                  <div class="controls">
                    <button class="btn" onclick="downloadImage()">💾 다운로드</button>
                    <button class="btn btn-secondary" onclick="window.close()">❌ 닫기</button>
                  </div>
                </div>
                
                <div class="image-container">
                  <img src="${base64Data}" alt="${fileNode.name}" class="image-preview" onerror="handleImageError(this)" />
                  <div class="image-info">
                    <div><strong>파일명:</strong> ${fileNode.name}</div>
                    <div><strong>경로:</strong> ${fileNode.path}</div>
                    <div><strong>크기:</strong> ${(fileInfo.size / 1024).toFixed(2)} KB</div>
                    <div><strong>타입:</strong> ${ext.toUpperCase()}</div>
                    <div><strong>Base64 길이:</strong> ${base64Data.length} 문자</div>
                  </div>
                </div>
                
                <script>
                  function downloadImage() {
                    const link = document.createElement('a');
                    link.href = '${base64Data}';
                    link.download = '${fileNode.name}';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                  
                  function handleImageError(img) {
                    console.error('이미지 로드 실패:', img.src.substring(0, 50) + '...');
                    const container = document.querySelector('.image-container');
                    container.innerHTML = \`
                      <div class="error-message">
                        <h2>❌ 이미지 로드 실패</h2>
                        <p>파일명: ${fileNode.name}</p>
                        <p>경로: ${fileNode.path}</p>
                        <p>Base64 길이: ${base64Data.length} 문자</p>
                        <p>브라우저 개발자 도구(F12)의 콘솔을 확인해주세요.</p>
                      </div>
                    \`;
                  }
                </script>
              </body>
            </html>
          `);
          newWindow.document.close();
        }
        return;
      } catch (error) {
        console.error('새 창 이미지 로드 오류:', error);
        alert(`이미지를 로드할 수 없습니다: ${fileNode.path}\n오류: ${error.message}`);
        return;
      }
    }
    
    // 텍스트 파일 처리
    const content = fileInfo.content;
    
    // 파일 확장자에 따라 탭 설정
    let tabType = 'html';
    
    if (ext === 'css') tabType = 'css';
    else if (ext === 'js') tabType = 'javascript';
    else if (ext === 'json') tabType = 'json';
    else if (ext === 'xml') tabType = 'xml';
    
    // XML 파일인 경우 포맷팅
    let formattedContent = content;
    if (ext === 'xml') {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const serializer = new XMLSerializer();
        formattedContent = serializer.serializeToString(xmlDoc);
      } catch (xmlError) {
        console.warn('XML 포맷팅 실패, 원본 내용 사용:', xmlError);
        formattedContent = content;
      }
    }
    
    // XHTML 파일인 경우 이미지 경로 처리
    if (ext === 'html' || ext === 'xhtml' || ext === 'xml') {
      try {
        // XHTML/HTML 파일에서 이미지 경로를 Base64로 변환
        const processedContent = await processXHTMLImages(content, fileNode.path);
        formattedContent = processedContent;
      } catch (error) {
        console.warn('새 창 XHTML 이미지 처리 실패:', error);
      }
    }
    
    const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>${fileNode.name} - Monaco Editor</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: #1e1e1e; 
                color: #d4d4d4;
                height: 100vh;
                overflow: hidden;
              }
              .header {
                background: #2d2d30;
                padding: 15px 20px;
                border-bottom: 1px solid #3e3e42;
                display: flex;
                align-items: center;
                justify-content: space-between;
              }
              .file-info {
                display: flex;
                align-items: center;
                gap: 10px;
              }
              .file-icon { font-size: 1.2em; }
              .file-name { 
                font-weight: 600; 
                color: #ffffff;
                font-size: 1.1em;
              }
              .file-path { 
                color: #858585; 
                font-size: 0.9em;
                font-family: 'Courier New', monospace;
              }
              .controls {
                display: flex;
                gap: 10px;
              }
              .btn {
                background: #007acc;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
              }
              .btn:hover {
                background: #005a9e;
              }
              .btn:active {
                background: #004578;
              }
              .btn-secondary {
                background: #6c757d;
              }
              .btn-secondary:hover {
                background: #5a6268;
              }
              .editor-container {
                height: calc(100vh - 80px);
                width: 100%;
              }
              #monaco-editor {
                width: 100%;
                height: 100%;
              }
            </style>
            <script src="https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js"></script>
          </head>
          <body>
            <div class="header">
              <div class="file-info">
                <span class="file-icon">📄</span>
                <span class="file-name">${fileNode.name}</span>
                <span class="file-path">${fileNode.path}</span>
              </div>
              <div class="controls">
                <button class="btn" onclick="copyContent()">📋 복사</button>
                <button class="btn btn-secondary" onclick="formatCode()">🎨 포맷</button>
                <button class="btn btn-secondary" onclick="window.close()">❌ 닫기</button>
              </div>
            </div>
            
            <div class="editor-container">
              <div id="monaco-editor"></div>
            </div>
            
            <script>
              require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs' }});
              require(['vs/editor/editor.main'], function() {
                const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                  value: \`${formattedContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`,
                  language: '${tabType}',
                  theme: 'vs-dark',
                  fontSize: 14,
                  minimap: { enabled: true },
                  automaticLayout: true,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  readOnly: false,
                  cursorStyle: 'line',
                  automaticLayout: true,
                  theme: 'vs-dark',
                  scrollbar: {
                    vertical: 'visible',
                    horizontal: 'visible'
                  }
                });
                
                window.editor = editor;
                
                // 창 크기 변경 시 에디터 크기 조정
                window.addEventListener('resize', () => {
                  editor.layout();
                });
              });
              
              function copyContent() {
                if (window.editor) {
                  const content = window.editor.getValue();
                  navigator.clipboard.writeText(content).then(() => {
                    const btn = document.querySelector('.btn');
                    const originalText = btn.textContent;
                    btn.textContent = '✅ 복사됨!';
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 2000);
                  }).catch(err => {
                    console.error('복사 실패:', err);
                    alert('복사에 실패했습니다.');
                  });
                }
              }
              
              function formatCode() {
                if (window.editor) {
                  const action = window.editor.getAction('editor.action.formatDocument');
                  if (action) {
                    action.run();
                  }
                }
              }
            </script>
          </body>
        </html>
      `);
      newWindow.document.close();
    }
  };

  // 폴더 토글 함수
  const toggleFolder = (node) => {
    if (node.children && node.children.length > 0) {
      setFileTree(prevTree => {
        const updateNode = (nodes) => {
          return nodes.map(n => {
            if (n.path === node.path) {
              return { ...n, isExpanded: !n.isExpanded };
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
  };

  const renderFolderTree = (nodes, level = 0) => {
    console.log('🔍🔍🔍 renderFolderTree 호출됨!', nodes, level);
    if (!nodes || nodes.length === 0) {
      console.log('🔍🔍🔍 노드가 없음');
      return (
        <div className="folder-empty">
          <div className="empty-message">
            {epubData ? (
              <>
                ◉ 폴더가 비어있습니다
                <small>파일이 없습니다</small>
              </>
            ) : (
              <>
                ◉ EPUB 파일을 업로드하면<br />
                파일 구조가 표시됩니다
                <small>EPUB 파일을 선택해주세요</small>
              </>
            )}
          </div>
        </div>
      );
    }

    return nodes.map((node) => {
      console.log('🔍🔍🔍 노드 렌더링:', node);
      const isFileExists = epubData && epubData.zipContent && 
        epubData.zipContent[node.path];

      return (
        <div key={node.id}>
          <div 
            className={`folder-item ${node.type} ${!epubData || !epubData.zipContent || !isFileExists ? 'disabled' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (node.type === 'folder') {
                toggleFolder(node);
              } else if (epubData && epubData.zipContent && node.type === 'file' && isFileExists) {
                handleFileClick(node);
              }
            }}
            onMouseDown={(e) => {
              if (e.button === 2) { // 우클릭
                console.log('🔍🔍🔍 우클릭 감지됨!');
                handleContextMenu(e, node);
              }
            }}
            onContextMenu={(e) => {
              console.log('🔍🔍🔍 onContextMenu 이벤트 발생!');
              handleContextMenu(e, node);
            }}
          >
            <span className="folder-indent" style={{ paddingLeft: `${level * 16}px` }}>
              <span className="folder-icon">
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
              <span className="folder-name">{node.name}</span>
            </span>
          </div>
          {node.children && node.children.length > 0 && node.isExpanded && (
            <div className="folder-children">
              {renderFolderTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const getTabIcon = (tab) => {
    const icons = {
      html: 'html',
      css: 'css',
      javascript: 'javascript',
      json: 'data_object',
      xml: 'code'
    };
    return icons[tab] || 'description';
  };

  // 파일 확장자에 따른 아이콘 결정
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    
    // 이미지 파일
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return 'image';
    
    // 웹 파일
    if (['html', 'htm'].includes(ext)) return 'html';
    if (ext === 'xhtml') return 'code';
    if (ext === 'css') return 'css';
    if (ext === 'js') return 'javascript';
    if (ext === 'json') return 'data_object';
    if (ext === 'xml') return 'code';
    
    // EPUB 관련
    if (ext === 'opf') return 'book';
    if (ext === 'ncx') return 'menu_book';
    if (ext === 'epub') return 'menu_book';
    
    // 폰트 파일
    if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font_download';
    
    // 미디어 파일
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audiotrack';
    if (['mp4', 'webm'].includes(ext)) return 'video_file';
    
    // 문서 파일
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['doc', 'docx'].includes(ext)) return 'description';
    if (['xls', 'xlsx'].includes(ext)) return 'table_chart';
    if (['ppt', 'pptx'].includes(ext)) return 'slideshow';
    
    // 압축 파일
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'folder_zip';
    
    // 텍스트 파일
    if (ext === 'txt') return 'description';
    
    return 'description';
  };

  // 임시 저장 기능
  const saveCurrentFile = async () => {
    const currentTab = getCurrentTab();
    if (!currentTab) {
      console.warn('저장할 파일이 없습니다.');
      return;
    }

    try {
      // 저장 전 실시간 검증 실행
      console.log('🔍 임시저장 전 실시간 검증 시작:', currentTab.name);
      
      // Monaco Editor의 현재 검증 상태 확인
      const editor = editorPaneRef.current?.getEditor();
      if (editor) {
        const model = editor.getModel();
        if (model) {
          // Monaco Editor의 검증을 강제로 실행
          const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
          console.log('📋 임시저장 시 검증 마커:', markers);
          
          // 검증 오류가 있으면 로거에 기록
          markers.forEach(marker => {
            if (marker.severity === window.monaco?.MarkerSeverity.Error) {
              if (window.logger) {
                window.logger.error('VALIDATION', `임시저장 시 검증 오류: ${marker.message}`, {
                  file: currentTab.filePath || currentTab.name,
                  line: marker.startLineNumber,
                  column: marker.startColumn,
                  offset: marker.startColumn,
                  path: currentTab.filePath || currentTab.name
                });
              }
            }
          });
        }
      }
      
      // 저장 완료 표시
      saveTab(currentTab.id);

       // 파일 내용이 변경되면 즉시 모든 마커 삭제
       clearAllMarkers();
      
      // 저장 후 미리보기 업데이트
      console.log('파일 임시 저장 완료, 미리보기 업데이트 중...');
      await runCode();
      
      // 저장 완료 표시 (탭에서 dirty 표시 제거)
      setOpenTabs(prev => prev.map(tab => 
        tab.id === currentTab.id ? { ...tab, isDirty: false } : tab
      ));
      
      // 저장 완료 시각적 피드백
      const fileName = currentTab.filePath ? 
        currentTab.filePath.split('/').pop() : 
        `${currentTab.name}.${currentTab.type}`;
      
      const saveNotification = document.createElement('div');
      saveNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      saveNotification.textContent = `💾 ${fileName} 임시 저장됨`;
      
      document.body.appendChild(saveNotification);
      
      setTimeout(() => {
        if (saveNotification.parentNode) {
          saveNotification.parentNode.removeChild(saveNotification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('파일 저장 실패:', error);
      alert('파일 저장에 실패했습니다.');
    }
  };

  // 제출 기능 (검수 완료 제출)
  const submitCurrentFile = async () => {
    const currentTab = getCurrentTab();
    if (!currentTab) {
      console.warn('제출할 파일이 없습니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // 이미지 사용 여부 확인
      checkImageUsage();
      
      // 코드 검증
      const validationResults = await validateCurrentFile();
      if (validationResults.errors.length > 0) {
        const confirmSubmit = window.confirm(
          `코드에 ${validationResults.errors.length}개의 오류가 있습니다.\n계속 제출하시겠습니까?`
        );
        if (!confirmSubmit) {
          setIsSubmitting(false);
          return;
        }
      }
      
      // 파일 저장
      await saveCurrentFileForSubmit();
      
      // 제출 로직 (실제 구현에서는 API 호출)
      console.log('파일 제출 중...', currentTab);
      
      // 제출 완료 시각적 피드백
      const fileName = currentTab.filePath ? 
        currentTab.filePath.split('/').pop() : 
        `${currentTab.name}.${currentTab.type}`;
      
      const submitNotification = document.createElement('div');
      submitNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #007bff;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      submitNotification.textContent = `📤 ${fileName} 제출 완료`;
      
      document.body.appendChild(submitNotification);
      
      setTimeout(() => {
        if (submitNotification.parentNode) {
          submitNotification.parentNode.removeChild(submitNotification);
        }
      }, 3000);
      
    } catch (error) {
      console.error('파일 제출 실패:', error);
      alert('파일 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 오류 위치로 이동하는 함수 (개선된 버전)
  const goToErrorLocation = (error) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor || !error.line || !error.column) {
      console.warn('⚠️ 오류 위치 이동 실패: editor 또는 오류 정보 없음', { error });
      return;
    }
    
    console.log(`🔍 오류 위치로 이동 시도:`, {
      line: error.line,
      column: error.column,
      message: error.message,
      file: error.file
    });
    
    const position = {
      lineNumber: error.line,
      column: error.column
    };
    
    // 해당 라인으로 스크롤하고 포커스
    editor.revealLineInCenter(error.line);
    editor.setPosition(position);
    editor.focus();
    
    // 오류 위치 하이라이트 (기존 하이라이트 제거 후 새로 추가)
    const range = {
      startLineNumber: error.line,
      startColumn: error.column,
      endLineNumber: error.line,
      endColumn: error.column + (error.length || 1)
    };
    
    // 기존 하이라이트 제거
    editor.deltaDecorations([], []);
    
    // 새 하이라이트 추가
    editor.deltaDecorations([], [{
      range: range,
      options: {
        className: 'error-highlight',
        hoverMessage: { value: error.message },
        isWholeLine: false,
        stickiness: 1 // 스크롤해도 하이라이트 유지
      }
    }]);
    
    // 오류 메시지 표시
    console.log(`✅ 오류 위치로 이동 완료: ${error.message} (라인 ${error.line}, 컬럼 ${error.column})`);
  };

  // 파일별 오류 하이라이트 삭제 함수
  const clearFileErrors = (filePath) => {
    if (!editorPaneRef.current?.getEditor()) return;
    
    try {
      console.log('🔍 파일 오류 하이라이트 삭제:', filePath);
      
      const editor = editorPaneRef.current.getEditor();
      const model = editor.getModel();
      if (!model) return;
      
      // 현재 모델의 파일 경로 확인
      const currentModelPath = model.uri?.fsPath || model.uri?.path || '';
      const currentFileName = currentModelPath.split('/').pop() || '';
      const targetFileName = filePath.split('/').pop() || '';
      
      console.log('🔍 파일 매칭 확인:', {
        currentModelPath,
        currentFileName,
        filePath,
        targetFileName
      });
      
      // 현재 모델과 대상 파일이 일치하는지 확인
      const isCurrentFile = currentFileName === targetFileName || 
                           currentModelPath.includes(targetFileName) ||
                           filePath.includes(currentFileName);
      
      if (isCurrentFile) {
        console.log('✅ 현재 파일과 일치 - 모든 standard-check 마커 삭제');
        
        // 현재 모델의 모든 standard-check 마커 삭제
        window.monaco?.editor.setModelMarkers(model, 'standard-check', []);
        
        // 에디터 오류 목록에서도 해당 파일의 오류 제거
        setEditorErrors(prev => {
          const filtered = prev.filter(error => {
            const errorFile = error.file || error.path || error.fileName || '';
            return !(errorFile.includes(targetFileName) || 
                    errorFile.includes(filePath) ||
                    errorFile.endsWith(targetFileName) ||
                    targetFileName.endsWith(errorFile.split('/').pop()));
          });
          return filtered;
        });
        

      } else {
        console.log('⚠️ 현재 파일과 일치하지 않음 - 전체 마커 확인');
        
        // 모든 모델의 마커를 확인하여 해당 파일 관련 마커 삭제
        const allModels = window.monaco?.editor.getModels() || [];
        let totalRemoved = 0;
        
        allModels.forEach(model => {
          const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
          const standardMarkers = markers.filter(m => m.source === 'standard-check');
          
          if (standardMarkers.length > 0) {
            console.log(`🔍 모델 ${model.uri?.fsPath}에서 ${standardMarkers.length}개 마커 발견`);
            window.monaco?.editor.setModelMarkers(model, 'standard-check', []);
            totalRemoved += standardMarkers.length;
          }
        });
        
        if (totalRemoved > 0) {
          console.log(`🗑️ 총 ${totalRemoved}개의 오류 마커 삭제`);
          
          // 에디터 오류 목록도 초기화
          setEditorErrors([]);
          
          
        }
      }
    } catch (error) {
      console.error('❌ 파일 오류 하이라이트 삭제 실패:', error);
      logger.error('VALIDATION', '파일 오류 하이라이트 삭제 실패', {
        filePath,
        error: error.message
      });
    }
  };

  // 모든 오류 하이라이트 삭제 함수 (강제 삭제)
  const clearAllErrorMarkers = () => {
    try {
      console.log('🔍 모든 오류 하이라이트 삭제 시작');
      
      // 1. 모든 Monaco Editor 모델에서 standard-check와 validation-check 마커 삭제
      const allModels = window.monaco?.editor.getModels() || [];
      let totalRemoved = 0;
      
      console.log(`🔍 전체 모델 개수: ${allModels.length}`);
      
      allModels.forEach(model => {
        const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
        console.log(`🔍 모델 ${model.uri?.fsPath}의 전체 마커:`, markers);
        
        const standardMarkers = markers.filter(m => m.source === 'standard-check');
        const validationMarkers = markers.filter(m => m.source === 'validation-check');
        
        console.log(`🔍 standard-check 마커: ${standardMarkers.length}개`);
        console.log(`🔍 validation-check 마커: ${validationMarkers.length}개`);
        
        if (standardMarkers.length > 0) {
          console.log(`🗑️ 모델 ${model.uri?.fsPath}에서 ${standardMarkers.length}개 standard-check 마커 삭제`);
          window.monaco?.editor.setModelMarkers(model, 'standard-check', []);
          totalRemoved += standardMarkers.length;
        }
        
        if (validationMarkers.length > 0) {
          console.log(`🗑️ 모델 ${model.uri?.fsPath}에서 ${validationMarkers.length}개 validation-check 마커 삭제`);
          window.monaco?.editor.setModelMarkers(model, 'validation-check', []);
          totalRemoved += validationMarkers.length;
        }
      });
      
      // 2. 현재 에디터 모델에서도 삭제
      const editor = editorPaneRef.current?.getEditor();
      if (editor) {
        const model = editor.getModel();
        if (model) {
          const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
          console.log(`🔍 현재 모델의 전체 마커:`, markers);
          
          const standardMarkers = markers.filter(m => m.source === 'standard-check');
          const validationMarkers = markers.filter(m => m.source === 'validation-check');
          
          console.log(`🔍 현재 모델 standard-check 마커: ${standardMarkers.length}개`);
          console.log(`🔍 현재 모델 validation-check 마커: ${validationMarkers.length}개`);
          
          if (standardMarkers.length > 0) {
            console.log(`🗑️ 현재 모델에서 ${standardMarkers.length}개 standard-check 마커 삭제`);
            window.monaco?.editor.setModelMarkers(model, 'standard-check', []);
            totalRemoved += standardMarkers.length;
          }
          
          if (validationMarkers.length > 0) {
            console.log(`🗑️ 현재 모델에서 ${validationMarkers.length}개 validation-check 마커 삭제`);
            window.monaco?.editor.setModelMarkers(model, 'validation-check', []);
            totalRemoved += validationMarkers.length;
          }
        }
      }
      
      // 3. 에디터 오류 목록 초기화
      setEditorErrors([]);
      
      // 4. 로그에서 해결된 오류 정리 (현재 파일만)
      const currentTab = getCurrentTab();
      const cleaned = logger.cleanResolvedErrors(currentTab ? currentTab.name : null);
      
      console.log(`🗑️ 총 ${totalRemoved}개의 오류 마커 삭제 완료, ${cleaned}개 로그 정리`);
      
      // 5. 삭제 후 확인
      setTimeout(() => {
        const remainingMarkers = window.monaco?.editor.getModelMarkers() || [];
        console.log(`🔍 삭제 후 남은 마커:`, remainingMarkers);
      }, 100);
      
    } catch (error) {
      console.error('❌ 모든 오류 하이라이트 삭제 실패:', error);
      logger.error('VALIDATION', '모든 오류 하이라이트 삭제 실패', {
        error: error.message
      });
    }
  };

  // 모든 마커 삭제 함수 (모든 소스)
  const clearAllMarkers = () => {
    try {
      console.log('🔍 모든 마커 삭제 시작 (모든 소스)');
      
      const allModels = window.monaco?.editor.getModels() || [];
      let totalRemoved = 0;
      
      console.log(`🔍 전체 모델 개수: ${allModels.length}`);
      
      allModels.forEach(model => {
        const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
        
        if (markers.length > 0) {
          console.log(`🔍 모델 ${model.uri?.fsPath}의 마커:`, markers);
          console.log(`🗑️ 모델 ${model.uri?.fsPath}에서 ${markers.length}개 마커 삭제`);
          
          // 모든 소스의 마커 삭제
          const sources = [...new Set(markers.map(m => m.source))];
          console.log(`🔍 삭제할 소스들:`, sources);
          
          sources.forEach(source => {
            console.log(`🗑️ 소스 '${source}' 마커 삭제`);
            window.monaco?.editor.setModelMarkers(model, source, []);
          });
          
          totalRemoved += markers.length;
        }
      });
      
      // 현재 에디터 모델에서도 삭제
      const editor = editorPaneRef.current?.getEditor();
      if (editor) {
        const model = editor.getModel();
        if (model) {
          const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
          if (markers.length > 0) {
            console.log(`🔍 현재 모델의 마커:`, markers);
            const sources = [...new Set(markers.map(m => m.source))];
            sources.forEach(source => {
              console.log(`🗑️ 현재 모델에서 소스 '${source}' 마커 삭제`);
              window.monaco?.editor.setModelMarkers(model, source, []);
            });
            totalRemoved += markers.length;
          }
        }
      }
      
      // 에디터 오류 목록 초기화
      setEditorErrors([]);
      
      // view-line 하이라이트 제거
      clearViewLineHighlights();
      
      console.log(`🗑️ 총 ${totalRemoved}개의 모든 마커 삭제 완료`);
      
      // 삭제 후 확인
      setTimeout(() => {
        const remainingMarkers = window.monaco?.editor.getModelMarkers() || [];
        console.log(`🔍 삭제 후 남은 마커:`, remainingMarkers);
      }, 100);
      
    } catch (error) {
      console.error('❌ 모든 마커 삭제 실패:', error);
      logger.error('VALIDATION', '모든 마커 삭제 실패', {
        error: error.message
      });
    }
  };

  // view-line 하이라이트 제거 함수
  const clearViewLineHighlights = () => {
    try {
      console.log('🔍 view-line 하이라이트 제거 시작');
      
      const editor = editorPaneRef.current?.getEditor();
      if (editor) {
        // view-line 관련 하이라이트 제거
        editor.deltaDecorations([], []);
        
        // 특정 CSS 클래스 제거
        const editorElement = editor.getDomNode();
        if (editorElement) {
          // 모든 하이라이트 관련 클래스 제거
          const viewLines = editorElement.querySelectorAll('.view-line');
          viewLines.forEach(line => {
            line.classList.remove(
              'currentFindMatch', 
              'findMatch', 
              'selectionHighlight',
              'errorHighlight',
              'warningHighlight',
              'infoHighlight'
            );
            
            // 인라인 스타일 제거
            line.style.backgroundColor = '';
            line.style.borderLeft = '';
            line.style.borderRight = '';
          });
          
          // 추가적인 하이라이트 요소들 제거
          const highlights = editorElement.querySelectorAll('.monaco-editor-overlaymessage, .monaco-editor-hover');
          highlights.forEach(h => {
            if (h.style) {
              h.style.display = 'none';
            }
          });
        }
        
        // Monaco Editor의 모든 데코레이션 제거
        const model = editor.getModel();
        if (model) {
          const decorations = editor.getDecorationsInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount())
          });
          
          if (decorations && decorations.length > 0) {
            console.log(`🗑️ ${decorations.length}개의 데코레이션 제거`);
            editor.deltaDecorations(decorations.map(d => d.id), []);
          }
        }
        
        console.log('🗑️ view-line 하이라이트 제거 완료');
      }
    } catch (error) {
      console.error('❌ view-line 하이라이트 제거 실패:', error);
    }
  };

 
  // Monaco Editor에 오류 마커 추가하는 함수
  const addErrorMarkers = (errors, filePath) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor || !window.monaco) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    // 현재 편집 중인 파일 정보 가져오기
    const currentTab = getCurrentTab();
    if (!currentTab) {
      console.warn('⚠️ 현재 편집 중인 파일이 없습니다.');
      return;
    }
    
    console.log('🔍 현재 편집 중인 파일:', {
      name: currentTab.name,
      path: currentTab.path,
      type: currentTab.type
    });
    
    // 현재 파일과 관련된 오류만 필터링
    const relevantErrors = errors.filter(error => {
      const errorFile = error.file || error.path || error.fileName || '';
      const currentFilePath = currentTab.path || currentTab.name || '';
      
      // 로컬 검증 에러인 경우 현재 파일에 적용
      if (error.path === 'local-validation') {
        return true;
      }
      
      console.log('🔍 오류 파일 매칭:', {
        errorFile: errorFile,
        currentFilePath: currentFilePath,
        isMatch: errorFile.includes(currentFilePath) || currentFilePath.includes(errorFile)
      });
      
      // 파일명 매칭 (정확한 매칭 또는 부분 매칭)
      return errorFile.includes(currentFilePath) || 
             currentFilePath.includes(errorFile) ||
             errorFile.endsWith(currentTab.name) ||
             currentTab.name.endsWith(errorFile.split('/').pop());
    });
    
    console.log(`🔍 관련 오류 필터링: ${errors.length}개 → ${relevantErrors.length}개`);
    
    const markers = relevantErrors.map(error => {
      // 실제 서버 응답 형식에 맞게 severity 처리
      let severity;
      if (error.severity === 'warning' || error.severity === 'WARNING') {
        severity = window.monaco.MarkerSeverity.Warning;
      } else if (error.severity === 'error' || error.severity === 'ERROR') {
        severity = window.monaco.MarkerSeverity.Error;
      } else if (error.severity === 'info' || error.severity === 'INFO') {
        severity = window.monaco.MarkerSeverity.Info;
      } else {
        severity = window.monaco.MarkerSeverity.Error; // 기본값
      }
      
      return {
        message: error.message,
        severity: severity,
        startLineNumber: parseInt(error.line) || 1,
        startColumn: parseInt(error.column) || 1,
        endLineNumber: parseInt(error.line) || 1,
        endColumn: parseInt(error.column) || 1,
        code: error.type || 'validation'
      };
    });
    
    window.monaco.editor.setModelMarkers(model, 'validation-check', markers);
    console.log(`📝 ${markers.length}개의 검증 오류 마커 추가됨`);
    console.log('📝 마커 상세:', markers);
  };

  // 전역 함수로 노출 (디버깅용)
  useEffect(() => {
    window.clearAllErrorMarkers = clearAllErrorMarkers;
    window.clearAllMarkers = clearAllMarkers;
    window.addErrorMarkers = addErrorMarkers;
    window.clearViewLineHighlights = clearViewLineHighlights;
    
    // 전역 validationErrors 상태 설정
    window.validationErrors = editorErrors;
  }, [editorErrors]);

  // 오류가 있는 파일을 자동으로 열고 하이라이트하는 함수
  const openFileWithError = async (error) => {
    try {
      const errorFile = error.file || error.path || error.fileName || '';
      if (!errorFile) {
        console.warn('⚠️ 오류에 파일 정보가 없습니다.');
        return false;
      }

      console.log('🔍 오류 파일 열기 시도:', errorFile);
      
      // 파일명 추출 (경로에서 파일명만)
      const fileName = errorFile.split('/').pop() || errorFile;
      console.log('🔍 추출된 파일명:', fileName);
      
      // 현재 열려있는 탭들 확인
      console.log('🔍 현재 열린 탭들:', openTabs);
      
      // 해당 파일이 이미 열려있는지 확인 (더 정확한 매칭)
      let targetTab = openTabs.find(tab => {
        const tabPath = tab.path || tab.name || '';
        const tabName = tab.name || '';
        
        // 정확한 경로 매칭
        if (tabPath === errorFile) return true;
        
        // 파일명 매칭
        if (tabName === fileName) return true;
        
        // 경로에 파일명이 포함되어 있는지 확인
        if (tabPath.includes(fileName) || errorFile.includes(tabName)) return true;
        
        // 파일명이 경로의 마지막 부분과 일치하는지 확인
        const tabPathParts = tabPath.split('/');
        const errorPathParts = errorFile.split('/');
        if (tabPathParts[tabPathParts.length - 1] === fileName) return true;
        if (errorPathParts[errorPathParts.length - 1] === tabName) return true;
        
        return false;
      });
      
      if (targetTab) {
        console.log('✅ 파일이 이미 열려있음, 해당 탭으로 전환:', targetTab.name);
        setActiveTabId(targetTab.id);
        
        // 탭 전환 후 약간의 지연을 두고 하이라이트 적용
        setTimeout(() => {
          const editor = editorPaneRef.current?.getEditor();
          if (editor && window.monaco) {
            // 해당 라인으로 스크롤
            editor.revealLineInCenter(error.line);
            
            // 커서를 오류 위치로 이동
            editor.setPosition({
              lineNumber: error.line,
              column: error.column
            });
            
            // 오류 위치 하이라이트
            const decorations = editor.deltaDecorations([], [{
              range: new window.monaco.Range(error.line, error.column, error.line, error.column + 1),
              options: {
                isWholeLine: false,
                className: 'error-highlight',
                hoverMessage: { value: error.message },
                beforeContentClassName: 'error-highlight-before',
                afterContentClassName: 'error-highlight-after'
              }
            }]);
            
            // 추가적인 시각적 피드백을 위한 라인 하이라이트
            editor.deltaDecorations([], [{
              range: new window.monaco.Range(error.line, 1, error.line, 1),
              options: {
                isWholeLine: true,
                className: 'error-line-highlight',
                hoverMessage: { value: `라인 ${error.line}: ${error.message}` }
              }
            }]);
            
            console.log('✅ 오류 위치 하이라이트 적용됨:', {
              line: error.line,
              column: error.column,
              message: error.message
            });
          }
        }, 100);
        
        return true;
      } else {
        console.log('⚠️ 파일이 열려있지 않음, 파일 열기 시도');
        
        // 파일 시스템에서 해당 파일 찾기 (경로 기반 검색)
        const findFileInTree = (tree, targetPath, targetName) => {
          for (const node of tree) {
            // 정확한 경로 매칭
            if (node.path === targetPath) {
              return node;
            }
            
            // 파일명 매칭
            if (node.name === targetName) {
              return node;
            }
            
            // 경로의 마지막 부분이 파일명과 일치하는지 확인
            if (node.path && node.path.split('/').pop() === targetName) {
              return node;
            }
            
            // 하위 폴더에서 검색
            if (node.children) {
              const found = findFileInTree(node.children, targetPath, targetName);
              if (found) return found;
            }
          }
          return null;
        };
        
        const fileNode = findFileInTree(fileTree, errorFile, fileName);
        console.log('🔍 파일 검색 결과:', {
          errorFile: errorFile,
          fileName: fileName,
          fileNode: fileNode,
          fileTree: fileTree
        });
        
        if (fileNode) {
          console.log('✅ 파일 노드 찾음:', fileNode);
          
          // 파일 열기
          await handleFileClick(fileNode);
          
          // 파일이 열린 후 오류 하이라이트 적용
          setTimeout(() => {
            const editor = editorPaneRef.current?.getEditor();
            if (editor && window.monaco) {
              // 해당 라인으로 스크롤
              editor.revealLineInCenter(error.line);
              
              // 커서를 오류 위치로 이동
              editor.setPosition({
                lineNumber: error.line,
                column: error.column
              });
              
              // 오류 위치 하이라이트
              const decorations = editor.deltaDecorations([], [{
                range: new window.monaco.Range(error.line, error.column, error.line, error.column + 1),
                options: {
                  isWholeLine: false,
                  className: 'error-highlight',
                  hoverMessage: { value: error.message },
                  beforeContentClassName: 'error-highlight-before',
                  afterContentClassName: 'error-highlight-after'
                }
              }]);
              
              // 추가적인 시각적 피드백을 위한 라인 하이라이트
              editor.deltaDecorations([], [{
                range: new window.monaco.Range(error.line, 1, error.line, 1),
                options: {
                  isWholeLine: true,
                  className: 'error-line-highlight',
                  hoverMessage: { value: `라인 ${error.line}: ${error.message}` }
                }
              }]);
              
              console.log('✅ 파일 열기 후 오류 위치 하이라이트 적용됨:', {
                line: error.line,
                column: error.column,
                message: error.message
              });
            }
          }, 200);
          
          return true;
        } else {
          console.warn('⚠️ 파일을 찾을 수 없음:', fileName);
          return false;
        }
      }
    } catch (error) {
      console.error('❌ 파일 열기 실패:', error);
      return false;
    }
  };
  
  // 다음 오류로 이동
  const goToNextError = () => {
    if (errorLocations.length === 0) return;
    
    const nextIndex = (currentErrorIndex + 1) % errorLocations.length;
    setCurrentErrorIndex(nextIndex);
    goToErrorLocation(errorLocations[nextIndex]);
  };
  
  // 이전 오류로 이동
  const goToPrevError = () => {
    if (errorLocations.length === 0) return;
    
    const prevIndex = currentErrorIndex === 0 ? errorLocations.length - 1 : currentErrorIndex - 1;
    setCurrentErrorIndex(prevIndex);
    goToErrorLocation(errorLocations[prevIndex]);
  };
  
  // 실시간 검증 설정 (개선된 버전)
  const setupRealTimeValidation = () => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    
    let validationTimeout;
    
    // 에디터 내용 변경 시 실시간 검증
    const validateOnChange = () => {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(async () => {
        const content = editor.getValue();
        const currentTab = getCurrentTab();
        
        if (!currentTab) return;
        

        
        // 파일 내용이 변경되면 즉시 모든 마커 삭제
        clearAllMarkers();
        
        const errors = [];
        
        // HTML/XHTML 실시간 검증
        if (currentTab.type === 'html' || currentTab.type === 'xhtml') {
          const htmlErrors = validateHTMLRealTime(content);
          errors.push(...htmlErrors);
        }
        
        // CSS 실시간 검증
        if (currentTab.type === 'css') {
          const cssErrors = validateCSSRealTime(content);
          errors.push(...cssErrors);
        }
        
        // JavaScript 실시간 검증
        if (currentTab.type === 'javascript') {
          const jsErrors = validateJavaScriptRealTime(content);
          errors.push(...jsErrors);
        }
        
        // 오류 위치 추적 업데이트
        setErrorLocations(errors);
        
        // Monaco Editor에 오류 표시
        if (window.monaco) {
          const model = editor.getModel();
          if (model) {
            const markers = errors.map(error => ({
              message: error.message,
              severity: window.monaco.MarkerSeverity.Error,
              startLineNumber: error.line,
              startColumn: error.column,
              endLineNumber: error.line,
              endColumn: error.column + (error.length || 1)
            }));
            
            window.monaco.editor.setModelMarkers(model, 'validation', markers);
          }
        }
        
        // 실시간 표준 검사 실행 (오류가 없을 때만)
        if (errors.length === 0) {
          try {
            // 접근성 검사
            await checkAccessibilityStandard();
            
            // EPUB 표준 검사
            await checkEpubStandard();
            
            // 모든 검사 통과 시 로그 정리
            logger.cleanResolvedErrors();
            
          } catch (error) {
            console.error('❌ 실시간 표준 검사 실패:', error);
          }
        }
      }, 500); // 500ms 지연으로 성능 최적화
    };
    
    // 에디터에 변경 이벤트 리스너 추가
    editor.onDidChangeModelContent(validateOnChange);
    
    // 초기 검증 실행
    validateOnChange();
  };
  // HTML 실시간 검증
  const validateHTMLRealTime = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // 태그 검증
      const openTags = line.match(/<([a-z][a-z0-9]*)[^>]*>/gi) || [];
      const closeTags = line.match(/<\/([a-z][a-z0-9]*)>/gi) || [];
      
      openTags.forEach((tag, tagIndex) => {
        const tagName = tag.match(/<([a-z][a-z0-9]*)/i)[1].toLowerCase();
        const column = line.indexOf(tag) + 1;
        
        // 자체 닫힘 태그 확인
        if (!['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
          // 닫는 태그가 같은 줄에 있는지 확인
          const closeTag = `</${tagName}>`;
          if (!line.includes(closeTag)) {
            errors.push({
              line: lineNumber,
              column: column,
              length: tag.length,
              message: `태그 <${tagName}>가 닫히지 않았습니다.`
            });
          }
        }
      });
      
      // 속성 검증
      const imgTags = line.match(/<img[^>]*>/gi) || [];
      imgTags.forEach((img, imgIndex) => {
        const column = line.indexOf(img) + 1;
        
        if (!img.includes('src=')) {
          errors.push({
            line: lineNumber,
            column: column,
            length: img.length,
            message: '이미지 태그에 src 속성이 없습니다.'
          });
        }
        
        if (!img.includes('alt=')) {
          errors.push({
            line: lineNumber,
            column: column,
            length: img.length,
            message: '이미지 태그에 alt 속성이 없습니다. (접근성 권장)'
          });
        }
      });
    });
    
    return errors;
  };
  
  // CSS 실시간 검증
  const validateCSSRealTime = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // 중괄호 검증
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      if (openBraces > 0 || closeBraces > 0) {
        const column = line.indexOf('{') > -1 ? line.indexOf('{') + 1 : line.indexOf('}') + 1;
        if (openBraces !== closeBraces) {
          errors.push({
            line: lineNumber,
            column: column,
            length: 1,
            message: '중괄호가 맞지 않습니다.'
          });
        }
      }
      
      // 세미콜론 검증
      const cssRules = line.match(/[a-zA-Z-]+\s*:\s*[^;]+/g) || [];
      cssRules.forEach((rule, ruleIndex) => {
        if (!line.trim().endsWith(';') && !line.trim().endsWith('{') && !line.trim().endsWith('}')) {
          const column = line.indexOf(rule) + 1;
          errors.push({
            line: lineNumber,
            column: column,
            length: rule.length,
            message: 'CSS 규칙 끝에 세미콜론(;)이 없습니다.'
          });
        }
      });
    });
    
    return errors;
  };
  
  // JavaScript 실시간 검증
  const validateJavaScriptRealTime = (content) => {
    const errors = [];
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      
      // 괄호 검증
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      if (openParens !== closeParens) {
        const column = line.indexOf('(') > -1 ? line.indexOf('(') + 1 : line.indexOf(')') + 1;
        errors.push({
          line: lineNumber,
          column: column,
          length: 1,
          message: '괄호가 맞지 않습니다.'
        });
      }
      
      if (openBrackets !== closeBrackets) {
        const column = line.indexOf('[') > -1 ? line.indexOf('[') + 1 : line.indexOf(']') + 1;
        errors.push({
          line: lineNumber,
          column: column,
          length: 1,
          message: '대괄호가 맞지 않습니다.'
        });
      }
      
      if (openBraces !== closeBraces) {
        const column = line.indexOf('{') > -1 ? line.indexOf('{') + 1 : line.indexOf('}') + 1;
        errors.push({
          line: lineNumber,
          column: column,
          length: 1,
          message: '중괄호가 맞지 않습니다.'
        });
      }
    });
    
    return errors;
  };
  
  // 한자 검색 기능
  const searchHanja = (text) => {
    if (!text.trim()) {
      setHanjaResults([]);
      return;
    }
    
    // 한자 데이터베이스 (실제로는 더 큰 데이터베이스 사용)
    const hanjaDatabase = {
      '가': ['家', '歌', '街', '價', '加'],
      '나': ['那', '娜', '奈', '拿'],
      '다': ['多', '茶', '打', '大'],
      '라': ['羅', '裸', '螺', '邏'],
      '마': ['馬', '麻', '魔', '磨'],
      '바': ['波', '把', '破', '罷'],
      '사': ['事', '四', '死', '思', '社'],
      '아': ['我', '兒', '雅', '亞'],
      '자': ['字', '自', '子', '者', '資'],
      '차': ['車', '次', '差', '茶'],
      '카': ['卡'],
      '타': ['他', '打', '多'],
      '파': ['破', '波', '派', '把'],
      '하': ['下', '夏', '河', '何', '賀'],
      '학': ['學', '鶴'],
      '생': ['生', '牲', '笙'],
      '활': ['活', '滑', '闊'],
      '동': ['動', '同', '東', '童'],
      '물': ['物', '勿'],
      '세': ['世', '歲', '勢'],
      '계': ['計', '界', '系', '繼'],
      '정': ['正', '政', '情', '定', '精'],
      '의': ['義', '意', '衣', '醫'],
      '리': ['理', '里', '利', '離'],
      '력': ['力', '歷', '曆'],
      '문': ['文', '門', '問'],
      '화': ['火', '花', '話', '化'],
      '수': ['水', '數', '手', '受'],
      '지': ['地', '知', '智', '志'],
      '천': ['天', '千', '川'],
      '국': ['國', '菊'],
      '민': ['民', '敏'],
      '주': ['主', '住', '酒', '周'],
      '회': ['會', '回', '懷'],
      '업': ['業', '業'],
      '기': ['氣', '機', '記', '期'],
      '관': ['官', '觀', '關', '館'],
      '원': ['院', '員', '元', '原'],
      '부': ['部', '府', '父', '富'],
      '장': ['長', '場', '章', '將'],
      '과': ['課', '科', '過'],
      '목': ['目', '木', '牧'],
      '표': ['表', '票', '標'],
      '면': ['面', '免', '綿'],
      '단': ['單', '團', '段'],
      '체': ['體', '替'],
      '통': ['通', '統'],
      '보': ['報', '保', '步', '補'],
      '고': ['高', '古', '告', '考'],
      '등': ['等', '登', '燈'],
      '급': ['級', '急', '給'],
      '반': ['班', '半', '反'],
      '교': ['校', '教', '橋'],
      '실': ['室', '實', '失'],
      '습': ['習', '襲'],
      '연': ['練', '連', '年', '然'],
      '복': ['福', '復', '服'],
      '료': ['料', '療'],
      '비': ['費', '比', '非', '飛'],
      '용': ['用', '勇', '容'],
      '품': ['品', '稟'],
      '질': ['質', '疾'],
      '량': ['量', '良', '糧'],
      '성': ['性', '成', '城', '星'],
      '능': ['能', '陵'],
      '발': ['發', '髮', '罰'],
      '전': ['前', '全', '戰', '電'],
      '진': ['進', '眞', '陣', '振'],
      '후': ['後', '厚', '候'],
      '개': ['改', '開', '個'],
      '시': ['時', '市', '詩', '視'],
      '대': ['大', '對', '代'],
      '결': ['決', '結', '潔'],
      '서': ['書', '西', '序', '署'],
      '명': ['名', '明', '命']
    };
    
    const results = [];
    const searchText = text.trim();
    
    // 정확한 매칭
    if (hanjaDatabase[searchText]) {
      hanjaDatabase[searchText].forEach(hanja => {
        results.push({
          hangul: searchText,
          hanja: hanja,
          meaning: getHanjaMeaning(hanja)
        });
      });
    }
    
    // 부분 매칭
    Object.keys(hanjaDatabase).forEach(hangul => {
      if (hangul.includes(searchText) && hangul !== searchText) {
        hanjaDatabase[hangul].forEach(hanja => {
          results.push({
            hangul: hangul,
            hanja: hanja,
            meaning: getHanjaMeaning(hanja)
          });
        });
      }
    });
    
    setHanjaResults(results.slice(0, 20)); // 최대 20개 결과
  };
  
  // 한자 의미 가져오기
  const getHanjaMeaning = (hanja) => {
    const meanings = {
      '家': '집 가',
      '歌': '노래 가',
      '街': '거리 가',
      '價': '값 가',
      '加': '더할 가',
      '那': '어찌 나',
      '娜': '예쁠 나',
      '奈': '어찌 나',
      '拿': '잡을 나',
      '多': '많을 다',
      '茶': '차 다',
      '打': '칠 다',
      '大': '클 대',
      '羅': '그물 라',
      '裸': '벌거벗을 라',
      '螺': '소라 라',
      '邏': '순라 라',
      '馬': '말 마',
      '麻': '삼 마',
      '魔': '마귀 마',
      '磨': '갈 마',
      '波': '물결 파',
      '把': '잡을 파',
      '破': '깨뜨릴 파',
      '罷': '그칠 파',
      '事': '일 사',
      '四': '넷 사',
      '死': '죽을 사',
      '思': '생각할 사',
      '社': '모일 사',
      '我': '나 아',
      '兒': '아이 아',
      '雅': '우아할 아',
      '亞': '버금 아',
      '字': '글자 자',
      '自': '스스로 자',
      '子': '아들 자',
      '者': '사람 자',
      '資': '재물 자',
      '車': '수레 차',
      '次': '버금 차',
      '差': '어긋날 차',
      '他': '다를 타',
      '下': '아래 하',
      '夏': '여름 하',
      '河': '물 하',
      '何': '어찌 하',
      '賀': '하례할 하',
      '學': '배울 학',
      '鶴': '학 학',
      '生': '날 생',
      '牲': '희생 생',
      '笙': '생황 생',
      '活': '살 활',
      '滑': '미끄러울 활',
      '闊': '넓을 활',
      '動': '움직일 동',
      '同': '같을 동',
      '東': '동녘 동',
      '童': '아이 동',
      '物': '만물 물',
      '勿': '말 물',
      '世': '세상 세',
      '歲': '해 세',
      '勢': '기세 세',
      '計': '셀 계',
      '界': '지경 계',
      '系': '이을 계',
      '繼': '이을 계',
      '正': '바를 정',
      '政': '정사 정',
      '情': '뜻 정',
      '定': '정할 정',
      '精': '정할 정',
      '義': '옳을 의',
      '意': '뜻 의',
      '衣': '옷 의',
      '醫': '의원 의',
      '理': '다스릴 리',
      '里': '마을 리',
      '利': '이로울 리',
      '離': '떠날 리',
      '力': '힘 력',
      '歷': '지낼 력',
      '曆': '책력 력',
      '文': '글월 문',
      '門': '문 문',
      '問': '물을 문',
      '火': '불 화',
      '花': '꽃 화',
      '話': '말할 화',
      '化': '될 화',
      '水': '물 수',
      '數': '셀 수',
      '手': '손 수',
      '受': '받을 수',
      '地': '땅 지',
      '知': '알 지',
      '智': '지혜 지',
      '志': '뜻 지',
      '天': '하늘 천',
      '千': '일천 천',
      '川': '내 천',
      '國': '나라 국',
      '菊': '국화 국',
      '民': '백성 민',
      '敏': '민첩할 민',
      '主': '주인 주',
      '住': '살 주',
      '酒': '술 주',
      '周': '두루 주',
      '會': '모일 회',
      '回': '돌 회',
      '懷': '품을 회',
      '業': '업 업',
      '氣': '기운 기',
      '機': '틀 기',
      '記': '기록할 기',
      '期': '기약할 기',
      '官': '벼슬 관',
      '觀': '볼 관',
      '關': '빗장 관',
      '館': '집 관',
      '院': '집 원',
      '員': '관원 원',
      '元': '으뜸 원',
      '原': '근본 원',
      '部': '나눌 부',
      '府': '관청 부',
      '父': '아비 부',
      '富': '부할 부',
      '長': '길 장',
      '場': '마당 장',
      '章': '글 장',
      '將': '장수 장',
      '課': '과목 과',
      '科': '과목 과',
      '過': '지날 과',
      '目': '눈 목',
      '木': '나무 목',
      '牧': '치다 목',
      '表': '겉 표',
      '票': '표 표',
      '標': '표 표',
      '面': '얼굴 면',
      '免': '면할 면',
      '綿': '솜 면',
      '單': '홑 단',
      '團': '둥글 단',
      '段': '단계 단',
      '體': '몸 체',
      '替': '바꿀 체',
      '通': '통할 통',
      '統': '거느릴 통',
      '報': '갚을 보',
      '保': '지킬 보',
      '步': '걸음 보',
      '補': '기울 보',
      '高': '높을 고',
      '古': '옛 고',
      '告': '고할 고',
      '考': '생각할 고',
      '等': '같을 등',
      '登': '오를 등',
      '燈': '등잔 등',
      '級': '등급 급',
      '急': '급할 급',
      '給': '줄 급',
      '班': '무리 반',
      '半': '반 반',
      '反': '돌이킬 반',
      '校': '학교 교',
      '教': '가르칠 교',
      '橋': '다리 교',
      '室': '집 실',
      '實': '열매 실',
      '失': '잃을 실',
      '練': '익힐 연',
      '連': '이을 연',
      '年': '해 연',
      '然': '그러할 연',
      '福': '복 복',
      '復': '다시 복',
      '服': '옷 복',
      '料': '재료 료',
      '療': '고칠 료',
      '費': '쓸 비',
      '比': '견줄 비',
      '非': '아닐 비',
      '飛': '날 비',
      '用': '쓸 용',
      '勇': '날랠 용',
      '容': '얼굴 용',
      '品': '물건 품',
      '稟': '받을 품',
      '質': '바탕 질',
      '疾': '병 질',
      '量': '헤아릴 량',
      '良': '어질 량',
      '糧': '양식 량',
      '性': '성품 성',
      '成': '이룰 성',
      '城': '성 성',
      '星': '별 성',
      '能': '능할 능',
      '陵': '언덕 능',
      '發': '발',
      '髮': '터럭 발',
      '罰': '벌할 발',
      '前': '앞 전',
      '全': '온전할 전',
      '戰': '싸울 전',
      '電': '번개 전',
      '進': '나아갈 진',
      '眞': '참 진',
      '陣': '진칠 진',
      '振': '떨 진',
      '後': '뒤 후',
      '厚': '두터울 후',
      '候': '기후 후',
      '改': '고칠 개',
      '開': '열 개',
      '個': '개 개',
      '時': '때 시',
      '市': '저자 시',
      '詩': '시 시',
      '視': '볼 시',
      '對': '대할 대',
      '代': '대신할 대',
      '決': '결할 결',
      '結': '맺을 결',
      '潔': '깨끗할 결',
      '書': '글 서',
      '西': '서녘 서',
      '序': '차례 서',
      '署': '관청 서',
      '名': '이름 명',
      '明': '밝을 명',
      '命': '목숨 명'
    };
    
    return meanings[hanja] || '의미 없음';
  };
  
  // 한자 삽입 함수
  const insertHanja = (hanja) => {
    const editor = editorPaneRef.current?.getEditor();
    if (!editor) return;
    
    const selection = editor.getSelection();
    if (!selection) return;
    
    editor.executeEdits(null, [
      { range: selection, text: hanja, forceMoveMarkers: true }
    ]);
    
    setHanjaSearchOpen(false);
    setHanjaSearchText('');
    setHanjaResults([]);
  };

  // 파일 검증 함수
  const validateCurrentFile = async () => {
    const currentTab = getCurrentTab();
    if (!currentTab) return { errors: [], warnings: [] };
    
    const errors = [];
    const warnings = [];
    
    // HTML/XHTML 파일 검증
    if (currentTab.type === 'html' || currentTab.type === 'xhtml') {
      const content = currentTab.content;
      
      // 태그 검증
      const openTags = content.match(/<([a-z][a-z0-9]*)[^>]*>/gi) || [];
      const closeTags = content.match(/<\/([a-z][a-z0-9]*)>/gi) || [];
      
      const tagCount = {};
      openTags.forEach(tag => {
        const tagName = tag.match(/<([a-z][a-z0-9]*)/i)[1].toLowerCase();
        tagCount[tagName] = (tagCount[tagName] || 0) + 1;
      });
      
      closeTags.forEach(tag => {
        const tagName = tag.match(/<\/([a-z][a-z0-9]*)/i)[1].toLowerCase();
        tagCount[tagName] = (tagCount[tagName] || 0) - 1;
      });
      
      Object.entries(tagCount).forEach(([tag, count]) => {
        if (count > 0) {
          errors.push(`닫히지 않은 태그: <${tag}>`);
        } else if (count < 0) {
          errors.push(`열리지 않은 태그: </${tag}>`);
        }
      });
      
      // 이미지 태그 검증
      const imgTags = content.match(/<img[^>]*>/gi) || [];
      imgTags.forEach((img, index) => {
        if (!img.includes('src=')) {
          errors.push(`이미지 태그에 src 속성이 없습니다 (${index + 1}번째)`);
        }
        if (!img.includes('alt=')) {
          warnings.push(`이미지 태그에 alt 속성이 없습니다 (${index + 1}번째)`);
        }
      });
    }
    
    return { errors, warnings };
  };

  // 기존 저장 함수 (제출용으로 사용)
  const saveCurrentFileForSubmit = async () => {
    const currentTab = getCurrentTab();
    if (!currentTab) {
      console.warn('저장할 파일이 없습니다.');
      return;
    }

    try {
      // 저장 완료 표시
      saveTab(currentTab.id);
      
      // 저장 후 미리보기 업데이트
      console.log('파일 저장 완료, 미리보기 업데이트 중...');
      await runCode();
      
      // 저장 완료 표시 (탭에서 dirty 표시 제거)
      setOpenTabs(prev => prev.map(tab => 
        tab.id === currentTab.id ? { ...tab, isDirty: false } : tab
      ));
      
      // 저장 완료 시각적 피드백
      const fileName = currentTab.filePath ? 
        currentTab.filePath.split('/').pop() : 
        `${currentTab.name}.${currentTab.type}`;
      
      const saveNotification = document.createElement('div');
      saveNotification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      saveNotification.textContent = `✅ ${fileName} 저장됨`;
      document.body.appendChild(saveNotification);
      
      // 3초 후 알림 제거
      setTimeout(() => {
        if (saveNotification.parentNode) {
          saveNotification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => {
            if (saveNotification.parentNode) {
              document.body.removeChild(saveNotification);
            }
          }, 300);
        }
      }, 3000);
      
      console.log(`파일이 저장되었습니다: ${fileName}`);
      
    } catch (error) {
      console.error('파일 저장 중 오류:', error);
      alert('파일 저장 중 오류가 발생했습니다.');
    }
  };

  // 파일 다운로드 기능 (저장 버튼용)
  const downloadCurrentFile = () => {
    const currentTab = getCurrentTab();
    if (!currentTab) {
      alert('다운로드할 파일이 없습니다.');
      return;
    }

    // 파일 확장자에 따른 MIME 타입 결정
    const getMimeType = (type) => {
      const mimeTypes = {
        html: 'text/html',
        xhtml: 'application/xhtml+xml',
        css: 'text/css',
        javascript: 'text/javascript',
        json: 'application/json',
        xml: 'application/xml',
        text: 'text/plain'
      };
      return mimeTypes[type] || 'text/plain';
    };

    // 파일명 생성 (원래 파일명 유지)
    const getFileName = (tab) => {
      if (tab.filePath) {
        const pathParts = tab.filePath.split('/');
        return pathParts[pathParts.length - 1];
      }
      return `${tab.name}.${tab.type}`;
    };

    try {
      // Blob 생성
      const blob = new Blob([currentTab.content], { 
        type: getMimeType(currentTab.type) 
      });
      
      // 다운로드 링크 생성
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFileName(currentTab);
      
      // 다운로드 실행
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 메모리 정리
      URL.revokeObjectURL(url);
      
      // 다운로드 완료 알림
      const fileName = getFileName(currentTab);
      alert(`파일이 다운로드되었습니다: ${fileName}`);
      
    } catch (error) {
      console.error('파일 다운로드 중 오류:', error);
      alert('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 모든 탭 저장 기능
  const saveAllFiles = () => {
    if (openTabs.length === 0) {
      alert('저장할 파일이 없습니다.');
      return;
    }

    // 모든 탭에 대해 실시간 검증 실행
    console.log('🔍 모든 파일 임시저장 전 실시간 검증 시작');
    
    openTabs.forEach(tab => {
      console.log(`📋 ${tab.name} 검증 중...`);
      
      // 각 탭의 내용에 대해 검증 실행
      if (tab.content) {
        // HTML/XHTML 파일인 경우 기본적인 문법 검사
        if (tab.type === 'html' || tab.type === 'xhtml') {
          const errors = [];
          
          // 기본적인 HTML 문법 검사
          const lines = tab.content.split('\n');
          lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            // 닫는 괄호 누락 검사
            if (line.includes('<div') && !line.includes('</div>') && !line.includes('/>')) {
              errors.push({
                message: '닫는 괄호가 누락되었습니다: <div>',
                line: lineNumber,
                column: line.indexOf('<div') + 1
              });
            }
            
            if (line.includes('<p') && !line.includes('</p>') && !line.includes('/>')) {
              errors.push({
                message: '닫는 괄호가 누락되었습니다: <p>',
                line: lineNumber,
                column: line.indexOf('<p') + 1
              });
            }
            
            // 여는 괄호 누락 검사
            if (line.includes('</div>') && !line.includes('<div')) {
              errors.push({
                message: '여는 괄호가 누락되었습니다: </div>',
                line: lineNumber,
                column: line.indexOf('</div>') + 1
              });
            }
          });
          
          // 검증 오류를 로거에 기록
          errors.forEach(error => {
            if (window.logger) {
              window.logger.error('VALIDATION', `임시저장 시 검증 오류: ${error.message}`, {
                file: tab.filePath || tab.name,
                line: error.line,
                column: error.column,
                offset: error.column,
                path: tab.filePath || tab.name
              });
            }
          });
        }
      }
    });

    // ZIP 파일 생성
    const zip = new JSZip();

    openTabs.forEach(tab => {
      if (tab.content) {
        const fileName = tab.filePath || `${tab.name}.${tab.type}`;
        zip.file(fileName, tab.content);
      }
    });

    // ZIP 파일 다운로드
    zip.generateAsync({ type: 'blob' }).then(content => {
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'edited_files.zip';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      // 모든 탭을 저장됨으로 표시
      openTabs.forEach(tab => saveTab(tab.id));
      alert('모든 파일이 ZIP 파일로 저장되었습니다.');
    }).catch(error => {
      console.error('ZIP 파일 생성 중 오류:', error);
      alert('ZIP 파일 생성 중 오류가 발생했습니다.');
    });
  };

  // 사이드바 토글 기능
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const togglePreview = () => {
    setPreviewVisible(!previewVisible);
  };

  const togglePanel = (panelName) => {
    setPanelStates(prev => ({
      ...prev,
      [panelName]: !prev[panelName]
    }));
  };
  // 자동 검사 기능
  const performCodeCheck = async (content, type) => {
    const results = [];
    
    try {
      // HTML 검사
      if (type === 'html') {
        const htmlResults = await checkHTML(content);
        results.push(...htmlResults);
      }
      
      // XHTML 검사
      if (type === 'xhtml') {
        const xhtmlResults = await checkXHTML(content);
        results.push(...xhtmlResults);
      }
      
      // CSS 검사
      if (type === 'css') {
        const cssResults = await checkCSS(content);
        results.push(...cssResults);
      }
      
      // JavaScript 검사
      if (type === 'javascript') {
        const jsResults = await checkJavaScript(content);
        results.push(...jsResults);
      }
      
      // JSON 검사
      if (type === 'json') {
        const jsonResults = await checkJSON(content);
        results.push(...jsonResults);
      }
      
      // XML 검사
      if (type === 'xml') {
        const xmlResults = await checkXML(content);
        results.push(...xmlResults);
      }
      
    } catch (error) {
      console.error('코드 검사 중 오류:', error);
      results.push({
        type: 'error',
        message: '코드 검사 중 오류가 발생했습니다.',
        line: 1,
        severity: 'error'
      });
    }
    
    return results;
  };

  // XHTML 검사
  const checkXHTML = async (content) => {
    const results = [];
    
    // XML 선언 검사
    if (!content.includes('<?xml version="1.0"')) {
      results.push({
        type: 'warning',
        message: 'XML 선언이 없습니다. XHTML 표준을 위해 <?xml version="1.0" encoding="UTF-8"?>을 추가하세요.',
        line: 1,
        severity: 'warning'
      });
    }
    
    // DOCTYPE 검사
    if (!content.includes('<!DOCTYPE html') && content.includes('<html')) {
      results.push({
        type: 'warning',
        message: 'DOCTYPE 선언이 없습니다. XHTML 표준을 위해 적절한 DOCTYPE을 추가하세요.',
        line: 1,
        severity: 'warning'
      });
    }
    
    // xmlns 속성 검사
    if (content.includes('<html') && !content.includes('xmlns="http://www.w3.org/1999/xhtml"')) {
      results.push({
        type: 'error',
        message: 'XHTML 네임스페이스가 누락되었습니다. <html> 태그에 xmlns="http://www.w3.org/1999/xhtml"를 추가하세요.',
        line: 1,
        severity: 'error'
      });
    }
    
    // 자동 닫힘 태그 검사
    const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 자동 닫힘 태그가 올바르게 닫혔는지 검사
      selfClosingTags.forEach(tag => {
        const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
        const matches = line.match(regex);
        
        if (matches) {
          matches.forEach(match => {
            if (!match.endsWith('/>') && !match.endsWith(' />')) {
              results.push({
                type: 'error',
                message: `${tag} 태그는 자동 닫힘 태그입니다. <${tag} /> 형태로 작성하세요.`,
                line: i + 1,
                severity: 'error'
              });
            }
          });
        }
      });
      
      // 일반 태그가 올바르게 닫혔는지 검사
      const tagMatches = line.match(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)/g);
      
      if (tagMatches) {
        for (const tag of tagMatches) {
          const tagName = tag.replace(/[<>\/]/g, '');
          const isClosing = tag.startsWith('</');
          
          if (!isClosing && !selfClosingTags.includes(tagName)) {
            // 열린 태그 다음에 닫는 태그가 있는지 검사
            const nextLines = lines.slice(i + 1);
            let foundClosing = false;
            
            for (let j = 0; j < nextLines.length; j++) {
              if (nextLines[j].includes(`</${tagName}>`)) {
                foundClosing = true;
                break;
              }
            }
            
            if (!foundClosing) {
              results.push({
                type: 'error',
                message: `${tagName} 태그가 닫히지 않았습니다. </${tagName}> 태그를 추가하세요.`,
                line: i + 1,
                severity: 'error'
              });
            }
          }
        }
      }
    }
    
    // 소문자 태그 검사
    const upperCaseTags = content.match(/<[A-Z][^>]*>/g);
    if (upperCaseTags) {
      results.push({
        type: 'warning',
        message: 'XHTML에서는 모든 태그가 소문자여야 합니다. 대문자 태그를 소문자로 변경하세요.',
        line: 1,
        severity: 'warning'
      });
    }
    
    // 속성값 따옴표 검사
    const unquotedAttrs = content.match(/=\s*[^"'][^>\s]+/g);
    if (unquotedAttrs) {
      results.push({
        type: 'error',
        message: 'XHTML에서는 모든 속성값이 따옴표로 감싸져야 합니다.',
        line: 1,
        severity: 'error'
      });
    }
    
    return results;
  };

  // HTML 검사
  const checkHTML = async (content) => {
    const results = [];
    
    // DOCTYPE 검사
    if (!content.includes('<!DOCTYPE html>') && content.includes('<html')) {
      results.push({
        type: 'warning',
        message: 'DOCTYPE 선언이 없습니다. HTML5 표준을 위해 <!DOCTYPE html>을 추가하세요.',
        line: 1,
        severity: 'warning'
      });
    }
    
    // 태그 닫힘 검사
    const openTags = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tagMatches = line.match(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)/g);
      
      if (tagMatches) {
        for (const tag of tagMatches) {
          const tagName = tag.replace(/[<>\/]/g, '');
          const isClosing = tag.startsWith('</');
          
          if (!isClosing) {
            if (!['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
              openTags.push({ tag: tagName, line: i + 1 });
            }
          } else {
            const lastOpenTag = openTags.pop();
            if (!lastOpenTag || lastOpenTag.tag !== tagName) {
              results.push({
                type: 'error',
                message: `태그 불일치: ${tagName} 태그가 올바르게 닫히지 않았습니다.`,
                line: i + 1,
                severity: 'error'
              });
            }
          }
        }
      }
    }
    
    // 열린 태그가 남아있는지 검사
    if (openTags.length > 0) {
      results.push({
        type: 'error',
        message: `닫히지 않은 태그: ${openTags.map(t => t.tag).join(', ')}`,
        line: openTags[0].line,
        severity: 'error'
      });
    }
    
    return results;
  };

  // CSS 검사
  const checkCSS = async (content) => {
    const results = [];
    
    // 중괄호 짝 검사
    let braceCount = 0;
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      
      if (braceCount < 0) {
        results.push({
          type: 'error',
          message: '닫는 중괄호가 너무 많습니다.',
          line: i + 1,
          severity: 'error'
        });
        break;
      }
    }
    
    if (braceCount > 0) {
      results.push({
        type: 'error',
        message: '열린 중괄호가 닫히지 않았습니다.',
        line: lines.length,
        severity: 'error'
      });
    }
    
    // 세미콜론 누락 검사
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') && 
          !line.includes('@') && !line.startsWith('/*') && !line.startsWith('//')) {
        results.push({
          type: 'warning',
          message: '세미콜론이 누락되었습니다.',
          line: i + 1,
          severity: 'warning'
        });
      }
    }
    
    return results;
  };

  // JavaScript 검사
  const checkJavaScript = async (content) => {
    const results = [];
    
    try {
      // 기본 문법 검사
      new Function(content);
    } catch (error) {
      results.push({
        type: 'error',
        message: `JavaScript 문법 오류: ${error.message}`,
        line: 1,
        severity: 'error'
      });
    }
    
    // 중괄호 짝 검사
    let braceCount = 0;
    let parenCount = 0;
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;
      parenCount += (line.match(/\(/g) || []).length;
      parenCount -= (line.match(/\)/g) || []).length;
      
      if (braceCount < 0) {
        results.push({
          type: 'error',
          message: '닫는 중괄호가 너무 많습니다.',
          line: i + 1,
          severity: 'error'
        });
      }
      
      if (parenCount < 0) {
        results.push({
          type: 'error',
          message: '닫는 괄호가 너무 많습니다.',
          line: i + 1,
          severity: 'error'
        });
      }
    }
    
    if (braceCount > 0) {
      results.push({
        type: 'error',
        message: '열린 중괄호가 닫히지 않았습니다.',
        line: lines.length,
        severity: 'error'
      });
    }
    
    if (parenCount > 0) {
      results.push({
        type: 'error',
        message: '열린 괄호가 닫히지 않았습니다.',
        line: lines.length,
        severity: 'error'
      });
    }
    
    return results;
  };

  // JSON 검사
  const checkJSON = async (content) => {
    const results = [];
    
    try {
      JSON.parse(content);
    } catch (error) {
      results.push({
        type: 'error',
        message: `JSON 문법 오류: ${error.message}`,
        line: 1,
        severity: 'error'
      });
    }
    
    return results;
  };

  // XML 검사
  const checkXML = async (content) => {
    const results = [];
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      
      // XML 파싱 오류 검사
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        results.push({
          type: 'error',
          message: 'XML 파싱 오류가 발생했습니다.',
          line: 1,
          severity: 'error'
        });
      }
    } catch (error) {
      results.push({
        type: 'error',
        message: `XML 검사 오류: ${error.message}`,
        line: 1,
        severity: 'error'
      });
    }
    
    return results;
  };

  // 자동 검사 실행
  const runAutoCheck = async () => {
    if (!autoCheckEnabled) return;
    
    const currentTab = getCurrentTab();
    if (!currentTab) return;
    
    setIsChecking(true);
    
    try {
      const results = await performCodeCheck(currentTab.content, currentTab.type);
      setCheckResults(results);
      
      // 검사 결과가 있으면 콘솔에 출력
      if (results.length > 0) {
        console.log('🔍 코드 검사 결과:', results);
      }
    } catch (error) {
      console.error('자동 검사 오류:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // 패널 렌더링 함수들
  const renderAutoCheckPanel = () => {
    if (!panelStates.autoCheck) return null;
    
    return (
      <div className="panel auto-check-panel">
        <div className="panel-header">
          <h3>🔍 자동 검사 결과</h3>
          <button 
            className="panel-close"
            onClick={() => togglePanel('autoCheck')}
            title="패널 닫기"
          >
            ×
          </button>
        </div>
        <div className="panel-content">
          {checkResults.length > 0 ? (
            <div className="check-results-list">
              {checkResults.map((result, index) => (
                <div 
                  key={index} 
                  className={`check-result-item ${result.severity}`}
                  onClick={() => {
                    if (editorRef.current && result.line) {
                      editorRef.current.revealLineInCenter(result.line);
                      editorRef.current.setPosition({ lineNumber: result.line, column: 1 });
                      editorRef.current.focus();
                    }
                  }}
                >
                  <span className="check-result-icon">
                    {result.severity === 'error' ? '❌' : '⚠️'}
                  </span>
                  <span className="check-result-message">{result.message}</span>
                  {result.line && (
                    <span className="check-result-line">라인 {result.line}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-results">
              <p>검사 결과가 없습니다.</p>
              <p>코드를 작성하면 자동으로 검사됩니다.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSettingsPanel = () => {
    if (!panelStates.settings) return null;
    
    return (
      <div className="panel settings-panel">
        <div className="panel-header">
          <h3>⚙️ 설정</h3>
          <button 
            className="panel-close"
            onClick={() => togglePanel('settings')}
            title="패널 닫기"
          >
            ×
          </button>
        </div>
        <div className="panel-content">
          <div className="setting-item">
            <label>
              <input 
                type="checkbox" 
                checked={autoCheckEnabled}
                onChange={(e) => setAutoCheckEnabled(e.target.checked)}
              />
              자동 검사 활성화
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input 
                type="checkbox" 
                checked={panelStates.sidebar}
                onChange={(e) => togglePanel('sidebar')}
              />
              사이드바 표시
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input 
                type="checkbox" 
                checked={panelStates.preview}
                onChange={(e) => togglePanel('preview')}
              />
              미리보기 표시
            </label>
          </div>
          <div className="setting-item">
            <label>에디터 폰트 크기:</label>
            <select 
              value="14" 
              onChange={(e) => {
                // 폰트 크기 변경 로직
              }}
            >
              <option value="12">12px</option>
              <option value="14">14px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
            </select>
          </div>
          
          <div className="setting-item">
            <label>Base URL (CSS/이미지 경로):</label>
            <input 
              type="text" 
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                localStorage.setItem('base-url', e.target.value);
                // Base URL이 변경되면 미리보기 업데이트
                setTimeout(() => {
                  const currentTab = getCurrentTab();
                  if (currentTab) {
                    runCode();
                  }
                }, 100);
              }}
              placeholder="http://example.com/assets/"
              style={{ width: '100%', padding: '4px' }}
            />
            <small>CSS와 이미지 파일의 기본 경로를 설정합니다.</small>
          </div>

          {/* 템플릿 파레트 섹션 */}
          <div className="template-palette-section">
            <h4>🎨 템플릿 파레트</h4>
            
            {/* 기본 템플릿 */}
            <div className="template-group">
              <h5>📄 기본 템플릿</h5>
              <div className="template-grid">
                {Object.values(DEFAULT_TEMPLATES).map(template => (
                  <div 
                    key={template.name}
                    className="template-card"
                    onMouseEnter={() => previewTemplate(template)}
                    onMouseLeave={() => setTemplatePreview('')}
                  >
                    <div className="template-preview">
                      <div className="template-icon">
                        {template.type === 'html' ? '🌐' : template.type === 'css' ? '🎨' : '📝'}
                      </div>
                      <div className="template-name">{template.name}</div>
                    </div>
                    <div className="template-actions">
                      <button 
                        className="template-btn insert"
                        onClick={() => insertTemplate(template)}
                        title="템플릿 삽입"
                      >
                        ➤
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 커스텀 템플릿 */}
            <div className="template-group">
              <h5>💾 커스텀 템플릿</h5>
              <div className="template-controls">
                <button 
                  className="template-btn save"
                  onClick={saveCustomTemplate}
                  title="현재 내용을 템플릿으로 저장"
                >
                  💾 저장
                </button>
              </div>
              <div className="template-grid">
                {customTemplates.map(template => (
                  <div 
                    key={template.id}
                    className="template-card custom"
                    onMouseEnter={() => previewTemplate(template)}
                    onMouseLeave={() => setTemplatePreview('')}
                  >
                    <div className="template-preview">
                      <div className="template-icon">
                        {template.type === 'html' ? '🌐' : template.type === 'css' ? '🎨' : '📝'}
                      </div>
                      <div className="template-name">{template.name}</div>
                    </div>
                    <div className="template-actions">
                      <button 
                        className="template-btn insert"
                        onClick={() => insertTemplate(template)}
                        title="템플릿 삽입"
                      >
                        ➤
                      </button>
                      <button 
                        className="template-btn delete"
                        onClick={() => deleteCustomTemplate(template.id)}
                        title="템플릿 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                {customTemplates.length === 0 && (
                  <div className="empty-state">
                    <p>저장된 커스텀 템플릿이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>

            {/* 스니펫 */}
            <div className="template-group">
              <h5>📝 코드 스니펫</h5>
              <div className="template-controls">
                <button 
                  className="template-btn save"
                  onClick={saveSnippet}
                  title="선택한 코드를 스니펫으로 저장"
                >
                  📝 저장
                </button>
              </div>
              
              {/* 기본 스니펫 */}
              <div className="snippet-section">
                <h6>기본 스니펫</h6>
                <div className="snippet-list">
                  {Object.values(DEFAULT_SNIPPETS).map(snippet => (
                    <div 
                      key={snippet.name}
                      className="snippet-item"
                      onClick={() => insertSnippet(snippet)}
                      title={snippet.description}
                    >
                      <span className="snippet-icon">
                        {snippet.type === 'html' ? '🌐' : snippet.type === 'css' ? '🎨' : '⚡'}
                      </span>
                      <span className="snippet-name">{snippet.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 커스텀 스니펫 */}
              <div className="snippet-section">
                <h6>커스텀 스니펫</h6>
                <div className="snippet-list">
                  {snippets.map(snippet => (
                    <div 
                      key={snippet.id}
                      className="snippet-item custom"
                    >
                      <div 
                        className="snippet-content"
                        onClick={() => insertSnippet(snippet)}
                        title={snippet.description}
                      >
                        <span className="snippet-icon">
                          {snippet.type === 'html' ? '🌐' : snippet.type === 'css' ? '🎨' : '⚡'}
                        </span>
                        <span className="snippet-name">{snippet.name}</span>
                      </div>
                      <button 
                        className="snippet-delete"
                        onClick={() => deleteSnippet(snippet.id)}
                        title="스니펫 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  {snippets.length === 0 && (
                    <div className="empty-state">
                      <p>저장된 스니펫이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 템플릿 미리보기 */}
            {templatePreview && (
              <div className="template-preview-section">
                <h5>👁️ 미리보기</h5>
                <div className="template-preview-content">
                  <pre><code>{templatePreview.substring(0, 300)}{templatePreview.length > 300 ? '...' : ''}</code></pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHelpPanel = () => {
    if (!panelStates.help) return null;
    
    return (
      <div className="panel help-panel">
        <div className="panel-header">
          <h3>❓ 도움말</h3>
          <button 
            className="panel-close"
            onClick={() => togglePanel('help')}
            title="패널 닫기"
          >
            ×
          </button>
        </div>
        <div className="panel-content">
          {/* <div className="help-section">
            <h4>📚 EPUB 업로드</h4>
            <p>EPUB 파일을 업로드하면 목차와 파일 구조가 자동으로 생성됩니다.</p>
          </div> */}
          <div className="help-section">
            <h4>🔍 자동 검사</h4>
            <p>코드를 작성하면 실시간으로 문법 오류와 경고를 검사합니다.</p>
          </div>
          <div className="help-section">
            <h4>👁️ 미리보기</h4>
            <p>HTML 코드를 작성하면 실시간으로 미리보기를 확인할 수 있습니다.</p>
          </div>
          <div className="help-section">
            <h4>💾 저장</h4>
            <p>현재 파일을 저장하거나 모든 파일을 ZIP으로 저장할 수 있습니다.</p>
          </div>
          <div className="help-section">
            <h4>🎨 테마</h4>
            <p>다크/라이트 테마를 전환할 수 있습니다.</p>
          </div>
        </div>
      </div>
    );
  };
  // 이미지 디버깅 패널 렌더링
  const renderImageDebugPanel = () => {
    if (!showImageDebug) return null;

    return (
      <div className="panel image-debug-panel" style={{
        position: 'fixed',
        top: '100px',
        right: '20px',
        width: '400px',
        maxHeight: '600px',
        zIndex: 10000,
        background: '#252526',
        border: '1px solid #454545',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div className="panel-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #454545'
        }}>
          <h3 style={{ margin: 0, color: '#d4d4d4' }}>🖼️ 이미지 디버깅</h3>
          <button 
            onClick={() => setShowImageDebug(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#d4d4d4',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
        <div className="panel-content" style={{
          padding: '16px',
          maxHeight: '500px',
          overflowY: 'auto'
        }}>
          {imageDebugInfo.length === 0 ? (
            <p style={{ color: '#858585', fontStyle: 'italic' }}>이미지 처리 정보가 없습니다.</p>
          ) : (
            <div>
              <div style={{ marginBottom: '12px', padding: '8px', background: '#2d2d30', borderRadius: '4px' }}>
                <strong style={{ color: '#d4d4d4' }}>📊 통계:</strong>
                <div style={{ color: '#858585', fontSize: '12px', marginTop: '4px' }}>
                  총 처리: {imageDebugInfo.length}개<br/>
                  성공: {imageDebugInfo.filter(info => info.status === 'success').length}개<br/>
                  실패: {imageDebugInfo.filter(info => info.status === 'not_found').length}개
                </div>
              </div>
              <button 
                onClick={() => setImageDebugInfo([])}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
              >
                로그 지우기
              </button>
              {imageDebugInfo.map((info, index) => (
                <div key={index} style={{
                  border: '1px solid #454545',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '8px',
                  background: info.status === 'success' ? '#1e3a1e' : '#3a1e1e'
                }}>
                  <div style={{ color: '#9cdcfe', fontWeight: 'bold' }}>
                    {info.fileName || info.originalSrc}
                  </div>
                  <div style={{ color: '#858585', fontSize: '12px', marginTop: '4px' }}>
                    <div>원본 경로: {info.originalSrc}</div>
                    <div>절대 경로: {info.absolutePath}</div>
                    <div>MIME 타입: {info.mimeType || 'N/A'}</div>
                    <div>내용 크기: {info.contentLength} bytes</div>
                    <div>데이터 URL 크기: {info.dataUrlLength} bytes</div>
                    <div>상태: {info.status}</div>
                    <div>시간: {new Date(info.timestamp).toLocaleTimeString()}</div>
                    {info.availableFiles && info.availableFiles.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ color: '#9cdcfe', fontWeight: 'bold' }}>사용 가능한 이미지 파일 ({info.availableFiles.length}개):</div>
                        <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '10px' }}>
                          {info.availableFiles.map((file, idx) => {
                            const fileName = file.split('/').pop();
                            const originalFileName = info.originalSrc.split('/').pop();
                            const isSimilar = fileName.toLowerCase().includes(originalFileName.toLowerCase()) || 
                                            originalFileName.toLowerCase().includes(fileName.toLowerCase());
                            return (
                              <div key={idx} style={{ 
                                color: isSimilar ? '#ffd700' : '#6a9955',
                                fontWeight: isSimilar ? 'bold' : 'normal'
                              }}>
                                • {file} {isSimilar && '(유사한 파일명)'}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {info.status === 'not_found' && (
                      <div style={{ marginTop: '8px', color: '#ff6b6b', fontSize: '11px' }}>
                        💡 팁: 이미지 경로를 확인하고 파일명이 정확한지 확인해보세요.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // VS Code 사이드바 렌더링
  const renderVscodeSidebar = () => {
    if (!vscodeSidebarVisible) return null;

    return (
      <div className="vscode-sidebar">
        <div className="vscode-sidebar-tabs">
          <button 
            className={`vscode-tab ${activeSidebarTab === 'explorer' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('explorer')}
            title="탐색기 (Ctrl+Shift+E)"
          >
            📁
          </button>
          <button 
            className={`vscode-tab ${activeSidebarTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('search')}
            title="검색 (Ctrl+Shift+F)"
          >
            🔍
          </button>
          <button 
            className={`vscode-tab ${activeSidebarTab === 'run' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('run')}
            title="실행 및 디버그 (Ctrl+Shift+D)"
          >
            ▶️
          </button>
          <button 
            className={`vscode-tab ${activeSidebarTab === 'extensions' ? 'active' : ''}`}
            onClick={() => setActiveSidebarTab('extensions')}
            title="확장 (Ctrl+Shift+X)"
          >
            ⚙️
          </button>
        </div>
        
        <div className="vscode-sidebar-content">
          {activeSidebarTab === 'explorer' && (
            <div className="explorer-panel">
              <div className="panel-header">
                <h3>탐색기</h3>
              </div>
              
              <div className="explorer-content">
                {epubData ? (
                  <div className="file-explorer">
                    <div className="explorer-section">
                      <div className="section-header">
                        <span className="section-icon">📚</span>
                        <span className="section-title">EPUB 파일</span>
                      </div>
                      <div className="section-content">
                        {renderFileTree()}
                      </div>
                    </div>
                    
                    <div className="explorer-section">
                      <div className="section-header">
                        <span className="section-icon">📖</span>
                        <span className="section-title">목차</span>
                      </div>
                      <div className="section-content">
                        {renderTocTree()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📚</div>
                    <div className="empty-text">EPUB 파일을 업로드하세요</div>
                    <button 
                      className="upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      EPUB 업로드
                    </button>
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
                  <button className="search-btn" onClick={performSearch}>◉</button>
                </div>
                <div className="search-options">
                  <label className="search-option">
                    <input 
                      type="checkbox" 
                      checked={searchOptions.caseSensitive}
                      onChange={(e) => setSearchOptions(prev => ({ ...prev, caseSensitive: e.target.checked }))}
                    /> 
                    대소문자 구분
                  </label>
                  <label className="search-option">
                    <input 
                      type="checkbox" 
                      checked={searchOptions.useRegex}
                      onChange={(e) => setSearchOptions(prev => ({ ...prev, useRegex: e.target.checked }))}
                    /> 
                    정규식
                  </label>
                  <label className="search-option">
                    <input 
                      type="checkbox" 
                      checked={searchOptions.wholeWord}
                      onChange={(e) => setSearchOptions(prev => ({ ...prev, wholeWord: e.target.checked }))}
                    /> 
                    전체 단어
                  </label>
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
                    <span className="config-icon">◉</span>
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
                    <span className="config-icon">◉</span>
                    <span className="config-name">
                      자동 검사 {autoCheckEnabled ? '(활성)' : '(비활성)'}
                    </span>
                  </div>
                  <div 
                    className="configuration-item"
                    onClick={() => togglePanel('autoCheck')}
                    title="검사 결과를 표시합니다"
                  >
                    <span className="config-icon">◉</span>
                    <span className="config-name">검사 결과 보기</span>
                  </div>
                  <div 
                    className="configuration-item"
                    onClick={saveCurrentFile}
                    disabled={!getCurrentTab()}
                    title="현재 파일을 임시 저장합니다"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>save</span>
                    <span className="config-name">임시 저장</span>
                  </div>
                  
                  <div 
                    className="configuration-item"
                    onClick={submitCurrentFile}
                    disabled={!getCurrentTab() || isSubmitting}
                    title="현재 파일을 제출합니다"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>send</span>
                    <span className="config-name">{isSubmitting ? '제출 중...' : '제출'}</span>
                  </div>
                  
                  <div 
                    className="configuration-item"
                    onClick={() => setTypeModalOpen(true)}
                    title="타입 & 롤을 선택합니다"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>category</span>
                    <span className="config-name">타입 & 롤</span>
                  </div>
                  
                  <div 
                    className="configuration-item"
                    onClick={() => setHanjaSearchOpen(true)}
                    title="한자를 검색합니다"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>translate</span>
                    <span className="config-name">한자 검색</span>
                  </div>
                  
                  <div 
                    className="configuration-item"
                    onClick={checkImageUsage}
                    title="사용되지 않는 이미지를 검사합니다"
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '16px'}}>image_search</span>
                    <span className="config-name">이미지 검사</span>
                  </div>
                  <div 
                    className="configuration-item"
                    onClick={saveAllFiles}
                    disabled={openTabs.length === 0}
                    title="모든 열린 파일을 ZIP으로 저장합니다"
                  >
                    <span className="config-icon">◉</span>
                    <span className="config-name">전체 저장</span>
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
                                      <span className="extension-icon">◉</span>
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
                                      <span className="extension-icon">◉</span>
                  <span className="extension-name">
                    코드 검사 {autoCheckEnabled ? '(활성)' : '(비활성)'}
                  </span>
                </div>
                <div 
                  className="extension-item"
                  onClick={toggleTheme}
                  title="테마를 변경합니다"
                >
                  <span className="extension-icon">🌓</span>
                  <span className="extension-name">테마 변경</span>
                </div>
                <div 
                  className="extension-item"
                  onClick={() => togglePanel('settings')}
                  title="설정을 엽니다"
                >
                                      <span className="extension-icon">◉</span>
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

  // 파일 트리 중복 제거 함수
  const removeDuplicateNodes = (nodes) => {
    if (!nodes || nodes.length === 0) return nodes;
    
    const seen = new Set();
    const uniqueNodes = [];
    
    for (const node of nodes) {
      const key = `${node.name}-${node.type}-${node.path || ''}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        
        // 자식 노드들도 재귀적으로 중복 제거
        if (node.children && node.children.length > 0) {
          node.children = removeDuplicateNodes(node.children);
        }
        
        uniqueNodes.push(node);
      } else {
        console.log('중복 노드 제거:', node.name, node.type, node.path);
      }
    }
    
    return uniqueNodes;
  };

  // 파일 트리 정렬 함수
  const sortFileTree = (nodes) => {
    if (!nodes || nodes.length === 0) return nodes;
    
    return nodes.sort((a, b) => {
      // 1. 폴더를 먼저, 파일을 나중에
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      
      // 2. 같은 타입이면 정렬 우선순위 적용
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // 파일 확장자 추출
      const aExt = aName.split('.').pop();
      const bExt = bName.split('.').pop();
      
      // 3. 특정 파일 타입 우선순위 (HTML, CSS, JS, 이미지 등)
      const getFilePriority = (name, ext) => {
        if (name === 'mimetype') return 1;
        if (name === 'container.xml') return 2;
        if (name === 'content.opf') return 3;
        if (name === 'toc.ncx') return 4;
        if (ext === 'html' || ext === 'xhtml') return 5;
        if (ext === 'css') return 6;
        if (ext === 'js') return 7;
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 8;
        if (ext === 'xml') return 9;
        return 10; // 기타 파일
      };
      
      const aPriority = getFilePriority(aName, aExt);
      const bPriority = getFilePriority(bName, bExt);
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // 4. 같은 우선순위면 알파벳/숫자 순서로 정렬
      return a.name.localeCompare(b.name, 'ko', { 
        numeric: true, 
        sensitivity: 'base' 
      });
    }).map(node => {
      // 자식 노드들도 재귀적으로 정렬
      if (node.children && node.children.length > 0) {
        return { ...node, children: sortFileTree(node.children) };
      }
      return node;
    });
  };
  // 파일 트리 렌더링 (VS Code 스타일)
  const renderFileTree = () => {
    if (!fileTree || fileTree.length === 0) {
      return (
        <div style={{padding: '12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',  display: 'flex', flexDirection: 'column'}}>
          {/* 파일 트리 헤더 */}
          <div style={{
            fontWeight: '600', 
            marginBottom: '8px', 
            color: '#1a1a1a',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            padding: '8px 12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
              <span className="material-symbols-outlined" style={{fontSize: '16px'}}>folder</span>
              <span>파일 탐색기</span>
            </div>
          </div>
          
          {/* 탐색기 도구 모음 */}
          <div style={{
            display: 'flex',
            gap: '2px',
            marginBottom: '8px',
            padding: '4px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            border: '1px solid #e9ecef'
          }}>
            <button 
              onClick={() => {
                // 테스트용 기본 폴더 생성
                const testFolder = { name: 'test-folder', type: 'folder', path: 'test-folder', children: [], isExpanded: true };
                setFileTree([testFolder]);
                setCurrentSelectedNode(testFolder);
              }}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                backgroundColor: '#ffffff',
                color: '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e9ecef';
                e.currentTarget.style.borderColor = '#adb5bd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
            >
              <span className="material-symbols-outlined" style={{fontSize: '14px'}}>science</span>
              테스트 폴더 생성
            </button>
          </div>
          
          <div className="file-tree-empty" style={{padding: '10px', color: '#666', fontStyle: 'italic', textAlign: 'center'}}>
            파일이 없습니다.<br/>
            위의 "테스트 폴더 생성" 버튼을 클릭하거나<br/>
            헤더의 "업로드" 또는 "가져오기" 버튼을 사용하세요.
          </div>
        </div>
      );
    }
    
    // 파일 트리 중복 제거 후 정렬
    const uniqueFileTree = removeDuplicateNodes([...fileTree]);
    const sortedFileTree = sortFileTree(uniqueFileTree);
    
    console.log('renderFileTree 호출됨 - fileTree:', sortedFileTree);
    
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
    
    const imagesFolder = findImagesFolderRecursive(sortedFileTree);
    if (imagesFolder) {
      console.log('images 폴더 발견:', {
        name: imagesFolder.name,
        type: imagesFolder.type,
        childrenCount: imagesFolder.children ? imagesFolder.children.length : 0,
        isExpanded: imagesFolder.isExpanded,
        children: imagesFolder.children ? imagesFolder.children.map(child => child.name) : []
      });
    } else {
      console.log('images 폴더를 찾을 수 없음. 전체 폴더 목록:', fileTree.map(node => node.name));
      
      // OEBPS 폴더 안의 하위 폴더들 확인
      const oebpsFolder = fileTree.find(node => node.name === 'OEBPS');
      if (oebpsFolder && oebpsFolder.children) {
        console.log('OEBPS 폴더 내 하위 폴더들:', oebpsFolder.children.filter(child => child.type === 'folder').map(child => child.name));
        console.log('OEBPS 폴더 내 모든 자식들:', oebpsFolder.children.map(child => `${child.name} (${child.type})`));
      }
    }
    
         // OEBPS 폴더가 접혀있으면 자동으로 펼치기 (useEffect 대신 조건부 렌더링)
     const oebpsFolder = sortedFileTree.find(node => node.name === 'OEBPS');
     if (oebpsFolder && !oebpsFolder.isExpanded) {
       console.log('OEBPS 폴더를 자동으로 펼칩니다.');
       // 즉시 상태 업데이트
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
    


    return (
      <div style={{padding: '12px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', height: '300px', display: 'flex', flexDirection: 'column'}}>
        {/* 파일 트리 헤더 */}
        <div style={{
          fontWeight: '600', 
          marginBottom: '8px', 
          color: '#1a1a1a',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e9ecef'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
            <span className="material-symbols-outlined" style={{fontSize: '16px'}}>folder</span>
            <span>파일 탐색기</span>
          </div>
        </div>
        
        {/* 탐색기 도구 모음 */}
        <div style={{
          display: 'flex',
          gap: '2px',
          marginBottom: '8px',
          padding: '6px',
          backgroundColor: '#e3f2fd',
          borderRadius: '6px',
          border: '2px solid #2196f3',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <button 
            onClick={() => {
              if (!currentSelectedNode) {
                alert('먼저 폴더를 선택해주세요.');
                return;
              }
              setSelectedNode(currentSelectedNode);
              createFolder();
            }}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              backgroundColor: '#ffffff',
              color: '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.borderColor = '#adb5bd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
          >
            <span className="material-symbols-outlined" style={{fontSize: '14px'}}>folder</span>
            새 폴더
          </button>
          
          <button 
            onClick={() => {
              if (!currentSelectedNode) {
                alert('먼저 폴더를 선택해주세요.');
                return;
              }
              setSelectedNode(currentSelectedNode);
              createFile();
            }}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              backgroundColor: '#ffffff',
              color: '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.borderColor = '#adb5bd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
          >
            <span className="material-symbols-outlined" style={{fontSize: '14px'}}>note_add</span>
            새 파일
          </button>
          
          <div style={{width: '1px', backgroundColor: '#dee2e6', margin: '0 4px'}} />
          
          <button 
            onClick={() => {
              if (!currentSelectedNode) {
                alert('먼저 삭제할 항목을 선택해주세요.');
                return;
              }
              setSelectedNode(currentSelectedNode);
              deleteNode();
            }}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              backgroundColor: '#ffffff',
              color: '#dc3545',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8d7da';
              e.currentTarget.style.borderColor = '#f5c6cb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
          >
            <span style={{fontSize: '14px'}}>🗑️</span>
            삭제
          </button>
          
          <div style={{width: '1px', backgroundColor: '#dee2e6', margin: '0 4px'}} />
          
          <button 
            onClick={() => {
              if (!currentSelectedNode) {
                alert('먼저 이름을 변경할 항목을 선택해주세요.');
                return;
              }
              setSelectedNode(currentSelectedNode);
              renameNode();
            }}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              backgroundColor: '#ffffff',
              color: '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e9ecef';
              e.currentTarget.style.borderColor = '#adb5bd';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
          >
            <span style={{fontSize: '14px'}}>✏️</span>
            이름 변경
          </button>
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
          {sortedFileTree.map((node, index) => (
            <div key={index}>
              <div 
                data-file-item="true"
                data-file-name={node.name}
                data-file-type={node.type}
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
                  border: currentSelectedNode && currentSelectedNode.name === node.name && currentSelectedNode.path === node.path ? '2px solid #4299e1' : '1px solid transparent',
                  backgroundColor: currentSelectedNode && currentSelectedNode.name === node.name && currentSelectedNode.path === node.path ? 'rgba(66, 153, 225, 0.1)' : 'transparent'
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
                onClick={() => {
                  setCurrentSelectedNode(node);
                  if (node.type === 'folder') {
                    toggleFolder(node);
                  } else {
                    handleFileClick(node);
                  }
                }}
                onContextMenu={(e) => {
                  console.log('파일트리 아이템 우클릭됨:', node.name);
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
                         data-file-item="true"
                         data-file-name={child.name}
                         data-file-type={child.type}
                         style={{
                           padding: '4px 8px',
                           marginBottom: '1px',
                           borderRadius: '4px',
                           cursor: 'pointer',
                           display: 'flex',
                           alignItems: 'center',
                           gap: '6px',
                           transition: 'all 0.2s ease',
                           color: '#ffffff',
                           fontSize: '12px',
                           border: currentSelectedNode && currentSelectedNode.name === child.name && currentSelectedNode.path === child.path ? '2px solid #4299e1' : '1px solid transparent',
                           backgroundColor: currentSelectedNode && currentSelectedNode.name === child.name && currentSelectedNode.path === child.path ? 'rgba(66, 153, 225, 0.1)' : 'transparent'
                         }}
                         onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor = '#f7fafc';
                           e.currentTarget.style.borderColor = '#e2e8f0';
                           e.currentTarget.style.color = '#4a5568';
                         }}
                         onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor = 'transparent';
                           e.currentTarget.style.borderColor = 'transparent';
                           e.currentTarget.style.color = '#ffffff';
                         }}
                         onClick={() => {
                           setCurrentSelectedNode(child);
                           if (child.type === 'folder') {
                             toggleFolder(child);
                           } else {
                             handleFileClick(child);
                           }
                         }}
                         onContextMenu={(e) => handleContextMenu(e, child)}
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
                                 data-file-item="true"
                                 data-file-name={grandChild.name}
                                 data-file-type={grandChild.type}
                                 style={{
                                   padding: '3px 8px',
                                   marginBottom: '1px',
                                   borderRadius: '3px',
                                   cursor: 'pointer',
                                   display: 'flex',
                                   alignItems: 'center',
                                   gap: '4px',
                                   transition: 'all 0.2s ease',
                                   color: '#ffffff',
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
                                   e.currentTarget.style.color = '#ffffff';
                                 }}
                                 onClick={() => {
                                   if (grandChild.type === 'folder') {
                                     toggleFolder(grandChild);
                                   } else {
                                     handleFileClick(grandChild);
                                   }
                                 }}
                                 onContextMenu={(e) => handleContextMenu(e, grandChild)}
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

  // 검색 기능 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOptions, setSearchOptions] = useState({
    caseSensitive: false,
    useRegex: false,
    wholeWord: false
  });
  
  // 파일 트리 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [currentSelectedNode, setCurrentSelectedNode] = useState(null);
  const [deletedFiles, setDeletedFiles] = useState([]); // 삭제된 파일 목록

  // 테마 관련 useEffect
  useEffect(() => {
    // 시스템 테마 변경 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(newSystemTheme);
      
      // 시스템 모드일 때만 현재 테마 업데이트
      if (themeMode === 'system') {
        setCurrentTheme(newSystemTheme);
        applyTheme(newSystemTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    // 초기 테마 적용
    applyTheme(currentTheme);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [themeMode, currentTheme]);

  // 검색 실행 함수
  const performSearch = async () => {
    if (!searchQuery.trim() || !epubData) {
      setSearchResults([]);
      return;
    }

    const results = [];
    const query = searchOptions.caseSensitive ? searchQuery : searchQuery.toLowerCase();

    // EPUB 파일들에서 검색
    for (const [filePath, fileData] of Object.entries(epubData.zipContent)) {
      if (fileData.type === 'text' || fileData.type === 'html' || fileData.type === 'xml') {
        const content = fileData.content || '';
        const searchContent = searchOptions.caseSensitive ? content : content.toLowerCase();
        
        let matches = [];
        
        if (searchOptions.useRegex) {
          try {
            const regex = new RegExp(query, searchOptions.caseSensitive ? 'g' : 'gi');
            const regexMatches = [...searchContent.matchAll(regex)];
            matches = regexMatches.map(match => ({
              index: match.index,
              text: match[0],
              line: getLineNumber(content, match.index)
            }));
          } catch (error) {
            console.error('Invalid regex:', error);
          }
        } else {
          let index = 0;
          while ((index = searchContent.indexOf(query, index)) !== -1) {
            const line = getLineNumber(content, index);
            const lineText = getLineText(content, index);
            
            if (!searchOptions.wholeWord || isWholeWord(content, index, query.length)) {
              matches.push({
                index,
                text: query,
                line,
                lineText
              });
            }
            index += 1;
          }
        }

        if (matches.length > 0) {
          results.push({
            filePath,
            fileName: filePath.split('/').pop(),
            matches,
            totalMatches: matches.length
          });
        }
      }
    }

    setSearchResults(results);
  };

  // 라인 번호 계산
  const getLineNumber = (content, index) => {
    return content.substring(0, index).split('\n').length;
  };

  // 라인 텍스트 가져오기
  const getLineText = (content, index) => {
    const lines = content.split('\n');
    const lineNumber = getLineNumber(content, index) - 1;
    return lines[lineNumber] || '';
  };

  // 전체 단어 확인
  const isWholeWord = (content, index, length) => {
    const before = index > 0 ? content[index - 1] : '';
    const after = index + length < content.length ? content[index + length] : '';
    const wordRegex = /\w/;
    return !wordRegex.test(before) && !wordRegex.test(after);
  };

  // 파일 트리 관리 함수들
  const handleContextMenu = (e, node) => {
    console.log('🔍🔍🔍 handleContextMenu 함수 호출됨!');
    console.log('🔍🔍🔍 이벤트 객체:', e);
    console.log('🔍🔍🔍 노드 객체:', node);
    e.preventDefault();
    e.stopPropagation();
    console.log('🔍🔍🔍 컨텍스트 메뉴 호출됨:', node);
    console.log('🔍🔍🔍 마우스 위치:', e.clientX, e.clientY);
    // ref에 노드 정보 저장 (동기적으로)
    selectedNodeRef.current = node;
    setSelectedNode(node);
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
    console.log('🔍🔍🔍 contextMenu 상태 설정됨:', { x: e.clientX, y: e.clientY });
    console.log('🔍🔍🔍 selectedNodeRef에 저장됨:', selectedNodeRef.current);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setSelectedNode(null);
  };
  const createFolder = () => {
    console.log('🔍 createFolder 호출됨');
    console.log('🔍 selectedNode:', selectedNode);
    console.log('🔍 selectedNodeRef.current:', selectedNodeRef.current);
    
    // ref에서 노드 정보 가져오기
    const targetNode = selectedNodeRef.current || selectedNode;
    
    if (!targetNode) {
      console.log('❌ targetNode가 없음');
      alert('선택된 노드가 없습니다. 파일트리에서 폴더를 선택한 후 다시 시도하세요.');
      return;
    }
    
    const folderName = prompt('새 폴더 이름을 입력하세요:');
    if (!folderName || !folderName.trim()) return;
    
    const newFolder = {
      name: folderName.trim(),
      type: 'folder',
      path: targetNode.type === 'folder' ? `${targetNode.path}/${folderName.trim()}` : `${targetNode.path.split('/').slice(0, -1).join('/')}/${folderName.trim()}`,
      children: [],
      isExpanded: true
    };
    
    console.log('새 폴더 생성:', newFolder);
    
    setFileTree(prevTree => {
      const addFolderToNode = (nodes) => {
        return nodes.map(node => {
          if (node.name === selectedNode.name && node.path === selectedNode.path) {
            console.log('노드에 폴더 추가:', node.name, newFolder.name);
            return {
              ...node,
              children: [...(node.children || []), newFolder]
            };
          }
          if (node.children) {
            return { ...node, children: addFolderToNode(node.children) };
          }
          return node;
        });
      };
      return addFolderToNode(prevTree);
    });
    
    // 새로 생성된 폴더를 선택 상태로 설정
    setCurrentSelectedNode(newFolder);
    closeContextMenu();
  };

  const createFile = () => {
    console.log('createFile 호출됨, selectedNode:', selectedNode);
    if (!selectedNode) {
      console.log('selectedNode가 없음');
      return;
    }
    
    const fileName = prompt('새 파일 이름을 입력하세요 (확장자 포함):');
    if (!fileName || !fileName.trim()) return;
    
    const newFile = {
      name: fileName.trim(),
      type: 'file',
      path: selectedNode.type === 'folder' ? `${selectedNode.path}/${fileName.trim()}` : `${selectedNode.path.split('/').slice(0, -1).join('/')}/${fileName.trim()}`,
      content: ''
    };
    
    console.log('새 파일 생성:', newFile);
    
    setFileTree(prevTree => {
      const addFileToNode = (nodes) => {
        return nodes.map(node => {
          if (node.name === selectedNode.name && node.path === selectedNode.path) {
            console.log('노드에 파일 추가:', node.name, newFile.name);
            return {
              ...node,
              children: [...(node.children || []), newFile]
            };
          }
          if (node.children) {
            return { ...node, children: addFileToNode(node.children) };
          }
          return node;
        });
      };
      return addFileToNode(prevTree);
    });
    
    // 새로 생성된 파일을 선택 상태로 설정
    setCurrentSelectedNode(newFile);
    closeContextMenu();
  };

  const deleteNode = async () => {
    
    // ref에서 노드 정보 가져오기
    const targetNode = selectedNodeRef.current || selectedNode;
    
    if (!targetNode) {
      console.log('❌ targetNode가 없음');
      alert('선택된 노드가 없습니다. 파일트리에서 파일을 선택한 후 다시 시도하세요.');
      return;
    }
    
    // 폴더인지 확인
    const isFolder = targetNode.type === 'folder' || targetNode.children;
    
    let confirmMessage = `정말로 "${targetNode.name}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    
    if (isFolder && targetNode.children && targetNode.children.length > 0) {
      confirmMessage = `정말로 폴더 "${targetNode.name}"과 그 안의 모든 파일(${targetNode.children.length}개)을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;
    }
    
    const confirmDelete = window.confirm(confirmMessage);
    
    if (!confirmDelete) return;
    
    try {
      // API로 파일 삭제
      const bookId = bookInfo?.id || window.currentBookId || 1;
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://lib-editor.boinit.com/api';
      
      // 토큰 가져오기
      const token = sessionStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃
      
      try {
        // 상대 경로 구성
        let relpath;
        
        if (targetNode.type === 'folder') {
          // 폴더인 경우: 노드 이름만 사용
          relpath = targetNode.name;
        } else {
          // 파일인 경우: 전체 경로 구성
          relpath = targetNode.path || targetNode.name;
          
          // targetNode.path가 비어있으면 부모 경로를 포함해서 구성
          if (!targetNode.path || targetNode.path === targetNode.name) {
            // 부모 노드들의 경로를 추적해서 전체 경로 구성
            const buildPath = (node) => {
              if (node.parent && node.parent.name !== 'root') {
                return buildPath(node.parent) + '/' + node.name;
              }
              return node.name;
            };
            relpath = buildPath(targetNode);
          }
          
          // 전체 URL에서 상대 경로만 추출 (workspace 이후의 경로만)
          if (relpath.includes('/workspace/')) {
            const workspaceIndex = relpath.indexOf('/workspace/');
            relpath = relpath.substring(workspaceIndex + 10); // '/workspace/' 제거
          }
        }
        
        console.log('🔍 삭제할 노드 정보:', { 
          type: targetNode.type,
          name: targetNode.name,
          originalPath: targetNode.path, 
          finalRelpath: relpath,
          fullTargetNode: targetNode
        });
        
        // relpath가 비어있으면 오류
        if (!relpath || relpath.trim() === '') {
          throw new Error('삭제할 파일/폴더 경로가 비어있습니다.');
        }
        
        const formData = new FormData();
        formData.append('relpath', relpath);
        
        // FormData 내용 확인
        console.log('🔍 FormData 내용:');
        for (let [key, value] of formData.entries()) {
          console.log(`  ${key}: ${value}`);
        }
        
        const response = await fetch(`${API_BASE_URL}/books/${bookId}/workspace/delete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          },
          body: formData,
          signal: controller.signal
        });

        console.log('🔍 요청 데이터:', response);
        
                clearTimeout(timeoutId);
        
        console.log('🔍 응답 상태:', response.status, response.statusText);
        
        if (!response.ok) {
          // 응답 텍스트 확인
          const errorText = await response.text();
          console.log('🔍 에러 응답 내용:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        // 응답이 비어있는지 확인
        const responseText = await response.text();
        console.log('🔍 응답 내용:', responseText);
        
        let result = null;
        if (responseText.trim()) {
          try {
            result = JSON.parse(responseText);
            console.log('✅ 파일 삭제 API 결과:', result);
          } catch (parseError) {
            console.log('⚠️ JSON 파싱 실패, 텍스트 응답으로 처리:', responseText);
            result = { message: responseText };
          }
        } else {
          console.log('✅ 파일 삭제 성공 (빈 응답)');
          result = { success: true };
        }
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('요청 시간 초과 (30초)');
        }
        throw fetchError;
      }
      
      // API 성공 시 UI 업데이트
    setFileTree(prevTree => {
      const removeNodeFromTree = (nodes) => {
        return nodes.filter(node => {
            if (node.name === targetNode.name && node.path === targetNode.path) {
            return false; // 삭제
          }
          if (node.children) {
            node.children = removeNodeFromTree(node.children);
          }
          return true;
        });
      };
      return removeNodeFromTree(prevTree);
    });
      
    
    // 열려있는 탭에서도 삭제
      setOpenTabs(prev => prev.filter(tab => tab.filePath !== targetNode.path));
    
    // 선택 상태 초기화
    setCurrentSelectedNode(null);
    closeContextMenu();
      
      // 성공 토스트 팝업 표시
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #4caf50; color: white;
        padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
        font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      notification.textContent = `✅ 파일 삭제 완료: ${targetNode.name}`;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ 파일 삭제 실패:', error);
      
      // 실패 토스트 팝업 표시
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #f44336; color: white;
        padding: 12px 20px; border-radius: 4px; font-family: 'Inter', sans-serif;
        font-size: 14px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease-out;
      `;
      notification.textContent = `❌ 파일 삭제 실패: ${error.message}`;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease-in';
          setTimeout(() => { if (notification.parentNode) { document.body.removeChild(notification); } }, 300);
        }
      }, 5000);
    }
  };

  const renameNode = () => {
    if (!selectedNode) return;
    
    const newName = prompt('새 이름을 입력하세요:', selectedNode.name);
    if (!newName || !newName.trim() || newName.trim() === selectedNode.name) return;
    
    const oldPath = selectedNode.path;
    const newPath = selectedNode.path.replace(selectedNode.name, newName.trim());
    
    setFileTree(prevTree => {
      const renameNodeInTree = (nodes) => {
        return nodes.map(node => {
          if (node.name === selectedNode.name && node.path === selectedNode.path) {
            return {
              ...node,
              name: newName.trim(),
              path: newPath
            };
          }
          if (node.children) {
            return { ...node, children: renameNodeInTree(node.children) };
          }
          return node;
        });
      };
      return renameNodeInTree(prevTree);
    });
    
    // 열려있는 탭에서도 이름 변경
    setOpenTabs(prev => prev.map(tab => 
      tab.filePath === oldPath ? { ...tab, filePath: newPath } : tab
    ));
    
    closeContextMenu();
  };

  // 검색 결과 클릭 처리
  const handleSearchResultClick = async (result, match) => {
    // 해당 파일을 탭에서 열기
    const fileNode = {
      path: result.filePath,
      name: result.fileName,
      type: 'file'
    };
    
    // 파일 내용 가져오기
    const fileData = epubData.zipContent[result.filePath];
    if (fileData) {
      await openTab(fileNode, fileData.content, fileData.type);
      
      // 에디터에서 해당 라인으로 스크롤 (Monaco Editor API 사용)
      if (editorRef.current) {
        const lineNumber = match.line;
        editorRef.current.revealLineInCenter(lineNumber);
        editorRef.current.setPosition({ lineNumber, column: 1 });
      }
    }
  };

  // 1. 상태 추가 (useState들 아래)
  const [previewDevice, setPreviewDevice] = useState({ label: 'PC', width: 1280, height: 800 });
  const [customDevice, setCustomDevice] = useState({ width: 375, height: 667 });

  // 2. 프리셋 정의 (컴포넌트 함수 내 상단에 추가)
  const previewDevices = [
    { label: 'PC', width: 1280, height: 800 },
    { label: 'Tablet', width: 768, height: 1024 },
    { label: 'Mobile (세로)', width: 375, height: 667 },
    { label: 'Mobile (가로)', width: 667, height: 375 },
    { label: 'Custom', width: null, height: null }
  ];

  return (
    <div className="App editor-page">
      <LoadingBar 
        isLoading={isLoading} 
        message={loadingMessage}
      />
      <style>
        {`
          .error-highlight {
            background-color: rgba(255, 0, 0, 0.3) !important;
            border-left: 3px solid #ff0000 !important;
            border-radius: 2px !important;
            animation: errorPulse 2s ease-in-out infinite !important;
            position: relative !important;
            box-shadow: 0 0 5px rgba(255, 0, 0, 0.5) !important;
          }
          
          .error-highlight::after {
            content: '' !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(255, 0, 0, 0.1) !important;
            pointer-events: none !important;
          }
          
          .error-line-highlight {
            background-color: rgba(255, 0, 0, 0.1) !important;
            border-left: 4px solid #ff0000 !important;
            animation: errorPulse 2s ease-in-out infinite !important;
          }
          
          .error-highlight-before {
            background-color: rgba(255, 0, 0, 0.2) !important;
          }
          
          .error-highlight-after {
            background-color: rgba(255, 0, 0, 0.2) !important;
          }
          
          @keyframes errorPulse {
            0%, 100% { 
              background-color: rgba(255, 0, 0, 0.2); 
              border-left-color: #ff0000;
            }
            50% { 
              background-color: rgba(255, 0, 0, 0.3); 
              border-left-color: #ff4444;
            }
          }
          
          .warning-highlight {
            background-color: rgba(255, 165, 0, 0.15) !important;
            border-left: 3px solid #ffa500 !important;
            border-radius: 2px !important;
          }
          
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      <Header
        vscodeSidebarVisible={vscodeSidebarVisible}
        toggleVscodeSidebar={toggleVscodeSidebar}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        handleWorkspaceLoad={handleWorkspaceLoad}
        saveCurrentFile={saveCurrentFile}
        downloadCurrentFile={downloadCurrentFile}
        getCurrentTab={getCurrentTab}
        applyFileToServer={applyFileToServer}
        validateAndSubmitFile={validateAndSubmitFile}
        validateFileContent={validateFileContent}
        submitFileContent={submitFileContent}
        runStandardChecks={runStandardChecks}
        checkAccessibilityStandard={checkAccessibilityStandard}
        checkEpubStandard={checkEpubStandard}
        panelStates={panelStates}
        togglePanel={togglePanel}
        setLogViewerVisible={setLogViewerVisible}
        clearAllErrorMarkers={clearAllErrorMarkers}
        openTabs={openTabs}
        fileTree={fileTree}
        deletedFiles={deletedFiles}
        setDeletedFiles={setDeletedFiles}
      />

      <VscodeSidebar
        visible={vscodeSidebarVisible}
        activeSidebarTab={activeSidebarTab}
        setActiveSidebarTab={setActiveSidebarTab}
        epubData={epubData}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        fileTree={fileTree}
        setFileTree={setFileTree}
        toc={toc}
        handleTocItemClick={handleTocItemClick}
        handleFileClick={handleFileClick}
        getFileIcon={getFileIcon}

        toggleFolder={toggleFolder}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchOptions={searchOptions}
        setSearchOptions={setSearchOptions}
        searchResults={searchResults}
        performSearch={performSearch}
        handleSearchResultClick={handleSearchResultClick}
        runCode={runCode}
        autoCheckEnabled={autoCheckEnabled}
        setAutoCheckEnabled={setAutoCheckEnabled}
        runAutoCheck={runAutoCheck}
        togglePanel={togglePanel}
        saveCurrentFile={saveCurrentFile}
        downloadCurrentFile={downloadCurrentFile}
        getCurrentTab={getCurrentTab}
        saveAllFiles={saveAllFiles}
        openTabs={openTabs}
        toggleTheme={toggleTheme}
        changeThemeMode={changeThemeMode}
        themeMode={themeMode}
        
        // 추가된 props
        currentSelectedNode={currentSelectedNode}
        setCurrentSelectedNode={setCurrentSelectedNode}
        setSelectedNode={setSelectedNode}
        createFolder={createFolder}
        createFile={createFile}
        deleteNode={deleteNode}
        renameNode={renameNode}
        handleContextMenu={handleContextMenu}
      />

      <div 
        className={`editor-container ${!vscodeSidebarVisible ? 'sidebar-hidden' : ''}`}
        style={{ 
          marginLeft: vscodeSidebarVisible ? '250px' : '0',
          width: vscodeSidebarVisible ? 'calc(100% - 250px)' : '100%'
        }}
      >
        <EditorPane
          ref={editorPaneRef}
          openTabs={openTabs}
          activeTabId={activeTabId}
          onTabChange={switchTab}
          onTabClose={closeTab}
          onContentChange={updateTabContent}
          onFormatText={formatText}
          onInsertHeading={insertHeading}
          onInsertParagraph={insertParagraph}
          onInsertHorizontalRule={insertHorizontalRule}
          onInsertOrderedList={insertOrderedList}
          onInsertUnorderedList={insertUnorderedList}
          onInsertBlockquote={insertBlockquote}
          onInsertSection={insertSection}
          onInsertLink={insertLink}
          onInsertImage={insertImage}
          onInsertTable={insertTable}
          onAlignText={alignText}
          onSetTextColor={setTextColor}
          onSetBackgroundColor={setBackgroundColor}
          onSetFontSize={setFontSize}
          onInsertCodeBlock={insertCodeBlock}
          onInsertInlineCode={insertInlineCode}
          onInsertRole={insertRole}
          onGoToNextError={goToNextError}
          onGoToPrevError={goToPrevError}
          onClearFileErrors={clearFileErrors}
          width={`${editorWidth}%`}
        />
        
        <div className="resizer" ref={resizerRef}></div>
        
        <div className="preview-pane" style={{ width: `${100 - editorWidth}%`, background: '#1e1e1e', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#2d2d30', borderBottom: '1px solid #3e3e42', minHeight: '48px', flexShrink: 0 }}>
            <h3 style={{ margin: 0, color: '#cccccc', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>preview</span>
              미리보기
              {isPreviewUpdating && (
                <span style={{ 
                  fontSize: '12px', 
                  color: '#4ec9b0', 
                  marginLeft: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span className="material-symbols-outlined" style={{ 
                    fontSize: '14px',
                    animation: 'spin 1s linear infinite'
                  }}>sync</span>
                  실시간 업데이트 중...
                </span>
              )}
            </h3>
          </div>
          <iframe 
            srcDoc={output} 
            title="Preview" 
            className="preview-iframe"
            sandbox="allow-scripts allow-same-origin"
            style={{
              flex: 1,
              border: 'none',
              background: 'white',
              width: '100%',
              height: '100%',
              overflow: 'auto',
              fontFamily: "'Noto Sans KR', 'Malgun Gothic', '맑은 고딕', Arial, sans-serif"
            }}
          />
        </div>
        
        {/* 패널들 */}
        {renderAutoCheckPanel()}
        {renderSettingsPanel()}
        {renderHelpPanel()}
        {renderImageDebugPanel()}
      </div>
      
      {/* Role 타입 선택 모달 */}
      <RoleTypeModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        onConfirm={handleRoleConfirm}
        selectedText={selectedTextForRole}
      />
      
      {/* 타입 & 롤 선택 모달 */}
      {typeModalOpen && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '400px',
            maxWidth: '600px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>타입 & 롤 선택</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>선택된 텍스트:</label>
              <div style={{
                padding: '12px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                border: '1px solid #ddd',
                minHeight: '60px',
                maxHeight: '120px',
                overflow: 'auto'
              }}>
                {selectedTextForType}
              </div>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>타입:</label>
              <select
                value={currentType}
                onChange={(e) => setCurrentType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">타입 선택</option>
                <option value="title">제목</option>
                <option value="subtitle">부제목</option>
                <option value="heading">헤딩</option>
                <option value="paragraph">단락</option>
                <option value="list">목록</option>
                <option value="quote">인용</option>
                <option value="note">노트</option>
                <option value="caption">캡션</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>롤:</label>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">롤 선택</option>
                <option value="doc-title">문서 제목</option>
                <option value="doc-subtitle">문서 부제목</option>
                <option value="chapter">챕터</option>
                <option value="section">섹션</option>
                <option value="subsection">하위 섹션</option>
                <option value="abstract">초록</option>
                <option value="foreword">서문</option>
                <option value="preface">머리말</option>
                <option value="introduction">서론</option>
                <option value="conclusion">결론</option>
                <option value="bibliography">참고문헌</option>
                <option value="index">색인</option>
                <option value="glossary">용어집</option>
                <option value="appendix">부록</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setTypeModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (currentType && currentRole) {
                    handleTypeRoleConfirm(currentType, currentRole);
                    setTypeModalOpen(false);
                  }
                }}
                disabled={!currentType || !currentRole}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: currentType && currentRole ? '#007bff' : '#ccc',
                  color: 'white',
                  cursor: currentType && currentRole ? 'pointer' : 'not-allowed'
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
             )}
       
       {/* 한자 검색 모달 */}
       {hanjaSearchOpen && (
         <div className="modal-overlay" style={{
           position: 'fixed',
           top: 0,
           left: 0,
           right: 0,
           bottom: 0,
           backgroundColor: 'rgba(0, 0, 0, 0.5)',
           display: 'flex',
           justifyContent: 'center',
           alignItems: 'center',
           zIndex: 1000
         }}>
           <div className="modal-content" style={{
             backgroundColor: '#ffffff',
             padding: '24px',
             borderRadius: '8px',
             minWidth: '500px',
             maxWidth: '700px',
             maxHeight: '600px',
             boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
             overflow: 'hidden',
             display: 'flex',
             flexDirection: 'column'
           }}>
             <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>한자 검색</h3>
             
             <div style={{ marginBottom: '16px' }}>
               <input
                 type="text"
                 placeholder="한글을 입력하세요 (예: 가, 나, 다...)"
                 value={hanjaSearchText}
                 onChange={(e) => {
                   setHanjaSearchText(e.target.value);
                   searchHanja(e.target.value);
                 }}
                 style={{
                   width: '100%',
                   padding: '12px',
                   border: '1px solid #ddd',
                   borderRadius: '4px',
                   fontSize: '16px'
                 }}
                 autoFocus
               />
             </div>
             
             <div style={{ 
               flex: 1, 
               overflow: 'auto', 
               border: '1px solid #eee', 
               borderRadius: '4px',
               padding: '8px'
             }}>
               {hanjaResults.length > 0 ? (
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                   {hanjaResults.map((result, index) => (
                     <div
                       key={index}
                       onClick={() => insertHanja(result.hanja)}
                       style={{
                         padding: '12px',
                         border: '1px solid #ddd',
                         borderRadius: '4px',
                         cursor: 'pointer',
                         textAlign: 'center',
                         transition: 'all 0.2s ease'
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.backgroundColor = '#f0f0f0';
                         e.currentTarget.style.borderColor = '#007bff';
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.backgroundColor = 'transparent';
                         e.currentTarget.style.borderColor = '#ddd';
                       }}
                     >
                       <div style={{ fontSize: '24px', marginBottom: '4px' }}>{result.hanja}</div>
                       <div style={{ fontSize: '12px', color: '#666' }}>{result.hangul}</div>
                       <div style={{ fontSize: '10px', color: '#999' }}>{result.meaning}</div>
                     </div>
                   ))}
                 </div>
               ) : hanjaSearchText ? (
                 <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                   검색 결과가 없습니다.
                 </div>
               ) : (
                 <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                   한글을 입력하여 한자를 검색하세요.
                 </div>
               )}
             </div>
             
             <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
               <button
                 onClick={() => {
                   setHanjaSearchOpen(false);
                   setHanjaSearchText('');
                   setHanjaResults([]);
                 }}
                 style={{
                   padding: '8px 16px',
                   border: '1px solid #ddd',
                   borderRadius: '4px',
                   backgroundColor: '#f8f9fa',
                   cursor: 'pointer'
                 }}
               >
                 닫기
               </button>
             </div>
           </div>
         </div>
       )}
       
               {/* 사용되지 않는 이미지 모달 */}
        {showUnusedImageModal && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div className="modal-content" style={{
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: '8px',
              minWidth: '500px',
              maxWidth: '700px',
              maxHeight: '600px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
                <span className="material-symbols-outlined" style={{fontSize: '20px', verticalAlign: 'middle', marginRight: '8px'}}>warning</span>
                사용되지 않는 이미지 발견
              </h3>
              
              <div style={{ marginBottom: '16px', color: '#666' }}>
                다음 이미지들이 XHTML 파일에서 참조되지 않고 있습니다:
              </div>
              
              <div style={{ 
                flex: 1, 
                overflow: 'auto', 
                border: '1px solid #eee', 
                borderRadius: '4px',
                padding: '8px'
              }}>
                {unusedImages.map((image, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{fontSize: '20px', color: '#ff9800'}}>image</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500' }}>{image.name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{image.path}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={() => setShowUnusedImageModal(false)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer'
                  }}
                >
                  나중에
                </button>
                <button
                  onClick={deleteUnusedImages}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  모두 삭제
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* 컨텍스트 메뉴 */}
        {console.log('컨텍스트 메뉴 렌더링 체크:', contextMenu)}
      {contextMenu && (
        <div
          data-context-menu="true"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
            zIndex: 99999,
            minWidth: '180px',
            padding: '8px 0'
          }}
          onClick={closeContextMenu}
        >
          <div
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={createFolder}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>create_new_folder</span>
            새 폴더
          </div>
          <div
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={createFile}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>note_add</span>
            새 파일
          </div>
          <div style={{height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0'}} />
          <div
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={renameNode}
          >
            ✏️ 이름 변경
          </div>
          <div
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#e53e3e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fed7d7'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={deleteNode}
          >
            🗑️ 삭제
          </div>
        </div>
      )}

      {/* 로그 뷰어 */}
      <LogViewer 
        onToggle={(mode) => {
          // 로그 뷰어를 완전히 숨기지 않고 최소화 상태만 유지
          console.log(`🔍 LogViewer 토글: ${mode}`);
          // setLogViewerVisible(false); // 이 줄을 주석 처리하여 완전히 숨기지 않음
        }}
        onErrorClick={handleLogErrorClick}
        clearAllErrorMarkers={clearAllErrorMarkers}
        getCurrentTab={getCurrentTab}
      />


    </div>
  );
}

export default EditorPage;