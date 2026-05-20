const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const token = getToken();
  const init = { method, headers: { ...headers } };

  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, init);
  if (raw) return res;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    let message = data?.error || `Request failed: ${res.status}`;
    if (res.status === 413) {
      message = data?.error || 'File is too large. Try a smaller file (max 512 MB).';
    }
    throw new Error(message);
  }
  return data;
}

async function fetchMediaBlob(fileId) {
  const res = await request(`/api/media/${fileId}`, { raw: true });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to load file');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? decodeURIComponent(match[1]) : null;
  return { blob, filename, mimetype: res.headers.get('Content-Type') || blob.type };
}

export const api = {
  register: (email, password) =>
    request('/api/auth/register', { method: 'POST', body: { email, password } }),
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),
  uploadFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/api/media/upload', { method: 'POST', body: form });
  },
  createJob: (fileId, actionType) =>
    request('/api/jobs', { method: 'POST', body: { fileId, actionType } }),
  listJobs: () => request('/api/jobs'),
  listNotifications: () => request('/api/notifications'),
  markAllNotificationsRead: () =>
    request('/api/notifications/read-all', { method: 'PATCH' }),
  markNotificationRead: (id) =>
    request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  getMediaMeta: (fileId) => request(`/api/media/${fileId}/meta`),
  viewMediaFile: async (fileId, fallbackName) => {
    const { blob, filename, mimetype } = await fetchMediaBlob(fileId);
    const url = URL.createObjectURL(blob);
    const name = filename || fallbackName || 'fluxon-output.txt';
    const isText = mimetype.startsWith('text/') || name.endsWith('.txt');
    if (isText) {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    const canPreview = /^(image|video|audio)\//.test(mimetype) || mimetype === 'application/pdf';
    if (canPreview) {
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  },
  downloadMediaFile: async (fileId, fallbackName) => {
    const { blob, filename } = await fetchMediaBlob(fileId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || fallbackName || 'fluxon-output';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
