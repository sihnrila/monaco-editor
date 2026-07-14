import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import TabBar from './TabBar';
import FormatToolbar from './FormatToolbar';
import './EditorPane.css';

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
          onMount={(editor) => {
            console.log('Editor onMount 호출됨');
            handleEditorMount(editor);
          }}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            fontSize: 14,
            // 자동완성 설정 강화
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
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
          }}
          onContextMenu={(e) => {
            console.log('컨텍스트 메뉴 이벤트:', e);
          }}
          onValidate={(markers) => {
            console.log('Monaco Editor 검증 결과:', markers);
          }}
          // Monaco Editor 기본 설정
          keepCurrentModel={true}
          loading={<div>Loading editor...</div>}
          onError={(error) => {
            console.error('Monaco Editor 오류:', error);
          }}
          beforeMount={(monaco) => {
            console.log('Monaco Editor beforeMount 시작');
            monacoRef.current = monaco;
            
            // 가장 간단한 테스트
            try {
              console.log('Monaco 객체 확인:', monaco);
              console.log('Monaco languages 확인:', monaco.languages);
              
              // XHTML 언어 등록 및 설정
              monaco.languages.register({ 
                id: 'xhtml',
                extensions: ['.xhtml'],
                aliases: ['XHTML', 'xhtml'],
                mimetypes: ['application/xhtml+xml', 'text/xhtml']
              });
              
              // XHTML 문법 하이라이트 설정
              monaco.languages.setMonarchTokensProvider('xhtml', {
                tokenPostfix: '.xhtml',
                defaultToken: '',
                tokenizer: {
                  root: [
                    [/<\?xml/, 'metatag'],
                    [/<!DOCTYPE/, 'metatag'],
                    [/<!--/, 'comment', '@comment'],
                    [/<(\!?)([a-zA-Z][a-zA-Z0-9\-]*)(\s[^>]*)?>/, {
                      cases: {
                        '$1==': { token: 'metatag' },
                        '@default': { token: 'tag', next: '@tag.$2' }
                      }
                    }],
                    [/[^<&]+/, 'content']
                  ],
                  comment: [
                    [/[^<\-]+/, 'comment.content'],
                    [/-->/, 'comment', '@pop'],
                    [/[<\-]/, 'comment.content']
                  ],
                  tag: [
                    [/[ \t\r\n]+/, 'white'],
                    [/([a-zA-Z][a-zA-Z0-9\-]*)(\s*=\s*)(")([^"]*)(")/, [
                      'attribute.name', 'delimiter', 'string.quote',
                      'attribute.value', 'string.quote'
                    ]],
                    [/([a-zA-Z][a-zA-Z0-9\-]*)(\s*=\s*)(')([^']*)(')/, [
                      'attribute.name', 'delimiter', 'string.quote',
                      'attribute.value', 'string.quote'
                    ]],
                    [/([a-zA-Z][a-zA-Z0-9\-]*)(\s*=\s*)([^ \t\r\n>]+)/, [
                      'attribute.name', 'delimiter', 'attribute.value'
                    ]],
                    [/[a-zA-Z][a-zA-Z0-9\-]*/, 'attribute.name'],
                    [/>/, { token: 'delimiter', next: '@pop' }],
                    [/[^ \t\r\n>]+/, 'attribute.value']
                  ]
                }
              });
              
              // XHTML 언어 설정
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
                ],
                indentationRules: {
                  increaseIndentPattern: /<(?!\?|!|(?:area|base|br|col|frame|hr|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)/,
                  decreaseIndentPattern: /<\/(?!html)[-_\.A-Za-z0-9]+\s*>/
                }
              });
              
              console.log('XHTML 언어 등록 및 설정 완료');
              
              // HTML 언어 설정 강화
              if (monaco.languages.html) {
                monaco.languages.html.htmlDefaults.setOptions({
                  validate: true,
                  format: {
                    tabSize: 2,
                    insertSpaces: true
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
                    showProperties: true,
                    showEvents: true,
                    showOperators: true,
                    showUnits: true,
                    showValues: true,
                    showDeprecated: true
                  }
                });
                console.log('HTML 언어 설정 완료');
              }
              
              // 모든 언어에 대한 기본 자동완성 등록
              const languages = ['html', 'xhtml', 'xml', 'text'];
              
              // HTML 자동완성 등록 (XHTML 포함)
              monaco.languages.registerCompletionItemProvider('html', {
                triggerCharacters: ['<', ' ', ':', '='],
                provideCompletionItems: (model, position) => {
                  console.log('HTML 자동완성 호출됨:', { model: model.uri.toString(), position });
                  return {
                    suggestions: [
                      {
                        label: 'test-html',
                        kind: monaco.languages.CompletionItemKind.Text,
                        insertText: 'HTML 테스트 자동완성',
                        documentation: 'HTML 테스트용'
                      },
                      {
                        label: 'p',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<p>${1}</p>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '단락 태그'
                      },
                      {
                        label: 'div',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<div>${1}</div>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'div 태그'
                      },
                      {
                        label: 'h1',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<h1>${1}</h1>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'h1 제목 태그'
                      },
                      {
                        label: 'h2',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<h2>${1}</h2>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'h2 제목 태그'
                      },
                      {
                        label: 'h3',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<h3>${1}</h3>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'h3 제목 태그'
                      },
                      {
                        label: 'br',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<br>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '줄바꿈 태그'
                      },
                      {
                        label: 'hr',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<hr>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '수평선 태그'
                      },
                      {
                        label: 'img',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<img src="${1}" alt="${2}">',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '이미지 태그'
                      },
                      {
                        label: 'link',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<link rel="stylesheet" href="${1}">',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'CSS 링크 태그'
                      },
                      {
                        label: 'meta',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<meta name="${1}" content="${2}">',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '메타 태그'
                      },
                      {
                        label: 'epub-xhtml',
                        kind: monaco.languages.CompletionItemKind.Snippet,
                        insertText: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html lang="ko" xml:lang="ko" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n<head>\n\t<meta charset="utf-8"/>\n\t<title>${1:제목}</title>\n\t<link href="../Styles/style_default_001.css" rel="stylesheet" type="text/css"/>\n</head>\n<body>\n\t<section epub:type="chapter" role="doc-chapter">\n\t\t<h1>${2:챕터 제목}</h1>\n\t\t<p>\n\t\t\t${3}\n\t\t</p>\n\t</section>\n</body>\n</html>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'EPUB XHTML 기본 문서 구조',
                        detail: 'EPUB XHTML Template'
                      },
                      {
                        label: 'section',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<section epub:type="${1:chapter}" role="doc-${2:chapter}">\n\t${3}\n</section>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'EPUB XHTML 섹션 태그'
                      },
                      {
                        label: 'ul',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<ul>\n\t<li>${1}</li>\n</ul>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '순서 없는 목록'
                      },
                      {
                        label: 'ol',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<ol>\n\t<li>${1}</li>\n</ol>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '순서 있는 목록'
                      },
                      {
                        label: 'li',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<li>${1}</li>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '목록 항목'
                      },
                      {
                        label: 'strong',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<strong>${1}</strong>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '굵은 텍스트'
                      },
                      {
                        label: 'em',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<em>${1}</em>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '기울임 텍스트'
                      },
                      {
                        label: 'a',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<a href="${1}">${2}</a>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '링크'
                      },
                      {
                        label: 'span',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<span>${1}</span>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '인라인 요소'
                      },
                      {
                        label: 'table',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<table>\n\t<tr>\n\t\t<td>${1}</td>\n\t</tr>\n</table>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '테이블'
                      },
                      {
                        label: 'tr',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<tr>\n\t<td>${1}</td>\n</tr>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '테이블 행'
                      },
                      {
                        label: 'td',
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: '<td>${1}</td>',
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: '테이블 셀'
                      }
                    ]
                  };
                }
              });
              
              console.log('HTML 자동완성 등록 완료');
              
              console.log('모든 언어 자동완성 등록 완료');
            } catch (error) {
              console.error('Monaco 초기화 오류:', error);
            }
            
            // 간단한 테스트용 자동완성 등록
            monaco.languages.registerCompletionItemProvider('html', {
              provideCompletionItems: () => {
                console.log('HTML 자동완성 호출됨');
                return {
                  suggestions: [
                    {
                      label: 'test',
                      kind: monaco.languages.CompletionItemKind.Text,
                      insertText: '테스트 자동완성',
                      documentation: '테스트용'
                    },
                    {
                      label: 'p',
                      kind: monaco.languages.CompletionItemKind.Class,
                      insertText: '<p>${1}</p>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '단락 태그'
                    }
                  ]
                };
              }
            });
            
            console.log('간단한 자동완성 등록 완료');
            
            // XHTML 언어 등록 (가장 먼저 등록)
            monaco.languages.register({ 
              id: 'xhtml',
              extensions: ['.xhtml'],
              aliases: ['XHTML', 'xhtml'],
              mimetypes: ['application/xhtml+xml', 'text/xhtml']
            });
            
            // XHTML 전용 설정 (HTML 기반 설정 제거)
            // XHTML은 자체 언어 설정을 사용
            
            // XHTML 언어 설정 (XHTML 규칙에 맞게)
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
              ],
              indentationRules: {
                // XHTML 규칙: 모든 태그는 닫혀야 함 (자동 닫힘 태그 제외)
                increaseIndentPattern: /<(?!\?|!|(?:area|base|br|col|frame|hr|img|input|link|meta|param)\b|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)/,
                decreaseIndentPattern: /<\/(?!html)[-_\.A-Za-z0-9]+\s*>/
              }
            });
            
            // XHTML 전용 검증 및 포맷팅 설정
            // XHTML 언어가 존재하는지 확인하고 설정
            console.log('XHTML 언어 등록 확인:', monaco.languages.xhtml);
            
            // XHTML 언어가 없으면 HTML 기반으로 설정
            if (!monaco.languages.xhtml) {
              console.log('XHTML 언어가 없음, HTML 기반으로 설정');
              // HTML 자동완성에 XHTML 스니펫 추가
              monaco.languages.registerCompletionItemProvider('html', {
                provideCompletionItems: (model, position) => {
                  const suggestions = [
                    {
                      label: 'epub-xhtml',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html lang="ko" xml:lang="ko" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n<head>\n\t<meta charset="utf-8"/>\n\t<title>${1:제목}</title>\n\t<link href="../Styles/style_default_001.css" rel="stylesheet" type="text/css"/>\n</head>\n<body>\n\t<section epub:type="chapter" role="doc-chapter">\n\t\t<h1>${2:챕터 제목}</h1>\n\t\t<p>\n\t\t\t${3}\n\t\t</p>\n\t</section>\n</body>\n</html>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'EPUB XHTML 기본 문서 구조',
                      detail: 'EPUB XHTML Template'
                    },
                    {
                      label: 'epub-section',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: '<section epub:type="${1:chapter}" role="doc-${2:chapter}">\n\t${3}\n</section>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'EPUB 섹션 요소',
                      detail: 'EPUB Section'
                    },
                    {
                      label: 'epub-chapter',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: '<section epub:type="chapter" role="doc-chapter">\n\t<h1>${1:챕터 제목}</h1>\n\t${2}\n</section>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'EPUB 챕터 섹션',
                      detail: 'EPUB Chapter'
                    }
                  ];
                  return { suggestions };
                }
              });
            } else {
              monaco.languages.xhtml.xhtmlDefaults.setOptions({
                validate: true,
                format: {
                  tabSize: 2,
                  insertSpaces: true,
                  wrapLineLength: 120
                },
                // XHTML 실시간 검증 설정
                validateOnType: true,
                validateOnPaste: true,
                // XHTML 특정 검증 규칙
                xhtmlValidate: {
                  enabled: true,
                  validateScripts: true,
                  validateStyles: true,
                  strictMode: true // XHTML 엄격 모드
                },
                // XHTML 자동완성 강화
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
                quickSuggestions: {
                  other: true,
                  comments: true,
                  strings: true
                },
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnCommitCharacter: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                wordBasedSuggestions: 'on'
              });
            }
            
            // XHTML 문법 하이라이팅 설정 (XHTML 규칙에 맞게)
            monaco.languages.setMonarchTokensProvider('xhtml', {
              tokenPostfix: '.xhtml',
              defaultToken: '',
              tokenizer: {
                root: [
                  [/<\?xml/, 'metatag'],
                  [/<!DOCTYPE/, 'metatag'],
                  [/<!--/, 'comment', '@comment'],
                  [/<(\!?)([a-zA-Z][a-zA-Z0-9\-]*)(\s[^>]*)?>/, {
                    cases: {
                      '$1==': { token: 'metatag' },
                      '@default': { token: 'tag', next: '@tag.$2' }
                    }
                  }],
                  [/[^<&]+/, 'content']
                ],
                comment: [
                  [/[^<\-]+/, 'comment.content'],
                  [/-->/, 'comment', '@pop'],
                  [/[<\-]/, 'comment.content']
                ],
                tag: [
                  [/[ \t\r\n]+/, 'white'],
                  [/([a-zA-Z][a-zA-Z0-9\-]*)(\s*=\s*)(")([^"]*)(")/, [
                    'attribute.name', 'delimiter', 'string.quote',
                    'attribute.value', 'string.quote'
                  ]],
                  [/([a-zA-Z][a-zA-Z0-9\-]*)(\s*=\s*)(')([^']*)(')/, [
                    'attribute.name', 'delimiter', 'string.quote',
                    'attribute.value', 'string.quote'
                  ]],
                  [/([a-zA-Z][a-zA-Z0-9\-]*)(\s*=\s*)([^ \t\r\n>]+)/, [
                    'attribute.name', 'delimiter', 'attribute.value'
                  ]],
                  [/[a-zA-Z][a-zA-Z0-9\-]*/, 'attribute.name'],
                  [/>/, { token: 'delimiter', next: '@pop' }],
                  [/[^ \t\r\n>]+/, 'attribute.value']
                ]
              }
            });
            
            // Monaco Editor 초기화 시 추가 설정
            monaco.editor.defineTheme('vs-dark-enhanced', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                // HTML 태그 하이라이트 개선
                { token: 'tag', foreground: '569cd6' },
                { token: 'tag.tag-name', foreground: '569cd6' },
                { token: 'tag.attribute', foreground: '9cdcfe' },
                { token: 'tag.attribute.value', foreground: 'ce9178' },
                // CSS 하이라이트 개선
                { token: 'property', foreground: '9cdcfe' },
                { token: 'property.value', foreground: 'ce9178' },
                { token: 'support.type.property-name.css', foreground: '9cdcfe' },
                { token: 'support.type.property-name', foreground: '9cdcfe' },
                // JavaScript 하이라이트 개선
                { token: 'keyword', foreground: 'c586c0' },
                { token: 'string', foreground: 'ce9178' },
                { token: 'comment', foreground: '6a9955' }
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
                // 오류 및 경고 색상 추가
                'editorError.foreground': '#f44747',
                'editorError.border': '#f44747',
                'editorWarning.foreground': '#ffcc02',
                'editorWarning.border': '#ffcc02',
                'editorInfo.foreground': '#007acc',
                'editorInfo.border': '#007acc'
              }
            });

            // HTML 언어 설정 개선 - 실시간 검증 강화
            if (monaco.languages.html) {
              monaco.languages.html.htmlDefaults.setOptions({
                validate: true,
                format: {
                  tabSize: 2,
                  insertSpaces: true,
                  wrapLineLength: 120
                },
                // HTML 실시간 검증 설정
                validateOnType: true,
                validateOnPaste: true,
                // HTML 특정 검증 규칙
                htmlValidate: {
                  enabled: true,
                  validateScripts: true,
                  validateStyles: true
                },
                // HTML 자동완성 활성화
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
                // 빠른 제안 활성화
                quickSuggestions: {
                  other: true,
                  comments: true,
                  strings: true
                },
                suggestOnTriggerCharacters: true
              });
              
                          // HTML 자동완성 프로바이더 등록 (XHTML과 구분)
            console.log('HTML 자동완성 프로바이더 등록 시작');
            
            // 모든 언어에 대한 자동완성 프로바이더 등록
            const allLanguages = ['html', 'xhtml', 'xml', 'text'];
            
            allLanguages.forEach(lang => {
              console.log(`${lang} 언어에 자동완성 프로바이더 등록`);
              monaco.languages.registerCompletionItemProvider(lang, {
                provideCompletionItems: (model, position) => {
                  console.log(`${lang} 자동완성 호출됨:`, { model: model.uri.toString(), position });
                  const suggestions = [
                    {
                      label: 'test',
                      kind: monaco.languages.CompletionItemKind.Text,
                      insertText: '테스트 자동완성',
                      documentation: '테스트용 자동완성'
                    },
                    {
                      label: 'p',
                      kind: monaco.languages.CompletionItemKind.Class,
                      insertText: '<p>${1}</p>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '단락 태그'
                    },
                    {
                      label: 'div',
                      kind: monaco.languages.CompletionItemKind.Class,
                      insertText: '<div>${1}</div>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'div 태그'
                    },
                    {
                      label: 'br',
                      kind: monaco.languages.CompletionItemKind.Class,
                      insertText: '<br>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '줄바꿈'
                    },
                    {
                      label: 'epub-xhtml',
                      kind: monaco.languages.CompletionItemKind.Snippet,
                      insertText: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html lang="ko" xml:lang="ko" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n<head>\n\t<meta charset="utf-8"/>\n\t<title>${1:제목}</title>\n\t<link href="../Styles/style_default_001.css" rel="stylesheet" type="text/css"/>\n</head>\n<body>\n\t<section epub:type="chapter" role="doc-chapter">\n\t\t<h1>${2:챕터 제목}</h1>\n\t\t<p>\n\t\t\t${3}\n\t\t</p>\n\t</section>\n</body>\n</html>',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'EPUB XHTML 기본 문서 구조',
                      detail: 'EPUB XHTML Template'
                    }
                  ];
                  console.log(`${lang} 자동완성 제안:`, suggestions.length, '개');
                  return { suggestions };
                }
              });
            });
            
            // 기존 HTML 자동완성 프로바이더 등록 (XHTML과 구분)
            monaco.languages.registerCompletionItemProvider('html', {
              provideCompletionItems: (model, position) => {
                console.log('HTML 자동완성 호출됨:', { model: model.uri.toString(), position });
                const suggestions = [
                  {
                    label: 'html',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<!DOCTYPE html>\n<html lang="ko">\n<head>\n\t<meta charset="UTF-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:style.css}">\n</head>\n<body>\n\t${3}\n</body>\n</html>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML5 기본 문서 구조',
                    detail: 'HTML Template'
                  },
                  {
                    label: 'div',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<div>${1}</div>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML div 요소'
                  },
                  {
                    label: 'p',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<p>${1}</p>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML paragraph 요소'
                  },
                  {
                    label: 'span',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<span>${1}</span>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML span 요소'
                  },
                  {
                    label: 'h1',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<h1>${1}</h1>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML h1 제목 요소'
                  },
                  {
                    label: 'h2',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<h2>${1}</h2>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML h2 제목 요소'
                  },
                  {
                    label: 'h3',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<h3>${1}</h3>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML h3 제목 요소'
                  },
                  {
                    label: 'ul',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<ul>\n\t<li>${1}</li>\n</ul>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 순서 없는 목록'
                  },
                  {
                    label: 'ol',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<ol>\n\t<li>${1}</li>\n</ol>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 순서 있는 목록'
                  },
                  {
                    label: 'li',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<li>${1}</li>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 목록 항목'
                  },
                  {
                    label: 'img',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<img src="${1}" alt="${2}">',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 이미지 요소'
                  },
                  {
                    label: 'link',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<link rel="stylesheet" href="${1}">',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'CSS 링크 요소'
                  },
                  {
                    label: 'script',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<script src="${1}"></script>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'JavaScript 스크립트 요소'
                  },
                  {
                    label: 'style',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<style>\n\t${1}\n</style>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'CSS 스타일 요소'
                  },
                  {
                    label: 'table',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<table>\n\t<tr>\n\t\t<td>${1}</td>\n\t</tr>\n</table>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 테이블 요소'
                  },
                  {
                    label: 'form',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<form action="${1}" method="post">\n\t${2}\n</form>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 폼 요소'
                  },
                  {
                    label: 'br',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<br>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 줄바꿈 요소'
                  },
                  {
                    label: 'hr',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<hr>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 수평선 요소'
                  },
                  {
                    label: 'strong',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<strong>${1}</strong>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 굵은 텍스트 요소'
                  },
                  {
                    label: 'em',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<em>${1}</em>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 기울임 텍스트 요소'
                  },
                  {
                    label: 'a',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<a href="${1}">${2}</a>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 링크 요소'
                  },
                  {
                    label: 'meta',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<meta name="${1}" content="${2}">',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 메타 태그'
                  },
                  {
                    label: 'title',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<title>${1}</title>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 제목 태그'
                  },
                  {
                    label: 'head',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<head>\n\t${1}\n</head>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 헤드 요소'
                  },
                  {
                    label: 'body',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<body>\n\t${1}\n</body>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'HTML 바디 요소'
                  },
                  // 테스트용 간단한 자동완성
                  {
                    label: 'test',
                    kind: monaco.languages.CompletionItemKind.Text,
                    insertText: '테스트 자동완성',
                    documentation: '테스트용 자동완성'
                  }
                ];
                console.log('HTML 자동완성 제안:', suggestions.length, '개');
                return { suggestions };
              }
            });
            }

            // CSS 언어 설정 개선 - 실시간 검증 강화
            if (monaco.languages.css) {
              monaco.languages.css.cssDefaults.setOptions({
                validate: true,
                lint: {
                  unknownAtRules: 'ignore'
                },
                // CSS 실시간 검증 설정
                validateOnType: true,
                validateOnPaste: true
              });
              
              // CSS 자동완성 프로바이더 등록
              monaco.languages.registerCompletionItemProvider('css', {
                provideCompletionItems: (model, position) => {
                  const suggestions = [
                    {
                      label: 'color',
                      kind: monaco.languages.CompletionItemKind.Property,
                      insertText: 'color: ${1};',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '텍스트 색상'
                    },
                    {
                      label: 'background-color',
                      kind: monaco.languages.CompletionItemKind.Property,
                      insertText: 'background-color: ${1};',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '배경 색상'
                    },
                    {
                      label: 'font-size',
                      kind: monaco.languages.CompletionItemKind.Property,
                      insertText: 'font-size: ${1}px;',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '폰트 크기'
                    },
                    {
                      label: 'margin',
                      kind: monaco.languages.CompletionItemKind.Property,
                      insertText: 'margin: ${1};',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '마진'
                    },
                    {
                      label: 'padding',
                      kind: monaco.languages.CompletionItemKind.Property,
                      insertText: 'padding: ${1};',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '패딩'
                    }
                  ];
                  return { suggestions };
                }
              });
            }

            // JavaScript 언어 설정 개선 - 실시간 검증 강화
            if (monaco.languages.javascript) {
              monaco.languages.javascript.javascriptDefaults.setOptions({
                validate: true,
                diagnosticsOptions: {
                  noSemanticValidation: false,
                  noSyntaxValidation: false
                },
                // JavaScript 실시간 검증 설정
                validateOnType: true,
                validateOnPaste: true
              });
              
              // JavaScript 자동완성 프로바이더 등록
              monaco.languages.registerCompletionItemProvider('javascript', {
                provideCompletionItems: (model, position) => {
                  const suggestions = [
                    {
                      label: 'function',
                      kind: monaco.languages.CompletionItemKind.Function,
                      insertText: 'function ${1:name}(${2:params}) {\n\t${3}\n}',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '함수 정의'
                    },
                    {
                      label: 'if',
                      kind: monaco.languages.CompletionItemKind.Keyword,
                      insertText: 'if (${1:condition}) {\n\t${2}\n}',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'if 조건문'
                    },
                    {
                      label: 'for',
                      kind: monaco.languages.CompletionItemKind.Keyword,
                      insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3}\n}',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: 'for 반복문'
                    },
                    {
                      label: 'console.log',
                      kind: monaco.languages.CompletionItemKind.Function,
                      insertText: 'console.log(${1});',
                      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                      documentation: '콘솔 로그'
                    }
                  ];
                  return { suggestions };
                }
              });
            }

            // XML 언어 설정 추가 (XHTML, OPF, NCX 파일용)
            if (monaco.languages.xml) {
              monaco.languages.xml.xmlDefaults.setOptions({
                validate: true,
                format: {
                  tabSize: 2,
                  insertSpaces: true
                },
                // XML 자동완성 활성화
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
                }
              });
              
                          // XML/XHTML 자동완성 프로바이더 등록
            monaco.languages.registerCompletionItemProvider('xml', {
              provideCompletionItems: (model, position) => {
                const suggestions = [
                  {
                    label: 'div',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<div>${1}</div>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'XML div 요소'
                  },
                  {
                    label: 'p',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<p>${1}</p>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'XML paragraph 요소'
                  },
                  {
                    label: 'span',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<span>${1}</span>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'XML span 요소'
                  }
                ];
                return { suggestions };
              }
            });

            // XHTML 언어 설정은 이미 beforeMount에서 등록됨

            console.log('Monaco Editor 초기화 완료');
            
            // 컨텍스트 메뉴 액션 등록
            monaco.editor.registerCommand('editor.action.showContextMenu', () => {
              console.log('컨텍스트 메뉴 표시');
            });
            
            // XHTML 전용 자동완성 프로바이더 등록
            monaco.languages.registerCompletionItemProvider('xhtml', {
              provideCompletionItems: (model, position) => {
                const suggestions = [
                  {
                    label: 'epub-xhtml',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html lang="ko" xml:lang="ko" xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n<head>\n\t<meta charset="utf-8"/>\n\t<title>${1:제목}</title>\n\t<link href="../Styles/style_default_001.css" rel="stylesheet" type="text/css"/>\n</head>\n<body>\n\t<section epub:type="chapter" role="doc-chapter">\n\t\t<h1>${2:챕터 제목}</h1>\n\t\t<p>\n\t\t\t${3}\n\t\t</p>\n\t</section>\n</body>\n</html>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB XHTML 기본 문서 구조',
                    detail: 'EPUB XHTML Template'
                  },
                  {
                    label: 'epub-section',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<section epub:type="${1:chapter}" role="doc-${2:chapter}">\n\t${3}\n</section>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 섹션 요소',
                    detail: 'EPUB Section'
                  },
                  {
                    label: 'epub-chapter',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<section epub:type="chapter" role="doc-chapter">\n\t<h1>${1:챕터 제목}</h1>\n\t${2}\n</section>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 챕터 섹션',
                    detail: 'EPUB Chapter'
                  },
                  {
                    label: 'epub-p',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<p>\n\t${1}\n</p>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 단락',
                    detail: 'EPUB Paragraph'
                  },
                  {
                    label: 'epub-h1',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<h1>${1}</h1>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 제목 1',
                    detail: 'EPUB Heading 1'
                  },
                  {
                    label: 'epub-h2',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<h2>${1}</h2>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 제목 2',
                    detail: 'EPUB Heading 2'
                  },
                  {
                    label: 'epub-h3',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<h3>${1}</h3>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 제목 3',
                    detail: 'EPUB Heading 3'
                  },
                  {
                    label: 'epub-img',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<img src="${1:../Images/image.jpg}" alt="${2:이미지 설명}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 이미지',
                    detail: 'EPUB Image'
                  },
                  {
                    label: 'epub-link',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<link href="${1:../Styles/style.css}" rel="stylesheet" type="text/css"/>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB CSS 링크',
                    detail: 'EPUB Link'
                  },
                  {
                    label: 'epub-meta',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<meta name="${1}" content="${2}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 메타 태그',
                    detail: 'EPUB Meta'
                  },
                  {
                    label: 'epub-br',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<br />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 줄바꿈',
                    detail: 'EPUB Break'
                  },
                  {
                    label: 'epub-hr',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<hr />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 수평선',
                    detail: 'EPUB Horizontal Rule'
                  },
                  {
                    label: 'xhtml',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ko">\n<head>\n\t<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>${1:Document}</title>\n\t<link rel="stylesheet" href="${2:../Styles/style.css}" />\n</head>\n<body>\n\t${3}\n</body>\n</html>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'XHTML 1.1 기본 문서 구조',
                    detail: 'XHTML Template'
                  },
                  {
                    label: 'div',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<div>${1}</div>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'DIV 컨테이너 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'p',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<p>${1}</p>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '단락 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'span',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<span>${1}</span>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'SPAN 요소 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'h1',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<h1>${1}</h1>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'H1 제목 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'h2',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<h2>${1}</h2>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'H2 제목 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'h3',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<h3>${1}</h3>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'H3 제목 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'ul',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<ul>\n\t<li>${1}</li>\n</ul>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '순서 없는 목록 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'ol',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<ol>\n\t<li>${1}</li>\n</ol>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '순서 있는 목록 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'li',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<li>${1}</li>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '목록 항목 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'img',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<img src="${1}" alt="${2}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '이미지 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'br',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<br />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '줄바꿈 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'hr',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<hr />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '수평선 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'link',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<link rel="stylesheet" href="${1}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'CSS 링크 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'meta',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<meta name="${1}" content="${2}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '메타 태그 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'input',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<input type="${1}" name="${2}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '입력 필드 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'area',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<area shape="${1}" coords="${2}" href="${3}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '이미지 맵 영역 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'base',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<base href="${1}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '기본 URL (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'col',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<col span="${1}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '테이블 열 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'frame',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<frame src="${1}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '프레임 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'param',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<param name="${1}" value="${2}" />',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '매개변수 (XHTML - 자동 닫힘)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'script',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<script src="${1}"></script>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'JavaScript 스크립트 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'style',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<style>\n\t${1}\n</style>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'CSS 스타일 (XHTML)',
                    detail: 'XHTML Element'
                  },
                  {
                    label: 'section',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<section epub:type="chapter" role="doc-chapter">\n\t${1}\n</section>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 챕터 섹션',
                    detail: 'EPUB Element'
                  },
                  {
                    label: 'epub-section',
                    kind: monaco.languages.CompletionItemKind.Class,
                    insertText: '<section epub:type="${1:chapter}" role="doc-${2:chapter}">\n\t${3}\n</section>',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'EPUB 섹션 (타입 지정)',
                    detail: 'EPUB Element'
                  }
                ];
                return { suggestions };
              }
            });
            }

          

          }}
        />
      </div>
    </div>
  );
});

EditorPane.displayName = 'EditorPane';

export default EditorPane;