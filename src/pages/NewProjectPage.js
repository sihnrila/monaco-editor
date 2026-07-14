import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './NewProjectPage.css';

const NewProjectPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: '',
    owner: user?.id || 0,
    memberships: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateSlug = () => {
    // 랜덤한 slug 생성 (API 스펙에 맞는 형태)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 100; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenerateSlug = () => {
    setFormData(prev => ({
      ...prev,
      slug: generateSlug()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 필수 필드 검증
      if (!formData.title.trim()) {
        throw new Error('프로젝트 제목을 입력해주세요.');
      }

      if (!formData.slug.trim()) {
        throw new Error('슬러그를 입력하거나 자동 생성해주세요.');
      }

      // API 요청 데이터 준비
      const projectData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        slug: formData.slug.trim(),
        owner: formData.owner,
        memberships: formData.memberships
      };

      console.log('프로젝트 생성 요청:', projectData);
      
      const response = await projectAPI.createProject(projectData);
      console.log('프로젝트 생성 성공:', response);
      
      // 성공 시 프로젝트 목록 페이지로 이동
      navigate('/projects');
    } catch (error) {
      console.error('프로젝트 생성 실패:', error);
      setError(error.message || '프로젝트 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/projects');
  };

  return (
    <div className="new-project-page">
      <div className="new-project-container">
        <div className="new-project-header">
          <h1>새 프로젝트 생성</h1>
          <p>새로운 프로젝트를 생성합니다.</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="new-project-form">
          <div className="form-group">
            <label htmlFor="title">프로젝트 제목 *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="프로젝트 제목을 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">프로젝트 설명</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="프로젝트에 대한 설명을 입력하세요"
              rows="4"
            />
          </div>

          <div className="form-group">
            <label htmlFor="slug">슬러그 *</label>
            <div className="slug-input-group">
              <input
                type="text"
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleInputChange}
                placeholder="프로젝트 슬러그를 입력하거나 자동 생성하세요"
                required
              />
              <button
                type="button"
                onClick={handleGenerateSlug}
                className="generate-slug-btn"
              >
                자동 생성
              </button>
            </div>
            <small>슬러그는 프로젝트의 고유 식별자입니다.</small>
          </div>

          <div className="form-group">
            <label htmlFor="owner">소유자 ID</label>
            <input
              type="number"
              id="owner"
              name="owner"
              value={formData.owner}
              onChange={handleInputChange}
              placeholder="소유자 ID"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-btn"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              className="create-btn"
              disabled={loading}
            >
              {loading ? '생성 중...' : '프로젝트 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectPage;

