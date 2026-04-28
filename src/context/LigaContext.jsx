import { createContext, useContext, useState } from 'react'

const LigaContext = createContext(null)

export function LigaProvider({ children }) {
  const [ligaActiva, setLigaActiva] = useState(null)

  return (
    <LigaContext.Provider value={{ ligaActiva, setLigaActiva }}>
      {children}
    </LigaContext.Provider>
  )
}

export function useLiga() {
  const context = useContext(LigaContext)
  if (!context) throw new Error('useLiga must be used within LigaProvider')
  return context
}
