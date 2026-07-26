import axios from 'axios';

let apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://') && !apiUrl.startsWith('/')) {
  apiUrl = `https://${apiUrl}`;
}

const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      const isAuthPage = path === '/login' || path === '/register';
      if (!isAuthPage) {
        // Session expired/invalid — clear the middleware's same-origin marker
        // too, otherwise it'll keep letting protected routes through.
        document.cookie = 'sf_authed=; path=/; max-age=0';
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
