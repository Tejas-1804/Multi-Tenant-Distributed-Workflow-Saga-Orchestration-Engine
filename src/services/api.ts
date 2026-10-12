import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token and target tenant header
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const targetTenantId = localStorage.getItem('targetTenantId');
  if (targetTenantId) {
    config.headers['x-target-tenant-id'] = targetTenantId;
  }

  return config;
});

// Response interceptor to handle errors cleanly
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      // Optional auto-redirect or clear stale token
    }
    return Promise.reject(error);
  }
);

export default api;
