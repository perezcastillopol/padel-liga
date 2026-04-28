import { supabase } from '../lib/supabase'

export async function getMiembrosByLiga(ligaId) {
  const { data, error } = await supabase
    .from('liga_miembros')
    .select('*, usuarios(*)')
    .eq('liga_id', ligaId)
    .eq('activo', true)
  if (error) throw error
  return data
}

export async function removeMiembro(ligaId, userId) {
  const { error } = await supabase
    .from('liga_miembros')
    .update({ activo: false })
    .eq('liga_id', ligaId)
    .eq('usuario_id', userId)
  if (error) throw error
}
