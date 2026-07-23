import { useEffect, useState } from 'react'
import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLiga } from '../../context/LigaContext'
import { getLigaById, getMiRolEnLiga } from '../../services/ligas.service'
import { getMiJugador } from '../../services/jugadores.service'
import { Button } from '@/components/ui/button'
import ModalVinculacion from '../../components/liga/ModalVinculacion'

export default function LigaLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ligaActiva, setLigaActiva, setJugadorActual } = useLiga()

  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarModalVinculacion, setMostrarModalVinculacion] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setMostrarModalVinculacion(false)

    async function cargarLiga() {
      try {
        const needsFetch = !ligaActiva || ligaActiva.id !== id
        const liga = needsFetch ? await getLigaById(id) : ligaActiva
        if (needsFetch) setLigaActiva(liga)

        const [miRol, miJugador] = await Promise.all([
          getMiRolEnLiga(id, user.id),
          getMiJugador(id, user.id),
        ])

        setRol(miRol)
        setJugadorActual(miJugador)
        if (!miJugador) setMostrarModalVinculacion(true)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (user) cargarLiga()
  }, [id, user])

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-muted-foreground">Cargando liga...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  const esTorneo = ligaActiva?.tipo === 'torneo'

  const tabs = [
    esTorneo
      ? { to: `/liga/${id}/torneo`, label: 'Torneo', icon: '🏆' }
      : { to: `/liga/${id}/clasificacion`, label: 'Clasificación', icon: '🏆' },
    { to: `/liga/${id}/partidos`, label: 'Partidos', icon: '🎾' },
    { to: `/liga/${id}/perfil`, label: 'Mi perfil', icon: '👤' },
    ...(rol === 'admin'
      ? [{ to: `/liga/${id}/config`, label: 'Config', icon: '⚙️' }]
      : []),
  ]

  return (
    <div className="flex flex-col h-[100dvh] max-w-md mx-auto bg-gray-50">
      <header className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-primary shrink-0"
          onClick={() => navigate('/mis-ligas')}
        >
          ← Mis ligas
        </Button>
        <h1 className="flex-1 text-base font-bold text-gray-900 truncate text-center">
          {ligaActiva?.nombre}
        </h1>
        {/* spacer to visually center the title */}
        <div className="shrink-0 w-[80px]" />
      </header>

      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>

      <nav className="flex bg-white border-t border-gray-100 shrink-0 pb-safe">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-14 no-underline transition-colors',
                isActive
                  ? 'text-primary border-t-2 border-primary'
                  : 'text-gray-400 border-t-2 border-transparent',
              ].join(' ')
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="text-[11px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </nav>

      {mostrarModalVinculacion && (
        <ModalVinculacion
          ligaId={id}
          userId={user.id}
          onVinculado={(jugador) => {
            setJugadorActual(jugador)
            setMostrarModalVinculacion(false)
          }}
        />
      )}
    </div>
  )
}
