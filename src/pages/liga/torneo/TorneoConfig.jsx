import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useLiga } from '../../../context/LigaContext'
import { getJugadoresLiga } from '../../../services/jugadores.service'
import {
  getParticipantes,
  inscribirJugador,
  desinscribirJugador,
  iniciarTorneo,
} from '../../../services/torneo.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function TorneoConfig() {
  const { user } = useAuth()
  const { ligaActiva, setLigaActiva } = useLiga()
  const navigate = useNavigate()

  const [jugadores, setJugadores] = useState([])
  const [participantes, setParticipantes] = useState([])
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [iniciando, setIniciando] = useState(false)

  useEffect(() => {
    if (!ligaActiva?.id) return

    async function cargar() {
      try {
        setLoading(true)
        setError(null)
        const [todosJugadores, listaParticipantes] = await Promise.all([
          getJugadoresLiga(ligaActiva.id),
          getParticipantes(ligaActiva.id),
        ])
        setJugadores(todosJugadores)
        setParticipantes(listaParticipantes)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id])

  const inscritosIds = new Set(participantes.map((p) => p.jugador_id))
  const disponibles = jugadores.filter((j) => !inscritosIds.has(j.id))
  const maxJugadores = ligaActiva?.torneo_max_jugadores ?? 0
  const faltan = Math.max(0, maxJugadores - participantes.length)

  async function handleInscribir() {
    if (!jugadorSeleccionado) return
    try {
      setError(null)
      await inscribirJugador(ligaActiva.id, jugadorSeleccionado)
      const jugador = jugadores.find((j) => j.id === jugadorSeleccionado)
      setParticipantes((prev) => [
        ...prev,
        { id: jugadorSeleccionado, jugador_id: jugadorSeleccionado, victorias: 0, derrotas: 0, jugador },
      ])
      setJugadorSeleccionado('')
    } catch (err) {
      setError(err.message || 'Error al inscribir el jugador')
    }
  }

  async function handleDesinscribir(jugadorId) {
    try {
      setError(null)
      await desinscribirJugador(ligaActiva.id, jugadorId)
      setParticipantes((prev) => prev.filter((p) => p.jugador_id !== jugadorId))
    } catch (err) {
      setError(err.message || 'Error al quitar el jugador')
    }
  }

  async function handleIniciar() {
    try {
      setIniciando(true)
      setError(null)
      const liga = await iniciarTorneo(ligaActiva.id, user.id)
      setLigaActiva(liga)
      navigate(`/liga/${ligaActiva.id}/torneo`)
    } catch (err) {
      setError(err.message || 'Error al iniciar el torneo')
      setIniciando(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
  }
  if (!ligaActiva) return null

  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuración del torneo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Número de jugadores</span>
            <span className="font-medium">{ligaActiva.torneo_max_jugadores}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Derrotas para eliminar</span>
            <span className="font-medium">{ligaActiva.torneo_max_derrotas}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">El admin participa</span>
            <span className="font-medium">{ligaActiva.torneo_admin_juega ? 'Sí' : 'No'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Jugadores inscritos ({participantes.length}/{maxJugadores})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {participantes.length === 0 && (
            <p className="text-sm text-muted-foreground py-1">Aún no hay jugadores inscritos</p>
          )}

          {participantes.map((p) => (
            <div key={p.jugador_id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 text-sm font-medium">{p.jugador?.nombre ?? '—'}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-gray-300 hover:text-destructive shrink-0"
                onClick={() => handleDesinscribir(p.jugador_id)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          {disponibles.length > 0 ? (
            <div className="flex gap-2 pt-3">
              <Select value={jugadorSeleccionado} onValueChange={setJugadorSeleccionado}>
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue placeholder="Elegir jugador" />
                </SelectTrigger>
                <SelectContent>
                  {disponibles.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="shrink-0 h-9"
                onClick={handleInscribir}
                disabled={!jugadorSeleccionado}
              >
                Inscribir
              </Button>
            </div>
          ) : (
            jugadores.length === 0 && (
              <p className="text-xs text-muted-foreground pt-2">
                Añade jugadores a la liga desde la sección de jugadores para poder inscribirlos
              </p>
            )
          )}

          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      <Button className="w-full" disabled={faltan > 0 || iniciando} onClick={handleIniciar}>
        {iniciando ? 'Iniciando...' : 'Iniciar torneo'}
      </Button>
      {faltan > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Faltan {faltan} {faltan === 1 ? 'jugador' : 'jugadores'} para iniciar
        </p>
      )}
    </div>
  )
}
