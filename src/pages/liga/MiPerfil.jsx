import { useEffect, useState } from 'react'
import { useLiga } from '../../context/LigaContext'
import { calcularClasificacion } from '../../services/clasificacion.service'
import { getPartidosConEstado, calcularEstadisticasPersonales } from '../../services/perfil.service'
import { getParticipacionTorneoJugador, getTodosPartidosTorneo } from '../../services/torneo.service'
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

const RAZON_CORTA = {
  'Fuera de la ventana temporal': 'Fuera de ventana',
  'Supera el máximo de partidos': 'Máx. alcanzado',
  'No está entre los mejores resultados': 'No el mejor',
  'Descartado por ser uno de los peores resultados': 'Entre los peores',
  'Máx. partidos con este compañero alcanzado': 'Límite compañero',
}

// ── Mini-card de partido ──────────────────────────────────────────────────────

function MiniPartidoCard({ partido, jugadorId, computa = true, razonNoComputa = null }) {
  const res = resultadoParaJugador(partido, jugadorId)
  const colorClass = COLOR_FONDO[res]
  const p1 = [partido.p1j1?.nombre, partido.p1j2?.nombre].filter(Boolean).join(' / ')
  const p2 = [partido.p2j1?.nombre, partido.p2j2?.nombre].filter(Boolean).join(' / ')
  const { label, className } = resultadoBadge(partido)

  return (
    <div className={!computa ? 'opacity-40' : ''}>
      <Card className={`border ${colorClass}`}>
        <CardContent className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-gray-400">{formatDate(partido.fecha)}</p>
                {!computa && razonNoComputa && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                    {RAZON_CORTA[razonNoComputa] ?? razonNoComputa}
                  </span>
                )}
              </div>
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
    </div>
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

// ── Bottom sheet ──────────────────────────────────────────────────────────────

function BottomSheet({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 pt-1 pb-3 shrink-0 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-sm"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-8 pt-3 space-y-2">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Página principal (liga estándar) ────────────────────────────────────────

function MiPerfilEstandar() {
  const { ligaActiva, jugadorActual } = useLiga()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [entrada, setEntrada] = useState(null)
  const [ultimosPartidos, setUltimosPartidos] = useState([])
  const [todosPartidosConEstado, setTodosPartidosConEstado] = useState([])
  const [verTodosOpen, setVerTodosOpen] = useState(false)

  useEffect(() => {
    if (!ligaActiva?.id || !jugadorActual?.id) {
      setLoading(false)
      return
    }

    async function cargar() {
      try {
        setLoading(true)
        const [todosConEstado, tabla] = await Promise.all([
          getPartidosConEstado(ligaActiva.id, jugadorActual.id, ligaActiva),
          calcularClasificacion(ligaActiva.id, ligaActiva),
        ])
        const partidos = todosConEstado.map(({ partido }) => partido)
        setStats(calcularEstadisticasPersonales(partidos, jugadorActual.id))
        setEntrada(tabla.find((e) => e.jugadorId === jugadorActual.id) ?? null)
        setUltimosPartidos(partidos.slice(0, 5))
        setTodosPartidosConEstado(todosConEstado)
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
  const partidosQueComputan = todosPartidosConEstado.filter((x) => x.computa)
  const partidosQueNoComputan = todosPartidosConEstado.filter((x) => !x.computa)

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
            <>
              {ultimosPartidos.map((p) => (
                <MiniPartidoCard key={p.id} partido={p} jugadorId={jugadorActual.id} />
              ))}
              {todosPartidosConEstado.length > 5 && (
                <button
                  onClick={() => setVerTodosOpen(true)}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium py-2"
                >
                  Ver todos ({todosPartidosConEstado.length})
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom sheet: todos los partidos ── */}
      <BottomSheet
        open={verTodosOpen}
        onClose={() => setVerTodosOpen(false)}
        title={`Todos los partidos (${todosPartidosConEstado.length})`}
      >
        {partidosQueComputan.map(({ partido }) => (
          <MiniPartidoCard key={partido.id} partido={partido} jugadorId={jugadorActual.id} />
        ))}

        {partidosQueNoComputan.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 whitespace-nowrap shrink-0">
                No computan para el ranking
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {partidosQueNoComputan.map(({ partido, razonNoComputa }) => (
              <MiniPartidoCard
                key={partido.id}
                partido={partido}
                jugadorId={jugadorActual.id}
                computa={false}
                razonNoComputa={razonNoComputa}
              />
            ))}
          </>
        )}
      </BottomSheet>

    </div>
  )
}

// ── Página principal (liga torneo) ──────────────────────────────────────────

function estadoBadgeTorneo(participacion) {
  if (participacion.esCampeon) return { label: '🏆 Campeón', className: 'bg-yellow-100 text-yellow-800' }
  if (participacion.estado === 'retirado') return { label: '🔄 Retirado', className: 'bg-orange-100 text-orange-800' }
  if (participacion.estado === 'lesionado') return { label: '🤕 Lesionado', className: 'bg-orange-100 text-orange-800' }
  if (participacion.estado === 'eliminado') return { label: '❌ Eliminado', className: 'bg-red-100 text-red-800' }
  if (participacion.estado === 'clasificado') return { label: '✅ Clasificado', className: 'bg-green-100 text-green-800' }
  return { label: '🎾 Activo', className: 'bg-blue-100 text-blue-800' }
}

// El badge ya deja claro cuándo alguien es campeón, así que este texto solo
// aporta algo nuevo para el resto de casos: finalista (perdió la Gran Final,
// pero torneo_participantes.estado sigue en 'clasificado' porque
// avanzarBracket() no lo toca ahí), eliminado en playoff (con la ronda
// concreta) o eliminado directamente en fase suiza (nunca llegó al bracket).
function faseAlcanzadaTexto(participacion) {
  if (participacion.esCampeon) return null
  if (participacion.faseAlcanzada) return participacion.faseAlcanzada
  if (participacion.estado === 'eliminado' && !participacion.enPlayoff) return 'Eliminado en fase suiza'
  return null
}

function MiPerfilTorneo() {
  const { ligaActiva, jugadorActual } = useLiga()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [participacion, setParticipacion] = useState(null)
  const [misPartidos, setMisPartidos] = useState([])

  useEffect(() => {
    // Si falta jugadorActual, el render de abajo muestra directamente
    // "Identifícate primero" sin llegar a consultar `loading`.
    if (!ligaActiva?.id || !jugadorActual?.id) return

    async function cargar() {
      try {
        setLoading(true)
        setError(null)
        const [datosParticipacion, todosPartidosTorneo] = await Promise.all([
          getParticipacionTorneoJugador(ligaActiva.id, jugadorActual.id),
          getTodosPartidosTorneo(ligaActiva.id),
        ])
        setParticipacion(datosParticipacion)
        setMisPartidos(
          todosPartidosTorneo
            .filter((p) =>
              [p.p1_jugador1_id, p.p1_jugador2_id, p.p2_jugador1_id, p.p2_jugador2_id].includes(jugadorActual.id)
            )
            // MiniPartidoCard/formatDate esperan `fecha` en formato YYYY-MM-DD;
            // torneo_partidos no tiene esa columna (se generan solos, no se
            // registran a mano), así que se deriva de `created_at`.
            .map((p) => ({ ...p, fecha: p.created_at?.slice(0, 10) }))
        )
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

  if (!participacion) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🎾</p>
        <p className="text-sm text-muted-foreground">Aún no estás inscrito en este torneo</p>
      </div>
    )
  }

  const badge = estadoBadgeTorneo(participacion)
  const faseTexto = faseAlcanzadaTexto(participacion)
  const misPartidosSuiza = misPartidos.filter((p) => p.ronda_tipo === 'suiza' || p.ronda_tipo === 'extra')
  const misPartidosPlayoff = misPartidos.filter((p) => ['wb', 'lb', 'final'].includes(p.ronda_tipo))

  return (
    <div className="space-y-4 pb-4">

      {/* ── Sección 1: Mi participación ── */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-green-700">
                {jugadorActual.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900">{jugadorActual.nombre}</h2>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
            {faseTexto && <p className="text-xs text-gray-500">{faseTexto}</p>}
          </div>

          <div className={`grid gap-3 ${participacion.enPlayoff ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Fase suiza</p>
              <p className="text-xl font-bold text-gray-900">
                {participacion.victoriasSuiza}-{participacion.derrotasSuiza}
              </p>
            </div>
            {participacion.enPlayoff && (
              <div className="bg-gray-50 rounded-xl px-3 py-3 text-center">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Playoff</p>
                <p className="text-xl font-bold text-gray-900">
                  {participacion.victoriasPlayoff}-{participacion.derrotasPlayoff}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Sección 2: Mis partidos en el torneo ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mis partidos en el torneo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {misPartidos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Aún no has jugado ningún partido</p>
          ) : (
            <>
              {misPartidosSuiza.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fase suiza</p>
                  {misPartidosSuiza.map((p) => (
                    <MiniPartidoCard key={p.id} partido={p} jugadorId={jugadorActual.id} />
                  ))}
                </div>
              )}
              {misPartidosPlayoff.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Playoff</p>
                  {misPartidosPlayoff.map((p) => (
                    <MiniPartidoCard key={p.id} partido={p} jugadorId={jugadorActual.id} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function MiPerfil() {
  const { ligaActiva } = useLiga()
  if (ligaActiva?.tipo === 'torneo') return <MiPerfilTorneo />
  return <MiPerfilEstandar />
}
