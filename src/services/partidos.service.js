import { supabase } from '../lib/supabase'

export async function getPartidosLiga(ligaId) {
  const [{ data: partidos, error }, { data: jugadores }] = await Promise.all([
    supabase.from('partidos').select('*').eq('liga_id', ligaId).order('fecha', { ascending: false }),
    supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId),
  ])
  if (error) throw error

  const jugadorMap = Object.fromEntries((jugadores ?? []).map((j) => [j.id, j]))

  return partidos.map((p) => ({
    ...p,
    p1j1: jugadorMap[p.p1_jugador1_id] ?? null,
    p1j2: jugadorMap[p.p1_jugador2_id] ?? null,
    p2j1: jugadorMap[p.p2_jugador1_id] ?? null,
    p2j2: jugadorMap[p.p2_jugador2_id] ?? null,
  }))
}

export async function crearPartido(ligaId, userId, datos) {
  const { data, error } = await supabase
    .from('partidos')
    .insert({ liga_id: ligaId, creado_por: userId, ...datos })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function editarPartido(partidoId, datos, pareja) {
  const extra =
    pareja === 'p1'
      ? { editado_por_p1: true }
      : pareja === 'p2'
        ? { editado_por_p2: true }
        : {}
  const { data, error } = await supabase
    .from('partidos')
    .update({ ...datos, ...extra })
    .eq('id', partidoId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarPartido(partidoId) {
  const { error } = await supabase.from('partidos').delete().eq('id', partidoId)
  if (error) throw error
}

export function puedeEditar(partido, jugadorActualId, esAdmin) {
  if (esAdmin) return { puede: true, pareja: null, motivo: 'admin' }
  if (!jugadorActualId) return { puede: false, pareja: null, motivo: 'sin jugador' }

  const enP1 =
    partido.p1_jugador1_id === jugadorActualId ||
    partido.p1_jugador2_id === jugadorActualId
  const enP2 =
    partido.p2_jugador1_id === jugadorActualId ||
    partido.p2_jugador2_id === jugadorActualId

  if (enP1 && !partido.editado_por_p1) return { puede: true, pareja: 'p1', motivo: 'jugador en pareja 1' }
  if (enP2 && !partido.editado_por_p2) return { puede: true, pareja: 'p2', motivo: 'jugador en pareja 2' }

  return { puede: false, pareja: null, motivo: 'no puedes editar este partido' }
}
