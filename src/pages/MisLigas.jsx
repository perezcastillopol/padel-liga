import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLiga } from '../context/LigaContext'
import { getMisLigas, crearLiga, unirseConCodigo } from '../services/ligas.service'
import { signOut } from '../services/auth.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

// ── Modal crear liga ──────────────────────────────────────────────────────────

const TIPOS_LIGA = [
  {
    tipo: 'estandar',
    icono: '🏅',
    titulo: 'Liga estándar',
    descripcion: 'Clasificación continua con puntos acumulados',
  },
  {
    tipo: 'torneo',
    icono: '🏆',
    titulo: 'Torneo',
    descripcion: 'Fase suiza + playoff double elimination',
  },
]

function ModalCrearLiga({ onClose, onCreada }) {
  const { user } = useAuth()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState('estandar')
  const [configAbierta, setConfigAbierta] = useState(false)
  const [ptsVictoria, setPtsVictoria] = useState(3)
  const [ptsDerrota, setPtsDerrota] = useState(1)
  const [ptsNoFinalizado, setPtsNoFinalizado] = useState(1.5)
  const [maxJugadores, setMaxJugadores] = useState(8)
  const [maxDerrotas, setMaxDerrotas] = useState(2)
  const [adminJuega, setAdminJuega] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return

    if (tipo === 'torneo') {
      const jugadores = Number(maxJugadores)
      const derrotas = Number(maxDerrotas)
      if (!Number.isInteger(jugadores) || jugadores < 8 || jugadores % 4 !== 0) {
        setError('El número de jugadores debe ser múltiplo de 4 y mínimo 8')
        return
      }
      if (!Number.isInteger(derrotas) || derrotas < 1) {
        setError('Las derrotas para eliminar deben ser como mínimo 1')
        return
      }
    }

    try {
      setLoading(true)
      setError(null)
      const liga = await crearLiga(user.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        tipo,
        config: {
          pts_victoria: Number(ptsVictoria),
          pts_derrota: Number(ptsDerrota),
          pts_no_finalizado: Number(ptsNoFinalizado),
        },
        torneoConfig: {
          max_jugadores: Number(maxJugadores),
          max_derrotas: Number(maxDerrotas),
          admin_juega: adminJuega,
        },
      })
      onCreada(liga)
    } catch (err) {
      setError(err.message || 'Error al crear la liga')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-5">Crear liga</h2>
        <form onSubmit={handleSubmit}>
          <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Tipo de liga
          </span>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {TIPOS_LIGA.map((opcion) => (
              <button
                key={opcion.tipo}
                type="button"
                onClick={() => setTipo(opcion.tipo)}
                className={`text-left rounded-xl border-2 px-3 py-3 transition-colors ${
                  tipo === opcion.tipo
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{opcion.icono}</span>
                <p className="text-sm font-semibold text-gray-900 mt-1">{opcion.titulo}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opcion.descripcion}</p>
              </button>
            ))}
          </div>

          <label htmlFor="crear-nombre" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Nombre de la liga *
          </label>
          <input
            id="crear-nombre"
            name="crear-nombre"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Mi liga de pádel"
            autoFocus
            required
          />

          <label htmlFor="crear-descripcion" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-4">
            Descripción
          </label>
          <textarea
            id="crear-descripcion"
            name="crear-descripcion"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y min-h-[72px]"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
          />

          {tipo === 'torneo' && (
            <div className="bg-gray-50 rounded-lg px-3.5 py-3 mt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Configuración del torneo
              </p>
              <div>
                <label htmlFor="crear-max-jugadores" className="block text-xs font-semibold text-gray-500 mb-1">
                  Número de jugadores
                </label>
                <input
                  id="crear-max-jugadores"
                  name="crear-max-jugadores"
                  className="w-20 px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                  type="number" min="8" step="4"
                  value={maxJugadores}
                  onChange={(e) => setMaxJugadores(e.target.value)}
                />
                <p className="text-[11px] text-gray-400 mt-0.5">Debe ser múltiplo de 4, mínimo 8</p>
              </div>
              <div>
                <label htmlFor="crear-max-derrotas" className="block text-xs font-semibold text-gray-500 mb-1">
                  Derrotas para eliminar
                </label>
                <input
                  id="crear-max-derrotas"
                  name="crear-max-derrotas"
                  className="w-20 px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                  type="number" min="1" step="1"
                  value={maxDerrotas}
                  onChange={(e) => setMaxDerrotas(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label htmlFor="crear-admin-juega" className="text-xs font-semibold text-gray-500">
                  El admin participa como jugador
                </label>
                <input
                  id="crear-admin-juega"
                  name="crear-admin-juega"
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={adminJuega}
                  onChange={(e) => setAdminJuega(e.target.checked)}
                />
              </div>
            </div>
          )}

          {tipo === 'estandar' && (
            <>
              <button
                type="button"
                className="mt-4 text-xs font-semibold text-gray-500 bg-transparent border-none cursor-pointer p-0"
                onClick={() => setConfigAbierta((v) => !v)}
              >
                {configAbierta ? '▲' : '▼'} Configuración inicial
              </button>

              {configAbierta && (
                <div className="bg-gray-50 rounded-lg px-3.5 py-3 mt-2.5 space-y-2">
                  <div>
                    <label htmlFor="crear-pts-victoria" className="block text-xs font-semibold text-gray-500 mb-1">Puntos por victoria</label>
                    <input
                      id="crear-pts-victoria"
                      name="crear-pts-victoria"
                      className="w-20 px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                      type="number" min="0" step="0.5"
                      value={ptsVictoria}
                      onChange={(e) => setPtsVictoria(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="crear-pts-derrota" className="block text-xs font-semibold text-gray-500 mb-1">Puntos por derrota</label>
                    <input
                      id="crear-pts-derrota"
                      name="crear-pts-derrota"
                      className="w-20 px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                      type="number" min="0" step="0.5"
                      value={ptsDerrota}
                      onChange={(e) => setPtsDerrota(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="crear-pts-nf" className="block text-xs font-semibold text-gray-500 mb-1">Puntos por no finalizado</label>
                    <input
                      id="crear-pts-nf"
                      name="crear-pts-nf"
                      className="w-20 px-2.5 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary"
                      type="number" min="0" step="0.5"
                      value={ptsNoFinalizado}
                      onChange={(e) => setPtsNoFinalizado(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {error && <p className="text-destructive text-sm mt-3">{error}</p>}

          <div className="flex gap-2 justify-end mt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !nombre.trim()}>
              {loading ? 'Creando...' : 'Crear liga'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal código de invitación ────────────────────────────────────────────────

function ModalCodigo({ liga, onClose }) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiar() {
    await navigator.clipboard.writeText(liga.codigo_invitacion)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-2">¡Liga creada!</h2>
        <p className="text-sm text-gray-500 mb-1">
          Comparte este código con los jugadores que quieras invitar a{' '}
          <strong className="text-gray-800">{liga.nombre}</strong>:
        </p>
        <div className="text-3xl font-bold tracking-[0.5em] text-gray-900 bg-gray-100 rounded-xl py-4 px-6 my-4 inline-block w-full">
          {liga.codigo_invitacion}
        </div>
        <Button variant="outline" className="w-full" onClick={handleCopiar}>
          {copiado ? '¡Copiado!' : 'Copiar código'}
        </Button>
        <Button className="w-full mt-2.5" onClick={onClose}>
          Entendido
        </Button>
      </div>
    </div>
  )
}

// ── Modal unirse con código ───────────────────────────────────────────────────

function ModalUnirse({ onClose, onUnido }) {
  const { user } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (codigo.length !== 6) return
    try {
      setLoading(true)
      setError(null)
      const liga = await unirseConCodigo(user.id, codigo)
      onUnido(liga)
    } catch (err) {
      setError(err.message || 'Error al unirse a la liga')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-5">Unirme con código</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="unirse-codigo" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Código de invitación
          </label>
          <input
            id="unirse-codigo"
            name="unirse-codigo"
            className="w-full px-3 py-3 text-xl font-bold text-center border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase tracking-[0.4em]"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="XXXXXX"
            maxLength={6}
            autoFocus
          />
          {error && <p className="text-destructive text-sm mt-3">{error}</p>}
          <div className="flex gap-2 justify-end mt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || codigo.length !== 6}>
              {loading ? 'Uniéndome...' : 'Unirme'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card de liga ──────────────────────────────────────────────────────────────

const TORNEO_ESTADO_LABEL = {
  configuracion: 'En configuración',
  suiza: 'Fase suiza',
  ronda_extra: 'Ronda extra',
  playoff: 'Playoff',
  finalizado: 'Finalizado',
}

function LigaCard({ liga, onEntrar }) {
  const esTorneo = liga.tipo === 'torneo'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{liga.nombre}</CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant={esTorneo ? 'outline' : 'secondary'}>
              {esTorneo ? '🏆 Torneo' : '🏅 Liga'}
            </Badge>
            <Badge variant={liga.rol === 'admin' ? 'default' : 'secondary'}>
              {liga.rol === 'admin' ? 'Admin' : 'Jugador'}
            </Badge>
          </div>
        </div>
        {liga.descripcion && (
          <CardDescription>{liga.descripcion}</CardDescription>
        )}
      </CardHeader>
      <CardFooter className="justify-between">
        <span className="text-xs text-muted-foreground">
          {esTorneo
            ? (TORNEO_ESTADO_LABEL[liga.torneo_estado] ?? '—')
            : `${liga.num_miembros ?? '—'} ${liga.num_miembros === 1 ? 'miembro' : 'miembros'}`}
        </span>
        <Button size="sm" onClick={() => onEntrar(liga)}>
          Entrar →
        </Button>
      </CardFooter>
    </Card>
  )
}

// ── FAB (botón flotante) ──────────────────────────────────────────────────────

function FAB({ onCrear, onUnirse }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="fixed inset-x-0 bottom-0 h-0 pointer-events-none z-40">
      <div className="max-w-md mx-auto h-0 relative">
        <div className="absolute bottom-6 right-6 pointer-events-auto flex flex-col items-end gap-2.5">
          {abierto && (
            <>
              <Button
                variant="secondary"
                className="shadow-md whitespace-nowrap"
                onClick={() => { setAbierto(false); onCrear() }}
              >
                Crear liga
              </Button>
              <Button
                variant="secondary"
                className="shadow-md whitespace-nowrap"
                onClick={() => { setAbierto(false); onUnirse() }}
              >
                Unirme con código
              </Button>
            </>
          )}
          <Button
            className="size-14 rounded-full text-2xl font-light shadow-xl"
            onClick={() => setAbierto((v) => !v)}
          >
            {abierto ? '✕' : '+'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function MisLigas() {
  const { user } = useAuth()
  const { setLigaActiva } = useLiga()
  const navigate = useNavigate()

  const [ligas, setLigas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modal, setModal] = useState(null) // 'crear' | 'unirse' | 'codigo'
  const [ligaRecienCreada, setLigaRecienCreada] = useState(null)

  async function cargarLigas() {
    try {
      setError(null)
      const data = await getMisLigas(user.id)
      setLigas(data)
    } catch (err) {
      setError('No se pudieron cargar las ligas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarLigas()
  }, [user.id])

  function handleEntrar(liga) {
    setLigaActiva(liga)
    navigate(`/liga/${liga.id}`)
  }

  function handleLigaCreada(liga) {
    setLigaRecienCreada(liga)
    setModal('codigo')
    cargarLigas()
  }

  function handleLigaUnido() {
    setModal(null)
    cargarLigas()
  }

  function handleCerrarCodigo() {
    setModal(null)
    setLigaRecienCreada(null)
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Mis ligas</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {ligas.length === 0 ? (
          <div className="text-center mt-20">
            <p className="text-base text-gray-400 mb-6">
              Aún no formas parte de ninguna liga
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => setModal('crear')}>Crear liga</Button>
              <Button variant="outline" onClick={() => setModal('unirse')}>
                Unirme con código
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {ligas.map((liga) => (
              <LigaCard key={liga.id} liga={liga} onEntrar={handleEntrar} />
            ))}
          </div>
        )}
      </main>

      {ligas.length > 0 && (
        <FAB onCrear={() => setModal('crear')} onUnirse={() => setModal('unirse')} />
      )}

      {modal === 'crear' && (
        <ModalCrearLiga onClose={() => setModal(null)} onCreada={handleLigaCreada} />
      )}
      {modal === 'codigo' && ligaRecienCreada && (
        <ModalCodigo liga={ligaRecienCreada} onClose={handleCerrarCodigo} />
      )}
      {modal === 'unirse' && (
        <ModalUnirse onClose={() => setModal(null)} onUnido={handleLigaUnido} />
      )}
    </div>
  )
}
