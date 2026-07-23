import { supabase } from '../lib/supabase'

function barajar(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export async function getParticipantes(ligaId) {
  const { data, error } = await supabase
    .from('torneo_participantes')
    .select(`
      id,
      liga_id,
      jugador_id,
      victorias,
      derrotas,
      estado,
      seed,
      liga_jugadores ( id, nombre, usuario_id )
    `)
    .eq('liga_id', ligaId)
    .order('seed', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data.map((p) => ({ ...p, jugador: p.liga_jugadores }))
}

export async function inscribirJugador(ligaId, jugadorId) {
  const { data, error } = await supabase
    .from('torneo_participantes')
    .insert({ liga_id: ligaId, jugador_id: jugadorId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function desinscribirJugador(ligaId, jugadorId) {
  const { error } = await supabase
    .from('torneo_participantes')
    .delete()
    .eq('liga_id', ligaId)
    .eq('jugador_id', jugadorId)
  if (error) throw error
}

export async function iniciarTorneo(ligaId, userId) {
  const participantes = await getParticipantes(ligaId)
  const jugadorIds = barajar(participantes.map((p) => p.jugador_id))

  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: 'suiza', numero: 1 })
    .select()
    .single()
  if (rondaError) throw rondaError

  const partidos = []
  for (let i = 0; i + 3 < jugadorIds.length; i += 4) {
    partidos.push({
      liga_id: ligaId,
      ronda_id: ronda.id,
      p1_jugador1_id: jugadorIds[i],
      p1_jugador2_id: jugadorIds[i + 1],
      p2_jugador1_id: jugadorIds[i + 2],
      p2_jugador2_id: jugadorIds[i + 3],
      creado_por: userId,
    })
  }

  if (partidos.length > 0) {
    const { error: partidosError } = await supabase.from('torneo_partidos').insert(partidos)
    if (partidosError) throw partidosError
  }

  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .update({ torneo_estado: 'suiza' })
    .eq('id', ligaId)
    .select()
    .single()
  if (ligaError) throw ligaError

  return liga
}

export async function getRondaActual(ligaId, tipo) {
  const { data, error } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('tipo', tipo)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getPartidosRonda(ligaId, rondaId) {
  const [{ data: partidos, error }, { data: jugadores }] = await Promise.all([
    supabase.from('torneo_partidos').select('*').eq('ronda_id', rondaId),
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
