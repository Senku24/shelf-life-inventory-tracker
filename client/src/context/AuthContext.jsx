import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken, clearToken, getToken } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      return null
    }
    try {
      const { user: fresh } = await api.me()
      setUser(fresh)
      return fresh
    } catch {
      clearToken()
      setUser(null)
      return null
    }
  }, [])

  // Restore the session on reload so a refresh doesn't bounce you to /login.
  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // api.js fires this when the server rejects our token mid-session.
  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('shelflife:unauthorized', onUnauthorized)
    return () => window.removeEventListener('shelflife:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (email, password) => {
    const { token, user: authed } = await api.login({ email, password })
    setToken(token)
    setUser(authed)
  }, [])

  const register = useCallback(async (name, email, password) => {
    const { token, user: created } = await api.register({ name, email, password })
    setToken(token)
    setUser(created)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, setUser }),
    [user, loading, login, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
