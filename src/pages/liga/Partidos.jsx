import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2, Plus, X, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLiga } from '../../context/LigaContext'
import { getMiRolEnLiga } from '../../services/ligas.service'
import { getJugadoresLiga } from '../../services/jugadores.service'
import {
  getPartidosLiga,
  crearPartido,
  editarPartido,
  eliminarPartido,
  puedeEditar,
} from '../../services/partidos.service'
import { getTodosPartidosTorneo, puedeEditarTorneo } from '../../services/torneo.service'
import RegistrarResultadoModal from './torneo/RegistrarResultadoModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function calcularResultado(sets, noFinalizado) {
  if (noFinalizado) return 'no_finalizado'
  let ganP1 = 0
  let ganP2 = 0
  const todos = [
    sets.set1p1 !== '' && sets.set1p2 !== '' ? [sets.set1p1, sets.set1p2] : null,
    sets.set2p1 !== '' && sets.set2p2 !== '' ? [sets.set2p1, sets.set2p2] : null,
    sets.set3p1 !== '' && sets.set3p2 !== '' ? [sets.set3p1, sets.set3p2] : null,
  ].filter(Boolean)
  for (const [p1, p2] of todos) {
    if (Number(p1) > Number(p2)) ganP1++
    else if (Number(p2) > Number(p1)) ganP2++
  }
  if (ganP1 > ganP2) return 'pareja1'
  if (ganP2 > ganP1) return 'pareja2'
  return 'no_finalizado'
}

function resultadoParaJugador(partido, jugadorId) {
  if (!jugadorId) return 'neutro'
  const enP1 =
    partido.p1_jugador1_id === jugadorId || partido.p1_jugador2_id === jugadorId
  const enP2 =
    partido.p2_jugador1_id === jugadorId || partido.p2_jugador2_id === jugadorId
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
  if (partido.resultado === 'pareja2') return { label: p2, className: 'bg-green-100 text-green-800' }
  return { label: 'No finalizado', className: 'bg-yellow-100 text-yellow-800' }
}

function resolverNombre(id, jugadores) {
  return jugadores.find((j) => j.id === id)?.nombre ?? ''
}

function setsDisplay(partido) {
  const sets = []
  if (partido.set1_p1 != null) sets.push(`${partido.set1_p1}-${partido.set1_p2}`)
  if (partido.set2_p1 != null) sets.push(`${partido.set2_p1}-${partido.set2_p2}`)
  if (partido.set3_p1 != null) sets.push(`${partido.set3_p1}-${partido.set3_p2}`)
  return sets.join('  ')
}

// ── Selects de jugador sin duplicados ────────────────────────────────────────

function JugadorSelect({ id, label, value, onChange, jugadores, excluir = [], disabled }) {
  const opciones = jugadores.filter((j) => !excluir.includes(j.id) || j.id === value)
  return (
    <div className="flex-1 min-w-0">
      <label htmlFor={id} className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="h-9 text-sm">
          <SelectValue placeholder="Jugador..." />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((j) => (
            <SelectItem key={j.id} value={j.id}>
              {j.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── Input de set ──────────────────────────────────────────────────────────────

function SetInput({ id, label, vP1, vP2, onP1, onP2, required }) {
  const idP1 = `${id}-p1`
  const idP2 = `${id}-p2`
  return (
    <div>
      <label htmlFor={idP1} className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {label}{required && ' *'}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={idP1}
          name={idP1}
          type="number"
          min="0"
          max="99"
          value={vP1}
          onChange={(e) => onP1(e.target.value)}
          className="h-9 text-center"
          placeholder="P1"
        />
        <span className="text-gray-400 font-bold">-</span>
        <Input
          id={idP2}
          name={idP2}
          type="number"
          min="0"
          max="99"
          value={vP2}
          onChange={(e) => onP2(e.target.value)}
          className="h-9 text-center"
          placeholder="P2"
        />
      </div>
    </div>
  )
}

// ── Formulario de partido ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  fecha: todayISO(),
  p1j1: '', p1j2: '', p2j1: '', p2j2: '',
  set1p1: '', set1p2: '',
  set2p1: '', set2p2: '',
  set3p1: '', set3p2: '',
  noFinalizado: false,
}

function FormPartido({ jugadores, partidoEdit, soloSets, onGuardar, onCancelar, onEliminar, esAdmin, saving }) {
  const [form, setForm] = useState(() => {
    if (!partidoEdit) return EMPTY_FORM
    return {
      fecha: partidoEdit.fecha,
      p1j1: partidoEdit.p1_jugador1_id ?? '',
      p1j2: partidoEdit.p1_jugador2_id ?? '',
      p2j1: partidoEdit.p2_jugador1_id ?? '',
      p2j2: partidoEdit.p2_jugador2_id ?? '',
      set1p1: partidoEdit.set1_p1 ?? '',
      set1p2: partidoEdit.set1_p2 ?? '',
      set2p1: partidoEdit.set2_p1 ?? '',
      set2p2: partidoEdit.set2_p2 ?? '',
      set3p1: partidoEdit.set3_p1 ?? '',
      set3p2: partidoEdit.set3_p2 ?? '',
      noFinalizado: partidoEdit.resultado === 'no_finalizado',
    }
  })

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resultado = calcularResultado(form, form.noFinalizado)

  const seleccionados = [form.p1j1, form.p1j2, form.p2j1, form.p2j2].filter(Boolean)
  const parejasCompletas = form.p1j1 && form.p1j2 && form.p2j1 && form.p2j2 && new Set(seleccionados).size === 4

  const set1Completo = form.set1p1 !== '' && form.set1p2 !== ''
  const canSave = parejasCompletas && set1Completo

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave) return
    const datos = {
      fecha: form.fecha,
      p1_jugador1_id: form.p1j1,
      p1_jugador2_id: form.p1j2,
      p2_jugador1_id: form.p2j1,
      p2_jugador2_id: form.p2j2,
      set1_p1: Number(form.set1p1),
      set1_p2: Number(form.set1p2),
      set2_p1: form.set2p1 !== '' ? Number(form.set2p1) : null,
      set2_p2: form.set2p2 !== '' ? Number(form.set2p2) : null,
      set3_p1: form.set3p1 !== '' ? Number(form.set3p1) : null,
      set3_p2: form.set3p2 !== '' ? Number(form.set3p2) : null,
      resultado,
    }
    await onGuardar(datos)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Fecha */}
      <div>
        <label htmlFor="partido-fecha" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          Fecha
        </label>
        <Input
          id="partido-fecha"
          name="partido-fecha"
          type="date"
          value={form.fecha}
          onChange={(e) => set('fecha', e.target.value)}
          className="h-10"
          disabled={soloSets}
        />
      </div>

      {/* Parejas */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pareja 1</p>
          <div className="flex gap-2">
            <JugadorSelect
              id="jugador-p1j1"
              label="Jugador 1"
              value={form.p1j1}
              onChange={(v) => set('p1j1', v)}
              jugadores={jugadores}
              excluir={seleccionados}
              disabled={soloSets}
            />
            <JugadorSelect
              id="jugador-p1j2"
              label="Jugador 2"
              value={form.p1j2}
              onChange={(v) => set('p1j2', v)}
              jugadores={jugadores}
              excluir={seleccionados}
              disabled={soloSets}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
          <div className="flex-1 h-px bg-gray-100" />
          vs
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pareja 2</p>
          <div className="flex gap-2">
            <JugadorSelect
              id="jugador-p2j1"
              label="Jugador 1"
              value={form.p2j1}
              onChange={(v) => set('p2j1', v)}
              jugadores={jugadores}
              excluir={seleccionados}
              disabled={soloSets}
            />
            <JugadorSelect
              id="jugador-p2j2"
              label="Jugador 2"
              value={form.p2j2}
              onChange={(v) => set('p2j2', v)}
              jugadores={jugadores}
              excluir={seleccionados}
              disabled={soloSets}
            />
          </div>
        </div>
      </div>

      {/* Sets */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sets</p>
        <SetInput
          id="set1"
          label="Set 1"
          required
          vP1={form.set1p1} onP1={(v) => set('set1p1', v)}
          vP2={form.set1p2} onP2={(v) => set('set1p2', v)}
        />
        <SetInput
          id="set2"
          label="Set 2"
          vP1={form.set2p1} onP1={(v) => set('set2p1', v)}
          vP2={form.set2p2} onP2={(v) => set('set2p2', v)}
        />
        <SetInput
          id="set3"
          label="Set 3"
          vP1={form.set3p1} onP1={(v) => set('set3p1', v)}
          vP2={form.set3p2} onP2={(v) => set('set3p2', v)}
        />
      </div>

      {/* No finalizado */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.noFinalizado}
          onChange={(e) => set('noFinalizado', e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm font-medium text-gray-700">Partido no finalizado</span>
      </label>

      {/* Resultado calculado */}
      {set1Completo && parejasCompletas && (() => {
        const n = (id) => resolverNombre(id, jugadores)
        const label =
          resultado === 'pareja1' ? `${n(form.p1j1)} / ${n(form.p1j2)} ganan` :
          resultado === 'pareja2' ? `${n(form.p2j1)} / ${n(form.p2j2)} ganan` :
          'No finalizado'
        const className =
          resultado === 'pareja1' ? 'bg-green-100 text-green-800' :
          resultado === 'pareja2' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Resultado calculado:</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}>
            {label}
          </span>
        </div>
        )
      })()}

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        {onEliminar && esAdmin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive shrink-0"
            onClick={onEliminar}
            disabled={saving}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onCancelar}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={!canSave || saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

// ── Card de partido ───────────────────────────────────────────────────────────

function PartidoCard({ partido, jugadorActualId, esAdmin, onEditar }) {
  const res = resultadoParaJugador(partido, jugadorActualId)
  const colorClass = COLOR_FONDO[res]
  const { puede } = puedeEditar(partido, jugadorActualId, esAdmin)

  const p1 = [partido.p1j1?.nombre, partido.p1j2?.nombre].filter(Boolean).join(' / ')
  const p2 = [partido.p2j1?.nombre, partido.p2j2?.nombre].filter(Boolean).join(' / ')

  return (
    <Card className={`border ${colorClass}`}>
      <CardContent className="px-2 sm:px-4 py-3 overflow-x-auto">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-1">{formatDate(partido.fecha)}</p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug break-words">
              {p1} <span className="text-gray-400 font-normal">vs</span> {p2}
            </p>
            <p className="text-sm sm:text-base font-bold text-gray-800 mt-1 tracking-wide">
              {setsDisplay(partido)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0 max-w-[35%]">
            {partido.resultado && (() => {
              const { label, className } = resultadoBadge(partido)
              return (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full ${className}`}>
                  {label}
                </span>
              )
            })()}
            {puede && (
              <button
                onClick={onEditar}
                className="text-gray-400 hover:text-primary transition-colors p-1 -mr-1"
                aria-label="Editar partido"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Modal / panel de formulario ───────────────────────────────────────────────

function PanelFormulario({ children, titulo, onCerrar }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100 sticky top-0 bg-white">
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-700 transition-colors p-1 -ml-1">
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="flex-1 text-base font-bold text-gray-900">{titulo}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-gray-700 transition-colors p-1 -mr-1">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ── Página principal (liga estándar) ────────────────────────────────────────

function PartidosEstandar() {
  const { user } = useAuth()
  const { ligaActiva, jugadorActual } = useLiga()

  const [partidos, setPartidos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [panelAbierto, setPanelAbierto] = useState(false)
  const [partidoEdit, setPartidoEdit] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errorForm, setErrorForm] = useState(null)

  const esAdmin = rol === 'admin'

  useEffect(() => {
    if (!ligaActiva?.id || !user?.id) return

    async function cargar() {
      try {
        setLoading(true)
        const [listaPartidos, listaJugadores, miRol] = await Promise.all([
          getPartidosLiga(ligaActiva.id),
          getJugadoresLiga(ligaActiva.id),
          getMiRolEnLiga(ligaActiva.id, user.id),
        ])
        setPartidos(listaPartidos)
        setJugadores(listaJugadores)
        setRol(miRol)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id, user?.id])

  function abrirNuevo() {
    setPartidoEdit(null)
    setErrorForm(null)
    setPanelAbierto(true)
  }

  function abrirEditar(partido) {
    setPartidoEdit(partido)
    setErrorForm(null)
    setPanelAbierto(true)
  }

  function cerrarPanel() {
    setPanelAbierto(false)
    setPartidoEdit(null)
  }

  async function handleGuardar(datos) {
    setErrorForm(null)
    try {
      setSaving(true)
      if (partidoEdit) {
        const { pareja } = puedeEditar(partidoEdit, jugadorActual?.id, esAdmin)
        const actualizado = await editarPartido(partidoEdit.id, datos, pareja)
        const listaActualizada = await getPartidosLiga(ligaActiva.id)
        setPartidos(listaActualizada)
      } else {
        await crearPartido(ligaActiva.id, user.id, datos)
        const listaActualizada = await getPartidosLiga(ligaActiva.id)
        setPartidos(listaActualizada)
      }
      cerrarPanel()
    } catch (err) {
      setErrorForm(err.message || 'Error al guardar el partido')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar() {
    if (!partidoEdit) return
    if (!confirm('¿Eliminar este partido?')) return
    try {
      setSaving(true)
      await eliminarPartido(partidoEdit.id)
      setPartidos((prev) => prev.filter((p) => p.id !== partidoEdit.id))
      cerrarPanel()
    } catch (err) {
      setErrorForm(err.message || 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando partidos...</p>
  }

  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }

  const soloSets = !!partidoEdit && !esAdmin

  return (
    <div className="space-y-3 pb-20">
      {partidos.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎾</p>
          <p className="text-sm text-muted-foreground">No hay partidos registrados aún</p>
        </div>
      ) : (
        partidos.map((p) => (
          <PartidoCard
            key={p.id}
            partido={p}
            jugadorActualId={jugadorActual?.id}
            esAdmin={esAdmin}
            onEditar={() => abrirEditar(p)}
          />
        ))
      )}

      {/* FAB */}
      <button
        onClick={abrirNuevo}
        className="fixed bottom-20 right-1/2 translate-x-[calc(50%+min(calc(50vw-1rem),192px))] bg-primary text-white rounded-full size-14 flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors z-40"
        aria-label="Añadir partido"
      >
        <Plus className="size-6" />
      </button>

      {/* Panel formulario */}
      {panelAbierto && (
        <PanelFormulario
          titulo={partidoEdit ? 'Editar partido' : 'Nuevo partido'}
          onCerrar={cerrarPanel}
        >
          <FormPartido
            jugadores={jugadores}
            partidoEdit={partidoEdit}
            soloSets={soloSets}
            esAdmin={esAdmin}
            onGuardar={handleGuardar}
            onCancelar={cerrarPanel}
            onEliminar={partidoEdit ? handleEliminar : null}
            saving={saving}
          />
          {errorForm && (
            <p className="text-destructive text-sm mt-3">{errorForm}</p>
          )}
        </PanelFormulario>
      )}
    </div>
  )
}

// ── Página principal (liga torneo) ──────────────────────────────────────────

function formatFecha(isoTimestamp) {
  if (!isoTimestamp) return ''
  return new Date(isoTimestamp).toLocaleDateString('es-ES')
}

function tituloRondaPlayoff(tipo, numeroRelativo) {
  if (tipo === 'final') return 'Gran Final'
  if (tipo === 'wb') return `WB Ronda ${numeroRelativo}`
  if (tipo === 'lb') return `LB Ronda ${numeroRelativo}`
  return 'Ronda'
}

// Agrupa los partidos de playoff por ronda y calcula, para WB/LB, el número
// relativo dentro de su lado (1, 2, 3... contando solo rondas del mismo tipo)
// en vez del número absoluto de ronda de toda la liga — mismo criterio que
// `contarRondaRelativa()` en torneo.service.js, pero calculado aquí en
// cliente ya que los partidos ya traen ronda_tipo/ronda_numero resueltos.
function agruparPlayoffPorRonda(partidos) {
  const numerosPorTipo = { wb: new Set(), lb: new Set() }
  for (const p of partidos) {
    if (p.ronda_tipo === 'wb' || p.ronda_tipo === 'lb') numerosPorTipo[p.ronda_tipo].add(p.ronda_numero)
  }
  const ordenPorTipo = {
    wb: [...numerosPorTipo.wb].sort((a, b) => a - b),
    lb: [...numerosPorTipo.lb].sort((a, b) => a - b),
  }

  const porRondaId = new Map()
  for (const p of partidos) {
    if (!porRondaId.has(p.ronda_id)) porRondaId.set(p.ronda_id, [])
    porRondaId.get(p.ronda_id).push(p)
  }

  const grupos = [...porRondaId.entries()].map(([rondaId, partidosRonda]) => {
    const { ronda_tipo: tipo, ronda_numero: numero } = partidosRonda[0]
    const numeroRelativo = tipo === 'wb' || tipo === 'lb' ? ordenPorTipo[tipo].indexOf(numero) + 1 : null
    return { rondaId, tipo, numero, numeroRelativo, partidos: partidosRonda }
  })

  return grupos.sort((a, b) => a.numero - b.numero)
}

function PartidoTorneoCard({ partido, jugadorActualId, esAdmin, onEditar }) {
  const res = resultadoParaJugador(partido, jugadorActualId)
  const colorClass = COLOR_FONDO[res]
  const { puede } = puedeEditarTorneo(esAdmin)

  const p1 = [partido.p1j1?.nombre, partido.p1j2?.nombre].filter(Boolean).join(' / ')
  const p2 = [partido.p2j1?.nombre, partido.p2j2?.nombre].filter(Boolean).join(' / ')

  return (
    <Card className={`border ${colorClass}`}>
      <CardContent className="px-2 sm:px-4 py-3 overflow-x-auto">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-1">{formatFecha(partido.created_at)}</p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug break-words">
              {p1} <span className="text-gray-400 font-normal">vs</span> {p2}
            </p>
            {partido.resultado && (
              <p className="text-sm sm:text-base font-bold text-gray-800 mt-1 tracking-wide">
                {setsDisplay(partido)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0 max-w-[35%]">
            {partido.resultado ? (() => {
              const { label, className } = resultadoBadge(partido)
              return (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full truncate max-w-full ${className}`}>
                  {label}
                </span>
              )
            })() : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                Sin resultado
              </span>
            )}
            {puede && (
              <button
                onClick={onEditar}
                className="text-gray-400 hover:text-primary transition-colors p-1 -mr-1"
                aria-label="Editar partido"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SeccionPartidosTorneo({ titulo, partidos, jugadorActualId, esAdmin, onEditar }) {
  if (partidos.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{titulo}</p>
      <div className="space-y-2">
        {partidos.map((p) => (
          <PartidoTorneoCard
            key={p.id}
            partido={p}
            jugadorActualId={jugadorActualId}
            esAdmin={esAdmin}
            onEditar={() => onEditar(p)}
          />
        ))}
      </div>
    </div>
  )
}

function PartidosTorneo() {
  const { user } = useAuth()
  const { ligaActiva, jugadorActual } = useLiga()

  const [partidos, setPartidos] = useState([])
  const [rol, setRol] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partidoModal, setPartidoModal] = useState(null)

  const esAdmin = rol === 'admin'
  const jugadorActualId = jugadorActual?.id ?? null

  useEffect(() => {
    if (!ligaActiva?.id || !user?.id) return

    async function cargar() {
      try {
        setLoading(true)
        setError(null)
        const [listaPartidos, miRol] = await Promise.all([
          getTodosPartidosTorneo(ligaActiva.id),
          getMiRolEnLiga(ligaActiva.id, user.id),
        ])
        setPartidos(listaPartidos)
        setRol(miRol)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id, user?.id])

  async function recargarPartidos() {
    setPartidos(await getTodosPartidosTorneo(ligaActiva.id))
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando partidos...</p>
  }
  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }

  if (partidos.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🎾</p>
        <p className="text-sm text-muted-foreground">No hay partidos registrados aún</p>
      </div>
    )
  }

  const partidosSuiza = partidos.filter((p) => p.ronda_tipo === 'suiza')
  const partidosExtra = partidos.filter((p) => p.ronda_tipo === 'extra')
  const partidosPlayoff = partidos.filter((p) => ['wb', 'lb', 'final'].includes(p.ronda_tipo))
  const gruposPlayoff = agruparPlayoffPorRonda(partidosPlayoff)

  return (
    <div className="space-y-5 pb-8">
      <SeccionPartidosTorneo
        titulo="Fase suiza"
        partidos={partidosSuiza}
        jugadorActualId={jugadorActualId}
        esAdmin={esAdmin}
        onEditar={setPartidoModal}
      />
      <SeccionPartidosTorneo
        titulo="Ronda extra"
        partidos={partidosExtra}
        jugadorActualId={jugadorActualId}
        esAdmin={esAdmin}
        onEditar={setPartidoModal}
      />

      {gruposPlayoff.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Playoff</p>
          {gruposPlayoff.map((grupo) => (
            <SeccionPartidosTorneo
              key={grupo.rondaId}
              titulo={tituloRondaPlayoff(grupo.tipo, grupo.numeroRelativo)}
              partidos={grupo.partidos}
              jugadorActualId={jugadorActualId}
              esAdmin={esAdmin}
              onEditar={setPartidoModal}
            />
          ))}
        </div>
      )}

      {partidoModal && (
        <RegistrarResultadoModal
          partido={partidoModal}
          jugadorActualId={jugadorActualId}
          esAdmin={esAdmin}
          onClose={() => setPartidoModal(null)}
          onGuardado={async () => {
            setPartidoModal(null)
            await recargarPartidos()
          }}
        />
      )}
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function Partidos() {
  const { ligaActiva } = useLiga()
  if (ligaActiva?.tipo === 'torneo') return <PartidosTorneo />
  return <PartidosEstandar />
}
