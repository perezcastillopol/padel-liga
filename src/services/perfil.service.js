import { supabase } from '../lib/supabase'

export async function getPartidosConEstado(ligaId, jugadorId, ligaConfig) {
  const {
    pts_victoria = 3,
    pts_derrota = 1,
    pts_no_finalizado = 1.5,
    ventana_dias = null,
    max_partidos = null,
    criterio_seleccion = 'mas_recientes',
    max_partidos_companero = null,
  } = ligaConfig

  const partidos = await getPartidosJugador(ligaId, jugadorId)
  // partidos sorted desc

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  function puntosParaJugador(partido) {
    if (partido.resultado === 'no_finalizado') return Number(pts_no_finalizado)
    const enP1 = partido.p1_jugador1_id === jugadorId || partido.p1_jugador2_id === jugadorId
    if ((enP1 && partido.resultado === 'pareja1') || (!enP1 && partido.resultado === 'pareja2')) {
      return Number(pts_victoria)
    }
    return Number(pts_derrota)
  }

  // Step 1: companion filter (applied before ventana, takes priority)
  const compañeroCount = {}
  const excludedByCompañero = new Set()
  if (max_partidos_companero != null) {
    for (const p of partidos) {
      const enP1 = p.p1_jugador1_id === jugadorId || p.p1_jugador2_id === jugadorId
      const compId = enP1
        ? (p.p1_jugador1_id === jugadorId ? p.p1_jugador2_id : p.p1_jugador1_id)
        : (p.p2_jugador1_id === jugadorId ? p.p2_jugador2_id : p.p2_jugador1_id)
      const key = compId ?? '__solo__'
      compañeroCount[key] = (compañeroCount[key] ?? 0) + 1
      if (compañeroCount[key] > max_partidos_companero) excludedByCompañero.add(p.id)
    }
  }

  // Step 2: ventana temporal (applied to non-companion-excluded partidos)
  let limite = null
  if (ventana_dias !== null) {
    limite = new Date(hoy)
    limite.setDate(limite.getDate() - ventana_dias)
  }

  const dentroVentana = []
  const fueraVentana = []
  for (const p of partidos) {
    if (excludedByCompañero.has(p.id)) continue
    if (limite !== null && new Date(p.fecha) < limite) {
      fueraVentana.push(p)
    } else {
      dentroVentana.push(p)
    }
  }

  const result = []

  if (max_partidos === null || dentroVentana.length <= max_partidos) {
    for (const p of dentroVentana) {
      result.push({ partido: p, computa: true, razonNoComputa: null })
    }
  } else {
    switch (criterio_seleccion) {
      case 'mas_recientes':
        for (let i = 0; i < dentroVentana.length; i++) {
          result.push({
            partido: dentroVentana[i],
            computa: i < max_partidos,
            razonNoComputa: i < max_partidos ? null : 'Supera el máximo de partidos',
          })
        }
        break

      case 'mejores_resultados': {
        const conPuntos = dentroVentana.map((p, i) => ({ i, puntos: puntosParaJugador(p) }))
        const topIndices = new Set(
          [...conPuntos].sort((a, b) => b.puntos - a.puntos).slice(0, max_partidos).map((x) => x.i)
        )
        for (let i = 0; i < dentroVentana.length; i++) {
          result.push({
            partido: dentroVentana[i],
            computa: topIndices.has(i),
            razonNoComputa: topIndices.has(i) ? null : 'No está entre los mejores resultados',
          })
        }
        break
      }

      case 'recientes_sin_peores': {
        const pool = dentroVentana.slice(0, max_partidos + 5)
        const fueraPool = dentroVentana.slice(max_partidos + 5)

        if (pool.length <= max_partidos) {
          for (const p of pool) result.push({ partido: p, computa: true, razonNoComputa: null })
        } else {
          const conPuntos = pool.map((p, i) => ({ i, puntos: puntosParaJugador(p) }))
          const peoresIndices = new Set(
            [...conPuntos].sort((a, b) => a.puntos - b.puntos).slice(0, 5).map((x) => x.i)
          )
          for (let i = 0; i < pool.length; i++) {
            result.push({
              partido: pool[i],
              computa: !peoresIndices.has(i),
              razonNoComputa: peoresIndices.has(i) ? 'Descartado por ser uno de los peores resultados' : null,
            })
          }
        }

        for (const p of fueraPool) {
          result.push({ partido: p, computa: false, razonNoComputa: 'Supera el máximo de partidos' })
        }
        break
      }

      default:
        for (let i = 0; i < dentroVentana.length; i++) {
          result.push({
            partido: dentroVentana[i],
            computa: i < max_partidos,
            razonNoComputa: i < max_partidos ? null : 'Supera el máximo de partidos',
          })
        }
    }
  }

  for (const p of fueraVentana) {
    result.push({ partido: p, computa: false, razonNoComputa: 'Fuera de la ventana temporal' })
  }

  for (const p of partidos) {
    if (excludedByCompañero.has(p.id)) {
      result.push({ partido: p, computa: false, razonNoComputa: 'Máx. partidos con este compañero alcanzado' })
    }
  }

  return result
}

export async function getPartidosJugador(ligaId, jugadorId) {
  const [{ data: partidos, error }, { data: jugadores }] = await Promise.all([
    supabase
      .from('partidos')
      .select('*')
      .eq('liga_id', ligaId)
      .or(
        `p1_jugador1_id.eq.${jugadorId},p1_jugador2_id.eq.${jugadorId},` +
        `p2_jugador1_id.eq.${jugadorId},p2_jugador2_id.eq.${jugadorId}`
      )
      .order('fecha', { ascending: false }),
    supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId),
  ])

  if (error) throw error

  const jugadorMap = Object.fromEntries((jugadores ?? []).map((j) => [j.id, j]))

  return (partidos ?? []).map((p) => ({
    ...p,
    p1j1: jugadorMap[p.p1_jugador1_id] ?? null,
    p1j2: jugadorMap[p.p1_jugador2_id] ?? null,
    p2j1: jugadorMap[p.p2_jugador1_id] ?? null,
    p2j2: jugadorMap[p.p2_jugador2_id] ?? null,
  }))
}

export function calcularEstadisticasPersonales(partidos, jugadorId) {
  const compañeroMap = {}
  const rivalMap = {}
  let victorias = 0, derrotas = 0, noFinalizados = 0

  for (const p of partidos) {
    const enP1 = p.p1_jugador1_id === jugadorId || p.p1_jugador2_id === jugadorId
    const enP2 = p.p2_jugador1_id === jugadorId || p.p2_jugador2_id === jugadorId
    if (!enP1 && !enP2) continue

    const gano = (enP1 && p.resultado === 'pareja1') || (enP2 && p.resultado === 'pareja2')
    const esNF = p.resultado === 'no_finalizado'

    if (esNF) noFinalizados++
    else if (gano) victorias++
    else derrotas++

    // Compañero
    const compId = enP1
      ? (p.p1_jugador1_id === jugadorId ? p.p1_jugador2_id : p.p1_jugador1_id)
      : (p.p2_jugador1_id === jugadorId ? p.p2_jugador2_id : p.p2_jugador1_id)
    const compObj = enP1
      ? (p.p1_jugador1_id === jugadorId ? p.p1j2 : p.p1j1)
      : (p.p2_jugador1_id === jugadorId ? p.p2j2 : p.p2j1)

    if (compId) {
      if (!compañeroMap[compId]) compañeroMap[compId] = { id: compId, nombre: compObj?.nombre ?? '?', partidos: 0, victorias: 0 }
      compañeroMap[compId].partidos++
      if (gano) compañeroMap[compId].victorias++
    }

    // Rivales (ambos jugadores de la pareja contraria)
    const rivalesRaw = enP1
      ? [{ id: p.p2_jugador1_id, obj: p.p2j1 }, { id: p.p2_jugador2_id, obj: p.p2j2 }]
      : [{ id: p.p1_jugador1_id, obj: p.p1j1 }, { id: p.p1_jugador2_id, obj: p.p1j2 }]

    for (const { id: rivalId, obj: rivalObj } of rivalesRaw) {
      if (!rivalId) continue
      if (!rivalMap[rivalId]) rivalMap[rivalId] = { id: rivalId, nombre: rivalObj?.nombre ?? '?', partidos: 0, victorias: 0 }
      rivalMap[rivalId].partidos++
      if (gano) rivalMap[rivalId].victorias++
    }
  }

  const decididos = victorias + derrotas
  const porcentajeVictorias = decididos > 0 ? Math.round((victorias / decididos) * 100) : 0

  const compañeros = Object.values(compañeroMap)
    .filter((c) => c.partidos >= 2)
    .map((c) => ({
      ...c,
      pct: c.partidos > 0 ? Math.round((c.victorias / c.partidos) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  const rivales = Object.values(rivalMap)
    .filter((r) => r.partidos >= 2)
    .map((r) => ({
      ...r,
      pct: r.partidos > 0 ? Math.round((r.victorias / r.partidos) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)

  return { totalPartidos: victorias + derrotas + noFinalizados, victorias, derrotas, noFinalizados, porcentajeVictorias, compañeros, rivales }
}
