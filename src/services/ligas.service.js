import { supabase } from '../lib/supabase'

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function getMisLigas(userId) {
  const { data, error } = await supabase
    .from('liga_miembros')
    .select(`
      rol,
      ligas (
        id,
        nombre,
        descripcion,
        codigo_invitacion,
        pts_victoria,
        pts_derrota,
        pts_no_finalizado,
        metodo_ranking,
        created_at,
        liga_miembros(count)
      )
    `)
    .eq('usuario_id', userId)
    .eq('activo', true)
  if (error) throw error

  return data.map((m) => ({
    ...m.ligas,
    rol: m.rol,
    num_miembros: m.ligas.liga_miembros[0].count,
  }))
}

export async function crearLiga(userId, { nombre, descripcion, config = {} }) {
  const codigo_invitacion = generateInviteCode()

  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .insert({
      nombre,
      descripcion: descripcion || null,
      codigo_invitacion,
      pts_victoria: config.pts_victoria ?? 3,
      pts_derrota: config.pts_derrota ?? 1,
      pts_no_finalizado: config.pts_no_finalizado ?? 1.5,
      criterio_seleccion: 'mas_recientes',
      metodo_ranking: 'puntos_totales',
      min_partidos_ranking: 3,
    })
    .select()
    .single()
  if (ligaError) throw ligaError

  const { error: miembroError } = await supabase
    .from('liga_miembros')
    .insert({ liga_id: liga.id, usuario_id: userId, rol: 'admin' })
  if (miembroError) throw miembroError

  return liga
}

export async function getLigaById(ligaId) {
  const { data, error } = await supabase
    .from('ligas')
    .select('*')
    .eq('id', ligaId)
    .single()
  if (error) throw error
  return data
}

export async function getMiRolEnLiga(ligaId, userId) {
  const { data, error } = await supabase
    .from('liga_miembros')
    .select('rol')
    .eq('liga_id', ligaId)
    .eq('usuario_id', userId)
    .eq('activo', true)
    .maybeSingle()
  if (error) throw error
  return data?.rol ?? null
}

export async function unirseConCodigo(userId, codigo) {
  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .select('id, nombre, descripcion')
    .eq('codigo_invitacion', codigo.toUpperCase())
    .single()

  if (ligaError || !liga) throw new Error('Código no válido')

  const { data: existing, error: checkError } = await supabase
    .from('liga_miembros')
    .select('id, activo')
    .eq('liga_id', liga.id)
    .eq('usuario_id', userId)
    .maybeSingle()
  if (checkError) throw checkError

  if (existing) throw new Error('Ya eres miembro de esta liga')

  const { error: insertError } = await supabase
    .from('liga_miembros')
    .insert({ liga_id: liga.id, usuario_id: userId, rol: 'jugador' })
  if (insertError) throw insertError

  return liga
}
