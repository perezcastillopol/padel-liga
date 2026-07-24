import { supabase } from '../lib/supabase'
import { puedeEditar } from './partidos.service'

function barajar(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function claveJugadores(a, b) {
  return [a, b].sort().join('-')
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

// ── Emparejamiento ────────────────────────────────────────────────────────────

function contarRepeticiones(split, parejasPrevias) {
  const [equipo1, equipo2] = split
  return (
    (parejasPrevias.has(claveJugadores(equipo1[0], equipo1[1])) ? 1 : 0) +
    (parejasPrevias.has(claveJugadores(equipo2[0], equipo2[1])) ? 1 : 0)
  )
}

function mejorSplit(cuatro, parejasPrevias) {
  const [a, b, c, d] = cuatro
  const opciones = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ]
  let mejor = opciones[0]
  let mejorRepeticiones = contarRepeticiones(mejor, parejasPrevias)
  for (const opcion of opciones.slice(1)) {
    const repeticiones = contarRepeticiones(opcion, parejasPrevias)
    if (repeticiones < mejorRepeticiones) {
      mejor = opcion
      mejorRepeticiones = repeticiones
      if (mejorRepeticiones === 0) break
    }
  }
  return { split: mejor, repeticiones: mejorRepeticiones }
}

// Prueba varios grupos de 4 dentro del pool disponible (que solo incluye
// jugadores del mismo record, salvo cuando se le pasa el sobrante mezclado con
// el record adyacente) buscando uno cuyas parejas resultantes no se hayan
// enfrentado ya como compañeras.
function elegirGrupoDeCuatro(pool, parejasPrevias, intentosMax = 8) {
  let mejorCombo = pool.slice(0, 4)
  let mejor = mejorSplit(mejorCombo, parejasPrevias)

  for (let i = 0; i < intentosMax && mejor.repeticiones > 0 && pool.length > 4; i++) {
    const combo = barajar(pool).slice(0, 4)
    const candidato = mejorSplit(combo, parejasPrevias)
    if (candidato.repeticiones < mejor.repeticiones) {
      mejorCombo = combo
      mejor = candidato
      if (mejor.repeticiones === 0) break
    }
  }

  return { combo: mejorCombo, split: mejor.split }
}

// Forma partidos de 4 en 4 a partir de un pool de jugadores (ya barajado),
// devolviendo los partidos formados y el sobrante que no llegó a completar un grupo de 4.
function formarPartidos(poolInicial, parejasPrevias) {
  let pool = poolInicial
  const partidos = []
  while (pool.length >= 4) {
    const { combo, split } = elegirGrupoDeCuatro(pool, parejasPrevias)
    pool = pool.filter((id) => !combo.includes(id))
    partidos.push({ p1a: split[0][0], p1b: split[0][1], p2a: split[1][0], p2b: split[1][1] })
  }
  return { partidos, sobrante: pool }
}

// Función pura: recibe participantes activos ({jugador_id, victorias, derrotas})
// y el Set de parejas que ya han jugado juntas, y devuelve los enfrentamientos
// de la siguiente ronda. Nunca mezcla jugadores de records distintos si puede
// evitarlo:
//   1. Dentro de cada grupo de record exacto (procesados de mejor a peor) se
//      forman primero todos los partidos "puros" que quepan; el sobrante de
//      cada grupo (0-3 jugadores) se guarda aparte, SIN mezclarlo todavía con
//      ningún otro grupo. Si jugadorQueDescanso pertenece a este grupo, se
//      coloca primero en la lista (antes de barajar el resto) para que sea
//      el último en quedar fuera si el grupo tiene sobrantes.
//   2. Solo cuando ya se han extraído los puros de TODOS los records, se
//      juntan esos sobrantes en una única lista, respetando el orden de mejor
//      a peor record, y se agrupan de 4 en 4 consecutivos: así cada grupo
//      mixto junta siempre a los sobrantes de record más cercano posible
//      entre sí (nunca a alguien de un extremo con alguien del otro).
// Si el total de activos no es múltiplo de 4, el sobrante final (los peor
// clasificados sin hueco) descansa esta ronda. Dentro de cada grupo de 4 ya
// formado (puro o mixto) se elige la combinación 2 vs 2 que evite repetir
// compañeros de fase suiza; si las tres combinaciones posibles repiten, se
// acepta la repetición.
export function generarParejasAleatorias(participantes, parejasPrevias = new Set(), jugadorQueDescanso = null) {
  const grupos = new Map()
  for (const p of participantes) {
    const clave = `${p.victorias}-${p.derrotas}`
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(p.jugador_id)
  }

  const ordenGrupos = [...grupos.keys()].sort((a, b) => {
    const [va, da] = a.split('-').map(Number)
    const [vb, db] = b.split('-').map(Number)
    if (vb !== va) return vb - va
    return da - db
  })

  const partidos = []
  const sobrantes = []

  // 1. Partidos puros dentro de cada record exacto; el sobrante de cada uno
  //    se acumula sin mezclar, manteniendo el orden de mejor a peor record.
  for (const clave of ordenGrupos) {
    const grupo = grupos.get(clave)
    const pool = jugadorQueDescanso != null && grupo.includes(jugadorQueDescanso)
      ? [jugadorQueDescanso, ...barajar(grupo.filter((id) => id !== jugadorQueDescanso))]
      : barajar(grupo)

    const { partidos: puros, sobrante } = formarPartidos(pool, parejasPrevias)
    partidos.push(...puros)
    sobrantes.push(...sobrante)
  }

  // 2. Los sobrantes de todos los records (ya ordenados de mejor a peor) se
  //    agrupan de 4 en 4 consecutivos, juntando siempre a los más cercanos.
  for (let i = 0; i + 4 <= sobrantes.length; i += 4) {
    const grupo = barajar(sobrantes.slice(i, i + 4))
    const { split } = mejorSplit(grupo, parejasPrevias)
    partidos.push({ p1a: split[0][0], p1b: split[0][1], p2a: split[1][0], p2b: split[1][1] })
  }

  return partidos
}

// A partir del pool que se le pasó a generarParejasAleatorias() y los
// partidos que devolvió, encuentra quién quedó sin partido esta ronda.
function calcularJugadorDescansa(pool, partidosGenerados) {
  const idsEnPartidos = new Set(partidosGenerados.flatMap((p) => [p.p1a, p.p1b, p.p2a, p.p2b]))
  return pool.find((p) => !idsEnPartidos.has(p.jugador_id))?.jugador_id ?? null
}

// Busca, dentro del mismo tipo de ronda, quién descansó en la ronda
// inmediatamente anterior (numero más alto por debajo de numeroActual).
async function obtenerJugadorDescansoAnterior(ligaId, tipo, numeroActual) {
  const { data, error } = await supabase
    .from('torneo_rondas')
    .select('jugador_descanso')
    .eq('liga_id', ligaId)
    .eq('tipo', tipo)
    .lt('numero', numeroActual)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.jugador_descanso ?? null
}

// Igual que obtenerJugadorDescansoAnterior() pero resuelto a {id, nombre}
// para mostrarlo en la UI.
async function resolverJugadorDescansoAnterior(ligaId, ronda) {
  const anteriorId = await obtenerJugadorDescansoAnterior(ligaId, ronda.tipo, ronda.numero)
  if (!anteriorId) return null
  const { data, error } = await supabase
    .from('liga_jugadores')
    .select('id, nombre')
    .eq('id', anteriorId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function crearPartidosRonda(rondaId, ligaId, partidos, creadoPor, opts = {}) {
  if (partidos.length === 0) return []
  const filas = partidos.map((p) => ({
    liga_id: ligaId,
    ronda_id: rondaId,
    p1_jugador1_id: p.p1a,
    p1_jugador2_id: p.p1b,
    p2_jugador1_id: p.p2a,
    p2_jugador2_id: p.p2b,
    creado_por: creadoPor,
    generado_auto: true,
    preview: opts.preview ?? false,
  }))
  const { data, error } = await supabase.from('torneo_partidos').insert(filas).select()
  if (error) throw error
  return data
}

const POS_A_COLUMNA = {
  p1j1: 'p1_jugador1_id',
  p1j2: 'p1_jugador2_id',
  p2j1: 'p2_jugador1_id',
  p2j2: 'p2_jugador2_id',
}

// Intercambia dos jugadores de la ronda (típicamente en preview). Cada "lado"
// es { partidoId, pos, jugadorId }; partidoId es null cuando ese jugador está
// descansando (no tiene fila en torneo_partidos), en cuyo caso ese lado no
// tiene nada que actualizar — solo se escribe en el lado que sí tiene partido.
export async function intercambiarJugadores(rondaId, lado1, lado2) {
  if (lado1.partidoId != null && lado1.partidoId === lado2.partidoId) {
    throw new Error('No se puede intercambiar jugadores dentro del mismo partido')
  }

  async function aplicar(lado, jugadorEntrante) {
    if (lado.partidoId == null) return
    const columna = POS_A_COLUMNA[lado.pos]
    if (!columna) throw new Error('Posición de jugador inválida')
    const { error } = await supabase
      .from('torneo_partidos')
      .update({ [columna]: jugadorEntrante })
      .eq('id', lado.partidoId)
      .eq('ronda_id', rondaId)
    if (error) throw error
  }

  await aplicar(lado1, lado2.jugadorId)
  await aplicar(lado2, lado1.jugadorId)
}

// Función pura: recibe los partidos de un preview (con p1j1/p1j2/p2j1/p2j2 ya
// resueltos a {id, nombre}) y el Set de parejas previas de la fase correspondiente,
// y devuelve la lista de parejas (compañeros) que quedarían repetidas.
export function verificarParejasRepetidas(partidos, parejasPrevias) {
  const repetidas = []
  for (const partido of partidos) {
    const parejas = [
      [partido.p1j1, partido.p1j2],
      [partido.p2j1, partido.p2j2],
    ]
    for (const [jugador1, jugador2] of parejas) {
      if (!jugador1 || !jugador2) continue
      if (parejasPrevias.has(claveJugadores(jugador1.id, jugador2.id))) {
        repetidas.push({ partido, jugador1, jugador2 })
      }
    }
  }
  return repetidas
}

// Parejas (de compañeros) que ya han jugado juntas, filtradas por fase:
// - 'suiza' → solo rondas de fase suiza
// - 'wb' o 'lb' → rondas de playoff completo (wb + lb), pueden repetirse de la suiza
// - 'extra' → sin restricción (Set vacío)
export async function getParejasPrevias(ligaId, tipoFase) {
  if (tipoFase === 'extra') return new Set()

  const tipos = tipoFase === 'suiza' ? ['suiza'] : ['wb', 'lb']

  const { data: rondas, error: rondasError } = await supabase
    .from('torneo_rondas')
    .select('id')
    .eq('liga_id', ligaId)
    .in('tipo', tipos)
  if (rondasError) throw rondasError

  const rondaIds = (rondas ?? []).map((r) => r.id)
  if (rondaIds.length === 0) return new Set()

  const { data: partidos, error: partidosError } = await supabase
    .from('torneo_partidos')
    .select('p1_jugador1_id, p1_jugador2_id, p2_jugador1_id, p2_jugador2_id')
    .in('ronda_id', rondaIds)
    .eq('preview', false)
  if (partidosError) throw partidosError

  const parejas = new Set()
  for (const p of partidos ?? []) {
    parejas.add(claveJugadores(p.p1_jugador1_id, p.p1_jugador2_id))
    parejas.add(claveJugadores(p.p2_jugador1_id, p.p2_jugador2_id))
  }
  return parejas
}

export async function iniciarTorneo(ligaId, userId) {
  const participantes = await getParticipantes(ligaId)
  const activos = participantes.filter((p) => p.estado === 'activo')

  const { error: ligaError } = await supabase
    .from('ligas')
    .update({ torneo_estado: 'suiza' })
    .eq('id', ligaId)
  if (ligaError) throw ligaError

  const parejasPrevias = await getParejasPrevias(ligaId, 'suiza')
  const partidosGenerados = generarParejasAleatorias(activos, parejasPrevias)
  const jugadorDescansaAhora = calcularJugadorDescansa(activos, partidosGenerados)

  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: 'suiza', numero: 1, estado: 'en_curso', jugador_descanso: jugadorDescansaAhora })
    .select()
    .single()
  if (rondaError) throw rondaError

  await crearPartidosRonda(ronda.id, ligaId, partidosGenerados, userId)

  return ronda
}

async function resolverPartidosDeRonda(ligaId, rondaId) {
  const [{ data: partidos, error: partidosError }, { data: jugadores, error: jugadoresError }] = await Promise.all([
    supabase.from('torneo_partidos').select('*').eq('ronda_id', rondaId),
    supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId),
  ])
  if (partidosError) throw partidosError
  if (jugadoresError) throw jugadoresError

  const jugadorMap = Object.fromEntries((jugadores ?? []).map((j) => [j.id, j]))
  return (partidos ?? []).map((p) => ({
    ...p,
    p1j1: jugadorMap[p.p1_jugador1_id] ?? null,
    p1j2: jugadorMap[p.p1_jugador2_id] ?? null,
    p2j1: jugadorMap[p.p2_jugador1_id] ?? null,
    p2j2: jugadorMap[p.p2_jugador2_id] ?? null,
  }))
}

// Jugadores que deberían estar jugando esta ronda de fase suiza (los activos).
// Usado solo para calcular quién descansa. Las rondas de tipo 'extra' se
// crean siempre con su pool completo ya resuelto (finalizarFaseSuiza() o
// crearRondaFinal()), así que no tienen un pool "esperado" recalculable aquí.
async function calcularPoolEsperado(ligaId, tipoRonda) {
  if (tipoRonda !== 'suiza') return []
  const participantes = await getParticipantes(ligaId)
  return participantes.filter((p) => p.estado === 'activo')
}

// Participantes del pool esperado que no aparecen en ninguno de los partidos
// de la ronda. Solo tiene sentido mientras la ronda está en preview.
async function calcularDescansan(ligaId, ronda, partidos) {
  if (ronda.estado !== 'pendiente') return []

  const pool = await calcularPoolEsperado(ligaId, ronda.tipo)
  const idsEnPartidos = new Set(
    partidos.flatMap((p) => [p.p1_jugador1_id, p.p1_jugador2_id, p.p2_jugador1_id, p.p2_jugador2_id])
  )
  return pool.filter((p) => !idsEnPartidos.has(p.jugador_id))
}

async function getRondaConPartidos(ligaId, rondaId) {
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('id', rondaId)
    .single()
  if (rondaError) throw rondaError

  const partidos = await resolverPartidosDeRonda(ligaId, rondaId)
  const descansan = await calcularDescansan(ligaId, ronda, partidos)
  const jugadorDescansoAnterior = await resolverJugadorDescansoAnterior(ligaId, ronda)
  return { ...ronda, partidos, descansan, jugadorDescansoAnterior }
}

// Devuelve la ronda en curso o en preview (suiza, extra o playoff) con sus
// partidos, los participantes que descansan (si está en preview), quién
// descansó en la ronda anterior del mismo tipo (si lo hubo) y los nombres de
// los jugadores ya resueltos.
export async function getRondaActual(ligaId) {
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('liga_id', ligaId)
    .in('estado', ['en_curso', 'pendiente'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (rondaError) throw rondaError
  if (!ronda) return null

  const partidos = await resolverPartidosDeRonda(ligaId, ronda.id)
  const descansan = await calcularDescansan(ligaId, ronda, partidos)
  const jugadorDescansoAnterior = await resolverJugadorDescansoAnterior(ligaId, ronda)
  return { ...ronda, partidos, descansan, jugadorDescansoAnterior }
}

export async function registrarResultadoPartido(partidoId, resultado, sets, jugadorActualId, esAdmin) {
  const { data: partido, error: partidoError } = await supabase
    .from('torneo_partidos')
    .select('*')
    .eq('id', partidoId)
    .single()
  if (partidoError) throw partidoError

  const { puede, pareja } = puedeEditar(partido, jugadorActualId, esAdmin)
  if (!puede) throw new Error('No tienes permiso para registrar este resultado')

  const extra =
    pareja === 'p1' ? { editado_por_p1: true }
      : pareja === 'p2' ? { editado_por_p2: true }
        : {}

  const { error: updateError } = await supabase
    .from('torneo_partidos')
    .update({ ...sets, resultado, ...extra })
    .eq('id', partidoId)
  if (updateError) throw updateError

  const { data: partidosRonda, error: partidosRondaError } = await supabase
    .from('torneo_partidos')
    .select('*')
    .eq('ronda_id', partido.ronda_id)
  if (partidosRondaError) throw partidosRondaError

  const rondaCompleta = partidosRonda.every((p) => p.resultado != null)
  if (!rondaCompleta) return { rondaCompleta: false }

  await cerrarRonda(partido.liga_id, partido.ronda_id, partidosRonda)
  return { rondaCompleta: true }
}

async function cerrarRonda(ligaId, rondaId, partidosRonda) {
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('id', rondaId)
    .single()
  if (rondaError) throw rondaError

  const { error: cerrarError } = await supabase
    .from('torneo_rondas')
    .update({ estado: 'finalizada' })
    .eq('id', rondaId)
  if (cerrarError) throw cerrarError

  if (ronda.tipo === 'extra') {
    const { error } = await supabase.from('ligas').update({ torneo_estado: 'playoff' }).eq('id', ligaId)
    if (error) throw error
    return
  }

  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .select('torneo_max_derrotas')
    .eq('id', ligaId)
    .single()
  if (ligaError) throw ligaError

  const participantes = await getParticipantes(ligaId)
  const cambios = new Map(participantes.map((p) => [p.jugador_id, { ...p }]))
  const tocados = new Set()

  for (const p of partidosRonda) {
    if (p.resultado === 'no_finalizado') continue
    const ganadores = p.resultado === 'pareja1'
      ? [p.p1_jugador1_id, p.p1_jugador2_id]
      : [p.p2_jugador1_id, p.p2_jugador2_id]
    const perdedores = p.resultado === 'pareja1'
      ? [p.p2_jugador1_id, p.p2_jugador2_id]
      : [p.p1_jugador1_id, p.p1_jugador2_id]

    for (const jugadorId of ganadores) {
      const c = cambios.get(jugadorId)
      if (c) { c.victorias += 1; tocados.add(jugadorId) }
    }
    for (const jugadorId of perdedores) {
      const c = cambios.get(jugadorId)
      if (c) { c.derrotas += 1; tocados.add(jugadorId) }
    }
  }

  for (const jugadorId of tocados) {
    const c = cambios.get(jugadorId)
    if (c.victorias >= liga.torneo_max_derrotas) c.estado = 'clasificado'
    else if (c.derrotas >= liga.torneo_max_derrotas) c.estado = 'eliminado'
    else c.estado = 'activo'
  }

  const participantesActualizados = [...cambios.values()]

  await Promise.all(
    participantesActualizados.map((p) =>
      supabase
        .from('torneo_participantes')
        .update({ victorias: p.victorias, derrotas: p.derrotas, estado: p.estado })
        .eq('id', p.id)
    )
  )
  // La decisión de seguir en fase suiza o cerrarla ya no es automática: la
  // toma el admin explícitamente con finalizarFaseSuiza() o crearRondaFinal().
}

// Genera (en preview) los partidos de la siguiente ronda de fase suiza,
// dando prioridad a quien descansó en la ronda anterior. No la marca como
// 'en_curso' hasta que el admin la confirme. La ronda extra ya NO se genera
// aquí: se crea explícitamente con finalizarFaseSuiza() o crearRondaFinal().
export async function generarPreviewRonda(ligaId) {
  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .select('torneo_estado')
    .eq('id', ligaId)
    .single()
  if (ligaError) throw ligaError

  if (liga.torneo_estado !== 'suiza') {
    throw new Error('No se puede generar una ronda en el estado actual del torneo')
  }

  const participantes = await getParticipantes(ligaId)
  const activos = participantes.filter((p) => p.estado === 'activo')

  const { data: ultimaRonda } = await supabase
    .from('torneo_rondas')
    .select('numero')
    .eq('liga_id', ligaId)
    .eq('tipo', 'suiza')
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()

  const numeroNuevo = (ultimaRonda?.numero ?? 0) + 1
  const jugadorQueDescanso = await obtenerJugadorDescansoAnterior(ligaId, 'suiza', numeroNuevo)

  const parejasPrevias = await getParejasPrevias(ligaId, 'suiza')
  const partidosGenerados = generarParejasAleatorias(activos, parejasPrevias, jugadorQueDescanso)
  const jugadorDescansaAhora = calcularJugadorDescansa(activos, partidosGenerados)

  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({
      liga_id: ligaId,
      tipo: 'suiza',
      numero: numeroNuevo,
      estado: 'pendiente',
      jugador_descanso: jugadorDescansaAhora,
    })
    .select()
    .single()
  if (rondaError) throw rondaError

  await crearPartidosRonda(ronda.id, ligaId, partidosGenerados, null, { preview: true })
  return getRondaConPartidos(ligaId, ronda.id)
}

// Confirma una ronda en preview: la hace visible para todos y jugable.
export async function confirmarRonda(ligaId, rondaId) {
  const { error: partidosError } = await supabase
    .from('torneo_partidos')
    .update({ preview: false })
    .eq('ronda_id', rondaId)
  if (partidosError) throw partidosError

  const { error: rondaError } = await supabase
    .from('torneo_rondas')
    .update({ estado: 'en_curso' })
    .eq('id', rondaId)
  if (rondaError) throw rondaError

  return getRondaConPartidos(ligaId, rondaId)
}

// Repite el sorteo de una ronda en preview: borra sus partidos y genera unos
// nuevos con generarParejasAleatorias(), manteniendo el mismo pool de
// participantes que le correspondía. Para fase suiza el pool son los activos
// (dando prioridad a quien descansó la ronda anterior). Para una ronda de
// tipo 'extra' (creada por finalizarFaseSuiza() o crearRondaFinal(), ambas
// con su pool ya resuelto en los partidos existentes) el pool se obtiene de
// quiénes están actualmente en esos partidos, ya que no hay una regla
// recalculable de negocio para reconstruirlo desde cero.
export async function repetirSorteo(ligaId, rondaId) {
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('id', rondaId)
    .single()
  if (rondaError) throw rondaError

  const participantes = await getParticipantes(ligaId)

  let pool
  let jugadorQueDescanso = null
  if (ronda.tipo === 'suiza') {
    pool = participantes.filter((p) => p.estado === 'activo')
    jugadorQueDescanso = await obtenerJugadorDescansoAnterior(ligaId, 'suiza', ronda.numero)
  } else {
    const { data: partidosActuales, error: partidosError } = await supabase
      .from('torneo_partidos')
      .select('p1_jugador1_id, p1_jugador2_id, p2_jugador1_id, p2_jugador2_id')
      .eq('ronda_id', rondaId)
    if (partidosError) throw partidosError
    const idsPool = new Set(
      (partidosActuales ?? []).flatMap((p) => [p.p1_jugador1_id, p.p1_jugador2_id, p.p2_jugador1_id, p.p2_jugador2_id])
    )
    pool = participantes.filter((p) => idsPool.has(p.jugador_id))
  }

  const { error: deleteError } = await supabase
    .from('torneo_partidos')
    .delete()
    .eq('ronda_id', rondaId)
  if (deleteError) throw deleteError

  const parejasPrevias = await getParejasPrevias(ligaId, ronda.tipo)
  const partidosGenerados = generarParejasAleatorias(pool, parejasPrevias, jugadorQueDescanso)
  const jugadorDescansaAhora = calcularJugadorDescansa(pool, partidosGenerados)
  await crearPartidosRonda(rondaId, ligaId, partidosGenerados, null, { preview: true })

  const { error: updateError } = await supabase
    .from('torneo_rondas')
    .update({ jugador_descanso: jugadorDescansaAhora })
    .eq('id', rondaId)
  if (updateError) throw updateError

  return getRondaConPartidos(ligaId, rondaId)
}

// Función pura para el modal "Finalizar fase suiza": dado el número total de
// jugadores que deben clasificar al playoff (numClasifican) y, si hace falta,
// los eliminados que se repescan (repescadosIds, Set de jugador_id), calcula
// quién clasifica, quién queda eliminado y si hay un empate justo en el corte
// de los activos que debería resolverse en una ronda extra aparte (esos
// jugadores no entran ni en clasificados ni en eliminados).
export function calcularCorteFinalSuiza(participantes, numClasifican, repescadosIds = new Set()) {
  const clasificadosExistentes = participantes.filter((p) => p.estado === 'clasificado')
  const activosOrdenados = [...participantes.filter((p) => p.estado === 'activo')].sort((a, b) => {
    if (b.victorias !== a.victorias) return b.victorias - a.victorias
    return a.derrotas - b.derrotas
  })
  const eliminadosOrdenados = [...participantes.filter((p) => p.estado === 'eliminado')].sort(
    (a, b) => a.derrotas - b.derrotas
  )
  const repescados = eliminadosOrdenados.filter((p) => repescadosIds.has(p.jugador_id))
  const eliminadosNoRepescados = eliminadosOrdenados.filter((p) => !repescadosIds.has(p.jugador_id))

  const disponibles = clasificadosExistentes.length + activosOrdenados.length
  const necesitanRepescar = Math.max(0, numClasifican - disponibles)

  const recordDe = (p) => `${p.victorias}-${p.derrotas}`
  const slots = Math.max(
    0,
    Math.min(activosOrdenados.length, numClasifican - clasificadosExistentes.length - repescados.length)
  )

  let corteInicio = slots
  let corteFin = slots
  if (slots > 0 && slots < activosOrdenados.length && recordDe(activosOrdenados[slots - 1]) === recordDe(activosOrdenados[slots])) {
    const recordCorte = recordDe(activosOrdenados[slots - 1])
    while (corteInicio > 0 && recordDe(activosOrdenados[corteInicio - 1]) === recordCorte) corteInicio--
    while (corteFin < activosOrdenados.length && recordDe(activosOrdenados[corteFin]) === recordCorte) corteFin++
  }

  const activosClasificados = activosOrdenados.slice(0, corteInicio)
  const zonaGris = activosOrdenados.slice(corteInicio, corteFin)
  const activosEliminados = activosOrdenados.slice(corteFin)

  return {
    clasificados: [...clasificadosExistentes, ...activosClasificados, ...repescados],
    eliminados: [...eliminadosNoRepescados, ...activosEliminados],
    zonaGris,
    necesitanRepescar,
    eliminadosOrdenados,
  }
}

// Cierra la fase suiza explícitamente (acción del admin, ya no automática)
// con los clasificados y eliminados ya decididos en la UI (ver
// calcularCorteFinalSuiza). Marca sus estados y decide la fase siguiente: si
// quedan >= 2 participantes sin resolver (ni clasificados ni eliminados —
// la "zona gris" que la UI dejó fuera de ambas listas para desempatar), crea
// la ronda extra con todos ellos (sin restricción de repetición); si no,
// pasa directamente a playoff.
export async function finalizarFaseSuiza(ligaId, clasificadosIds, eliminadosIds) {
  const participantes = await getParticipantes(ligaId)
  const porJugadorId = new Map(participantes.map((p) => [p.jugador_id, p]))

  const idsClasificados = clasificadosIds.map((jid) => porJugadorId.get(jid)?.id).filter(Boolean)
  const idsEliminados = eliminadosIds.map((jid) => porJugadorId.get(jid)?.id).filter(Boolean)

  if (idsClasificados.length > 0) {
    const { error } = await supabase
      .from('torneo_participantes')
      .update({ estado: 'clasificado' })
      .in('id', idsClasificados)
    if (error) throw error
  }
  if (idsEliminados.length > 0) {
    const { error } = await supabase
      .from('torneo_participantes')
      .update({ estado: 'eliminado' })
      .in('id', idsEliminados)
    if (error) throw error
  }

  const participantesActualizados = await getParticipantes(ligaId)
  const activosRestantes = participantesActualizados.filter((p) => p.estado === 'activo')
  const siguienteFase = activosRestantes.length >= 2 ? 'ronda_extra' : 'playoff'

  if (siguienteFase === 'ronda_extra') {
    const { data: ronda, error: rondaError } = await supabase
      .from('torneo_rondas')
      .insert({ liga_id: ligaId, tipo: 'extra', numero: 1, estado: 'pendiente' })
      .select()
      .single()
    if (rondaError) throw rondaError

    const partidosGenerados = generarParejasAleatorias(activosRestantes, new Set())
    await crearPartidosRonda(ronda.id, ligaId, partidosGenerados, null, { preview: true })
  }

  const { error: estadoError } = await supabase.from('ligas').update({ torneo_estado: siguienteFase }).eq('id', ligaId)
  if (estadoError) throw estadoError

  return { siguienteFase }
}

// Crea manualmente la ronda final (tipo 'extra') con los jugadores que elige
// el admin, sea cual sea su estado actual (clasificado, activo o eliminado);
// deben ser múltiplo de 4. A los activos que NO participen en esta ronda
// final se les marca como clasificados, ya que al pasar a 'ronda_extra' no
// queda ninguna otra pantalla de fase suiza donde decidir su suerte.
export async function crearRondaFinal(ligaId, jugadorIds) {
  if (jugadorIds.length === 0 || jugadorIds.length % 4 !== 0) {
    throw new Error('El número de jugadores debe ser múltiplo de 4')
  }

  const participantes = await getParticipantes(ligaId)
  const seleccionados = participantes.filter((p) => jugadorIds.includes(p.jugador_id))
  if (seleccionados.length !== jugadorIds.length) {
    throw new Error('Algún jugador seleccionado no es válido')
  }

  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: 'extra', numero: 1, estado: 'pendiente' })
    .select()
    .single()
  if (rondaError) throw rondaError

  const partidosGenerados = generarParejasAleatorias(seleccionados, new Set())
  await crearPartidosRonda(ronda.id, ligaId, partidosGenerados, null, { preview: true })

  const { error: estadoError } = await supabase.from('ligas').update({ torneo_estado: 'ronda_extra' }).eq('id', ligaId)
  if (estadoError) throw estadoError

  const activosRestantes = participantes.filter((p) => p.estado === 'activo')
  if (activosRestantes.length > 0) {
    const { error: clasificarError } = await supabase
      .from('torneo_participantes')
      .update({ estado: 'clasificado' })
      .in('id', activosRestantes.map((p) => p.id))
    if (clasificarError) throw clasificarError
  }

  return getRondaConPartidos(ligaId, ronda.id)
}
