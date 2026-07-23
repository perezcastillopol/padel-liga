import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useLiga } from '../../../context/LigaContext'
import { getMiRolEnLiga } from '../../../services/ligas.service'
import { getParticipantes, getRondaActual, getPartidosRonda } from '../../../services/torneo.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ── Helpers ───────────────────────────────────────────────────────────────────

function estadoColor(derrotas, maxDerrotas) {
  if (derrotas >= maxDerrotas) return 'red'
  if (derrotas === maxDerrotas - 1) return 'orange'
  return 'green'
}

const COLOR_FONDO = {
  green: 'bg-green-50 border-green-100',
  orange: 'bg-orange-50 border-orange-100',
  red: 'bg-red-50 border-red-100',
}

const COLOR_TEXTO = {
  green: 'text-green-800',
  orange: 'text-orange-800',
  red: 'text-red-800',
}

function ordenarPorRendimiento(participantes) {
  return [...participantes].sort((a, b) => {
    if (b.victorias !== a.victorias) return b.victorias - a.victorias
    return a.derrotas - b.derrotas
  })
}

// ── Tabla de clasificación suiza ──────────────────────────────────────────────

function TablaClasificacionSuiza({ participantes, maxDerrotas }) {
  const ordenados = ordenarPorRendimiento(participantes)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clasificación</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem] gap-x-2 items-center px-4 py-2 border-b border-gray-100 min-w-[280px]">
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">#</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase">Jugador</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">V</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">D</span>
        </div>
        {ordenados.map((p, i) => {
          const color = estadoColor(p.derrotas, maxDerrotas)
          return (
            <div
              key={p.id}
              className={`grid grid-cols-[1.5rem_1fr_2.5rem_2.5rem] gap-x-2 items-center px-4 py-2.5 border-b last:border-0 min-w-[280px] ${COLOR_FONDO[color]}`}
            >
              <span className="text-sm font-bold text-gray-400 text-center">{i + 1}</span>
              <span className={`text-sm font-medium truncate ${COLOR_TEXTO[color]}`}>
                {p.jugador?.nombre ?? '—'}
              </span>
              <span className="text-sm text-gray-700 text-center">{p.victorias}</span>
              <span className="text-sm text-gray-700 text-center">{p.derrotas}</span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Lista de partidos de una ronda ───────────────────────────────────────────

function nombresPareja(j1, j2) {
  return [j1?.nombre, j2?.nombre].filter(Boolean).join(' / ') || '—'
}

function ListaPartidosRonda({ partidos }) {
  if (partidos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Aún no hay partidos en esta ronda
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {partidos.map((partido) => (
        <Card key={partido.id}>
          <CardContent className="p-3 flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{nombresPareja(partido.p1j1, partido.p1j2)}</span>
            <span className="text-xs text-gray-400 shrink-0">vs</span>
            <span className="text-sm font-medium truncate text-right">{nombresPareja(partido.p2j1, partido.p2j2)}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Vistas por estado ─────────────────────────────────────────────────────────

function VistaConfiguracion({ esAdmin, ligaId }) {
  const navigate = useNavigate()
  return (
    <Card>
      <CardContent className="text-center py-10 space-y-3">
        <p className="text-4xl">🏆</p>
        <p className="text-sm text-muted-foreground">
          {esAdmin
            ? 'El torneo está en configuración'
            : 'El torneo está siendo configurado por el admin'}
        </p>
        {esAdmin && (
          <Button onClick={() => navigate(`/liga/${ligaId}/torneo/config`)}>
            Gestionar torneo
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function VistaSuiza({ maxDerrotas, participantes, ronda, partidos }) {
  return (
    <div className="space-y-4 pb-4">
      <TablaClasificacionSuiza participantes={participantes} maxDerrotas={maxDerrotas} />
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {ronda ? `Ronda ${ronda.numero}` : 'Ronda actual'}
        </p>
        <ListaPartidosRonda partidos={partidos} />
      </div>
    </div>
  )
}

function VistaRondaExtra({ partidos }) {
  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Ronda extra de desempate para completar los clasificados a playoff.
          </p>
        </CardContent>
      </Card>
      <ListaPartidosRonda partidos={partidos} />
    </div>
  )
}

function VistaPlayoff() {
  return (
    <Card>
      <CardContent className="text-center py-10 space-y-2">
        <p className="text-4xl">🥊</p>
        <p className="text-sm text-muted-foreground">El bracket del playoff está en construcción</p>
      </CardContent>
    </Card>
  )
}

function VistaFinalizado({ participantes }) {
  const ordenados = ordenarPorRendimiento(participantes)
  const ganador = ordenados[0]

  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="text-center py-8 space-y-2">
          <p className="text-4xl">🏆</p>
          <p className="text-sm text-muted-foreground">Campeón del torneo</p>
          <p className="text-xl font-bold text-gray-900">{ganador?.jugador?.nombre ?? '—'}</p>
        </CardContent>
      </Card>
      <TablaClasificacionSuiza participantes={participantes} maxDerrotas={Infinity} />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function TorneoHome() {
  const { user } = useAuth()
  const { ligaActiva } = useLiga()

  const [rol, setRol] = useState(null)
  const [participantes, setParticipantes] = useState([])
  const [ronda, setRonda] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ligaActiva?.id) return

    async function cargar() {
      try {
        setLoading(true)
        setError(null)
        const estado = ligaActiva.torneo_estado

        const [miRol, listaParticipantes] = await Promise.all([
          getMiRolEnLiga(ligaActiva.id, user.id),
          estado === 'configuracion' ? Promise.resolve([]) : getParticipantes(ligaActiva.id),
        ])
        setRol(miRol)
        setParticipantes(listaParticipantes)

        if (estado === 'suiza' || estado === 'ronda_extra') {
          const tipoRonda = estado === 'suiza' ? 'suiza' : 'extra'
          const rondaActual = await getRondaActual(ligaActiva.id, tipoRonda)
          setRonda(rondaActual)
          setPartidos(rondaActual ? await getPartidosRonda(ligaActiva.id, rondaActual.id) : [])
        } else {
          setRonda(null)
          setPartidos([])
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id, ligaActiva?.torneo_estado, user.id])

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando torneo...</p>
  }
  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }
  if (!ligaActiva) return null

  switch (ligaActiva.torneo_estado) {
    case 'configuracion':
      return <VistaConfiguracion esAdmin={rol === 'admin'} ligaId={ligaActiva.id} />
    case 'suiza':
      return (
        <VistaSuiza
          maxDerrotas={ligaActiva.torneo_max_derrotas}
          participantes={participantes}
          ronda={ronda}
          partidos={partidos}
        />
      )
    case 'ronda_extra':
      return <VistaRondaExtra partidos={partidos} />
    case 'playoff':
      return <VistaPlayoff />
    case 'finalizado':
      return <VistaFinalizado participantes={participantes} />
    default:
      return <VistaConfiguracion esAdmin={rol === 'admin'} ligaId={ligaActiva.id} />
  }
}
