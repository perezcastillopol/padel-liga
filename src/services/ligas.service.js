import { supabase } from '../lib/supabase'

export async function getLigasByUser(userId) {
  const { data, error } = await supabase
    .from('liga_miembros')
    .select('*, ligas(*)')
    .eq('usuario_id', userId)
    .eq('activo', true)
  if (error) throw error
  return data.map((m) => ({ ...m.ligas, rol: m.rol }))
}

export async function createLiga(liga) {
  const { data, error } = await supabase.from('ligas').insert(liga).select().single()
  if (error) throw error
  return data
}

export async function joinLigaByCode(code, userId) {
  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .select('id')
    .eq('codigo_invitacion', code)
    .single()
  if (ligaError) throw ligaError

  const { error } = await supabase.from('liga_miembros').insert({
    liga_id: liga.id,
    usuario_id: userId,
    rol: 'jugador',
  })
  if (error) throw error
  return liga
}
