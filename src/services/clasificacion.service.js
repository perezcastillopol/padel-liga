import { supabase } from '../lib/supabase'

export async function getClasificacion(ligaId) {
  const { data, error } = await supabase
    .from('partidos')
    .select('*')
    .eq('liga_id', ligaId)
  if (error) throw error
  return data
}
