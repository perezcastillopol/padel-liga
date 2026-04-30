import { useEffect, useState } from 'react'
import { useLiga } from '../../context/LigaContext'
import { calcularClasificacion } from '../../services/clasificacion.service'
import { getPartidosJugador, calcularEstadisticasPersonales } from '../../services/perfil.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function ordinal(n) {
  return `${n}º`
}

function resultadoParaJugador(partido, jugadorId) {
  if (!jugadorId) return 'neutro'
  const enP1 = partido.p1_jugador1_id === jugadorId || partido.p1_jugador2_id === jugadorId
  const enP2 = partido.p2_jugador1_id === jugadorId || partido.p2_jugador2_id === jugadorId
  if (!enP1 && !enP2) return 'neutro'
  if (partido.resultado === 'no_finalizado') return 'no_finalizado'
  const ganoP1 = partido.resultado === 'pareja1'
  if ((enP1 && ganoP1) || (enP2 && !ganoP1)) return 'victoria'
  return 'derrota'
}

const COLOR_FONDO = {
  victoria: 'bg-green-50 border-green-200',
  derrota: 'bg-red-50 border-red-200',
  no_finalizado: 'bg-yellow-50 border-yellow-200',
  neutro: 'bg-white border-gray-200',
}

function resultadoBadge(partido) {
  const p1 = [partido.p1j1?.nombre, partido.p1j2?.nombre].filter(Boolean).join(' / ')
  const p2 = [partido.p2j1?.nombre, partido.p2j2?.nombre].filter(Boolean).join(' / ')
  if (partido.resultado === 'pareja1') return { label: p1, className: 'bg-green-100 text-green-800' }
  if (partido.resultado === 'pareja2') return { label: p2, className: 'bg-red-100 text-red-800' }
  return { label: 'No finalizado', className: 'bg-yellow-100 text-yellow-800' }
}

function setsDisplay(partido) {
  const sets = []
  if (partido.set1_p1 != null) sets.push(`${partido.set1_p1}-${partido.set1_p2}`)
  if (partido.set2_p1 != null) sets.push(`${partido.set2_p1}-${partido.set2_p2}`)
  if (partido.set3_p1 != null) sets.push(`${partido.set3_p1}-${partido.set3_p2}`)
  return sets.join('  ')
}

const METODO_LABEL = {
  puntos_totales: 'Puntos',
  media_puntos: 'Media',
  ratio_sets: 'Sets%',
  media_puntos_minimo: 'Media',
}

function formatValorRanking(valor, metodo) {
  if (valor === null || valor === undefined) return '—'
  if (metodo === 'ratio_sets') return (valor * 100).toFixed(0) + '%'
  if (metodo === 'media_puntos' || metodo === 'media_puntos_minimo') return valor.toFixed(2)
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1)
}

// ── Mini-card de partido ──────────────────────────────────────────────────────

function MiniPartidoCard({ partido, jugadorId }) {
  const res = resultadoParaJugador(partido, jugadorId)
  const colorClass = COLOR_FONDO[res]
  const p1 = [partido.p1j1?.nombre, partido.p1j2?.nombre].filter(Boolean).join(' / ')
  const p2 = [partido.p2j1?.nombre, partido.p2j2?.nombre].filter(Boolean).join(' / ')
  const { label, className } = resultadoBadge(partido)

  return (
    <Card className={`border ${colorClass}`}>
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-1">{formatDate(partido.fecha)}</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {p1} <span className="text-gray-400 font-normal">vs</span> {p2}
            </p>
            <p className="text-base font-bold text-gray-800 mt-1 tracking-wide">
              {setsDisplay(partido)}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${className}`}>
            {label}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Fila de compañero o rival ─────────────────────────────────────────────────

function FilaPersona({ nombre, partidos, pct }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-gray-500">{nombre.charAt(0).toUpperCase()}</span>
      </div>
      <span className="flex-1 text-sm font-medium text-gray-900 truncate">{nombre}</span>
      <span className="text-xs text-gray-400 shrink-0">{partidos}P</span>
      <span className="text-sm font-bold text-gray-700 shrink-0 w-10 text-right">{pct}%</span>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function MiPerfil() {
  const { ligaActiva, jugadorActual } = useLiga()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [entrada, setEntrada] = useState(null)
  const [ultimosPartidos, setUltimosPartidos] = useState([])

  useEffect(() => {
    if (!ligaActiva?.id || !jugadorActual?.id) {
      setLoading(false)
      return
    }

    async function cargar() {
      try {
        setLoading(true)
        const [partidos, tabla] = await Promise.all([
          getPartidosJugador(ligaActiva.id, jugadorActual.id),
          calcularClasificacion(ligaActiva.id, ligaActiva),
        ])

        setStats(calcularEstadisticasPersonales(partidos, jugadorActual.id))
        setEntrada(tabla.find((e) => e.jugadorId === jugadorActual.id) ?? null)
        setUltimosPartidos(partidos.slice(0, 5))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id, jugadorActual?.id])

  if (!jugadorActual) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">👤</p>
        <p className="text-sm text-muted-foreground">Identifícate primero para ver tu perfil</p>
      </div>
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando perfil...</p>
  }

  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }

  const metodo = ligaActiva?.metodo_ranking ?? 'puntos_totales'

  return (
    <div className="space-y-4 pb-4">

      {/* ── Sección 1: Resumen ── */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex flex-col items-center gap-2 mb-5">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-green-700">
                {jugadorActual.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{jugadorActual.nombre}</h2>
            {entrada && !entrada.sinRanking && (
              <Badge variant="secondary" className="text-sm font-semibold">
                {ordinal(entrada.posicion)} en el ranking
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'PJ', value: stats?.totalPartidos ?? 0 },
              { label: 'V', value: stats?.victorias ?? 0 },
              { label: 'D', value: stats?.derrotas ?? 0 },
              { label: 'NF', value: stats?.noFinalizados ?? 0 },
              { label: '% V *', value: stats ? `${stats.porcentajeVictorias}%` : '—' },
              {
                label: METODO_LABEL[metodo],
                value: entrada ? formatValorRanking(entrada.valorRanking, metodo) : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-right">* sobre partidos decididos</p>
        </CardContent>
      </Card>

      {/* ── Sección 2: Mejores compañeros ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mejores compañeros</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!stats || stats.compañeros.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aún no hay datos suficientes</p>
          ) : (
            stats.compañeros.map((c) => (
              <FilaPersona key={c.id} nombre={c.nombre} partidos={c.partidos} pct={c.pct} />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Sección 3: Rivales ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rivales</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {!stats || stats.rivales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aún no hay datos suficientes</p>
          ) : (
            stats.rivales.map((r) => (
              <FilaPersona key={r.id} nombre={r.nombre} partidos={r.partidos} pct={r.pct} />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Sección 4: Últimos partidos ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos partidos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {ultimosPartidos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No has jugado ningún partido aún</p>
          ) : (
            ultimosPartidos.map((p) => (
              <MiniPartidoCard key={p.id} partido={p} jugadorId={jugadorActual.id} />
            ))
          )}
        </CardContent>
      </Card>

    </div>
  )
}
