import { useEffect, useRef, useState } from 'react'
import { Trash2, RotateCcw, Copy, Check, Plus, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLiga } from '../../context/LigaContext'
import { actualizarLiga } from '../../services/ligas.service'
import {
  getTodosJugadoresLiga,
  crearJugador,
  archivarJugador,
  desarchivarJugador,
} from '../../services/jugadores.service'
import { getMiembros, cambiarRol } from '../../services/miembros.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Hook de feedback con auto-limpieza ────────────────────────────────────────

function useFeedback() {
  const [feedback, setFeedback] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function show(type, message) {
    clearTimeout(timerRef.current)
    setFeedback({ type, message })
    timerRef.current = setTimeout(() => setFeedback(null), 3000)
  }

  return [feedback, show]
}

function FeedbackMsg({ feedback }) {
  if (!feedback) return null
  return (
    <p className={`text-sm mt-2 ${feedback.type === 'success' ? 'text-primary' : 'text-destructive'}`}>
      {feedback.message}
    </p>
  )
}

// ── Sección 1: Información de la liga ────────────────────────────────────────

function SeccionInfo({ liga, onGuardado }) {
  const [nombre, setNombre] = useState(liga?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(liga?.descripcion ?? '')
  const [copiado, setCopiado] = useState(false)
  const [savingNombre, setSavingNombre] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [feedbackNombre, showFeedbackNombre] = useFeedback()
  const [feedbackDesc, showFeedbackDesc] = useFeedback()

  useEffect(() => {
    setNombre(liga?.nombre ?? '')
    setDescripcion(liga?.descripcion ?? '')
  }, [liga?.id])

  async function guardarNombre() {
    if (!nombre.trim() || nombre.trim() === liga.nombre) return
    try {
      setSavingNombre(true)
      const updated = await actualizarLiga(liga.id, { nombre: nombre.trim() })
      onGuardado(updated)
      showFeedbackNombre('success', 'Nombre actualizado')
    } catch {
      showFeedbackNombre('error', 'Error al guardar')
    } finally {
      setSavingNombre(false)
    }
  }

  async function guardarDescripcion() {
    if (descripcion === (liga.descripcion ?? '')) return
    try {
      setSavingDesc(true)
      const updated = await actualizarLiga(liga.id, {
        descripcion: descripcion.trim() || null,
      })
      onGuardado(updated)
      showFeedbackDesc('success', 'Descripción actualizada')
    } catch {
      showFeedbackDesc('error', 'Error al guardar')
    } finally {
      setSavingDesc(false)
    }
  }

  async function copiarCodigo() {
    await navigator.clipboard.writeText(liga.codigo_invitacion)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de la liga</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <label htmlFor="liga-nombre" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Nombre
          </label>
          <div className="flex gap-2">
            <Input
              id="liga-nombre"
              name="liga-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-10"
            />
            <Button
              size="sm"
              className="shrink-0 h-10"
              onClick={guardarNombre}
              disabled={savingNombre || !nombre.trim() || nombre.trim() === liga.nombre}
            >
              {savingNombre ? '...' : 'Guardar'}
            </Button>
          </div>
          <FeedbackMsg feedback={feedbackNombre} />
        </div>

        <div>
          <label htmlFor="liga-descripcion" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Descripción
          </label>
          <textarea
            id="liga-descripcion"
            name="liga-descripcion"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y min-h-[72px] mb-2"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
          />
          <Button
            size="sm"
            onClick={guardarDescripcion}
            disabled={savingDesc || descripcion === (liga.descripcion ?? '')}
          >
            {savingDesc ? '...' : 'Guardar descripción'}
          </Button>
          <FeedbackMsg feedback={feedbackDesc} />
        </div>

        <Separator />

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Código de invitación
          </label>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
            <span className="flex-1 text-xl font-bold tracking-[0.4em] text-gray-900">
              {liga.codigo_invitacion}
            </span>
            <Button variant="outline" size="sm" onClick={copiarCodigo} className="shrink-0 gap-1.5">
              {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Sección 2: Jugadores del ranking ─────────────────────────────────────────

function SeccionJugadores({ ligaId, jugadores, onCambio }) {
  const [mostrarInput, setMostrarInput] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, showFeedback] = useFeedback()

  const activos = jugadores.filter((j) => j.activo)
  const archivados = jugadores.filter((j) => !j.activo)

  async function handleCrear(e) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return
    try {
      setLoading(true)
      const nuevo = await crearJugador(ligaId, nuevoNombre.trim())
      onCambio([...jugadores, nuevo])
      setNuevoNombre('')
      setMostrarInput(false)
      showFeedback('success', `${nuevo.nombre} añadido`)
    } catch {
      showFeedback('error', 'Error al añadir jugador')
    } finally {
      setLoading(false)
    }
  }

  async function handleArchivar(jugador) {
    try {
      await archivarJugador(jugador.id)
      onCambio(jugadores.map((j) => j.id === jugador.id ? { ...j, activo: false } : j))
    } catch {
      showFeedback('error', 'Error al archivar jugador')
    }
  }

  async function handleRestaurar(jugador) {
    try {
      await desarchivarJugador(jugador.id)
      onCambio(jugadores.map((j) => j.id === jugador.id ? { ...j, activo: true } : j))
    } catch {
      showFeedback('error', 'Error al restaurar jugador')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jugadores del ranking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {activos.length === 0 && !mostrarInput && (
          <p className="text-sm text-muted-foreground py-1">No hay jugadores activos</p>
        )}

        {activos.map((j) => (
          <div key={j.id} className="flex items-center gap-2 py-1.5">
            <span className="flex-1 text-sm font-medium">{j.nombre}</span>
            <Badge variant={j.usuario_id ? 'default' : 'secondary'} className="shrink-0">
              {j.usuario_id ? 'Con cuenta' : 'Sin cuenta'}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-gray-300 hover:text-destructive shrink-0"
              onClick={() => handleArchivar(j)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        {mostrarInput ? (
          <form onSubmit={handleCrear} className="flex gap-2 pt-2">
            <Input
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombre del jugador"
              className="h-9"
              autoFocus
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              className="shrink-0 h-9"
              disabled={loading || !nuevoNombre.trim()}
            >
              {loading ? '...' : 'Añadir'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 h-9 w-9"
              onClick={() => { setMostrarInput(false); setNuevoNombre('') }}
            >
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2 gap-1.5"
            onClick={() => setMostrarInput(true)}
          >
            <Plus className="size-4" />
            Añadir jugador
          </Button>
        )}

        <FeedbackMsg feedback={feedback} />

        {archivados.length > 0 && (
          <>
            <Separator className="my-3" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pb-1">
              Archivados
            </p>
            {archivados.map((j) => (
              <div key={j.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 text-sm text-muted-foreground">{j.nombre}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-gray-300 hover:text-primary shrink-0"
                  title="Restaurar"
                  onClick={() => handleRestaurar(j)}
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Sección 3: Sistema de puntuación ─────────────────────────────────────────

const CRITERIO_OPTS = [
  { value: 'mas_recientes', label: 'Los más recientes' },
  { value: 'mejores_resultados', label: 'Los mejores resultados' },
  { value: 'recientes_sin_peores', label: 'Más recientes excluyendo los peores' },
]

function getCriterioDescripcion(criterio, maxPartidos) {
  const n = maxPartidos !== '' ? Number(maxPartidos) : null
  const nStr = n !== null ? n : '—'
  switch (criterio) {
    case 'recientes_sin_peores':
      return `Analiza los últimos ${n !== null ? n + 5 : '—'} partidos y descarta los 5 peores`
    case 'mejores_resultados':
      return `De todos tus partidos cuenta solo los ${nStr} con mejor resultado`
    case 'mas_recientes':
      return `Cuentan los ${nStr} partidos más recientes`
    default:
      return null
  }
}

const RANKING_OPTS = [
  { value: 'puntos_totales', label: 'Puntos totales' },
  { value: 'media_puntos', label: 'Media de puntos por partido' },
  { value: 'ratio_sets', label: 'Ratio de sets ganados' },
  { value: 'media_puntos_minimo', label: 'Media con mínimo de partidos' },
]

function SeccionPuntuacion({ liga, onGuardado }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [feedback, showFeedback] = useFeedback()

  useEffect(() => {
    if (!liga) return
    setForm({
      pts_victoria: liga.pts_victoria ?? 3,
      pts_derrota: liga.pts_derrota ?? 1,
      pts_no_finalizado: liga.pts_no_finalizado ?? 1.5,
      ventana_dias: liga.ventana_dias != null ? String(liga.ventana_dias) : '',
      max_partidos: liga.max_partidos != null ? String(liga.max_partidos) : '',
      criterio_seleccion: liga.criterio_seleccion ?? 'mas_recientes',
      metodo_ranking: liga.metodo_ranking ?? 'puntos_totales',
      min_partidos_ranking: liga.min_partidos_ranking ?? 3,
    })
  }, [liga])

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const criterioNecesitaMax = ['mejores_resultados', 'recientes_sin_peores'].includes(form?.criterio_seleccion)
  const errorMaxPartidos = criterioNecesitaMax && form?.max_partidos === ''
    ? 'Este criterio requiere definir un máximo de partidos'
    : null
  const errorMinPartidos = form?.metodo_ranking === 'media_puntos_minimo' && !String(form?.min_partidos_ranking ?? '').trim()
    ? 'Este método requiere definir un mínimo de partidos'
    : null
  const avisoVentana = form?.ventana_dias === ''
    ? 'Sin ventana temporal todos los partidos cuentan sin límite de tiempo'
    : null

  async function guardar() {
    if (errorMaxPartidos || errorMinPartidos) return
    try {
      setSaving(true)
      const datos = {
        pts_victoria: Number(form.pts_victoria),
        pts_derrota: Number(form.pts_derrota),
        pts_no_finalizado: Number(form.pts_no_finalizado),
        ventana_dias: form.ventana_dias === '' ? null : Number(form.ventana_dias),
        max_partidos: form.max_partidos === '' ? null : Number(form.max_partidos),
        criterio_seleccion: form.criterio_seleccion,
        metodo_ranking: form.metodo_ranking,
        min_partidos_ranking: Number(form.min_partidos_ranking),
      }
      const updated = await actualizarLiga(liga.id, datos)
      onGuardado(updated)
      showFeedback('success', 'Configuración guardada')
    } catch {
      showFeedback('error', 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sistema de puntuación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { field: 'pts_victoria', label: 'Victoria' },
            { field: 'pts_derrota', label: 'Derrota' },
            { field: 'pts_no_finalizado', label: 'No finalizado' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label htmlFor={field} className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {label}
              </label>
              <Input
                id={field}
                name={field}
                type="number"
                min="0"
                step="0.5"
                value={form[field]}
                onChange={(e) => setField(field, e.target.value)}
                className="h-10"
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ventana-dias" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Ventana (días)
            </label>
            <Input
              id="ventana-dias"
              name="ventana-dias"
              type="number"
              min="1"
              value={form.ventana_dias}
              onChange={(e) => setField('ventana_dias', e.target.value)}
              className="h-10"
              placeholder="Sin límite"
            />
            {avisoVentana && (
              <p className="text-amber-600 text-xs mt-1">{avisoVentana}</p>
            )}
          </div>
          <div>
            <label htmlFor="max-partidos" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Máx. partidos
            </label>
            <Input
              id="max-partidos"
              name="max-partidos"
              type="number"
              min="1"
              value={form.max_partidos}
              onChange={(e) => setField('max_partidos', e.target.value)}
              className={`h-10 ${errorMaxPartidos ? 'border-destructive' : ''}`}
              placeholder="Sin límite"
            />
            {errorMaxPartidos && (
              <p className="text-destructive text-xs mt-1">{errorMaxPartidos}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Criterio de selección
          </label>
          <Select value={form.criterio_seleccion} onValueChange={(v) => setField('criterio_seleccion', v)}>
            <SelectTrigger className="w-full h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRITERIO_OPTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {getCriterioDescripcion(form.criterio_seleccion, form.max_partidos) && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {getCriterioDescripcion(form.criterio_seleccion, form.max_partidos)}
            </p>
          )}
        </div>

        <Separator />

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Método de ranking
          </label>
          <Select value={form.metodo_ranking} onValueChange={(v) => setField('metodo_ranking', v)}>
            <SelectTrigger className="w-full h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANKING_OPTS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {form.metodo_ranking === 'media_puntos_minimo' && (
          <div>
            <label htmlFor="min-partidos-ranking" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Mínimo de partidos para el ranking
            </label>
            <Input
              id="min-partidos-ranking"
              name="min-partidos-ranking"
              type="number"
              min="1"
              value={form.min_partidos_ranking}
              onChange={(e) => setField('min_partidos_ranking', e.target.value)}
              className={`h-10 w-24 ${errorMinPartidos ? 'border-destructive' : ''}`}
            />
            {errorMinPartidos && (
              <p className="text-destructive text-xs mt-1">{errorMinPartidos}</p>
            )}
          </div>
        )}

        <Button
          className="w-full"
          onClick={guardar}
          disabled={saving || !!errorMaxPartidos || !!errorMinPartidos}
        >
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
        <FeedbackMsg feedback={feedback} />
      </CardContent>
    </Card>
  )
}

// ── Sección 4: Miembros con cuenta ────────────────────────────────────────────

function SeccionMiembros({ ligaId, miembros, userId, onCambio }) {
  const [roles, setRoles] = useState({})
  const [saving, setSaving] = useState({})
  const [feedback, showFeedback] = useFeedback()

  useEffect(() => {
    const initial = {}
    miembros.forEach((m) => { initial[m.usuario_id] = m.rol })
    setRoles(initial)
  }, [miembros])

  async function handleCambiarRol(miembro, nuevoRol) {
    const prevRol = roles[miembro.usuario_id]
    setRoles((prev) => ({ ...prev, [miembro.usuario_id]: nuevoRol }))
    setSaving((prev) => ({ ...prev, [miembro.usuario_id]: true }))
    try {
      await cambiarRol(ligaId, miembro.usuario_id, nuevoRol)
      onCambio(miembros.map((m) =>
        m.usuario_id === miembro.usuario_id ? { ...m, rol: nuevoRol } : m
      ))
      showFeedback('success', `Rol de ${miembro.usuarios?.nombre} actualizado`)
    } catch {
      setRoles((prev) => ({ ...prev, [miembro.usuario_id]: prevRol }))
      showFeedback('error', 'Error al cambiar el rol')
    } finally {
      setSaving((prev) => ({ ...prev, [miembro.usuario_id]: false }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Miembros con cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {miembros.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay miembros con cuenta</p>
        )}
        {miembros.map((m) => {
          const esMisMismo = m.usuario_id === userId
          const rolActual = roles[m.usuario_id] ?? m.rol

          return (
            <div key={m.id} className="flex items-center gap-3 py-1.5">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {m.usuarios?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">
                  {m.usuarios?.nombre}
                  {esMisMismo && (
                    <span className="text-xs text-muted-foreground ml-1">(tú)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground truncate">{m.usuarios?.email}</p>
              </div>
              {esMisMismo ? (
                <Badge variant={rolActual === 'admin' ? 'default' : 'secondary'} className="shrink-0">
                  {rolActual === 'admin' ? 'Admin' : 'Jugador'}
                </Badge>
              ) : (
                <Select
                  value={rolActual}
                  onValueChange={(v) => handleCambiarRol(m, v)}
                  disabled={saving[m.usuario_id]}
                >
                  <SelectTrigger className="w-28 h-7 text-xs shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="jugador">Jugador</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}
        <FeedbackMsg feedback={feedback} />
      </CardContent>
    </Card>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Configuracion() {
  const { ligaActiva, setLigaActiva } = useLiga()
  const { user } = useAuth()

  const [jugadores, setJugadores] = useState([])
  const [miembros, setMiembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ligaActiva?.id) return

    async function cargar() {
      try {
        setLoading(true)
        const [todosJugadores, todosMiembros] = await Promise.all([
          getTodosJugadoresLiga(ligaActiva.id),
          getMiembros(ligaActiva.id),
        ])
        setJugadores(todosJugadores)
        setMiembros(todosMiembros)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [ligaActiva?.id])

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-8">Cargando...</p>
  }

  if (error) {
    return <p className="text-destructive text-sm text-center py-8">Error: {error}</p>
  }

  if (!ligaActiva) return null

  return (
    <div className="space-y-4 pb-4">
      <SeccionInfo key={`info-${ligaActiva.id}`} liga={ligaActiva} onGuardado={setLigaActiva} />
      <SeccionJugadores
        ligaId={ligaActiva.id}
        jugadores={jugadores}
        onCambio={setJugadores}
      />
      <SeccionPuntuacion key={`puntuacion-${ligaActiva.id}`} liga={ligaActiva} onGuardado={setLigaActiva} />
      <SeccionMiembros
        ligaId={ligaActiva.id}
        miembros={miembros}
        userId={user?.id}
        onCambio={setMiembros}
      />
    </div>
  )
}
