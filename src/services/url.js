// URL helpers to centralize base URL management for assets (css/img/link)

const DEFAULT_ASSET_ORIGIN = process.env.REACT_APP_ASSET_ORIGIN || 'https://lib-editor.boinit.com';

const ensureTrailingSlash = (value) => {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
};

export const getAssetOrigin = () => {
  const override = localStorage.getItem('asset-origin');
  return (override && override.trim()) || DEFAULT_ASSET_ORIGIN;
};

export const setAssetOrigin = (origin) => {
  if (origin) {
    localStorage.setItem('asset-origin', origin);
  } else {
    localStorage.removeItem('asset-origin');
  }
};

export const getWorkspaceBaseUrl = (bookId) => {
  const origin = getAssetOrigin();
  // bookId may be slug or id; we just compose path
  return ensureTrailingSlash(`${origin}/assets/${bookId}/workspace`);
};

export const getConfiguredWorkspaceBaseUrl = (bookId) => {
  // Backward compatibility: support both keys
  const override = localStorage.getItem('workspace-base-url') || localStorage.getItem('base-url');
  if (override && override.trim()) {
    return ensureTrailingSlash(override.trim());
  }
  return getWorkspaceBaseUrl(bookId);
};

export const setWorkspaceBaseUrl = (url) => {
  if (url) {
    localStorage.setItem('workspace-base-url', url);
  } else {
    localStorage.removeItem('workspace-base-url');
  }
};

export default {
  getAssetOrigin,
  setAssetOrigin,
  getWorkspaceBaseUrl,
  getConfiguredWorkspaceBaseUrl,
  setWorkspaceBaseUrl
};


