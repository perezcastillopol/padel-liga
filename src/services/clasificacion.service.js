import { supabase } from '../lib/supabase'

export async function calcularClasificacion(ligaId, ligaConfig) {
  const [{ data: todosPartidos, error: errorPartidos }, { data: jugadores, error: errorJugadores }] =
    await Promise.all([
      supabase.from('partidos').select('*').eq('liga_id', ligaId).order('fecha', { ascending: false }),
      supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId).eq('activo', true),
    ])

  if (errorPartidos) throw errorPartidos
  if (errorJugadores) throw errorJugadores

  return calcularRankingDesdePartidos(todosPartidos ?? [], jugadores ?? [], ligaConfig)
}

export async function calcularEvolucionRanking(ligaId, ligaConfig, semanas) {
  const [{ data: todosPartidos, error: ep }, { data: jugadores, error: ej }] = await Promise.all([
    supabase.from('partidos').select('*').eq('liga_id', ligaId).order('fecha', { ascending: true }),
    supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId).eq('activo', true),
  ])

  if (ep) throw ep
  if (ej) throw ej

  const partidos = todosPartidos ?? []
  const jugs = jugadores ?? []

  if (partidos.length === 0) return { semanas: [], evolution: new Map() }

  const hoy = new Date()
  hoy.setHours(23, 59, 59, 999)

  const primerFecha = new Date(partidos[0].fecha)
  const fechaLimite = semanas > 0
    ? new Date(hoy.getTime() - semanas * 7 * 24 * 60 * 60 * 1000)
    : primerFecha

  const inicioSemana = getStartOfWeek(new Date(Math.max(fechaLimite.getTime(), primerFecha.getTime())))

  const semanasArr = []
  const cursor = new Date(inicioSemana)
  while (cursor <= hoy) {
    const finSemana = new Date(cursor)
    finSemana.setDate(finSemana.getDate() + 6)
    finSemana.setHours(23, 59, 59, 999)
    semanasArr.push(finSemana)
    cursor.setDate(cursor.getDate() + 7)
  }

  const evolution = new Map()
  for (const j of jugs) {
    evolution.set(j.id, { nombre: j.nombre, serie: [] })
  }

  for (const finSemana of semanasArr) {
    const clasificacion = calcularRankingDesdePartidos(partidos, jugs, ligaConfig, finSemana)
    for (const entry of clasificacion) {
      if (!evolution.has(entry.jugadorId)) continue
      evolution.get(entry.jugadorId).serie.push({
        posicion: entry.sinRanking ? null : entry.posicion,
        puntos: entry.puntos,
      })
    }
  }

  return { semanas: semanasArr, evolution }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function getStartOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function calcularRankingDesdePartidos(todosPartidos, jugadores, ligaConfig, fechaCorte = null) {
  const {
    pts_victoria = 3,
    pts_derrota = 1,
    pts_no_finalizado = 1.5,
    ventana_dias = null,
    max_partidos = null,
    criterio_seleccion = 'mas_recientes',
    metodo_ranking = 'puntos_totales',
    min_partidos_ranking = 3,
  } = ligaConfig

  const fechaRef = fechaCorte ?? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })()

  let partidos = fechaCorte
    ? todosPartidos.filter((p) => new Date(p.fecha) <= fechaRef)
    : [...todosPartidos]

  partidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  if (ventana_dias !== null) {
    const limite = new Date(fechaRef)
    limite.setDate(limite.getDate() - ventana_dias)
    limite.setHours(0, 0, 0, 0)
    partidos = partidos.filter((p) => new Date(p.fecha) >= limite)
  }

  const jugadorMap = {}
  for (const j of jugadores) {
    jugadorMap[j.id] = { jugadorId: j.id, nombre: j.nombre, partidosDetalle: [] }
  }

  for (const p of partidos) {
    const setsGanadosP1 = contarSetsGanados(p, 'p1')
    const setsGanadosP2 = contarSetsGanados(p, 'p2')
    const setsTotales = setsGanadosP1 + setsGanadosP2

    for (const { id, pareja } of [
      { id: p.p1_jugador1_id, pareja: 'p1' },
      { id: p.p1_jugador2_id, pareja: 'p1' },
      { id: p.p2_jugador1_id, pareja: 'p2' },
      { id: p.p2_jugador2_id, pareja: 'p2' },
    ]) {
      if (!id || !jugadorMap[id]) continue
      const gana = pareja === 'p1' ? 'pareja1' : 'pareja2'
      const setsGanados = pareja === 'p1' ? setsGanadosP1 : setsGanadosP2
      let resultado, puntos

      if (p.resultado === 'no_finalizado') {
        resultado = 'no_finalizado'
        puntos = Number(pts_no_finalizado)
      } else if (p.resultado === gana) {
        resultado = 'victoria'
        puntos = Number(pts_victoria)
      } else {
        resultado = 'derrota'
        puntos = Number(pts_derrota)
      }

      jugadorMap[id].partidosDetalle.push({ fecha: p.fecha, resultado, puntos, setsGanados, setsTotales })
    }
  }

  const clasificacion = []

  for (const jugador of Object.values(jugadorMap)) {
    let detalle = jugador.partidosDetalle
    if (max_partidos !== null && detalle.length > 0) {
      detalle = aplicarCriterio(detalle, criterio_seleccion, max_partidos)
    }

    const totalPartidos = detalle.length
    const victorias = detalle.filter((d) => d.resultado === 'victoria').length
    const derrotas = detalle.filter((d) => d.resultado === 'derrota').length
    const noFinalizados = detalle.filter((d) => d.resultado === 'no_finalizado').length
    const puntos = detalle.reduce((sum, d) => sum + d.puntos, 0)
    const setsGanados = detalle.reduce((sum, d) => sum + d.setsGanados, 0)
    const setsTotalesSum = detalle.reduce((sum, d) => sum + d.setsTotales, 0)

    let valorRanking = null
    let sinRanking = false

    if (totalPartidos === 0) {
      sinRanking = true
    } else {
      switch (metodo_ranking) {
        case 'puntos_totales':
          valorRanking = puntos
          break
        case 'media_puntos':
          valorRanking = puntos / totalPartidos
          break
        case 'ratio_sets':
          valorRanking = setsTotalesSum > 0 ? setsGanados / setsTotalesSum : 0
          break
        case 'media_puntos_minimo':
          if (totalPartidos >= min_partidos_ranking) {
            valorRanking = puntos / totalPartidos
          } else {
            valorRanking = null
            sinRanking = true
          }
          break
      }
    }

    clasificacion.push({
      jugadorId: jugador.jugadorId,
      nombre: jugador.nombre,
      partidos: totalPartidos,
      victorias,
      derrotas,
      noFinalizados,
      puntos,
      setsGanados,
      setsTotales: setsTotalesSum,
      valorRanking,
      sinRanking,
      posicion: null,
    })
  }

  clasificacion.sort((a, b) => {
    if (a.sinRanking && !b.sinRanking) return 1
    if (!a.sinRanking && b.sinRanking) return -1
    if (b.valorRanking !== a.valorRanking) return (b.valorRanking ?? 0) - (a.valorRanking ?? 0)
    if (b.victorias !== a.victorias) return b.victorias - a.victorias
    if (a.derrotas !== b.derrotas) return a.derrotas - b.derrotas
    const ratioA = a.setsTotales > 0 ? a.setsGanados / a.setsTotales : 0
    const ratioB = b.setsTotales > 0 ? b.setsGanados / b.setsTotales : 0
    return ratioB - ratioA
  })

  let pos = 1
  for (const entry of clasificacion) {
    if (!entry.sinRanking) entry.posicion = pos++
  }

  return clasificacion
}

function contarSetsGanados(partido, pareja) {
  let ganados = 0
  const sets = [
    [partido.set1_p1, partido.set1_p2],
    [partido.set2_p1, partido.set2_p2],
    [partido.set3_p1, partido.set3_p2],
  ]
  for (const [p1, p2] of sets) {
    if (p1 == null || p2 == null) continue
    if (pareja === 'p1' && p1 > p2) ganados++
    if (pareja === 'p2' && p2 > p1) ganados++
  }
  return ganados
}

function aplicarCriterio(detalle, criterio, max) {
  switch (criterio) {
    case 'mas_recientes':
      return detalle.slice(0, max)

    case 'mejores_resultados':
      return [...detalle].sort((a, b) => b.puntos - a.puntos).slice(0, max)

    case 'recientes_sin_peores': {
      const pool = detalle.slice(0, max + 5)
      if (pool.length <= max) return pool
      const sorted = [...pool].sort((a, b) => a.puntos - b.puntos)
      const peores = new Set(sorted.slice(0, 5).map((_, i) => i))
      let descartados = 0
      return pool.filter((entry) => {
        const idx = pool.indexOf(entry)
        if (peores.has(idx) && descartados < 5) { descartados++; return false }
        return true
      })
    }

    default:
      return detalle.slice(0, max)
  }
}
