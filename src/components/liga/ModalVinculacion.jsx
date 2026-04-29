import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getJugadoresNoVinculados,
  vincularJugador,
  crearYVincularJugador,
} from '../../services/jugadores.service'

export default function ModalVinculacion({ ligaId, userId, onVinculado }) {
  const [jugadoresLibres, setJugadoresLibres] = useState([])
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [cargando, setCargando] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const jugadores = await getJugadoresNoVinculados(ligaId)
        setJugadoresLibres(jugadores)
      } catch (err) {
        setError('No se pudieron cargar los jugadores')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [ligaId])

  async function handleVincular() {
    if (!jugadorSeleccionado) return
    try {
      setLoading(true)
      setError(null)
      const jugador = await vincularJugador(jugadorSeleccionado, userId)
      onVinculado(jugador)
    } catch (err) {
      setError(err.message || 'Error al vincular jugador')
      setLoading(false)
    }
  }

  async function handleCrearNuevo(e) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return
    try {
      setLoading(true)
      setError(null)
      const jugador = await crearYVincularJugador(ligaId, userId, nuevoNombre.trim())
      onVinculado(jugador)
    } catch (err) {
      setError(err.message || 'Error al crear jugador')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">¿Quién eres en esta liga?</h2>
          <p className="text-sm text-muted-foreground mt-1">Identifícate para continuar</p>
        </div>

        {cargando ? (
          <p className="text-sm text-muted-foreground text-center py-4">Cargando jugadores...</p>
        ) : (
          <>
            {/* Sección: jugador existente */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Soy uno de estos jugadores</p>
              {jugadoresLibres.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay jugadores sin asignar en esta liga
                </p>
              ) : (
                <>
                  <Select
                    value={jugadorSeleccionado}
                    onValueChange={setJugadorSeleccionado}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona tu nombre..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jugadoresLibres.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    onClick={handleVincular}
                    disabled={loading || !jugadorSeleccionado}
                  >
                    {loading && jugadorSeleccionado ? 'Confirmando...' : 'Confirmar'}
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3 my-5">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground font-medium">o</span>
              <Separator className="flex-1" />
            </div>

            {/* Sección: nuevo jugador */}
            <form onSubmit={handleCrearNuevo} className="space-y-3">
              <p className="text-sm font-semibold text-gray-700">Soy nuevo en esta liga</p>
              <Input
                placeholder="Tu nombre completo"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                disabled={loading}
                className="h-10"
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={loading || !nuevoNombre.trim()}
              >
                {loading && nuevoNombre.trim() ? 'Uniéndome...' : 'Unirme como nuevo jugador'}
              </Button>
            </form>
          </>
        )}

        {error && <p className="text-destructive text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}
