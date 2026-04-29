import { supabase } from '../lib/supabase'

export async function getMiembros(ligaId) {
  const { data, error } = await supabase
    .from('liga_miembros')
    .select(`
      id,
      rol,
      fecha_union,
      usuario_id,
      usuarios (
        id,
        nombre,
        email,
        avatar_url
      )
    `)
    .eq('liga_id', ligaId)
    .eq('activo', true)
    .order('fecha_union')
  if (error) throw error
  return data
}

export async function cambiarRol(ligaId, usuarioId, nuevoRol) {
  const { error } = await supabase
    .from('liga_miembros')
    .update({ rol: nuevoRol })
    .eq('liga_id', ligaId)
    .eq('usuario_id', usuarioId)
  if (error) throw error
}

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
