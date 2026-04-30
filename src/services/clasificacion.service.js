import { supabase } from '../lib/supabase'

export async function calcularClasificacion(ligaId, ligaConfig) {
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

  const [{ data: todosPartidos, error: errorPartidos }, { data: jugadores, error: errorJugadores }] =
    await Promise.all([
      supabase.from('partidos').select('*').eq('liga_id', ligaId).order('fecha', { ascending: false }),
      supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId).eq('activo', true),
    ])

  if (errorPartidos) throw errorPartidos
  if (errorJugadores) throw errorJugadores

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  let partidos = todosPartidos ?? []

  if (ventana_dias !== null) {
    const limite = new Date(hoy)
    limite.setDate(limite.getDate() - ventana_dias)
    partidos = partidos.filter((p) => new Date(p.fecha) >= limite)
  }

  function puntosPartido(resultado) {
    if (resultado === 'no_finalizado') return pts_no_finalizado
    return null
  }

  const jugadorMap = {}
  for (const j of jugadores ?? []) {
    jugadorMap[j.id] = {
      jugadorId: j.id,
      nombre: j.nombre,
      partidosDetalle: [],
    }
  }

  for (const p of partidos) {
    const ids = [
      { id: p.p1_jugador1_id, pareja: 'p1' },
      { id: p.p1_jugador2_id, pareja: 'p1' },
      { id: p.p2_jugador1_id, pareja: 'p2' },
      { id: p.p2_jugador2_id, pareja: 'p2' },
    ]

    const setsGanadosP1 = contarSetsGanados(p, 'p1')
    const setsGanadosP2 = contarSetsGanados(p, 'p2')
    const setsTotalesP1 = setsGanadosP1 + setsGanadosP2
    const setsTotalesP2 = setsTotalesP1

    for (const { id, pareja } of ids) {
      if (!id || !jugadorMap[id]) continue
      const gana = pareja === 'p1' ? 'pareja1' : 'pareja2'
      const pierde = pareja === 'p1' ? 'pareja2' : 'pareja1'
      let resultado, puntos, setsGanados, setsTotales

      if (p.resultado === 'no_finalizado') {
        resultado = 'no_finalizado'
        puntos = Number(pts_no_finalizado)
        setsGanados = pareja === 'p1' ? setsGanadosP1 : setsGanadosP2
        setsTotales = setsTotalesP1
      } else if (p.resultado === gana) {
        resultado = 'victoria'
        puntos = Number(pts_victoria)
        setsGanados = pareja === 'p1' ? setsGanadosP1 : setsGanadosP2
        setsTotales = setsTotalesP1
      } else {
        resultado = 'derrota'
        puntos = Number(pts_derrota)
        setsGanados = pareja === 'p1' ? setsGanadosP1 : setsGanadosP2
        setsTotales = setsTotalesP1
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
    const setsTotales = detalle.reduce((sum, d) => sum + d.setsTotales, 0)

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
          valorRanking = setsTotales > 0 ? setsGanados / setsTotales : 0
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
      valorRanking,
      sinRanking,
      posicion: null,
    })
  }

  clasificacion.sort((a, b) => {
    if (a.sinRanking && !b.sinRanking) return 1
    if (!a.sinRanking && b.sinRanking) return -1
    return (b.valorRanking ?? 0) - (a.valorRanking ?? 0)
  })

  let pos = 1
  for (const entry of clasificacion) {
    if (!entry.sinRanking) {
      entry.posicion = pos++
    }
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
