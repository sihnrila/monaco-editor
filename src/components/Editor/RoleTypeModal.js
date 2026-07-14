import React, { useState } from 'react';
import './RoleTypeModal.css';

const RoleTypeModal = ({ isOpen, onClose, onConfirm, selectedText }) => {
  const [selectedType, setSelectedType] = useState('author');
  const [customType, setCustomType] = useState('');
  const [useCustomType, setUseCustomType] = useState(false);

  const predefinedTypes = [
    { value: 'author', label: '저자 (Author)' },
    { value: 'editor', label: '편집자 (Editor)' },
    { value: 'translator', label: '번역자 (Translator)' },
    { value: 'illustrator', label: '일러스트레이터 (Illustrator)' },
    { value: 'photographer', label: '사진작가 (Photographer)' },
    { value: 'designer', label: '디자이너 (Designer)' },
    { value: 'reviewer', label: '검토자 (Reviewer)' },
    { value: 'contributor', label: '기여자 (Contributor)' },
    { value: 'publisher', label: '출판사 (Publisher)' },
    { value: 'copyright-holder', label: '저작권자 (Copyright Holder)' }
  ];

  const handleConfirm = () => {
    const finalType = useCustomType ? customType.trim() : selectedType;
    onConfirm(finalType);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="role-modal-overlay" onClick={handleCancel}>
      <div className="role-modal" onClick={(e) => e.stopPropagation()}>
        <div className="role-modal-header">
          <h3>Role 태그 추가</h3>
          <button className="close-btn" onClick={handleCancel}>×</button>
        </div>
        
        <div className="role-modal-content">
          <div className="selected-text">
            <strong>선택된 텍스트:</strong>
            <div className="text-preview">"{selectedText}"</div>
          </div>
          
          <div className="role-type-section">
            <label>Role 타입 선택:</label>
            
            <div className="type-options">
              <div className="predefined-types">
                <label>
                  <input
                    type="radio"
                    name="roleType"
                    checked={!useCustomType}
                    onChange={() => setUseCustomType(false)}
                  />
                  미리 정의된 타입
                </label>
                
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  disabled={useCustomType}
                  className="type-select"
                >
                  {predefinedTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="custom-type">
                <label>
                  <input
                    type="radio"
                    name="roleType"
                    checked={useCustomType}
                    onChange={() => setUseCustomType(true)}
                  />
                  커스텀 타입
                </label>
                
                <input
                  type="text"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="커스텀 role 타입 입력"
                  disabled={!useCustomType}
                  className="custom-type-input"
                />
              </div>
            </div>
          </div>
          
          <div className="preview-section">
            <strong>미리보기:</strong>
            <div className="tag-preview">
              {useCustomType && customType.trim() ? (
                `<role type="${customType.trim()}">${selectedText}</role>`
              ) : (
                `<role type="${selectedType}">${selectedText}</role>`
              )}
            </div>
          </div>
        </div>
        
        <div className="role-modal-footer">
          <button className="cancel-btn" onClick={handleCancel}>
            취소
          </button>
          <button 
            className="confirm-btn" 
            onClick={handleConfirm}
            disabled={useCustomType && !customType.trim()}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleTypeModal;

