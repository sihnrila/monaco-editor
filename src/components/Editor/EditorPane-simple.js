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
    minimap: {
      enabled: true,
      side: 'right',
      size: 'proportional',
      showSlider: 'always',
      renderCharacters: false,
      maxColumn: 120,
      scale: 1
    },
    scrollBeyondLastLine: false,
    scrollBeyondLastColumn: 10,
    automaticLayout: true,
    fixedOverflowWidgets: true,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    wordWrap: 'on',
    lineNumbers: 'on',
    folding: true,
    renderWhitespace: 'boundary',
    renderControlCharacters: false,
    validateOnType: true,
    validateOnPaste: true,
    problems: {
      decorations: true
    },
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
      highlightActiveIndentation: true
    },
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
    quickSuggestions: {
      other: true,
      comments: true,
      strings: true
    }
  }
}, ref) => {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // 현재 활성 탭 가져오기
  const getCurrentTab = () => {
    return openTabs.find(tab => tab.id === activeTabId);
  };

  // 언어 타입 결정 함수
  const getLanguageType = (tab) => {
    if (!tab) return 'text';
    
    // XHTML 파일인 경우 HTML 언어로 처리
    if (tab.type === 'xhtml' || 
        (tab.filePath && tab.filePath.toLowerCase().endsWith('.xhtml')) ||
        (tab.name && tab.name.toLowerCase().endsWith('.xhtml'))) {
      console.log('XHTML 파일을 HTML 언어로 처리:', tab.name);
      return 'html';
    }
    
    const languageMap = {
      'html': 'html',
      'css': 'css',
      'javascript': 'javascript',
      'js': 'javascript',
      'json': 'json',
      'xml': 'xml',
      'markdown': 'markdown',
      'md': 'markdown',
      'text': 'text'
    };
    
    return languageMap[tab.type] || 'text';
  };

  // Editor 마운트 시 처리
  const handleEditorMount = (editor) => {
    console.log('Editor 마운트됨');
    editorRef.current = editor;
    window.monacoEditor = editor;
    window.monaco = monacoRef.current;
    editor.focus();
    setTimeout(() => editor.layout(), 0);
    editor.updateOptions({ readOnly: false });
    
    // 자동완성 강제 활성화
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
      contextmenu: true
    });
  };

  // 내용 변경 처리
  const handleChange = (value, event) => {
    const currentTab = getCurrentTab();
    if (currentTab && onContentChange) {
      onContentChange(currentTab.id, value);
    }
  };

  // 탭 내용 업데이트
  const updateTabContent = (tabId, content) => {
    if (editorRef.current) {
      editorRef.current.executeEdits('content-change', [{
        range: editorRef.current.getModel().getFullModelRange(),
        text: content
      }]);
    }
  };

  // 현재 탭 가져오기
  const currentTab = getCurrentTab();

  // 탭 변경 시 내용 업데이트
  useEffect(() => {
    if (currentTab && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== currentTab.content) {
        updateTabContent(currentTab.id, currentTab.content || '');
      }
      setTimeout(() => editorRef.current.layout(), 0);
    }
  }, [activeTabId, currentTab]);

  console.log('EditorPane 렌더링:', { currentTab, activeTabId });

  return (
    <div className="editor-pane" style={{ width }}>
      <TabBar
        tabs={openTabs}
        activeTabId={activeTabId}
        onTabChange={onTabChange}
        onTabClose={onTabClose}
      />
      <div className="editor-container">
        <FormatToolbar
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
        />
        <div className="editor-wrapper">
          <Editor
            path={currentTab?.filePath || currentTab?.name || 'untitled'}
            language={getLanguageType(currentTab)}
            value={currentTab?.content || ''}
            onMount={handleEditorMount}
            onChange={handleChange}
            theme="vs-dark"
            options={{
              fontSize: 14,
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true
              },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'on'
            }}
            beforeMount={(monaco) => {
              console.log('Monaco Editor beforeMount 시작');
              monacoRef.current = monaco;
              
              // 간단한 HTML 자동완성 등록
              monaco.languages.registerCompletionItemProvider('html', {
                triggerCharacters: ['<'],
                provideCompletionItems: (model, position) => {
                  console.log('HTML 자동완성 호출됨!');
                  return {
                    suggestions: [
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
                        label: 'test',
                        kind: monaco.languages.CompletionItemKind.Text,
                        insertText: '테스트 자동완성',
                        documentation: '테스트용'
                      }
                    ]
                  };
                }
              });
              
              console.log('HTML 자동완성 등록 완료');
            }}
          />
        </div>
      </div>
    </div>
  );
});

EditorPane.displayName = 'EditorPane';

export default EditorPane;

