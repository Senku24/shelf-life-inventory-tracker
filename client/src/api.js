const TOKEN_KEY = 'shelflife_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // An expired or tampered token should drop the session rather than loop on 401s.
    if (res.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('shelflife:unauthorized'))
    }
    throw new ApiError(data.message || `Request failed (${res.status})`, res.status)
  }
  return data
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),

  createHousehold: (name) => request('/households', { method: 'POST', body: { name } }),
  joinHousehold: (inviteCode) => request('/households/join', { method: 'POST', body: { inviteCode } }),
  myHousehold: () => request('/households/me'),
  members: (id) => request(`/households/${id}/members`),
  leaveHousehold: () => request('/households/leave', { method: 'POST' }),

  items: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString()
    return request(`/items${qs ? `?${qs}` : ''}`)
  },
  addItem: (body) => request('/items', { method: 'POST', body }),
  updateItem: (id, body) => request(`/items/${id}`, { method: 'PUT', body }),
  setItemStatus: (id, status) => request(`/items/${id}/status`, { method: 'PATCH', body: { status } }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),

  stats: () => request('/dashboard/stats'),
  expiring: () => request('/dashboard/expiring'),
  leaderboard: () => request('/dashboard/leaderboard'),
}
