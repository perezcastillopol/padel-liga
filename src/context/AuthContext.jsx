import { createContext, useContext, useEffect, useState } from 'react'
import { getSession, onAuthStateChange, getPuedeCrearLiga } from '../services/auth.service'

const AuthContext = createContext(null)

async function construirUsuario(sessionUser) {
  if (!sessionUser) return null
  const puede_crear_liga = await getPuedeCrearLiga(sessionUser.id)
  return { ...sessionUser, puede_crear_liga }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function initSession() {
      const s = await getSession()
      setSession(s)
      setUser(await construirUsuario(s?.user ?? null))
      setLoading(false)
    }
    initSession()

    const subscription = onAuthStateChange(async (s) => {
      setSession(s)
      setUser(await construirUsuario(s?.user ?? null))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
