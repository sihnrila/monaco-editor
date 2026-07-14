// 태그 교체/감싸기 유틸 함수
export function replaceOrWrapTag(selectedText, newTag, attrs = '') {
  // h1~h6, p, ul, ol, blockquote, pre, code 등
  const tagPattern = /^<([a-z0-9]+)(\s[^>]*)?>([\s\S]*)<\/\1>$/i;
  const match = selectedText.match(tagPattern);
  if (match) {
    return `<${newTag}${attrs ? ' ' + attrs : ''}>${match[3]}</${newTag}>`;
  } else {
    return `<${newTag}${attrs ? ' ' + attrs : ''}>${selectedText}</${newTag}>`;
  }
}

// 텍스트 포맷팅 관련 유틸리티 함수들
export const formatUtils = {
  // HTML 포맷팅
  formatText: (editor, type) => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel().getValueInRange(selection);
    let formattedText = '';

    switch (type) {
      case 'bold':
        formattedText = `<strong>${selectedText}</strong>`;
        break;
      case 'italic':
        formattedText = `<em>${selectedText}</em>`;
        break;
      case 'underline':
        formattedText = `<u>${selectedText}</u>`;
        break;
      case 'strikethrough':
        formattedText = `<s>${selectedText}</s>`;
        break;
      default:
        formattedText = selectedText;
    }

    editor.executeEdits('format-text', [{
      range: selection,
      text: formattedText
    }]);
    editor.focus();
  },

  // 제목 삽입
  insertHeading: (editor, level = 1) => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel().getValueInRange(selection);
    const headingText = replaceOrWrapTag(selectedText, `h${level}`);

    editor.executeEdits('insert-heading', [{
      range: selection,
      text: headingText
    }]);
    editor.focus();
  },

  // 단락 삽입
  insertParagraph: (editor) => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel().getValueInRange(selection);
    const paragraphText = replaceOrWrapTag(selectedText, 'p');

    editor.executeEdits('insert-paragraph', [{
      range: selection,
      text: paragraphText
    }]);
    editor.focus();
  },

  // 링크 삽입
  insertLink: (editor) => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const selectedText = editor.getModel().getValueInRange(selection);
    const url = prompt('링크 URL을 입력하세요:', 'https://');
    
    if (url) {
      const linkText = `<a href="${url}">${selectedText || 'Link Text'}</a>`;
      editor.executeEdits('insert-link', [{
        range: selection,
        text: linkText
      }]);
    }
    editor.focus();
  },

  // 이미지 삽입
  insertImage: (editor) => {
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;

    const src = prompt('이미지 URL을 입력하세요:', '');
    const alt = prompt('이미지 설명을 입력하세요:', '');
    
    if (src) {
      const imgText = `<img src="${src}" alt="${alt || ''}" />`;
      editor.executeEdits('insert-image', [{
        range: selection,
        text: imgText
      }]);
    }
    editor.focus();
  }
};