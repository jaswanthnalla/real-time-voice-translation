const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || 'Request failed');
  }

  return data.data as T;
}

export const api = {
  createSession(sourceLang: string, targetLang: string) {
    return request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ sourceLang, targetLang }),
    });
  },

  getSession(id: string) {
    return request(`/sessions/${id}`);
  },

  deleteSession(id: string) {
    return request(`/sessions/${id}`, { method: 'DELETE' });
  },

  translate(text: string, sourceLang: string, targetLang: string) {
    return request('/translate', {
      method: 'POST',
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
  },
};
