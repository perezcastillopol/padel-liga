import { supabase } from '../lib/supabase'

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
