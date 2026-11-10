import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'
import {
  requestNotificationPermission,
  startNotificationPolling,
  stopNotificationPolling,
} from '../services/notifications'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)


  useEffect(() => {
    const token = localStorage.getItem('token')
    if (user && user.role === 'user' && token) {

      requestNotificationPermission().then((granted) => {
        if (granted) startNotificationPolling(user.id)
      })
    } else {
      stopNotificationPolling()
    }
    return () => stopNotificationPolling()
  }, [user?.id])

  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { access_token, user: u } = res.data
    localStorage.setItem('token', access_token)
    localStorage.setItem('user', JSON.stringify(u))
    setUser(u)
    return u
  }

  const register = async (name, email, password) => {
    await api.post('/api/auth/register', { name, email, password })
  }

  const logout = () => {
    stopNotificationPolling()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
