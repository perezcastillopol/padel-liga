import { supabase } from '../lib/supabase'

export async function getPartidosByLiga(ligaId) {
  const { data, error } = await supabase
    .from('partidos')
    .select('*')
    .eq('liga_id', ligaId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data
}

export async function createPartido(partido) {
  const { data, error } = await supabase.from('partidos').insert(partido).select().single()
  if (error) throw error
  return data
}

export async function updatePartido(id, changes) {
  const { data, error } = await supabase.from('partidos').update(changes).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deletePartido(id) {
  const { error } = await supabase.from('partidos').delete().eq('id', id)
  if (error) throw error
}
