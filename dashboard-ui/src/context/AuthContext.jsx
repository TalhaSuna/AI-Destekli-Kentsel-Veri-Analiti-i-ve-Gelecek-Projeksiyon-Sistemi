import { createContext, useContext, useState, useCallback } from 'react'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:8090'
const TOKEN_KEY = 'kentsel_token'

const AuthContext = createContext(null)

function parseJWT(token) {
  try {
    const payload = token.split('.')[1]
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

function isExpired(claims) {
  if (!claims?.exp) return true
  return Date.now() / 1000 > claims.exp
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) return null
    const claims = parseJWT(stored)
    return isExpired(claims) ? null : stored
  })

  const claims = token ? parseJWT(token) : null

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok || !data.token) throw new Error(data.error || 'Giriş başarısız')
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }, [])

  const hasPermission = useCallback(
    (perm) => claims?.permissions?.includes(perm) ?? false,
    [claims]
  )

  return (
    <AuthContext.Provider value={{ token, claims, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
