import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import TabBar from './TabBar';
import FormatToolbar from './FormatToolbar';
import './EditorPane.css';
import 'monaco-editor/min/vs/editor/editor.main.css';


const EditorPane = forwardRef(({
  openTabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onContentChange,
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
  onClearFileErrors,
  width,
  editorOptions = {
    fontSize: 14,
    fontFamily: "'JetBrains Mono','Fira Code',Monaco,Consolas,'Courier New',monospace",
    lineHeight: 22,
    fontLigatures: true,
    readOnly: false,
    // 미니맵 설정 개선
    minimap: {
      enabled: true,
      side: 'right',
      size: 'proportional',
      showSlider: 'always',
      renderCharacters: false,
      maxColumn: 120,
      scale: 1
    },
    // 스크롤 설정
    scrollBeyondLastLine: false,
    scrollBeyondLastColumn: 10,
    automaticLayout: true,
    
    // ResizeObserver 루프 문제 해결
    fixedOverflowWidgets: true,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    
    // 기본 편집 설정
    wordWrap: 'on',
    lineNumbers: 'on',
    folding: true,
    renderWhitespace: 'boundary',
    renderControlCharacters: false,
    
    // 문법 검사 및 오류 표시 설정
    validateOnType: true,
    validateOnPaste: true,
    
    // 오류 및 경고 표시 설정
    problems: {
      decorations: true
    },
    
    // 브래킷 및 괄호 설정
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
      highlightActiveIndentation: true
    },
    
    // 자동완성 및 제안 기능 강화
    colorDecorators: true,
    semanticHighlighting: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: 'on',
    parameterHints: { enabled: true },
    hover: { enabled: true },
    contextmenu: true,
    
    // 컨텍스트 메뉴 강화
    contextmenu: true,
    quickSuggestions: {
      other: true,
      comments: true,
      strings: true
    },
    
    // 제안 위젯 설정
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
      showProperties: true,
      showEvents: true,
      showOperators: true,
      showUnits: true,
      showValues: true,
      showDeprecated: true
    },
    
    // 기본 포맷팅 설정
    formatOnType: true,
    formatOnPaste: true,
    tabSize: 2,
    insertSpaces: true,
    
    // 오류 이동 및 탐색 설정
    gotoLocation: {
      multiple: 'goto',
      multipleDefinitions: 'goto',
      multipleTypeDefinitions: 'goto',
      multipleDeclarations: 'goto',
      multipleImplementations: 'goto',
      multipleReferences: 'goto',
      alternativeDefinitionCommand: 'editor.action.goToReferences',
      alternativeTypeDefinitionCommand: 'editor.action.goToReferences',
      alternativeDeclarationCommand: 'editor.action.goToReferences',
      alternativeImplementationCommand: 'editor.action.goToReferences',
      alternativeReferenceCommand: 'editor.action.goToReferences'
    }
  }
}, ref) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const lastPosRef = useRef(null);

  // 외부에서 editor에 접근할 수 있도록 ref를 통해 노출
  useImperativeHandle(ref, () => ({
    getEditor: () => editorRef.current,
    getValue: () => editorRef.current?.getValue() || '',
    setValue: (value) => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;
      const fullRange = model.getFullModelRange();
      editor.executeEdits('content-update', [
        { range: fullRange, text: value, forceMoveMarkers: true }
      ]);
    },
    getSelection: () => editorRef.current?.getSelection(),
    focus: () => editorRef.current?.focus(),
    executeEdits: (source, edits) => editorRef.current?.executeEdits(source, edits)
  }));

  // 현재 활성 탭 가져오기
  const getCurrentTab = () => {
    return openTabs.find(tab => tab.id === activeTabId);
  };

  // 언어 타입 결정 함수
  const getLanguageType = (tab) => {
  if (!tab) return 'text';
  
  // Monaco Editor에서 지원하는 언어로 매핑
  const languageMap = {
    'html': 'html',
    'xhtml': 'html', // XHTML은 HTML로 처리 (안정성을 위해)
    'css': 'css',
    'javascript': 'javascript',
    'js': 'javascript',
    'json': 'json',
    'xml': 'xml',
    'markdown': 'markdown',
    'md': 'markdown',
    'text': 'text'
  };
  
  // XHTML 파일인 경우 HTML 언어로 처리 (안정성을 위해)
  if (tab.type === 'xhtml' || 
      (tab.filePath && tab.filePath.toLowerCase().endsWith('.xhtml')) ||
      (tab.name && tab.name.toLowerCase().endsWith('.xhtml'))) {
    console.log('XHTML 파일을 HTML 언어로 처리:', tab.name);
    return 'html';
  }
  
  return languageMap[tab.type] || 'text';
};

  // Editor 마운트 시 처리
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    // 전역으로 Monaco Editor 인스턴스 설정
    window.monacoEditor = editor;
    window.monaco = monacoRef.current;
    editor.focus();
    // 초기 레이아웃만 적용 (커서 위치 변경 없음)
    setTimeout(() => editor.layout(), 0);
    // 항상 편집 가능 상태 보장
    editor.updateOptions({ readOnly: false });
    
                  // 자동완성 및 문법 하이라이트 강제 활성화
              editor.updateOptions({
                quickSuggestions: {
                  other: true,
                  comments: true,
                  strings: true
                },
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnCommitCharacter: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                wordBasedSuggestions: 'on',
                parameterHints: { enabled: true },
                hover: { enabled: true },
                contextmenu: true,
                // 추가 자동완성 설정
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
                  showProperties: true,
                  showEvents: true,
                  showOperators: true,
                  showUnits: true,
                  showValues: true,
                  showDeprecated: true
                },
                // 실시간 검증 설정
                validateOnType: true,
                validateOnPaste: true,
                // 괄호 및 태그 하이라이트 설정
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true,
                  highlightActiveIndentation: true
                },
                // 문법 하이라이트 강화
                semanticHighlighting: true,
                colorDecorators: true,
                // 자동 닫기 설정
                autoClosingBrackets: 'always',
                autoClosingQuotes: 'always',
                autoClosingOvertype: 'always',
                autoClosingDelete: 'always'
              });
    
    // 자동완성 테스트를 위한 키보드 이벤트 추가
    editor.addCommand(monacoRef.current.KeyMod.CtrlCmd | monacoRef.current.KeyCode.Space, () => {
      console.log('Ctrl+Space 자동완성 명령 실행');
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
    });
    
    console.log('Editor 마운트 완료, 자동완성 설정 적용됨');
    
    // 현재 탭의 언어 설정
    const currentTab = getCurrentTab();
    if (currentTab) {
      const language = getLanguageType(currentTab);
      
      // 모델의 언어 설정
      const model = editor.getModel();
      if (model && monacoRef.current) {
        monacoRef.current.editor.setModelLanguage(model, language);
        
        // CSS 파일인 경우 자동완성 강화 및 실시간 검증
        if (language === 'css') {
          editor.updateOptions({
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            },
            suggestOnTriggerCharacters: true,
            // CSS 실시간 검증 강화
            validateOnType: true,
            validateOnPaste: true,
            realtimeValidation: true
          });
          

        }
        
        // HTML 파일인 경우 자동완성 강화 및 실시간 검증
        if (language === 'html') {
          editor.updateOptions({
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            },
            suggestOnTriggerCharacters: true,
            // HTML 실시간 검증 강화
            validateOnType: true,
            validateOnPaste: true,
            realtimeValidation: true
          });
          

        }
        
        // XHTML 파일인 경우 자동완성 강화 및 실시간 검증
        if (language === 'xhtml') {
          editor.updateOptions({
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            },
            suggestOnTriggerCharacters: true,
            // XHTML 실시간 검증 강화
            validateOnType: true,
            validateOnPaste: true,
            realtimeValidation: true,
            // 자동완성 강화 설정
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
              showProperties: true,
              showEvents: true,
              showOperators: true,
              showUnits: true,
              showValues: true,
              showDeprecated: true
            },
            // 추가 자동완성 설정
            acceptSuggestionOnCommitCharacter: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            wordBasedSuggestions: 'on',
            parameterHints: { enabled: true },
            hover: { enabled: true },
            contextmenu: true
          });
          

        }
      }
    }
    
    // 오류 탐색 기능 추가
    const addErrorNavigation = () => {
      // F8 키로 다음 오류로 이동
      editor.addCommand(monacoRef.current.KeyCode.F8, () => {
        const markers = monacoRef.current.editor.getModelMarkers({ resource: editor.getModel().uri });
        const errors = markers.filter(marker => marker.severity === monacoRef.current.MarkerSeverity.Error);
        
        if (errors.length > 0) {
          const currentPosition = editor.getPosition();
          let nextError = errors.find(error => 
            error.startLineNumber > currentPosition.lineNumber ||
            (error.startLineNumber === currentPosition.lineNumber && error.startColumn > currentPosition.column)
          );
          
          if (!nextError) {
            nextError = errors[0]; // 첫 번째 오류로 순환
          }
          
          editor.setPosition({ lineNumber: nextError.startLineNumber, column: nextError.startColumn });
          editor.revealLineInCenter(nextError.startLineNumber);
          editor.focus();
        }
      });
      
      // Shift+F8 키로 이전 오류로 이동
      editor.addCommand(monacoRef.current.KeyMod.Shift | monacoRef.current.KeyCode.F8, () => {
        const markers = monacoRef.current.editor.getModelMarkers({ resource: editor.getModel().uri });
        const errors = markers.filter(marker => marker.severity === monacoRef.current.MarkerSeverity.Error);
        
        if (errors.length > 0) {
          const currentPosition = editor.getPosition();
          let prevError = errors.reverse().find(error => 
            error.startLineNumber < currentPosition.lineNumber ||
            (error.startLineNumber === currentPosition.lineNumber && error.startColumn < currentPosition.column)
          );
          
          if (!prevError) {
            prevError = errors[0]; // 마지막 오류로 순환
          }
          
          editor.setPosition({ lineNumber: prevError.startLineNumber, column: prevError.startColumn });
          editor.revealLineInCenter(prevError.startLineNumber);
          editor.focus();
        }
      });
    };
    
    // Monaco가 로드된 후 오류 탐색 기능 추가
    if (monacoRef.current) {
      addErrorNavigation();
      
      // 실시간 검증 설정
      const currentTab = getCurrentTab();
      if (currentTab) {
        const language = getLanguageType(currentTab);
        setupRealTimeValidation(editor, language);
      }
    } else {
      // Monaco가 아직 로드되지 않은 경우 대기
      const checkMonaco = setInterval(() => {
        if (monacoRef.current) {
          addErrorNavigation();
          
          // 실시간 검증 설정
          const currentTab = getCurrentTab();
          if (currentTab) {
            const language = getLanguageType(currentTab);
            setupRealTimeValidation(editor, language);
          }
          
          clearInterval(checkMonaco);
        }
      }, 100);
    }
    
    // 자동완성 위젯 스타일 개선
    const suggestWidget = document.querySelector('.monaco-editor .suggest-widget');
    if (suggestWidget) {
      suggestWidget.style.zIndex = '1000';
    }
  };

  // 내용 변경 시 처리
  const handleChange = (value) => {
    const currentTab = getCurrentTab();
    if (currentTab && onContentChange) {
      onContentChange(currentTab.id, value);
      
      // 내용 변경 시 해당 파일의 오류 하이라이트 삭제
      if (onClearFileErrors) {
        onClearFileErrors(currentTab.filePath || currentTab.name);
      }
    }
  };

  // 실시간 오류 검사 함수
  const setupRealTimeValidation = (editor, language) => {
    if (!editor || !monacoRef.current) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    
    // 실시간 검증을 위한 모델 변경 리스너
    const disposable = model.onDidChangeContent(() => {
      // 약간의 지연을 두어 타이핑 중에는 검증하지 않음
      setTimeout(() => {
        validateContent(editor, language);
      }, 300); // 지연 시간을 줄여서 더 빠른 검증
    });
    
    // 초기 검증
    validateContent(editor, language);
    
    // 에디터 포커스 시 재검증
    const focusDisposable = editor.onDidFocusEditorText(() => {
      validateContent(editor, language);
    });
    
    return () => {
      disposable.dispose();
      focusDisposable.dispose();
    };
  };

  // 컨텐츠 검증 함수
  const validateContent = (editor, language) => {
    if (!editor || !monacoRef.current) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    const content = model.getValue();
    const lines = content.split('\n');
    const markers = [];
    
    
    // HTML 검증
    if (language === 'html') {
      validateHTML(content, lines, markers);
    }
    
    // CSS 검증
    if (language === 'css') {
      validateCSS(content, lines, markers);
    }
    
    // JavaScript 검증
    if (language === 'javascript') {
      validateJavaScript(content, lines, markers);
    }
    
    // 마커 설정
    monacoRef.current.editor.setModelMarkers(model, 'custom-validator', markers);
    
    
    // 오류가 있으면 콘솔에 출력
    if (markers.length > 0) {
      markers.forEach((marker, index) => {
      });
    }

    // 검증 후 커서 위치 보정 제거 (타이핑 중 커서 점프 방지)
  };

  // HTML 검증 함수
  const validateHTML = (content, lines, markers) => {
    // 태그가 닫히지 않은 경우 검사
    const openTags = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    let match;
    
    while ((match = tagRegex.exec(content)) !== null) {
      const tagName = match[1].toLowerCase();
      const isClosing = match[0].startsWith('</');
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const column = match.index - content.lastIndexOf('\n', match.index);
      
      if (!isClosing) {
        // 자체 닫힘 태그가 아닌 경우에만 추가
        if (!['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'].includes(tagName)) {
          openTags.push({ tag: tagName, line: lineNumber, column: column });
        }
      } else {
        // 닫는 태그인 경우
        const lastOpenTag = openTags.pop();
        if (!lastOpenTag || lastOpenTag.tag !== tagName) {
          // 태그가 맞지 않는 경우
          markers.push({
            message: `Mismatched tag: expected </${lastOpenTag?.tag || 'unknown'}>, found </${tagName}>`,
            severity: monacoRef.current.MarkerSeverity.Error,
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column + match[0].length
          });
        }
      }
    }
    
    // 닫히지 않은 태그들 검사
    openTags.forEach(({ tag, line, column }) => {
      markers.push({
        message: `Unclosed tag: <${tag}>`,
        severity: monacoRef.current.MarkerSeverity.Error,
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: column + tag.length + 2
      });
    });
    
    // 속성 검증
    const attrRegex = /<[^>]*\s+([a-zA-Z-]+)\s*=\s*["'][^"']*["'][^>]*>/g;
    while ((match = attrRegex.exec(content)) !== null) {
      const attrName = match[1].toLowerCase();
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const column = match.index - content.lastIndexOf('\n', match.index);
      
      // 잘못된 속성 검사
      if (['onclick', 'onload', 'onerror'].includes(attrName)) {
        markers.push({
          message: `Security warning: Avoid using ${attrName} attribute`,
          severity: monacoRef.current.MarkerSeverity.Warning,
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + attrName.length
        });
      }
    }
  };

  // CSS 검증 함수
  const validateCSS = (content, lines, markers) => {
    // 중괄호 짝 맞추기 검사
    let braceCount = 0;
    const braceRegex = /[{}]/g;
    let match;
    
    while ((match = braceRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const column = match.index - content.lastIndexOf('\n', match.index);
      
      if (match[0] === '{') {
        braceCount++;
      } else {
        braceCount--;
        if (braceCount < 0) {
          markers.push({
            message: 'Unexpected closing brace }',
            severity: monacoRef.current.MarkerSeverity.Error,
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column + 1
          });
          braceCount = 0;
        }
      }
    }
    
    if (braceCount > 0) {
      markers.push({
        message: `${braceCount} unclosed brace(s)`,
        severity: monacoRef.current.MarkerSeverity.Error,
        startLineNumber: lines.length,
        startColumn: 1,
        endLineNumber: lines.length,
        endColumn: lines[lines.length - 1].length + 1
      });
    }
    
    // CSS 속성 검증
    const propertyRegex = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
    while ((match = propertyRegex.exec(content)) !== null) {
      const property = match[1].toLowerCase();
      const value = match[2].trim();
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const column = match.index - content.lastIndexOf('\n', match.index);
      
      // 잘못된 속성 검사
      if (['color', 'background-color', 'font-size'].includes(property)) {
        if (!value.match(/^[#a-zA-Z0-9()\s,.-]+$/)) {
          markers.push({
            message: `Invalid value for ${property}: ${value}`,
            severity: monacoRef.current.MarkerSeverity.Warning,
            startLineNumber: lineNumber,
            startColumn: column,
            endLineNumber: lineNumber,
            endColumn: column + property.length
          });
        }
      }
    }
    
    // 세미콜론 누락 검사
    const ruleRegex = /([^}]+)}/g;
    while ((match = ruleRegex.exec(content)) !== null) {
      const rules = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      if (rules.includes(':') && !rules.trim().endsWith(';')) {
        const lastColonIndex = rules.lastIndexOf(':');
        const afterColon = rules.substring(lastColonIndex + 1).trim();
        
        if (afterColon && !afterColon.endsWith(';')) {
          markers.push({
            message: 'Missing semicolon after property value',
            severity: monacoRef.current.MarkerSeverity.Error,
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: rules.length + 1
          });
        }
      }
    }
  };

  // JavaScript 검증 함수
  const validateJavaScript = (content, lines, markers) => {
    // 괄호 짝 맞추기 검사
    let braceCount = 0;
    let bracketCount = 0;
    let parenCount = 0;
    const braceRegex = /[{}[\]()]/g;
    let match;
    
    while ((match = braceRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const column = match.index - content.lastIndexOf('\n', match.index);
      
      switch (match[0]) {
        case '{':
          braceCount++;
          break;
        case '}':
          braceCount--;
          break;
        case '[':
          bracketCount++;
          break;
        case ']':
          bracketCount--;
          break;
        case '(':
          parenCount++;
          break;
        case ')':
          parenCount--;
          break;
      }
      
      if (braceCount < 0 || bracketCount < 0 || parenCount < 0) {
        markers.push({
          message: 'Unexpected closing bracket/brace/parenthesis',
          severity: monacoRef.current.MarkerSeverity.Error,
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + 1
        });
        braceCount = Math.max(0, braceCount);
        bracketCount = Math.max(0, bracketCount);
        parenCount = Math.max(0, parenCount);
      }
    }
    
    // 세미콜론 누락 검사
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.endsWith(';') && !trimmedLine.endsWith('{') && 
          !trimmedLine.endsWith('}') && !trimmedLine.endsWith('[') && !trimmedLine.endsWith(']') &&
          !trimmedLine.endsWith('(') && !trimmedLine.endsWith(')') && !trimmedLine.startsWith('//') &&
          !trimmedLine.startsWith('/*') && !trimmedLine.startsWith('*') && !trimmedLine.startsWith('*/') &&
          !trimmedLine.includes('function') && !trimmedLine.includes('if') && !trimmedLine.includes('for') &&
          !trimmedLine.includes('while') && !trimmedLine.includes('switch') && !trimmedLine.includes('try') &&
          !trimmedLine.includes('catch') && !trimmedLine.includes('else') && !trimmedLine.includes('return') &&
          !trimmedLine.includes('break') && !trimmedLine.includes('continue') && !trimmedLine.includes('throw')) {
        
        markers.push({
          message: 'Missing semicolon',
          severity: monacoRef.current.MarkerSeverity.Warning,
          startLineNumber: index + 1,
          startColumn: line.length,
          endLineNumber: index + 1,
          endColumn: line.length + 1
        });
      }
    });
    
    // 변수 선언 검사
    const varRegex = /(var|let|const)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const column = match.index - content.lastIndexOf('\n', match.index);
      
      // 예약어 검사
      const reservedWords = ['break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'];
      
      if (reservedWords.includes(varName)) {
        markers.push({
          message: `'${varName}' is a reserved word`,
          severity: monacoRef.current.MarkerSeverity.Error,
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column + varName.length
        });
      }
    }
  };

  // 오류 탐색 함수들
  const goToNextError = () => {
    if (!editorRef.current || !monacoRef.current) return;
    
    const editor = editorRef.current;
    const markers = monacoRef.current.editor.getModelMarkers({ resource: editor.getModel().uri });
    const errors = markers.filter(marker => marker.severity === monacoRef.current.MarkerSeverity.Error);
    
    if (errors.length > 0) {
      const currentPosition = editor.getPosition();
      let nextError = errors.find(error => 
        error.startLineNumber > currentPosition.lineNumber ||
        (error.startLineNumber === currentPosition.lineNumber && error.startColumn > currentPosition.column)
      );
      
      if (!nextError) {
        nextError = errors[0]; // 첫 번째 오류로 순환
      }
      
      editor.setPosition({ lineNumber: nextError.startLineNumber, column: nextError.startColumn });
      editor.revealLineInCenter(nextError.startLineNumber);
      editor.focus();
    }
  };

  const goToPrevError = () => {
    if (!editorRef.current || !monacoRef.current) return;
    
    const editor = editorRef.current;
    const markers = monacoRef.current.editor.getModelMarkers({ resource: editor.getModel().uri });
    const errors = markers.filter(marker => marker.severity === monacoRef.current.MarkerSeverity.Error);
    
    if (errors.length > 0) {
      const currentPosition = editor.getPosition();
      let prevError = errors.reverse().find(error => 
        error.startLineNumber < currentPosition.lineNumber ||
        (error.startLineNumber === currentPosition.lineNumber && error.startColumn < currentPosition.column)
      );
      
      if (!prevError) {
        prevError = errors[0]; // 마지막 오류로 순환
      }
      
      editor.setPosition({ lineNumber: prevError.startLineNumber, column: prevError.startColumn });
      editor.revealLineInCenter(prevError.startLineNumber);
      editor.focus();
    }
  };

  // 탭 아이콘 가져오기
  const getTabIcon = (type) => {
    const icons = {
      html: 'html',
              css: 'css',
        javascript: 'javascript',
              js: 'javascript',
        json: 'data_object',
              xml: 'code',
        xhtml: 'code',
              text: 'description',
        md: 'article',
              markdown: 'article'
    };
          return icons[type] || 'description';
  };

  const currentTab = getCurrentTab();

  // 탭이 변경될 때 언어 업데이트
  useEffect(() => {
    if (editorRef.current && currentTab && monacoRef.current) {
      const language = getLanguageType(currentTab);
      const model = editorRef.current.getModel();
      if (model) {
        const currentLanguage = model.getLanguageId();
        if (currentLanguage !== language) {
          monacoRef.current.editor.setModelLanguage(model, language);
        }
        // 레이아웃만 적용 (커서 위치 변경 제거)
        const editor = editorRef.current;
        setTimeout(() => editor.layout(), 0);
      }
    }
  }, [activeTabId, currentTab]);

  // 활성 탭 변경 시 커서 위치 보존 (선택적)
  useEffect(() => {
    if (editorRef.current && activeTabId) {
      // 탭 변경 시에만 위치 저장 (타이핑 중에는 저장하지 않음)
      const currentPos = editorRef.current.getPosition();
      if (currentPos && currentPos.lineNumber > 0) {
        lastPosRef.current = currentPos;
      }
    }
  }, [activeTabId]);

  console.log('EditorPane 렌더링:', { currentTab, activeTabId });
  
  // 간단한 테스트용 자동완성
  const testSuggestions = [
    { label: 'test', insertText: '테스트' },
    { label: 'p', insertText: '<p></p>' },
    { label: 'div', insertText: '<div></div>' }
  ];
  
  return (
    <div className="editor-pane" style={{ width: width }}>
      <TabBar
        openTabs={openTabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        onTabClose={onTabClose}
        getTabIcon={getTabIcon}
      />
      
      <FormatToolbar
        currentTab={currentTab}
        onFormatText={onFormatText}
        onInsertHeading={onInsertHeading}
        onInsertParagraph={onInsertParagraph}
        onInsertHorizontalRule={onInsertHorizontalRule}
        onInsertOrderedList={onInsertOrderedList}
        onInsertUnorderedList={onInsertUnorderedList}
        onInsertBlockquote={onInsertBlockquote}
        onInsertSection={onInsertSection}
        onInsertLink={onInsertLink}
        onInsertImage={onInsertImage}
        onInsertTable={onInsertTable}
        onAlignText={onAlignText}
        onSetTextColor={onSetTextColor}
        onSetBackgroundColor={onSetBackgroundColor}
        onSetFontSize={onSetFontSize}
        onInsertCodeBlock={onInsertCodeBlock}
        onInsertInlineCode={onInsertInlineCode}
        onInsertRole={onInsertRole}
        onGoToNextError={goToNextError}
        onGoToPrevError={goToPrevError}
      />
      
      <div className="editor-container">
  <Editor
    path={currentTab?.filePath || currentTab?.name || 'untitled'}
    language={getLanguageType(currentTab)}
    value={currentTab?.content || ''}
    theme="vs-dark-enhanced"
    options={{
      fontSize: 14,
      // 🔧 자동완성 핵심
      quickSuggestions: { other: true, comments: false, strings: true },
      quickSuggestionsDelay: 0,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      snippetSuggestions: 'inline',
      tabCompletion: 'on',
      // ⚠️ 버전 호환 위해 boolean 권장 (낮은 monaco 버전에서 문자열 타입 미지원)
      wordBasedSuggestions: true,
      suggestSelection: 'first',
      fixedOverflowWidgets: true,       // ← 팝업 잘림 방지
      suggest: { showUsers: false, showIssues: false },

      // 괄호/가이드
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },

      // 하이라이트
      'semanticHighlighting.enabled': true,
      colorDecorators: true,

      // 자동 닫기
      autoClosingBrackets: 'always',
      //autoClosingQuotes: 'always',
      //autoClosingOvertype: 'always',
      //autoClosingDelete: 'always',
      mouseWheelZoom: true, 
    }}
    onChange={handleChange}
    onMount={(editor) => {
      console.log('Editor onMount 호출됨');
      handleEditorMount?.(editor);
      editor.updateOptions({
        quickSuggestionsDelay: 0,
        wordBasedSuggestions: 'currentDocument',
        suggestSelection: 'first',
      });
    }}
    onContextMenu={(e) => console.log('컨텍스트 메뉴 이벤트:', e)}
    onValidate={(markers) => {
      console.log('Monaco Editor 검증 결과:', markers);
      
      // 검증 오류가 있으면 로거에 기록
      if (markers && markers.length > 0) {
        markers.forEach(marker => {
          if (marker.severity === monacoRef.current?.MarkerSeverity.Error) {
            const currentTab = getCurrentTab();
            const fileName = currentTab?.filePath || currentTab?.name || 'unknown';
            
            // 로거에 오류 기록
            if (window.logger) {
              window.logger.error('VALIDATION', `실시간 검증 오류: ${marker.message}`, {
                file: fileName,
                line: marker.startLineNumber,
                column: marker.startColumn,
                offset: marker.startColumn,
                path: fileName
              });
            }
          }
        });
      }
      
      // 추가적인 HTML/XHTML 문법 검증
      const currentTab = getCurrentTab();
      if (currentTab && (currentTab.type === 'html' || currentTab.type === 'xhtml')) {
        const editor = editorRef.current;
        if (editor) {
          const content = editor.getValue();
          const lines = content.split('\n');
          const fileName = currentTab?.filePath || currentTab?.name || 'unknown';
          
          // 기본적인 HTML 문법 검사
          lines.forEach((line, index) => {
            const lineNumber = index + 1;
            
            // 닫는 괄호 누락 검사 (더 정확한 검사)
            const divOpenMatch = line.match(/<div[^>]*>/g);
            const divCloseMatch = line.match(/<\/div>/g);
            const pOpenMatch = line.match(/<p[^>]*>/g);
            const pCloseMatch = line.match(/<\/p>/g);
            
            if (divOpenMatch && (!divCloseMatch || divOpenMatch.length > divCloseMatch.length)) {
              if (window.logger) {
                window.logger.error('VALIDATION', `실시간 검증 오류: <div> 태그의 닫는 괄호가 누락되었습니다`, {
                  file: fileName,
                  line: lineNumber,
                  column: line.indexOf('<div') + 1,
                  offset: line.indexOf('<div') + 1,
                  path: fileName
                });
              }
            }
            
            if (pOpenMatch && (!pCloseMatch || pOpenMatch.length > pCloseMatch.length)) {
              if (window.logger) {
                window.logger.error('VALIDATION', `실시간 검증 오류: <p> 태그의 닫는 괄호가 누락되었습니다`, {
                  file: fileName,
                  line: lineNumber,
                  column: line.indexOf('<p') + 1,
                  offset: line.indexOf('<p') + 1,
                  path: fileName
                });
              }
            }
          });
        }
      }
    }}
    keepCurrentModel
    loading={<div>Loading editor...</div>}
    onError={(error) => console.error('Monaco Editor 오류:', error)}
    beforeMount={(monaco) => {
      console.log('Monaco Editor beforeMount 시작');
      monacoRef.current = monaco;

      // ✅ 여러 번 마운트되어도 1회만 초기화
      if (monaco.__boinSetupDone) return;
      monaco.__boinSetupDone = true;

      /* ── 테마 정의 + 적용 ───────────────────────────────── */
      monaco.editor.defineTheme('vs-dark-enhanced', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'tag', foreground: '569cd6' },
          { token: 'tag.tag-name', foreground: '569cd6' },
          { token: 'tag.attribute', foreground: '9cdcfe' },
          { token: 'tag.attribute.value', foreground: 'ce9178' },
          { token: 'property', foreground: '9cdcfe' },
          { token: 'property.value', foreground: 'ce9178' },
          { token: 'support.type.property-name.css', foreground: '9cdcfe' },
          { token: 'support.type.property-name', foreground: '9cdcfe' },
          { token: 'keyword', foreground: 'c586c0' },
          { token: 'string', foreground: 'ce9178' },
          { token: 'comment', foreground: '6a9955' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editor.lineHighlightBackground': '#2a2d2e',
          'editor.selectionBackground': '#264f78',
          'editor.inactiveSelectionBackground': '#3a3d41',
          'editorSuggestWidget.background': '#252526',
          'editorSuggestWidget.border': '#454545',
          'editorSuggestWidget.selectedBackground': '#094771',
          'editorSuggestWidget.highlightForeground': '#0097fb',
          'editorError.foreground': '#f44747',
          'editorError.border': '#f44747',
          'editorWarning.foreground': '#ffcc02',
          'editorWarning.border': '#ffcc02',
          'editorInfo.foreground': '#007acc',
          'editorInfo.border': '#007acc',
        },
      });
      monaco.editor.setTheme('vs-dark-enhanced');

      /* ── 언어 기본 옵션 ─────────────────────────────────── */
      monaco.languages.html?.htmlDefaults.setOptions({
        validate: true,
        format: { tabSize: 2, insertSpaces: true, wrapLineLength: 120 },
        suggest: { html5: true },
        // HTML 검증 강화
        validateScripts: true,
        validateStyles: true,
      });
      monaco.languages.xml?.xmlDefaults.setOptions({
        validate: true,
        format: { tabSize: 2, insertSpaces: true },
        // XML 검증 강화
        validateOnType: true,
        validateOnPaste: true,
      });
      monaco.languages.css?.cssDefaults.setOptions({
        validate: true,
        lint: { unknownAtRules: 'ignore' },
        // CSS 검증 강화
        validateOnType: true,
        validateOnPaste: true,
      });

      /* ── 파일 확장자 → 언어 매핑 (xhtml→html, opf/ncx→xml) ── */
      const dispModelMap = monaco.editor.onDidCreateModel((model) => {
        const path = (model.uri.path || model.uri.toString()).toLowerCase();
        if (path.endsWith('.xhtml')) monaco.editor.setModelLanguage(model, 'html');
        if (path.endsWith('.opf') || path.endsWith('.ncx')) monaco.editor.setModelLanguage(model, 'xml');
      });
      // 이미 만들어진 모델도 한번 정리
      monaco.editor.getModels().forEach((model) => {
        const p = (model.uri.path || model.uri.toString()).toLowerCase();
        if (p.endsWith('.xhtml')) monaco.editor.setModelLanguage(model, 'html');
        if (p.endsWith('.opf') || p.endsWith('.ncx')) monaco.editor.setModelLanguage(model, 'xml');
      });

      /* ── HTML 스니펫/제안 (1회 등록) ─────────────────────── */
      const htmlProvider = monaco.languages.registerCompletionItemProvider('html', {
        triggerCharacters: ['<', '/', ' ', ':', '=', '"', "'"],
        provideCompletionItems: () => ({
          suggestions: [
            {
              label: 'html5',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
`<!DOCTYPE html>
<html lang="ko">
<head>
\t<meta charset="UTF-8">
\t<meta name="viewport" content="width=device-width, initial-scale=1.0">
\t<title>\${1:Document}</title>
\t<link rel="stylesheet" href="\${2:style.css}">
</head>
<body>
\t\${3}
</body>
</html>`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'HTML5 기본 문서',
            },
            {
              label: 'epub-xhtml',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html lang="ko" xml:lang="ko" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
\t<meta charset="utf-8"/>
\t<title>\${1:제목}</title>
\t<link href="../Styles/style_default_001.css" rel="stylesheet" type="text/css"/>
</head>
<body>
\t<section epub:type="chapter" role="doc-chapter">
\t\t<h1>\${2:챕터 제목}</h1>
\t\t<p>\${3}</p>
\t</section>
</body>
</html>`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'EPUB XHTML 템플릿',
            },
            { label: 'div', kind: monaco.languages.CompletionItemKind.Class,
              insertText: '<div>${1}</div>',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'p', kind: monaco.languages.CompletionItemKind.Class,
              insertText: '<p>${1}</p>',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'img', kind: monaco.languages.CompletionItemKind.Class,
              insertText: '<img src="${1}" alt="${2}" />',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'section-epub', kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '<section epub:type="${1:chapter}" role="doc-${2:chapter}">\\n\\t${3}\\n</section>',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          ],
        }),
      });

      /* ── XML/OPF 간단 스니펫 ──────────────────────────────── */
      const xmlProvider = monaco.languages.registerCompletionItemProvider('xml', {
        triggerCharacters: ['<', '/', ' ', ':', '=', '"', "'", '?'],
        provideCompletionItems: () => ({
          suggestions: [
            {
              label: 'opf-package',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText:
`<package version="3.0" unique-identifier="\${1:id}" xmlns="http://www.idpf.org/2007/opf">
\t\${2}
</package>`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'OPF package 루트',
            },
          ],
        }),
      });

      /* ── CSS 간단 스니펫 ──────────────────────────────────── */
      const cssProvider = monaco.languages.registerCompletionItemProvider('css', {
        triggerCharacters: [';', ':', '-', ' '],
        provideCompletionItems: () => ({
          suggestions: [
            { label: 'color', kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'color: ${1};',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'background-color', kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'background-color: ${1};',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'font-size', kind: monaco.languages.CompletionItemKind.Property,
              insertText: 'font-size: ${1}px;',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          ],
        }),
      });

      /* ── JS 간단 스니펫 ───────────────────────────────────── */
      const jsProvider = monaco.languages.registerCompletionItemProvider('javascript', {
        triggerCharacters: ['.', ' ', '('],
        provideCompletionItems: () => ({
          suggestions: [
            { label: 'function', kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'function ${1:name}(${2:params}) {\\n\\t${3}\\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
            { label: 'log', kind: monaco.languages.CompletionItemKind.Function,
              insertText: 'console.log(${1});',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet },
          ],
        }),
      });

      // 선택: 해제 핸들 저장해두기
      monaco.__boinDisposables = [dispModelMap, htmlProvider, xmlProvider, cssProvider, jsProvider];
    }}
  />
</div>
</div>
  );
});

EditorPane.displayName = 'EditorPane';

export default EditorPane;