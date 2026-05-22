import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useLiga } from '../../context/LigaContext'
import { calcularEvolucionRanking } from '../../services/clasificacion.service'
import { Card, CardContent } from '@/components/ui/card'

// ── Constantes ────────────────────────────────────────────────────────────────

const PERIODOS = [
  { label: '1M', semanas: 4 },
  { label: '3M', semanas: 12 },
  { label: '6M', semanas: 24 },
  { label: 'Todo', semanas: 0 },
]

const COLORES = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
  '#ea580c', '#0d9488',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSemana(date) {
  const d = new Date(date)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, jugadoresConColor }) {
  if (!active || !payload?.length) return null
  const jugMap = Object.fromEntries(jugadoresConColor.map((j) => [j.id, j.nombre]))
  const entradas = payload
    .filter((e) => e.value != null)
    .sort((a, b) => (a.value ?? 99) - (b.value ?? 99))
  if (!entradas.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm min-w-[140px]">
      <p className="text-xs font-semibold text-gray-400 mb-1.5">{label}</p>
      {entradas.map((e) => (
        <div key={e.dataKey} className="flex items-center gap-2 py-0.5">
          <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: e.stroke }} />
          <span className="flex-1 text-gray-700 truncate">{jugMap[e.dataKey] ?? e.dataKey}</span>
          <span className="font-bold text-gray-900">#{e.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 pt-1 pb-3 shrink-0 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8 pt-3">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EvolucionRanking() {
  const { ligaActiva, jugadorActual } = useLiga()
  const { id } = useParams()
  const navigate = useNavigate()

  const [periodo, setPeriodo] = useState(12)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [semanasData, setSemanasData] = useState([])
  const [evolutionMap, setEvolutionMap] = useState(new Map())
  const [jugadoresConColor, setJugadoresConColor] = useState([])
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [filtroOpen, setFiltroOpen] = useState(false)

  useEffect(() => {
    if (!ligaActiva?.id) return

    async function cargar() {
      setLoading(true)
      setError(null)
      try {
        const { semanas, evolution } = await calcularEvolucionRanking(ligaActiva.id, ligaActiva, periodo)
        setSemanasData(semanas)
        setEvolutionMap(evolution)

        const lista = Array.from(evolution.entries())
          .map(([jugId, { nombre }]) => ({ id: jugId, nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map((j, idx) => ({ ...j, color: COLORES[idx % COLORES.length] }))
        setJugadoresConColor(lista)
        setSeleccionados((prev) => {
          const nuevosIds = new Set(lista.map((j) => j.id))
          if (prev.size === 0) {
            // Primera carga: seleccionar solo el jugador actual, o todos si no hay
            if (jugadorActual?.id && nuevosIds.has(jugadorActual.id)) {
              return new Set([jugadorActual.id])
            }
            return nuevosIds
          }
          // Cambio de período: preservar selección existente
          const preservados = new Set([...prev].filter((pid) => nuevosIds.has(pid)))
          return preservados.size > 0 ? preservados : nuevosIds
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id, periodo])

  function toggleJugador(jugId) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(jugId)) {
        if (next.size === 1) return prev // al menos uno debe quedar
        next.delete(jugId)
      } else {
        next.add(jugId)
      }
      return next
    })
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(jugadoresConColor.map((j) => j.id)))
  }

  function deseleccionarTodos() {
    const fallback = jugadorActual?.id ?? jugadoresConColor[0]?.id
    setSeleccionados(fallback ? new Set([fallback]) : new Set(jugadoresConColor.map((j) => j.id)))
  }

  const todosSeleccionados = jugadoresConColor.length > 0 && seleccionados.size === jugadoresConColor.length

  const jugadoresFiltrados = jugadoresConColor.filter((j) => seleccionados.has(j.id))
  const maxPosicion = jugadoresConColor.length

  const chartData = semanasData.map((semana, idx) => {
    const point = { semana: formatSemana(semana) }
    for (const j of jugadoresFiltrados) {
      const serie = evolutionMap.get(j.id)?.serie ?? []
      point[j.id] = serie[idx]?.posicion ?? null
    }
    return point
  })

  const hayDatos = chartData.some((point) => jugadoresFiltrados.some((j) => point[j.id] != null))
  const xInterval = semanasData.length > 20 ? 3 : semanasData.length > 10 ? 1 : 0
  const mostrarDots = semanasData.length <= 12

  return (
    <div className="space-y-4 pb-4">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/liga/${id}/clasificacion`)}
          className="text-sm text-blue-600 font-medium shrink-0"
        >
          ← Clasificación
        </button>
        <h2 className="text-base font-bold text-gray-900 truncate">Evolución del ranking</h2>
      </div>

      {/* ── Selector de período ── */}
      <div className="flex gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriodo(p.semanas)}
            className={[
              'flex-1 py-1.5 rounded-full text-sm font-semibold border transition-colors',
              periodo === p.semanas
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Calculando evolución...</p>
      ) : error ? (
        <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
      ) : semanasData.length < 2 || !hayDatos ? (
        <div className="text-center py-16">
          <p className="text-3xl mb-3">📈</p>
          <p className="text-sm text-muted-foreground">
            Aún no hay suficientes partidos para mostrar la evolución
          </p>
        </div>
      ) : (
        <>
          {/* ── Filtro de jugadores ── */}
          <div className="space-y-2">
            <button
              onClick={() => setFiltroOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-full px-3 py-1.5 bg-white hover:border-gray-400 transition-colors"
            >
              <span>Filtrar jugadores</span>
              <span className="text-xs text-gray-400">
                ({seleccionados.size}/{jugadoresConColor.length})
              </span>
            </button>

            {jugadoresConColor.length !== seleccionados.size && (
              <div className="flex flex-wrap gap-1.5">
                {jugadoresFiltrados.map((j) => (
                  <span
                    key={j.id}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                  >
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: j.color }} />
                    {j.nombre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Gráfico ── */}
          <Card>
            <CardContent className="pt-4 pb-2 px-2">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="semana"
                    interval={xInterval}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    reversed
                    domain={[1, maxPosicion]}
                    allowDecimals={false}
                    tickCount={Math.min(maxPosicion, 8)}
                    tickFormatter={(v) => `#${v}`}
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip
                    content={<CustomTooltip jugadoresConColor={jugadoresConColor} />}
                    cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                  />
                  {jugadoresFiltrados.map((j) => (
                    <Line
                      key={j.id}
                      dataKey={j.id}
                      stroke={j.color}
                      strokeWidth={2}
                      dot={mostrarDots ? { r: 3, fill: j.color } : false}
                      activeDot={{ r: 5, fill: j.color }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Leyenda ── */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
            {jugadoresFiltrados.map((j) => (
              <div key={j.id} className="flex items-center gap-1.5">
                <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: j.color }} />
                <span className="text-xs text-gray-600">{j.nombre}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Bottom sheet: filtro de jugadores ── */}
      <BottomSheet
        open={filtroOpen}
        onClose={() => setFiltroOpen(false)}
        title="Seleccionar jugadores"
      >
        <button
          onClick={todosSeleccionados ? deseleccionarTodos : seleccionarTodos}
          className="w-full text-left text-sm font-semibold text-blue-600 py-3 border-b border-gray-100 mb-1"
        >
          {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>

        {jugadoresConColor.map((j) => {
          const activo = seleccionados.has(j.id)
          return (
            <button
              key={j.id}
              onClick={() => toggleJugador(j.id)}
              className="w-full flex items-center gap-3 py-3 border-b border-gray-50 last:border-0 text-left"
            >
              <div
                className={[
                  'size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                  activo ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white',
                ].join(' ')}
              >
                {activo && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
              </div>
              <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: j.color }} />
              <span className="text-sm font-medium text-gray-900">{j.nombre}</span>
            </button>
          )
        })}
      </BottomSheet>

    </div>
  )
}
