import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useLiga } from '../../../context/LigaContext'
import { getMiRolEnLiga, getLigaById } from '../../../services/ligas.service'
import { puedeEditar } from '../../../services/partidos.service'
import {
  getParticipantes,
  getRondaActual,
  generarPreviewRonda,
  confirmarRonda,
  repetirSorteo,
  getParejasPrevias,
  intercambiarJugadores,
  verificarParejasRepetidas,
  finalizarFaseSuiza,
  crearRondaFinal,
  calcularCorteFinalSuiza,
  getEstadoPlayoff,
  finalizarTorneo,
  getClasificacionPlayoff,
  getTorneoStats,
} from '../../../services/torneo.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RegistrarResultadoModal from './RegistrarResultadoModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordenarPorRendimiento(participantes) {
  return [...participantes].sort((a, b) => {
    if (b.victorias !== a.victorias) return b.victorias - a.victorias
    return a.derrotas - b.derrotas
  })
}

function estadoInfo(p, maxDerrotas) {
  if (p.estado === 'clasificado') return { label: '✅ Clasificado', color: 'green' }
  if (p.estado === 'eliminado') return { label: '❌ Eliminado', color: 'red' }
  if (maxDerrotas != null && p.derrotas === maxDerrotas - 1) return { label: '⚠️ En riesgo', color: 'orange' }
  return { label: 'Activo', color: 'gray' }
}

const COLOR_FILA = {
  green: 'bg-green-50 border-green-100',
  orange: 'bg-orange-50 border-orange-100',
  red: 'bg-red-50 border-red-100',
  gray: 'bg-white border-gray-100',
}

const COLOR_TEXTO = {
  green: 'text-green-800',
  orange: 'text-orange-800',
  red: 'text-red-800',
  gray: 'text-gray-900',
}

const COLOR_BADGE = {
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-600',
}

function nombresPareja(j1, j2) {
  return [j1?.nombre, j2?.nombre].filter(Boolean).join(' / ') || '—'
}

function setsDisplay(partido) {
  const sets = []
  if (partido.set1_p1 != null) sets.push(`${partido.set1_p1}-${partido.set1_p2}`)
  if (partido.set2_p1 != null) sets.push(`${partido.set2_p1}-${partido.set2_p2}`)
  if (partido.set3_p1 != null) sets.push(`${partido.set3_p1}-${partido.set3_p2}`)
  return sets.join('  ')
}

function ganadorLabel(partido) {
  if (partido.resultado === 'pareja1') return nombresPareja(partido.p1j1, partido.p1j2)
  if (partido.resultado === 'pareja2') return nombresPareja(partido.p2j1, partido.p2j2)
  return 'No finalizado'
}

// ── Tabla de clasificación suiza ──────────────────────────────────────────────

function TablaClasificacionSuiza({ participantes, maxDerrotas, titulo = 'Clasificación' }) {
  const ordenados = ordenarPorRendimiento(participantes)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div className="grid grid-cols-[1.5rem_1fr_2rem_2rem_5rem] gap-x-2 items-center px-4 py-2 border-b border-gray-100 min-w-[320px]">
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">#</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase">Jugador</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">V</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">D</span>
          <span className="text-[10px] font-semibold text-gray-400 uppercase text-center">Estado</span>
        </div>
        {ordenados.map((p, i) => {
          const { label, color } = estadoInfo(p, maxDerrotas)
          return (
            <div
              key={p.id}
              className={`grid grid-cols-[1.5rem_1fr_2rem_2rem_5rem] gap-x-2 items-center px-4 py-2.5 border-b last:border-0 min-w-[320px] ${COLOR_FILA[color]}`}
            >
              <span className="text-sm font-bold text-gray-400 text-center">{i + 1}</span>
              <span className={`text-sm font-medium truncate ${COLOR_TEXTO[color]}`}>
                {p.jugador?.nombre ?? '—'}
              </span>
              <span className="text-sm text-gray-700 text-center">{p.victorias}</span>
              <span className="text-sm text-gray-700 text-center">{p.derrotas}</span>
              <span className="text-center">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${COLOR_BADGE[color]}`}>
                  {label}
                </span>
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── Partidos de la ronda ──────────────────────────────────────────────────────

function PartidoRondaCard({ partido, jugadorActualId, esAdmin, soloLectura, onRegistrar }) {
  const { puede } = puedeEditar(partido, jugadorActualId, esAdmin)
  const tieneResultado = !!partido.resultado

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{nombresPareja(partido.p1j1, partido.p1j2)}</span>
          <span className="text-xs text-gray-400 shrink-0">vs</span>
          <span className="text-sm font-medium truncate text-right">{nombresPareja(partido.p2j1, partido.p2j2)}</span>
        </div>

        {tieneResultado ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-gray-800 tracking-wide">{setsDisplay(partido)}</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                partido.resultado === 'no_finalizado' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {ganadorLabel(partido)}
            </span>
          </div>
        ) : (
          !soloLectura && puede && (
            <Button size="sm" variant="outline" className="w-full" onClick={onRegistrar}>
              Registrar resultado
            </Button>
          )
        )}
      </CardContent>
    </Card>
  )
}

function ListaPartidosRonda({ partidos, jugadorActualId, esAdmin, soloLectura, onRegistrar }) {
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
        <PartidoRondaCard
          key={partido.id}
          partido={partido}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          soloLectura={soloLectura}
          onRegistrar={() => onRegistrar(partido)}
        />
      ))}
    </div>
  )
}

// ── Partidos editables del preview (tap para intercambiar jugadores) ────────

function JugadorChip({ jugador, seleccionado, onTap }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        'flex-1 min-w-0 text-sm font-medium truncate px-2 py-1.5 rounded-lg border border-dashed cursor-pointer transition-colors',
        seleccionado
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-gray-300 text-gray-800 hover:border-gray-400',
      ].join(' ')}
    >
      {jugador?.nombre ?? '—'}
    </button>
  )
}

function PartidoPreviewCard({ partido, seleccion, onTap }) {
  const posiciones = ['p1j1', 'p1j2', 'p2j1', 'p2j2']
  function seleccionada(pos) {
    return seleccion?.jugadorId != null && seleccion.jugadorId === partido[pos]?.id
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          {posiciones.slice(0, 2).map((pos) => (
            <JugadorChip
              key={pos}
              jugador={partido[pos]}
              seleccionado={seleccionada(pos)}
              onTap={() => onTap({ partidoId: partido.id, pos, jugadorId: partido[pos]?.id ?? null })}
            />
          ))}
        </div>
        <div className="text-center text-xs text-gray-400 font-medium">vs</div>
        <div className="flex items-center gap-1.5">
          {posiciones.slice(2, 4).map((pos) => (
            <JugadorChip
              key={pos}
              jugador={partido[pos]}
              seleccionado={seleccionada(pos)}
              onTap={() => onTap({ partidoId: partido.id, pos, jugadorId: partido[pos]?.id ?? null })}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ListaPartidosPreview({ partidos, seleccion, onTap }) {
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
        <PartidoPreviewCard key={partido.id} partido={partido} seleccion={seleccion} onTap={onTap} />
      ))}
    </div>
  )
}

// ── Jugadores que descansan esta ronda (también tappables) ──────────────────

function ListaDescansan({ jugadorIds, participantesPorJugadorId, seleccion, onTap, titulo = 'Descansan esta ronda' }) {
  if (jugadorIds.length === 0) return null

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</p>
      <div className="flex flex-wrap gap-2">
        {jugadorIds.map((jugadorId) => {
          const participante = participantesPorJugadorId.get(jugadorId)
          const seleccionado = seleccion?.jugadorId === jugadorId
          return (
            <button
              key={jugadorId}
              type="button"
              onClick={() => onTap({ partidoId: null, pos: null, jugadorId })}
              className={[
                'text-sm font-medium px-2.5 py-1.5 rounded-lg border border-dashed cursor-pointer transition-colors',
                seleccionado
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400',
              ].join(' ')}
            >
              {participante?.jugador?.nombre ?? '—'}
              <span className="text-xs text-gray-400 ml-1.5">
                {participante?.victorias ?? 0}-{participante?.derrotas ?? 0}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Sección "ronda actual" con soporte de preview/generación manual ──────────

function SeccionRondaActual({ ligaId, ronda, participantes, esAdmin, jugadorActualId, onRegistrar, onCambio }) {
  const [accion, setAccion] = useState(null) // 'generando' | 'repitiendo' | 'confirmando'
  const [error, setError] = useState(null)
  const [partidosLocal, setPartidosLocal] = useState(ronda?.partidos ?? [])
  const [parejasPrevias, setParejasPrevias] = useState(new Set())
  const [seleccion, setSeleccion] = useState(null) // { partidoId, pos, jugadorId }
  const [rondaAnterior, setRondaAnterior] = useState(ronda)

  const participantesPorJugadorId = new Map(participantes.map((p) => [p.jugador_id, p]))

  function obtenerJugadorInfo(jugadorId) {
    return participantesPorJugadorId.get(jugadorId)?.jugador ?? { id: jugadorId, nombre: '—' }
  }

  const esPreview = ronda?.estado === 'pendiente'

  // Cuando el padre trae una ronda distinta (nueva ronda, o repetirSorteo
  // regeneró los partidos), se resetea el estado local editable.
  if (ronda !== rondaAnterior) {
    setRondaAnterior(ronda)
    setPartidosLocal(ronda?.partidos ?? [])
    setSeleccion(null)
  }

  useEffect(() => {
    if (!esPreview || !ronda) return
    let cancelado = false
    getParejasPrevias(ligaId, ronda.tipo)
      .then((set) => { if (!cancelado) setParejasPrevias(set) })
      .catch((err) => setError(err.message))
    return () => { cancelado = true }
  }, [ligaId, ronda?.id, ronda?.tipo, esPreview])

  async function handleGenerar() {
    try {
      setAccion('generando')
      setError(null)
      await generarPreviewRonda(ligaId)
      onCambio()
    } catch (err) {
      setError(err.message || 'Error al generar la ronda')
    } finally {
      setAccion(null)
    }
  }

  async function handleRepetir() {
    try {
      setAccion('repitiendo')
      setError(null)
      await repetirSorteo(ligaId, ronda.id)
      onCambio()
    } catch (err) {
      setError(err.message || 'Error al repetir el sorteo')
    } finally {
      setAccion(null)
    }
  }

  async function handleConfirmar() {
    try {
      setAccion('confirmando')
      setError(null)
      await confirmarRonda(ligaId, ronda.id)
      onCambio()
    } catch (err) {
      setError(err.message || 'Error al confirmar la ronda')
    } finally {
      setAccion(null)
    }
  }

  // Coloca en cada lado (si tiene partido) el jugador indicado. Un lado con
  // partidoId=null (descansa) no tiene fila que escribir: su "posición" es
  // simplemente no estar en ningún partido, así que no requiere cambio aquí.
  function escribirSlots(sel1, jugador1, sel2, jugador2) {
    setPartidosLocal((prev) => {
      const next = prev.map((p) => ({ ...p }))
      if (sel1.partidoId != null) {
        next.find((p) => p.id === sel1.partidoId)[sel1.pos] = jugador1
      }
      if (sel2.partidoId != null) {
        next.find((p) => p.id === sel2.partidoId)[sel2.pos] = jugador2
      }
      return next
    })
  }

  function aplicarSwap(sel1, sel2) {
    escribirSlots(sel1, obtenerJugadorInfo(sel2.jugadorId), sel2, obtenerJugadorInfo(sel1.jugadorId))
  }

  function revertirSwap(sel1, sel2) {
    escribirSlots(sel1, obtenerJugadorInfo(sel1.jugadorId), sel2, obtenerJugadorInfo(sel2.jugadorId))
  }

  async function handleIntercambio(sel1, sel2) {
    aplicarSwap(sel1, sel2)
    try {
      await intercambiarJugadores(ronda.id, sel1, sel2)
    } catch (err) {
      setError(err.message || 'Error al intercambiar jugadores')
      revertirSwap(sel1, sel2)
    }
  }

  function handleTapJugador(seleccionNueva) {
    if (!seleccion) {
      setSeleccion(seleccionNueva)
      return
    }
    if (seleccion.jugadorId === seleccionNueva.jugadorId) {
      // mismo jugador: no tiene sentido intercambiarlo consigo mismo, re-seleccionar
      setSeleccion(null)
      return
    }
    const sel1 = seleccion
    setSeleccion(null)
    handleIntercambio(sel1, seleccionNueva)
  }

  const poolIds = new Set()
  if (ronda) {
    for (const p of ronda.partidos) {
      ;[p.p1_jugador1_id, p.p1_jugador2_id, p.p2_jugador1_id, p.p2_jugador2_id].forEach((id) => id && poolIds.add(id))
    }
    for (const d of ronda.descansan ?? []) poolIds.add(d.jugador_id)
  }
  const idsEnPartidosLocal = new Set(
    partidosLocal.flatMap((p) => [p.p1j1?.id, p.p1j2?.id, p.p2j1?.id, p.p2j2?.id].filter(Boolean))
  )
  const descansanIds = [...poolIds].filter((id) => !idsEnPartidosLocal.has(id))

  const esBracket = ['wb', 'lb', 'final'].includes(ronda?.tipo)
  const repetidas = esPreview ? verificarParejasRepetidas(partidosLocal, parejasPrevias) : []

  if (!ronda) {
    if (!esAdmin) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Esperando a que el admin genere la siguiente ronda
        </p>
      )
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground text-center py-2">
          Todos los partidos de la ronda tienen resultado.
        </p>
        <Button className="w-full" onClick={handleGenerar} disabled={accion === 'generando'}>
          {accion === 'generando' ? 'Generando...' : 'Generar siguiente ronda'}
        </Button>
        {error && <p className="text-destructive text-sm text-center">{error}</p>}
      </div>
    )
  }

  if (esPreview && !esAdmin) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        El admin está preparando la siguiente ronda
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {esPreview && (
        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
          Vista previa
        </span>
      )}

      {esPreview ? (
        <>
          <ListaPartidosPreview partidos={partidosLocal} seleccion={seleccion} onTap={handleTapJugador} />
          <ListaDescansan
            jugadorIds={descansanIds}
            participantesPorJugadorId={participantesPorJugadorId}
            seleccion={seleccion}
            onTap={handleTapJugador}
            titulo={esBracket ? 'Bye esta ronda' : 'Descansan esta ronda'}
          />
        </>
      ) : (
        <ListaPartidosRonda
          partidos={ronda.partidos}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          soloLectura={false}
          onRegistrar={onRegistrar}
        />
      )}

      {esPreview && repetidas.length > 0 && (
        <p className="text-sm font-medium text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          ⚠️ {repetidas.length} pareja{repetidas.length === 1 ? '' : 's'} repetida{repetidas.length === 1 ? '' : 's'}:{' '}
          {repetidas.map((r) => `${r.jugador1?.nombre ?? '—'} / ${r.jugador2?.nombre ?? '—'}`).join(', ')}
        </p>
      )}

      {esPreview && esAdmin && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleRepetir} disabled={!!accion}>
            {accion === 'repitiendo' ? 'Repitiendo...' : 'Repetir sorteo'}
          </Button>
          <Button
            className={`flex-1 ${repetidas.length === 0 ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={handleConfirmar}
            disabled={!!accion || repetidas.length > 0}
          >
            {accion === 'confirmando' ? 'Confirmando...' : 'Confirmar ronda'}
          </Button>
        </div>
      )}
      {error && <p className="text-destructive text-sm text-center">{error}</p>}
    </div>
  )
}

// ── Gestión de fin de fase suiza ─────────────────────────────────────────────

function ordenarParaRondaFinal(participantes) {
  const clasificados = [...participantes.filter((p) => p.estado === 'clasificado')].sort(
    (a, b) => b.victorias - a.victorias
  )
  const activos = [...participantes.filter((p) => p.estado === 'activo')].sort((a, b) => {
    if (b.victorias !== a.victorias) return b.victorias - a.victorias
    return a.derrotas - b.derrotas
  })
  const eliminados = [...participantes.filter((p) => p.estado === 'eliminado')].sort(
    (a, b) => a.derrotas - b.derrotas
  )
  return [...clasificados, ...activos, ...eliminados]
}

function ModalRondaFinal({ ligaId, participantes, onClose, onCreada }) {
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const ordenados = ordenarParaRondaFinal(participantes)

  function toggle(jugadorId) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(jugadorId)) next.delete(jugadorId)
      else next.add(jugadorId)
      return next
    })
  }

  const cantidad = seleccionados.size
  const esValido = cantidad > 0 && cantidad % 4 === 0

  async function handleConfirmar() {
    if (!esValido) return
    try {
      setGuardando(true)
      setError(null)
      await crearRondaFinal(ligaId, [...seleccionados])
      onCreada()
    } catch (err) {
      setError(err.message || 'Error al crear la ronda final')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-1">Ronda final</h2>
        <p className="text-sm text-gray-500 mb-4">
          Elige los jugadores que disputarán la ronda final (deben ser múltiplo de 4)
        </p>

        <div className="space-y-1 mb-3">
          {ordenados.map((p) => {
            const { label, color } = estadoInfo(p, null)
            return (
              <label key={p.jugador_id} className="flex items-center gap-2 py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccionados.has(p.jugador_id)}
                  onChange={() => toggle(p.jugador_id)}
                  className="size-4 rounded accent-primary shrink-0"
                />
                <span className="flex-1 text-sm font-medium truncate">{p.jugador?.nombre ?? '—'}</span>
                <span className="text-xs text-gray-400 shrink-0">{p.victorias}-{p.derrotas}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${COLOR_BADGE[color]}`}>
                  {label}
                </span>
              </label>
            )
          })}
        </div>

        <p className={`text-xs mb-3 ${esValido ? 'text-green-600' : 'text-gray-500'}`}>
          {cantidad} seleccionado{cantidad === 1 ? '' : 's'}
          {cantidad > 0 && cantidad % 4 !== 0 ? ` (debe ser múltiplo de 4, actualmente ${cantidad})` : ''}
        </p>

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!esValido || guardando}>
            {guardando ? 'Creando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ModalFinalizarFaseSuiza({ ligaId, participantes, minClasificados, onClose, onFinalizado }) {
  const clasificadosExistentes = participantes.filter((p) => p.estado === 'clasificado')
  const activosExistentes = participantes.filter((p) => p.estado === 'activo')
  const defaultNum = clasificadosExistentes.length + activosExistentes.length

  const [numClasifican, setNumClasifican] = useState(String(defaultNum))
  const [repescados, setRepescados] = useState(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const num = Number(numClasifican)
  const numValido = numClasifican !== '' && Number.isInteger(num) && num >= 0
  const esPar = numValido && num % 2 === 0
  const cumpleMinimo = !numValido || minClasificados == null || num >= minClasificados

  const corte = numValido ? calcularCorteFinalSuiza(participantes, num, repescados) : null
  const repechajeCompleto = corte ? repescados.size === corte.necesitanRepescar : false
  const necesitaRepechaje = corte ? corte.necesitanRepescar > 0 : false

  const esValido = numValido && esPar && cumpleMinimo && (!corte || corte.necesitanRepescar === 0 || repechajeCompleto)

  function toggleRepescado(jugadorId) {
    setRepescados((prev) => {
      const next = new Set(prev)
      if (next.has(jugadorId)) next.delete(jugadorId)
      else next.add(jugadorId)
      return next
    })
  }

  async function handleConfirmar() {
    if (!esValido || !corte) return
    try {
      setGuardando(true)
      setError(null)
      await finalizarFaseSuiza(
        ligaId,
        corte.clasificados.map((p) => p.jugador_id),
        corte.eliminados.map((p) => p.jugador_id)
      )
      onFinalizado()
    } catch (err) {
      setError(err.message || 'Error al finalizar la fase suiza')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">Finalizar fase suiza</h2>

        <label htmlFor="num-clasifican" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Jugadores que clasifican al playoff
        </label>
        <Input
          id="num-clasifican"
          type="number"
          min="0"
          step="1"
          value={numClasifican}
          onChange={(e) => setNumClasifican(e.target.value)}
          className="h-10"
        />
        {numValido && !esPar && <p className="text-destructive text-xs mt-1">Debe ser un número par</p>}
        {numValido && esPar && !cumpleMinimo && (
          <p className="text-destructive text-xs mt-1">Debe ser al menos {minClasificados}</p>
        )}

        {corte && necesitaRepechaje && (
          <div className="bg-gray-50 rounded-lg px-3.5 py-3 mt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Seleccionar eliminados que repescan ({repescados.size}/{corte.necesitanRepescar})
            </p>
            <div className="space-y-1">
              {corte.eliminadosOrdenados.map((p) => (
                <label key={p.jugador_id} className="flex items-center gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repescados.has(p.jugador_id)}
                    onChange={() => toggleRepescado(p.jugador_id)}
                    disabled={!repescados.has(p.jugador_id) && repescados.size >= corte.necesitanRepescar}
                    className="size-4 rounded accent-primary"
                  />
                  <span className="flex-1 text-sm font-medium truncate">{p.jugador?.nombre ?? '—'}</span>
                  <span className="text-xs text-gray-400">{p.victorias}-{p.derrotas}</span>
                </label>
              ))}
            </div>
            {!repechajeCompleto && (
              <p className="text-xs text-gray-500 mt-2">
                Selecciona exactamente {corte.necesitanRepescar} para completar el número elegido
              </p>
            )}
          </div>
        )}

        {esValido && corte && (
          <div className="bg-gray-50 rounded-lg px-3.5 py-3 mt-3 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Clasifican: {corte.clasificados.length} jugadores</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {corte.clasificados.map((p) => (
                <div key={p.jugador_id} className="flex items-center justify-between text-sm gap-2">
                  <span className="text-gray-700 truncate">{p.jugador?.nombre ?? '—'}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.victorias}-{p.derrotas}</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-gray-900 pt-1">Eliminados: {corte.eliminados.length} jugadores</p>
            {corte.zonaGris.length > 0 && (
              <p className="text-sm text-orange-700">
                Ronda extra: {corte.zonaGris.length} jugadores empatados en el corte
              </p>
            )}
          </div>
        )}

        {error && <p className="text-destructive text-sm mt-3">{error}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!esValido || guardando}>
            {guardando ? 'Cerrando...' : 'Confirmar y cerrar fase suiza'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function SeccionGestionFase({ ligaId, participantes, ronda, maxDerrotas, maxEliminados, minClasificados, onCambio }) {
  const [modalRondaFinal, setModalRondaFinal] = useState(false)
  const [modalFinalizar, setModalFinalizar] = useState(false)

  if (maxEliminados == null) return null
  if (ronda != null) return null

  const eliminados = participantes.filter((p) => p.estado === 'eliminado')
  const activos = participantes.filter((p) => p.estado === 'activo')
  const hayZonaLimite = activos.some((p) => maxDerrotas != null && p.derrotas === maxDerrotas - 1)

  if (eliminados.length < maxEliminados) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gestión de fase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button className="w-full" variant="outline" onClick={() => setModalFinalizar(true)}>
          Finalizar fase suiza
        </Button>
        {hayZonaLimite && (
          <Button className="w-full" onClick={() => setModalRondaFinal(true)}>
            Ronda final
          </Button>
        )}
      </CardContent>

      {modalRondaFinal && (
        <ModalRondaFinal
          ligaId={ligaId}
          participantes={participantes}
          onClose={() => setModalRondaFinal(false)}
          onCreada={() => {
            setModalRondaFinal(false)
            onCambio()
          }}
        />
      )}
      {modalFinalizar && (
        <ModalFinalizarFaseSuiza
          ligaId={ligaId}
          participantes={participantes}
          minClasificados={minClasificados}
          onClose={() => setModalFinalizar(false)}
          onFinalizado={() => {
            setModalFinalizar(false)
            onCambio()
          }}
        />
      )}
    </Card>
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

function VistaSuiza({ ligaActiva, participantes, ronda, jugadorActualId, esAdmin, onRegistrar, onCambio }) {
  const eliminados = participantes.filter((p) => p.estado === 'eliminado').length
  const clasificados = participantes.filter((p) => p.estado === 'clasificado').length
  const minClasificados = ligaActiva.torneo_min_clasificados

  return (
    <div className="space-y-4 pb-4">
      <TablaClasificacionSuiza participantes={participantes} maxDerrotas={ligaActiva.torneo_max_derrotas} />

      <div className="text-center">
        {minClasificados != null && (
          <p className={`text-sm font-semibold ${clasificados >= minClasificados ? 'text-green-600' : 'text-gray-500'}`}>
            {clasificados} clasificados de {minClasificados} mínimos para el playoff
          </p>
        )}
        <p className="text-xs text-muted-foreground">{eliminados} eliminados</p>
      </div>

      {esAdmin && (
        <SeccionGestionFase
          ligaId={ligaActiva.id}
          participantes={participantes}
          ronda={ronda}
          maxDerrotas={ligaActiva.torneo_max_derrotas}
          maxEliminados={ligaActiva.torneo_max_eliminados}
          minClasificados={minClasificados}
          onCambio={onCambio}
        />
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {ronda ? `Ronda ${ronda.numero}` : 'Ronda actual'}
        </p>
        {ronda?.jugadorDescansoAnterior && (
          <p className="text-xs text-gray-400 -mt-1 mb-2">
            Descansó la ronda anterior: {ronda.jugadorDescansoAnterior.nombre}
          </p>
        )}
        <SeccionRondaActual
          ligaId={ligaActiva.id}
          ronda={ronda}
          participantes={participantes}
          esAdmin={esAdmin}
          jugadorActualId={jugadorActualId}
          onRegistrar={onRegistrar}
          onCambio={onCambio}
        />
      </div>
    </div>
  )
}

function VistaRondaExtra({ ligaActiva, participantes, ronda, jugadorActualId, esAdmin, onRegistrar, onCambio }) {
  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Ronda extra de desempate para completar los clasificados a playoff.
          </p>
        </CardContent>
      </Card>

      {esAdmin && (
        <SeccionGestionFase
          ligaId={ligaActiva.id}
          participantes={participantes}
          ronda={ronda}
          maxDerrotas={ligaActiva.torneo_max_derrotas}
          maxEliminados={ligaActiva.torneo_max_eliminados}
          minClasificados={ligaActiva.torneo_min_clasificados}
          onCambio={onCambio}
        />
      )}

      <SeccionRondaActual
        ligaId={ligaActiva.id}
        ronda={ronda}
        participantes={participantes}
        esAdmin={esAdmin}
        jugadorActualId={jugadorActualId}
        onRegistrar={onRegistrar}
        onCambio={onCambio}
      />
    </div>
  )
}

// ── Bracket del playoff ───────────────────────────────────────────────────────

function FilaBracket({ fila }) {
  const eliminado = fila.estado === 'eliminado'
  const tieneBye = !eliminado && fila.bye
  return (
    <div
      className={`px-2.5 py-2 rounded-lg border ${eliminado ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-medium truncate min-w-0 ${eliminado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {fila.jugador?.nombre ?? '—'}
        </p>
        {eliminado && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">
            Eliminado
          </span>
        )}
        {tieneBye && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0 whitespace-nowrap">
            Bye →
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">{fila.victorias}-{fila.derrotas}</p>
    </div>
  )
}

function ColumnaBracket({ titulo, filas }) {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
      {filas.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">—</p>
      ) : (
        <div className="space-y-1.5">
          {filas.map((f) => <FilaBracket key={f.id} fila={f} />)}
        </div>
      )}
    </div>
  )
}

function BracketVisual({ wb, lb }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bracket</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <ColumnaBracket titulo="Winner Bracket" filas={wb} />
        <ColumnaBracket titulo="Loser Bracket" filas={lb} />
      </CardContent>
    </Card>
  )
}

function GranFinalCard({ wb, lb }) {
  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <p className="text-sm font-bold text-gray-900">🏆 GRAN FINAL</p>
        <div className="space-y-1">
          {wb.map((f) => (
            <p key={f.id} className="text-sm text-gray-700">
              <span className="font-semibold">{f.jugador?.nombre ?? '—'}</span>{' '}
              <span className="text-gray-400">— Viene del Winner Bracket</span>
            </p>
          ))}
          {lb.map((f) => (
            <p key={f.id} className="text-sm text-gray-700">
              <span className="font-semibold">{f.jugador?.nombre ?? '—'}</span>{' '}
              <span className="text-gray-400">— Viene del Loser Bracket</span>
            </p>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Partido único, con parejas sorteadas al azar entre los 4 finalistas — sin ventaja para nadie.
        </p>
      </CardContent>
    </Card>
  )
}

function VistaCampeon({ campeon, esAdmin, onFinalizar }) {
  const [finalizando, setFinalizando] = useState(false)
  const [error, setError] = useState(null)

  async function handleFinalizar() {
    try {
      setFinalizando(true)
      setError(null)
      await onFinalizar()
    } catch (err) {
      setError(err.message || 'Error al finalizar el torneo')
      setFinalizando(false)
    }
  }

  return (
    <Card>
      <CardContent className="text-center py-10 space-y-3">
        <p className="text-5xl">🏆</p>
        <p className="text-sm text-muted-foreground">¡Campeón del torneo!</p>
        <p className="text-xl font-bold text-gray-900">{nombresPareja(campeon.j1, campeon.j2)}</p>
        {esAdmin && (
          <Button className="mt-2" onClick={handleFinalizar} disabled={finalizando}>
            {finalizando ? 'Finalizando...' : 'Finalizar torneo'}
          </Button>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  )
}

// Una sección de ronda por lado del bracket (WB o LB): título propio y su
// propio sistema de preview/confirmar, totalmente independiente del otro
// lado — ambos pueden tener una ronda abierta al mismo tiempo.
function SeccionLadoBracket({ titulo, ligaId, ronda, participantes, esAdmin, jugadorActualId, onRegistrar, onCambio }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{titulo}</p>
      {ronda ? (
        <SeccionRondaActual
          ligaId={ligaId}
          ronda={ronda}
          participantes={participantes}
          esAdmin={esAdmin}
          jugadorActualId={jugadorActualId}
          onRegistrar={onRegistrar}
          onCambio={onCambio}
        />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Sin ronda activa</p>
      )}
    </div>
  )
}

function VistaPlayoff({ ligaActiva, estadoPlayoff, participantes, jugadorActualId, esAdmin, onRegistrar, onCambio }) {
  if (!estadoPlayoff) return null
  const { wb, lb, rondaWb, rondaLb, rondaFinal, campeon } = estadoPlayoff

  if (campeon) {
    return (
      <VistaCampeon
        campeon={campeon}
        esAdmin={esAdmin}
        onFinalizar={async () => {
          // torneo_ganador_id solo admite un jugador de referencia; se usa
          // el primero de la pareja ganadora (j2 queda igualmente marcado
          // como campeón en torneo_participantes, ver finalizarTorneo()).
          await finalizarTorneo(ligaActiva.id, campeon.j1.id)
          onCambio()
        }}
      />
    )
  }

  const wbActivos = wb.filter((f) => f.estado === 'activo')
  const lbActivos = lb.filter((f) => f.estado === 'activo')

  const seccionesComunes = { ligaId: ligaActiva.id, participantes, esAdmin, jugadorActualId, onRegistrar, onCambio }

  return (
    <div className="space-y-4 pb-4">
      <BracketVisual wb={wb} lb={lb} />

      {rondaFinal && <GranFinalCard wb={wbActivos} lb={lbActivos} />}

      {rondaFinal ? (
        <SeccionLadoBracket titulo="Gran Final" ronda={rondaFinal} {...seccionesComunes} />
      ) : (
        <>
          {(rondaWb || wb.length > 0) && (
            <SeccionLadoBracket
              titulo={rondaWb ? `Winner Bracket - Ronda ${rondaWb.numeroRelativo}` : 'Winner Bracket'}
              ronda={rondaWb}
              {...seccionesComunes}
            />
          )}
          {(rondaLb || lb.length > 0) && (
            <SeccionLadoBracket
              titulo={rondaLb ? `Loser Bracket - Ronda ${rondaLb.numeroRelativo}` : 'Loser Bracket'}
              ronda={rondaLb}
              {...seccionesComunes}
            />
          )}
        </>
      )}
    </div>
  )
}

function medallaPosicion(posicion) {
  if (posicion === 1) return '🥇'
  if (posicion === 2) return '🥈'
  if (posicion === 3) return '🥉'
  return null
}

function ClasificacionPlayoffCard({ clasificacion }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clasificación del playoff</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {clasificacion.map((c) => (
          <div
            key={c.jugadorId}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0"
          >
            <span className="text-sm font-bold text-gray-400 w-7 text-center shrink-0">
              {medallaPosicion(c.posicion) ?? `${c.posicion}º`}
            </span>
            <span className="flex-1 text-sm font-medium text-gray-900 truncate">{c.nombre}</span>
            <span className="text-xs text-gray-400 shrink-0">{c.victoriasPlayoff}-{c.derrotasPlayoff}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function EstadisticasTorneoCard({ stats }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Estadísticas del torneo</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalPartidos}</p>
          <p className="text-xs text-gray-500">Partidos jugados</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.rondasSuiza}</p>
          <p className="text-xs text-gray-500">Rondas fase suiza</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{stats.rondasPlayoff}</p>
          <p className="text-xs text-gray-500">Rondas playoff</p>
        </div>
      </CardContent>
    </Card>
  )
}

function VistaFinalizado({ participantes, estadoPlayoff, clasificacionPlayoff, torneoStats }) {
  const campeon = estadoPlayoff?.campeon
  const ordenados = ordenarPorRendimiento(participantes)
  const ganadorFallback = ordenados[0]

  return (
    <div className="space-y-4 pb-4">
      <Card>
        <CardContent className="text-center py-10 space-y-2">
          <p className="text-6xl">🏆</p>
          <p className="text-xl font-bold text-gray-900">
            {campeon ? nombresPareja(campeon.j1, campeon.j2) : (ganadorFallback?.jugador?.nombre ?? '—')}
          </p>
          <p className="text-sm text-muted-foreground">Campeón del torneo</p>
        </CardContent>
      </Card>

      {clasificacionPlayoff.length > 0 && <ClasificacionPlayoffCard clasificacion={clasificacionPlayoff} />}

      {torneoStats && <EstadisticasTorneoCard stats={torneoStats} />}

      <TablaClasificacionSuiza participantes={participantes} maxDerrotas={Infinity} titulo="Clasificación fase suiza" />
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function TorneoHome() {
  const { user } = useAuth()
  const { ligaActiva, setLigaActiva, jugadorActual } = useLiga()

  const [rol, setRol] = useState(null)
  const [participantes, setParticipantes] = useState([])
  const [ronda, setRonda] = useState(null)
  const [estadoPlayoff, setEstadoPlayoff] = useState(null)
  const [clasificacionPlayoff, setClasificacionPlayoff] = useState([])
  const [torneoStats, setTorneoStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partidoModal, setPartidoModal] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
          setRonda(await getRondaActual(ligaActiva.id))
          setEstadoPlayoff(null)
          setClasificacionPlayoff([])
          setTorneoStats(null)
        } else if (estado === 'playoff') {
          setRonda(null)
          setEstadoPlayoff(await getEstadoPlayoff(ligaActiva.id))
          setClasificacionPlayoff([])
          setTorneoStats(null)
        } else if (estado === 'finalizado') {
          setRonda(null)
          const [estadoP, clasificacionP, stats] = await Promise.all([
            getEstadoPlayoff(ligaActiva.id),
            getClasificacionPlayoff(ligaActiva.id),
            getTorneoStats(ligaActiva.id),
          ])
          setEstadoPlayoff(estadoP)
          setClasificacionPlayoff(clasificacionP)
          setTorneoStats(stats)
        } else {
          setRonda(null)
          setEstadoPlayoff(null)
          setClasificacionPlayoff([])
          setTorneoStats(null)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id, ligaActiva?.torneo_estado, user.id, refreshKey])

  // Refresca ligaActiva desde Supabase y fuerza recargar los datos del
  // torneo. Se usa como onCambio en vez de solo bumpear refreshKey porque
  // varias acciones (finalizarFaseSuiza, crearRondaFinal, iniciarPlayoff,
  // finalizarTorneo...) cambian torneo_estado en la base de datos — sin
  // refrescar ligaActiva el componente seguiría mostrando la vista anterior
  // (el switch de más abajo decide la vista a partir de ligaActiva.torneo_estado).
  async function recargarTodo() {
    try {
      const ligaFresca = await getLigaById(ligaActiva.id)
      setLigaActiva(ligaFresca)
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshKey((k) => k + 1)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando torneo...</p>
  }
  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }
  if (!ligaActiva) return null

  const esAdmin = rol === 'admin'
  const jugadorActualId = jugadorActual?.id ?? null

  let contenido
  switch (ligaActiva.torneo_estado) {
    case 'configuracion':
      contenido = <VistaConfiguracion esAdmin={esAdmin} ligaId={ligaActiva.id} />
      break
    case 'suiza':
      contenido = (
        <VistaSuiza
          ligaActiva={ligaActiva}
          participantes={participantes}
          ronda={ronda}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          onRegistrar={setPartidoModal}
          onCambio={recargarTodo}
        />
      )
      break
    case 'ronda_extra':
      contenido = (
        <VistaRondaExtra
          ligaActiva={ligaActiva}
          participantes={participantes}
          ronda={ronda}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          onRegistrar={setPartidoModal}
          onCambio={recargarTodo}
        />
      )
      break
    case 'playoff':
      contenido = (
        <VistaPlayoff
          ligaActiva={ligaActiva}
          estadoPlayoff={estadoPlayoff}
          participantes={participantes}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          onRegistrar={setPartidoModal}
          onCambio={recargarTodo}
        />
      )
      break
    case 'finalizado':
      contenido = (
        <VistaFinalizado
          participantes={participantes}
          estadoPlayoff={estadoPlayoff}
          clasificacionPlayoff={clasificacionPlayoff}
          torneoStats={torneoStats}
        />
      )
      break
    default:
      contenido = <VistaConfiguracion esAdmin={esAdmin} ligaId={ligaActiva.id} />
  }

  return (
    <>
      {contenido}
      {partidoModal && (
        <RegistrarResultadoModal
          partido={partidoModal}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          onClose={() => setPartidoModal(null)}
          onGuardado={() => {
            setPartidoModal(null)
            recargarTodo()
          }}
        />
      )}
    </>
  )
}
