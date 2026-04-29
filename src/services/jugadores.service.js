import { supabase } from '../lib/supabase'

export async function getJugadoresLiga(ligaId) {
  const { data, error } = await supabase
    .from('liga_jugadores')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data
}

export async function getJugadoresNoVinculados(ligaId) {
  const { data, error } = await supabase
    .from('liga_jugadores')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('activo', true)
    .is('usuario_id', null)
    .order('nombre')
  if (error) throw error
  return data
}

export async function getMiJugador(ligaId, userId) {
  const { data, error } = await supabase
    .from('liga_jugadores')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('usuario_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function vincularJugador(jugadorId, userId) {
  const { data, error } = await supabase
    .from('liga_jugadores')
    .update({ usuario_id: userId })
    .eq('id', jugadorId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function crearYVincularJugador(ligaId, userId, nombre) {
  const { data, error } = await supabase
    .from('liga_jugadores')
    .insert({ liga_id: ligaId, usuario_id: userId, nombre })
    .select()
    .single()
  if (error) throw error
  return data
}
