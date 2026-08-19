import { supabase } from '../lib/supabase'

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/mis-ligas`,
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getPuedeCrearLiga(userId) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('puede_crear_liga')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.puede_crear_liga ?? false
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return subscription
}
