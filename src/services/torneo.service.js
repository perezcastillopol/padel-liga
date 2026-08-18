import { supabase } from '../lib/supabase'

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

// Marca a un participante como 'lesionado': igual que 'clasificado'/'eliminado',
// generarParejasAleatorias() solo recibe participantes 'activo' (sus llamadores
// filtran por ese estado antes de invocarla), así que un lesionado queda
// automáticamente excluido de las siguientes rondas de fase suiza sin tocar
// esa función. Solo disponible mientras torneo_estado === 'suiza' (gestionado
// desde Configuracion.jsx).
export async function marcarLesionado(ligaId, jugadorId) {
  const { data, error } = await supabase
    .from('torneo_participantes')
    .update({ estado: 'lesionado' })
    .eq('liga_id', ligaId)
    .eq('jugador_id', jugadorId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Al desmarcar, no se vuelve sin más a 'activo': se recalcula el estado a
// partir del record actual del jugador (por si mientras estaba lesionado se
// corrigió algún resultado suyo de una ronda ya cerrada, ver
// ajustarStatsPartidoCorregido) — si ese record ya alcanza
// torneo_max_derrotas, el estado correcto es 'clasificado' o 'eliminado', no
// 'activo'.
export async function desmarcarLesionado(ligaId, jugadorId) {
  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .select('torneo_max_derrotas')
    .eq('id', ligaId)
    .single()
  if (ligaError) throw ligaError

  const { data: participante, error: participanteError } = await supabase
    .from('torneo_participantes')
    .select('victorias, derrotas')
    .eq('liga_id', ligaId)
    .eq('jugador_id', jugadorId)
    .single()
  if (participanteError) throw participanteError

  const nuevoEstado = participante.victorias >= liga.torneo_max_derrotas
    ? 'clasificado'
    : participante.derrotas >= liga.torneo_max_derrotas
      ? 'eliminado'
      : 'activo'

  const { data, error } = await supabase
    .from('torneo_participantes')
    .update({ estado: nuevoEstado })
    .eq('liga_id', ligaId)
    .eq('jugador_id', jugadorId)
    .select()
    .single()
  if (error) throw error
  return data
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
// Recibe solo participantes 'activo' — 'clasificado', 'eliminado' y
// 'lesionado' quedan excluidos por igual porque cada llamador filtra por ese
// estado antes de invocarla (no hay ninguna comprobación de estado aquí).
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
// partidos que devolvió, encuentra a quién le faltó partido esta ronda
// (normalmente 0 o 1 en fase suiza, pero puede haber más en el playoff).
function calcularJugadoresSinPartido(pool, partidosGenerados) {
  const idsEnPartidos = new Set(partidosGenerados.flatMap((p) => [p.p1a, p.p1b, p.p2a, p.p2b]))
  return pool.filter((p) => !idsEnPartidos.has(p.jugador_id))
}

// Función pura para el playoff: el pool ya pertenece a un solo lado del
// bracket (WB o LB), así que a diferencia de generarParejasAleatorias no hace
// falta agrupar por record — se agrupan de 4 en 4 directamente, evitando
// repetir parejas ya jugadas EN EL PLAYOFF (parejasPreviasPlayoff; las de la
// fase suiza sí pueden repetirse, ver getParejasPrevias). El sobrante (pool
// no múltiplo de 4) descansa esta ronda con bye.
export function generarParejasPlayoff(clasificados, parejasPreviasPlayoff = new Set()) {
  const { partidos, sobrante } = formarPartidos(barajar(clasificados), parejasPreviasPlayoff)
  return { partidos, bye: sobrante }
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
// Se permite intercambiar dos jugadores del mismo partido (recompone las
// parejas de ese enfrentamiento): como cada "lado" solo escribe su propia
// columna (p1_jugador1_id, p1_jugador2_id, p2_jugador1_id o p2_jugador2_id),
// dos updates a distintas columnas de la misma fila no chocan entre sí. La
// única combinación que no tiene sentido es intercambiar un jugador consigo
// mismo.
export async function intercambiarJugadores(rondaId, lado1, lado2) {
  if (lado1.jugadorId === lado2.jugadorId) {
    throw new Error('No se puede intercambiar un jugador consigo mismo')
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
  const jugadorDescansaAhora = calcularJugadoresSinPartido(activos, partidosGenerados)[0]?.jugador_id ?? null

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

// Jugadores que deberían estar jugando esta ronda (los activos, en fase
// suiza; o las filas de torneo_bracket activas asociadas a esta ronda
// concreta, en WB/LB). Usado solo para calcular quién descansa/tiene bye. Las
// rondas de tipo 'extra' y 'final' se crean siempre con su pool completo ya
// resuelto, así que no tienen un pool "esperado" recalculable aquí.
async function calcularPoolEsperado(ligaId, ronda) {
  if (ronda.tipo === 'suiza') {
    const participantes = await getParticipantes(ligaId)
    return participantes.filter((p) => p.estado === 'activo')
  }
  if (ronda.tipo === 'wb' || ronda.tipo === 'lb') {
    const { data, error } = await supabase
      .from('torneo_bracket')
      .select('jugador_id')
      .eq('liga_id', ligaId)
      .eq('lado', ronda.tipo)
      .eq('ronda_id', ronda.id)
      .eq('estado', 'activo')
    if (error) throw error
    return data ?? []
  }
  return []
}

// Participantes del pool esperado que no aparecen en ninguno de los partidos
// de la ronda. Solo tiene sentido mientras la ronda está en preview. En
// fase suiza esto es "quién descansa"; en WB/LB es "quién tiene bye".
async function calcularDescansan(ligaId, ronda, partidos) {
  if (ronda.estado !== 'pendiente') return []

  const pool = await calcularPoolEsperado(ligaId, ronda)
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

export async function registrarResultadoPartido(partidoId, resultado, sets, jugadorActualId, esAdmin, ausenteId = null) {
  if (!esAdmin) throw new Error('No tienes permiso para registrar este resultado')

  const { data: partido, error: partidoError } = await supabase
    .from('torneo_partidos')
    .select('*, torneo_rondas ( tipo, estado )')
    .eq('id', partidoId)
    .single()
  if (partidoError) throw partidoError

  const tipoRonda = partido.torneo_rondas?.tipo
  const esPlayoff = tipoRonda === 'wb' || tipoRonda === 'lb' || tipoRonda === 'final'
  const rondaYaFinalizada = partido.torneo_rondas?.estado === 'finalizada'

  if (ausenteId && tipoRonda !== 'suiza') {
    throw new Error('Marcar jugador ausente solo está disponible en la fase suiza')
  }
  // Corregir un resultado de playoff ya cerrado no es seguro: avanzarBracket()
  // ya movió a esos 4 jugadores (y puede haber creado rondas nuevas a partir
  // de ese movimiento), así que no hay un "deshacer" simple como en fase
  // suiza/extra — se bloquea en vez de arriesgar un estado de bracket
  // inconsistente.
  if (rondaYaFinalizada && esPlayoff) {
    throw new Error('No se puede corregir un resultado de playoff una vez cerrada su ronda: el bracket ya avanzó a partir de él')
  }

  // Con jugador ausente, el resultado y los sets se derivan automáticamente:
  // gana la pareja contraria a la del ausente y no se juega ningún set.
  const ausenteEnPareja1 = partido.p1_jugador1_id === ausenteId || partido.p1_jugador2_id === ausenteId
  const resultadoFinal = ausenteId ? (ausenteEnPareja1 ? 'pareja2' : 'pareja1') : resultado
  const setsFinal = ausenteId
    ? { set1_p1: null, set1_p2: null, set2_p1: null, set2_p2: null, set3_p1: null, set3_p2: null }
    : sets

  const { error: updateError } = await supabase
    .from('torneo_partidos')
    .update({ ...setsFinal, resultado: resultadoFinal, ausente_id: ausenteId })
    .eq('id', partidoId)
  if (updateError) throw updateError

  if (rondaYaFinalizada) {
    // La ronda ya estaba cerrada: esto es una corrección de un resultado ya
    // contabilizado, no el cierre de la ronda. Se ajusta solo el delta de
    // ESTE partido para sus 4 jugadores, sin reprocesar el resto de la ronda
    // ni volver a tocar torneo_rondas.estado — si no, cerrarRonda() sumaría
    // otra vez las victorias/derrotas ya aplicadas la primera vez.
    const partidoNuevo = { ...partido, ...setsFinal, resultado: resultadoFinal, ausente_id: ausenteId }
    await ajustarStatsPartidoCorregido(partido.liga_id, partido, partidoNuevo)
    return { rondaCompleta: true }
  }

  const { data: partidosRonda, error: partidosRondaError } = await supabase
    .from('torneo_partidos')
    .select('*')
    .eq('ronda_id', partido.ronda_id)
  if (partidosRondaError) throw partidosRondaError

  const rondaCompleta = partidosRonda.every((p) => p.resultado != null)
  if (!rondaCompleta) return { rondaCompleta: false }

  if (esPlayoff) {
    await cerrarRondaPlayoff(partido.liga_id, partido.ronda_id)
  } else {
    await cerrarRonda(partido.liga_id, partido.ronda_id, partidosRonda)
  }
  return { rondaCompleta: true }
}

// Victorias/derrotas que aporta un partido a cada uno de sus 4 jugadores
// según su resultado (o el reparto asimétrico de un jugador ausente) —
// reutilizado tanto al cerrar una ronda por primera vez (cerrarRonda) como al
// corregir un resultado ya contabilizado (ajustarStatsPartidoCorregido). Un
// partido sin decidir o 'no_finalizado' no aporta nada.
function contribucionPartido(p) {
  const contrib = new Map()
  if (!p.resultado || p.resultado === 'no_finalizado') return contrib

  function sumar(jugadorId, campo) {
    if (!jugadorId) return
    const actual = contrib.get(jugadorId) ?? { victorias: 0, derrotas: 0 }
    actual[campo] += 1
    contrib.set(jugadorId, actual)
  }

  if (p.ausente_id) {
    const ausenteEnPareja1 = p.p1_jugador1_id === p.ausente_id || p.p1_jugador2_id === p.ausente_id
    const rivales = ausenteEnPareja1
      ? [p.p2_jugador1_id, p.p2_jugador2_id]
      : [p.p1_jugador1_id, p.p1_jugador2_id]
    sumar(p.ausente_id, 'derrotas')
    rivales.forEach((id) => sumar(id, 'victorias'))
    return contrib
  }

  const ganadores = p.resultado === 'pareja1'
    ? [p.p1_jugador1_id, p.p1_jugador2_id]
    : [p.p2_jugador1_id, p.p2_jugador2_id]
  const perdedores = p.resultado === 'pareja1'
    ? [p.p2_jugador1_id, p.p2_jugador2_id]
    : [p.p1_jugador1_id, p.p1_jugador2_id]
  ganadores.forEach((id) => sumar(id, 'victorias'))
  perdedores.forEach((id) => sumar(id, 'derrotas'))
  return contrib
}

// Corrige las stats de un partido de fase suiza/extra cuya ronda YA estaba
// finalizada, sin reprocesar el resto de la ronda: a cada uno de sus 4
// jugadores se le resta la contribución que tenía el resultado anterior y se
// le suma la del nuevo (p. ej. si antes ganaba pareja1 y ahora gana pareja2,
// esos 4 jugadores ven revertida la victoria/derrota antigua y aplicada la
// nueva). Solo se escribe para los jugadores realmente afectados por el
// cambio, no para todos torneo_participantes.
async function ajustarStatsPartidoCorregido(ligaId, partidoAnterior, partidoNuevo) {
  const contribAnterior = contribucionPartido(partidoAnterior)
  const contribNueva = contribucionPartido(partidoNuevo)
  const jugadoresTocados = new Set([...contribAnterior.keys(), ...contribNueva.keys()])
  if (jugadoresTocados.size === 0) return

  const { data: liga, error: ligaError } = await supabase
    .from('ligas')
    .select('torneo_max_derrotas')
    .eq('id', ligaId)
    .single()
  if (ligaError) throw ligaError

  const participantes = await getParticipantes(ligaId)
  const cambios = new Map(participantes.map((p) => [p.jugador_id, { ...p }]))

  await Promise.all(
    [...jugadoresTocados].map((jugadorId) => {
      const c = cambios.get(jugadorId)
      if (!c) return null

      const antes = contribAnterior.get(jugadorId) ?? { victorias: 0, derrotas: 0 }
      const despues = contribNueva.get(jugadorId) ?? { victorias: 0, derrotas: 0 }
      c.victorias += despues.victorias - antes.victorias
      c.derrotas += despues.derrotas - antes.derrotas
      if (c.victorias >= liga.torneo_max_derrotas) c.estado = 'clasificado'
      else if (c.derrotas >= liga.torneo_max_derrotas) c.estado = 'eliminado'
      else c.estado = 'activo'

      return supabase
        .from('torneo_participantes')
        .update({ victorias: c.victorias, derrotas: c.derrotas, estado: c.estado })
        .eq('id', c.id)
    })
  )
}

async function cerrarRonda(ligaId, rondaId, partidosRonda) {
  const { error: cerrarError } = await supabase
    .from('torneo_rondas')
    .update({ estado: 'finalizada' })
    .eq('id', rondaId)
  if (cerrarError) throw cerrarError

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
    for (const [jugadorId, { victorias, derrotas }] of contribucionPartido(p)) {
      const c = cambios.get(jugadorId)
      if (!c) continue
      c.victorias += victorias
      c.derrotas += derrotas
      tocados.add(jugadorId)
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
  // Esta misma lógica aplica tanto a rondas de fase suiza como a rondas
  // extra: ninguna decide automáticamente el siguiente paso (ni continuar,
  // ni pasar a playoff) — eso lo hace el admin explícitamente con
  // finalizarFaseSuiza() o crearRondaFinal(), viendo el botón "Finalizar
  // fase suiza" tanto en la vista de fase suiza como en la de ronda extra.
}

// ── Playoff (double elimination) ─────────────────────────────────────────────

// Récord de victorias/derrotas SOLO del playoff (WB + LB + Gran Final),
// calculado al vuelo a partir de torneo_partidos — no se guarda en
// torneo_bracket para no duplicar estado. Devuelve un Map jugador_id -> {victorias, derrotas}.
async function calcularRecordPlayoff(ligaId) {
  const { data: rondas, error: rondasError } = await supabase
    .from('torneo_rondas')
    .select('id')
    .eq('liga_id', ligaId)
    .in('tipo', ['wb', 'lb', 'final'])
  if (rondasError) throw rondasError

  const rondaIds = (rondas ?? []).map((r) => r.id)
  const record = new Map()
  if (rondaIds.length === 0) return record

  const { data: partidos, error: partidosError } = await supabase
    .from('torneo_partidos')
    .select('p1_jugador1_id, p1_jugador2_id, p2_jugador1_id, p2_jugador2_id, resultado')
    .in('ronda_id', rondaIds)
    .eq('preview', false)
  if (partidosError) throw partidosError

  function sumar(jugadorId, campo) {
    if (!record.has(jugadorId)) record.set(jugadorId, { victorias: 0, derrotas: 0 })
    record.get(jugadorId)[campo] += 1
  }

  for (const p of partidos ?? []) {
    if (p.resultado == null || p.resultado === 'no_finalizado') continue
    const ganadores = p.resultado === 'pareja1'
      ? [p.p1_jugador1_id, p.p1_jugador2_id]
      : [p.p2_jugador1_id, p.p2_jugador2_id]
    const perdedores = p.resultado === 'pareja1'
      ? [p.p2_jugador1_id, p.p2_jugador2_id]
      : [p.p1_jugador1_id, p.p1_jugador2_id]
    ganadores.forEach((id) => sumar(id, 'victorias'))
    perdedores.forEach((id) => sumar(id, 'derrotas'))
  }

  return record
}

// Crea (en preview) la siguiente ronda de un lado del bracket (WB o LB) a
// partir de quienes siguen 'activo' en ese lado. Marca con bye=true, en las
// filas de torneo_bracket, a quienes se quedan sin partido esta ronda (pool
// no múltiplo de 4) y asocia todas las filas de ese lado a esta ronda
// (ronda_id), jueguen o no, para que calcularPoolEsperado() las recoja.
async function crearRondaBracket(ligaId, lado, creadoPor) {
  const { data: filasBracket, error: bracketError } = await supabase
    .from('torneo_bracket')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('lado', lado)
    .eq('estado', 'activo')
  if (bracketError) throw bracketError

  const parejasPrevias = await getParejasPrevias(ligaId, lado)
  const ids = filasBracket.map((f) => f.jugador_id)
  const { partidos: partidosIds, bye } = generarParejasPlayoff(ids, parejasPrevias)

  if (partidosIds.length === 0) {
    throw new Error(
      `No se puede generar la siguiente ronda de ${lado === 'wb' ? 'Winner Bracket' : 'Loser Bracket'}: ` +
      'el número de jugadores restante no permite formar ningún partido.'
    )
  }

  const numero = await obtenerSiguienteNumeroRonda(ligaId)
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: lado, numero, estado: 'pendiente' })
    .select()
    .single()
  if (rondaError) throw rondaError

  await crearPartidosRonda(ronda.id, ligaId, partidosIds, creadoPor, { preview: true })

  const idsConBye = new Set(bye)
  await Promise.all(
    filasBracket.map((f) =>
      supabase.from('torneo_bracket').update({ ronda_id: ronda.id, bye: idsConBye.has(f.jugador_id) }).eq('id', f.id)
    )
  )

  return ronda
}

// Crea la Gran Final: partido único entre los 4 finalistas (2 que llegan
// desde el WB, 2 desde el LB), con parejas sorteadas al azar entre los 4 —
// no hay pareja fija ni ventaja para quien viene del WB. Gana quien gane
// este partido, directamente campeón; no existe ronda de desempate.
async function crearGranFinal(ligaId, enWb, enLb) {
  const numero = await obtenerSiguienteNumeroRonda(ligaId)
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: 'final', numero, estado: 'pendiente' })
    .select()
    .single()
  if (rondaError) throw rondaError

  const [a, b, c, d] = barajar([...enWb, ...enLb].map((f) => f.jugador_id))
  const partido = { p1a: a, p1b: b, p2a: c, p2b: d }
  await crearPartidosRonda(ronda.id, ligaId, [partido], null, { preview: true })

  await Promise.all(
    [...enWb, ...enLb].map((f) =>
      supabase.from('torneo_bracket').update({ ronda_id: ronda.id, bye: false }).eq('id', f.id)
    )
  )

  return ronda
}

// WB y LB pueden tener cada uno una ronda activa simultáneamente (p. ej. las
// dos rondas paralelas que crea iniciarPlayoff() cuando sobran 2 clasificados,
// o un WB que ya avanzó de ronda mientras el LB anterior sigue abierto): antes
// de crear una ronda nueva para un lado hay que comprobar que ese lado no
// tenga ya una en curso, o se duplicaría con jugadores que siguen jugando.
async function hayRondaActivaDeTipo(ligaId, tipo) {
  const { data, error } = await supabase
    .from('torneo_rondas')
    .select('id')
    .eq('liga_id', ligaId)
    .eq('tipo', tipo)
    .in('estado', ['pendiente', 'en_curso'])
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return !!data
}

// Avanza el bracket automáticamente cuando se cierra una ronda de playoff
// (llamado desde cerrarRondaPlayoff). Ganadores de WB siguen en WB;
// perdedores de WB caen al LB; ganadores de LB siguen en LB; perdedores de LB
// quedan eliminados del torneo. Un partido 'no_finalizado' no mueve a esos 4
// jugadores (se quedan 'activo' en su lado actual y entran en la siguiente
// ronda de ese lado con normalidad) — limitación conocida, ver CLAUDE.md.
export async function avanzarBracket(ligaId, rondaId) {
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('id', rondaId)
    .single()
  if (rondaError) throw rondaError

  if (ronda.tipo === 'final') {
    // Partido único: el ganador ya es el campeón directamente, no hay ronda
    // de desempate que crear. getEstadoPlayoff() deriva el campeón leyendo
    // el resultado de esta misma ronda una vez queda 'finalizada'.
    return
  }

  const { data: partidosRonda, error: partidosError } = await supabase
    .from('torneo_partidos')
    .select('*')
    .eq('ronda_id', rondaId)
  if (partidosError) throw partidosError

  const { data: filasBracket, error: bracketError } = await supabase
    .from('torneo_bracket')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('ronda_id', rondaId)
  if (bracketError) throw bracketError
  const bracketPorJugador = new Map(filasBracket.map((f) => [f.jugador_id, f]))

  const actualizaciones = new Map()
  for (const p of partidosRonda) {
    if (p.resultado === 'no_finalizado') continue
    const ganadores = p.resultado === 'pareja1'
      ? [p.p1_jugador1_id, p.p1_jugador2_id]
      : [p.p2_jugador1_id, p.p2_jugador2_id]
    const perdedores = p.resultado === 'pareja1'
      ? [p.p2_jugador1_id, p.p2_jugador2_id]
      : [p.p1_jugador1_id, p.p1_jugador2_id]

    for (const jugadorId of ganadores) {
      actualizaciones.set(jugadorId, { lado: ronda.tipo, estado: 'activo' })
    }
    for (const jugadorId of perdedores) {
      actualizaciones.set(jugadorId, ronda.tipo === 'wb' ? { lado: 'lb', estado: 'activo' } : { lado: 'lb', estado: 'eliminado' })
    }
  }

  await Promise.all(
    [...actualizaciones.entries()].map(([jugadorId, cambio]) => {
      const fila = bracketPorJugador.get(jugadorId)
      if (!fila) return null
      return supabase.from('torneo_bracket').update(cambio).eq('id', fila.id)
    })
  )

  const { data: bracketActivo, error: activoError } = await supabase
    .from('torneo_bracket')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('estado', 'activo')
  if (activoError) throw activoError

  const enWb = bracketActivo.filter((f) => f.lado === 'wb')
  const enLb = bracketActivo.filter((f) => f.lado === 'lb')

  // Los dos lados se comprueban de forma independiente (no "else if"): con
  // rondas WB/LB en paralelo, cerrar la ronda de un lado puede necesitar
  // generar la siguiente ronda de ESE lado sin tocar el otro, que puede
  // seguir teniendo su propia ronda abierta.
  if (enWb.length > 2 && !(await hayRondaActivaDeTipo(ligaId, 'wb'))) {
    await crearRondaBracket(ligaId, 'wb', null)
  }
  if (enLb.length > 2 && !(await hayRondaActivaDeTipo(ligaId, 'lb'))) {
    await crearRondaBracket(ligaId, 'lb', null)
  }
  if (enWb.length === 2 && enLb.length === 2 && !(await hayRondaActivaDeTipo(ligaId, 'final'))) {
    await crearGranFinal(ligaId, enWb, enLb)
  }
  // Si un lado ya bajó a 2 pero el otro aún no, no se crea nada: se espera a
  // que el otro lado también resuelva sus rondas pendientes.
}

// Cierra una ronda de playoff (WB, LB o Gran Final): la marca 'finalizada' y
// dispara el avance automático del bracket (a diferencia de fase suiza/extra,
// donde el avance es siempre una acción manual del admin).
async function cerrarRondaPlayoff(ligaId, rondaId) {
  const { error } = await supabase.from('torneo_rondas').update({ estado: 'finalizada' }).eq('id', rondaId)
  if (error) throw error
  await avanzarBracket(ligaId, rondaId)
}

// Arranca el playoff a partir de los participantes 'clasificado', ordenados
// por victorias desc / derrotas asc. Si el número de clasificados no es
// múltiplo de 4 (debe serlo, o serlo +2), los 2 primeros del ranking tienen
// bye en la primera ronda de WB (sorteo aleatorio si empatan en el puesto de
// corte). TODOS los clasificados entran en `torneo_bracket` con `lado='wb'`
// — el LB arranca completamente vacío y solo se puebla más adelante con los
// perdedores de la propia WB Ronda 1 (vía avanzarBracket()); no se crea
// ninguna ronda LB aquí. Los clasificados sin bye juegan la ronda `tipo='wb'`
// en preview; los 2 con bye quedan asociados a esa misma ronda (bye=true,
// sin partido) hasta que les toque jugar en WB Ronda 2.
export async function iniciarPlayoff(ligaId) {
  const participantes = await getParticipantes(ligaId)
  let clasificados = [...participantes.filter((p) => p.estado === 'clasificado')].sort((a, b) => {
    if (b.victorias !== a.victorias) return b.victorias - a.victorias
    return a.derrotas - b.derrotas
  })

  const n = clasificados.length
  const resto = n % 4
  if (n === 0 || (resto !== 0 && resto !== 2)) {
    throw new Error('El número de clasificados no permite formar el playoff (debe ser múltiplo de 4, o múltiplo de 4 más 2)')
  }

  if (resto === 2) {
    const [primero, segundo] = clasificados
    if (primero.victorias === segundo.victorias && primero.derrotas === segundo.derrotas && Math.random() < 0.5) {
      clasificados = [segundo, primero, ...clasificados.slice(2)]
    }
  }

  const conBye = resto === 2 ? clasificados.slice(0, 2) : []
  const sinBye = resto === 2 ? clasificados.slice(2) : clasificados
  const idsConBye = new Set(conBye.map((p) => p.jugador_id))
  const posicionPorId = new Map(clasificados.map((p, i) => [p.jugador_id, i + 1]))

  const numero = await obtenerSiguienteNumeroRonda(ligaId)
  const { data: rondaWb, error: rondaWbError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: 'wb', numero, estado: 'pendiente' })
    .select()
    .single()
  if (rondaWbError) throw rondaWbError

  const filasBracket = clasificados.map((p) => ({
    liga_id: ligaId,
    ronda_id: rondaWb.id,
    jugador_id: p.jugador_id,
    posicion: posicionPorId.get(p.jugador_id),
    lado: 'wb',
    estado: 'activo',
    bye: idsConBye.has(p.jugador_id),
  }))
  const { error: bracketError } = await supabase.from('torneo_bracket').insert(filasBracket)
  if (bracketError) throw bracketError

  const parejasPrevias = await getParejasPrevias(ligaId, 'wb')
  const { partidos: partidosWb } = generarParejasPlayoff(sinBye.map((p) => p.jugador_id), parejasPrevias)
  await crearPartidosRonda(rondaWb.id, ligaId, partidosWb, null, { preview: true })

  const { error: estadoError } = await supabase.from('ligas').update({ torneo_estado: 'playoff' }).eq('id', ligaId)
  if (estadoError) throw estadoError
}

// Número de ronda relativo dentro de su lado del bracket (1, 2, 3... contando
// solo rondas del mismo tipo — wb o lb — anteriores a esta), en vez del
// `numero` absoluto que continúa la numeración global de toda la liga.
async function contarRondaRelativa(ligaId, ronda) {
  if (ronda.tipo !== 'wb' && ronda.tipo !== 'lb') return null
  const { count, error } = await supabase
    .from('torneo_rondas')
    .select('*', { count: 'exact', head: true })
    .eq('liga_id', ligaId)
    .eq('tipo', ronda.tipo)
    .lt('numero', ronda.numero)
  if (error) throw error
  return (count ?? 0) + 1
}

// Ronda activa (pendiente o en_curso) de un tipo concreto ('wb', 'lb' o
// 'final'), con sus partidos y quién tiene bye — igual que getRondaActual()
// pero acotada a un solo lado, ya que WB y LB pueden tener cada uno su propia
// ronda abierta al mismo tiempo (a diferencia de fase suiza/extra, donde solo
// hay una ronda activa por liga).
async function getRondaActivaDeTipo(ligaId, tipo) {
  const { data: ronda, error } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('tipo', tipo)
    .in('estado', ['en_curso', 'pendiente'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!ronda) return null

  const partidos = await resolverPartidosDeRonda(ligaId, ronda.id)
  const descansan = await calcularDescansan(ligaId, ronda, partidos)
  return { ...ronda, partidos, descansan }
}

// Estado completo del bracket para la UI: jugadores en WB y en LB (con su
// posición inicial y récord de playoff), la ronda activa de cada lado
// (rondaWb/rondaLb — pueden coexistir en paralelo, p. ej. justo al arrancar
// el playoff con 2 clasificados de sobra), la Gran Final (rondaFinal, nunca
// simultánea con rondaWb/rondaLb) y el campeón si ya se decidió (derivado de
// la última ronda 'final' finalizada cuando ya no queda ninguna ronda
// pendiente/en curso en ningún lado).
export async function getEstadoPlayoff(ligaId) {
  const { data: filas, error } = await supabase
    .from('torneo_bracket')
    .select('*, liga_jugadores ( id, nombre )')
    .eq('liga_id', ligaId)
    .order('posicion', { ascending: true })
  if (error) throw error

  const record = await calcularRecordPlayoff(ligaId)
  function enriquecer(f) {
    return {
      ...f,
      jugador: f.liga_jugadores,
      victorias: record.get(f.jugador_id)?.victorias ?? 0,
      derrotas: record.get(f.jugador_id)?.derrotas ?? 0,
    }
  }

  const wb = (filas ?? []).filter((f) => f.lado === 'wb').map(enriquecer)
  const lb = (filas ?? []).filter((f) => f.lado === 'lb').map(enriquecer)

  const [rondaWbActiva, rondaLbActiva, rondaFinal] = await Promise.all([
    getRondaActivaDeTipo(ligaId, 'wb'),
    getRondaActivaDeTipo(ligaId, 'lb'),
    getRondaActivaDeTipo(ligaId, 'final'),
  ])

  const rondaWb = rondaWbActiva
    ? { ...rondaWbActiva, numeroRelativo: await contarRondaRelativa(ligaId, rondaWbActiva) }
    : null
  const rondaLb = rondaLbActiva
    ? { ...rondaLbActiva, numeroRelativo: await contarRondaRelativa(ligaId, rondaLbActiva) }
    : null

  let campeon = null
  if (!rondaWb && !rondaLb && !rondaFinal) {
    const { data: ultimaFinal, error: finalError } = await supabase
      .from('torneo_rondas')
      .select('*')
      .eq('liga_id', ligaId)
      .eq('tipo', 'final')
      .eq('estado', 'finalizada')
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (finalError) throw finalError

    if (ultimaFinal) {
      const partidosFinal = await resolverPartidosDeRonda(ligaId, ultimaFinal.id)
      const partido = partidosFinal[0]
      if (partido?.resultado === 'pareja1') campeon = { j1: partido.p1j1, j2: partido.p1j2 }
      else if (partido?.resultado === 'pareja2') campeon = { j1: partido.p2j1, j2: partido.p2j2 }
    }
  }

  return { wb, lb, rondaWb, rondaLb, rondaFinal, campeon }
}

// Cierra el torneo (acción explícita del admin tras ver la pantalla de
// campeón): guarda campeonId en ligas.torneo_ganador_id (un único jugador de
// referencia; la pareja ganadora completa se sigue viendo en el resultado del
// partido de la Gran Final) y marca campeon=true en torneo_participantes para
// los 2 jugadores de la pareja ganadora — releída aquí desde el resultado del
// partido, no confiada al llamador, para no depender de que el cliente pase
// el id correcto del compañero.
export async function finalizarTorneo(ligaId, campeonId) {
  const { data: ultimaFinal, error: finalError } = await supabase
    .from('torneo_rondas')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('tipo', 'final')
    .eq('estado', 'finalizada')
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (finalError) throw finalError

  if (ultimaFinal) {
    const { data: partidoFinal, error: partidoError } = await supabase
      .from('torneo_partidos')
      .select('*')
      .eq('ronda_id', ultimaFinal.id)
      .maybeSingle()
    if (partidoError) throw partidoError

    if (partidoFinal?.resultado === 'pareja1' || partidoFinal?.resultado === 'pareja2') {
      const ganadoresIds = partidoFinal.resultado === 'pareja1'
        ? [partidoFinal.p1_jugador1_id, partidoFinal.p1_jugador2_id]
        : [partidoFinal.p2_jugador1_id, partidoFinal.p2_jugador2_id]

      const { data: participantesGanadores, error: participantesError } = await supabase
        .from('torneo_participantes')
        .select('id')
        .eq('liga_id', ligaId)
        .in('jugador_id', ganadoresIds)
      if (participantesError) throw participantesError

      if (participantesGanadores.length > 0) {
        const { error: badgeError } = await supabase
          .from('torneo_participantes')
          .update({ campeon: true })
          .in('id', participantesGanadores.map((p) => p.id))
        if (badgeError) throw badgeError
      }
    }
  }

  const { error } = await supabase
    .from('ligas')
    .update({ torneo_estado: 'finalizado', torneo_ganador_id: campeonId })
    .eq('id', ligaId)
  if (error) throw error
}

// Posición final de cada jugador que llegó al playoff, derivada por completo
// del historial real de partidos (no del `estado`/`ronda_id` "actuales" de
// torneo_bracket, que para los 4 finalistas de la Gran Final no se actualizan
// — avanzarBracket() no toca nada cuando cierra una ronda 'final'):
//   1º/2º → ganadores/perdedores de la ronda 'final' (empatados de a 2, ya
//     que la Gran Final es 2vs2 y no hay desempate por posición individual).
//   3º-4º → perdedores de la última ronda 'lb' (por `numero`) antes de la
//     final — siempre exactamente un partido de 4, ya que el LB solo llega a
//     quedar en 2 jugando una ronda con pool=4.
//   El resto → agrupados por la ronda 'lb' en la que perdieron (ronda más
//     reciente = mejor posición), continuando la numeración de posiciones
//     tras el hueco que dejó el grupo anterior (p. ej. si 3º-4º ocupó 2
//     puestos, el siguiente grupo empieza en 5º).
export async function getClasificacionPlayoff(ligaId) {
  const { data: filasBracket, error: bracketError } = await supabase
    .from('torneo_bracket')
    .select('jugador_id, liga_jugadores ( id, nombre )')
    .eq('liga_id', ligaId)
  if (bracketError) throw bracketError

  const nombrePorJugador = new Map(filasBracket.map((f) => [f.jugador_id, f.liga_jugadores?.nombre ?? '—']))
  const record = await calcularRecordPlayoff(ligaId)

  const { data: rondas, error: rondasError } = await supabase
    .from('torneo_rondas')
    .select('id, tipo, numero')
    .eq('liga_id', ligaId)
    .in('tipo', ['wb', 'lb', 'final'])
    .order('numero', { ascending: true })
  if (rondasError) throw rondasError

  const rondaIds = rondas.map((r) => r.id)
  const { data: partidos, error: partidosError } = rondaIds.length === 0
    ? { data: [], error: null }
    : await supabase
      .from('torneo_partidos')
      .select('ronda_id, p1_jugador1_id, p1_jugador2_id, p2_jugador1_id, p2_jugador2_id, resultado')
      .in('ronda_id', rondaIds)
      .eq('preview', false)
  if (partidosError) throw partidosError

  const posiciones = new Map()
  let siguientePosicion = 1

  const rondaFinal = rondas.filter((r) => r.tipo === 'final').sort((a, b) => b.numero - a.numero)[0] ?? null
  const partidoFinal = rondaFinal
    ? partidos.find((p) => p.ronda_id === rondaFinal.id && (p.resultado === 'pareja1' || p.resultado === 'pareja2'))
    : null

  if (partidoFinal) {
    const ganadores = partidoFinal.resultado === 'pareja1'
      ? [partidoFinal.p1_jugador1_id, partidoFinal.p1_jugador2_id]
      : [partidoFinal.p2_jugador1_id, partidoFinal.p2_jugador2_id]
    const perdedores = partidoFinal.resultado === 'pareja1'
      ? [partidoFinal.p2_jugador1_id, partidoFinal.p2_jugador2_id]
      : [partidoFinal.p1_jugador1_id, partidoFinal.p1_jugador2_id]
    ganadores.forEach((id) => posiciones.set(id, 1))
    perdedores.forEach((id) => posiciones.set(id, 2))
    siguientePosicion = 3
  }

  const rondasLb = rondas.filter((r) => r.tipo === 'lb').sort((a, b) => b.numero - a.numero)

  for (const ronda of rondasLb) {
    const perdedoresRonda = []
    for (const p of partidos.filter((p) => p.ronda_id === ronda.id)) {
      if (p.resultado !== 'pareja1' && p.resultado !== 'pareja2') continue
      const perdedores = p.resultado === 'pareja1'
        ? [p.p2_jugador1_id, p.p2_jugador2_id]
        : [p.p1_jugador1_id, p.p1_jugador2_id]
      for (const id of perdedores) {
        if (!posiciones.has(id)) perdedoresRonda.push(id)
      }
    }
    if (perdedoresRonda.length === 0) continue
    for (const id of perdedoresRonda) posiciones.set(id, siguientePosicion)
    siguientePosicion += perdedoresRonda.length
  }

  for (const f of filasBracket) {
    if (!posiciones.has(f.jugador_id)) posiciones.set(f.jugador_id, siguientePosicion++)
  }

  return [...posiciones.entries()]
    .map(([jugadorId, posicion]) => ({
      jugadorId,
      nombre: nombrePorJugador.get(jugadorId) ?? '—',
      posicion,
      victoriasPlayoff: record.get(jugadorId)?.victorias ?? 0,
      derrotasPlayoff: record.get(jugadorId)?.derrotas ?? 0,
    }))
    .sort((a, b) => a.posicion - b.posicion)
}

// Estadísticas generales del torneo para la pantalla final: total de
// partidos jugados (suiza + playoff, contando solo los ya confirmados/no
// preview) y número de rondas de cada fase.
export async function getTorneoStats(ligaId) {
  const { data: rondas, error: rondasError } = await supabase
    .from('torneo_rondas')
    .select('id, tipo')
    .eq('liga_id', ligaId)
  if (rondasError) throw rondasError

  const rondaIds = rondas.map((r) => r.id)
  const rondasSuiza = rondas.filter((r) => r.tipo === 'suiza' || r.tipo === 'extra').length
  const rondasPlayoff = rondas.filter((r) => r.tipo === 'wb' || r.tipo === 'lb' || r.tipo === 'final').length

  const { count, error: partidosError } = rondaIds.length === 0
    ? { count: 0, error: null }
    : await supabase
      .from('torneo_partidos')
      .select('*', { count: 'exact', head: true })
      .in('ronda_id', rondaIds)
      .eq('preview', false)
      .not('resultado', 'is', null)
  if (partidosError) throw partidosError

  return {
    totalPartidos: count ?? 0,
    rondasSuiza,
    rondasPlayoff,
  }
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
  const jugadorDescansaAhora = calcularJugadoresSinPartido(activos, partidosGenerados)[0]?.jugador_id ?? null

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

  if (ronda.tipo === 'final') {
    const { data: filasBracket, error: bracketError } = await supabase
      .from('torneo_bracket')
      .select('jugador_id')
      .eq('liga_id', ligaId)
      .eq('ronda_id', rondaId)
    if (bracketError) throw bracketError

    await supabase.from('torneo_partidos').delete().eq('ronda_id', rondaId)

    const [a, b, c, d] = barajar(filasBracket.map((f) => f.jugador_id))
    await crearPartidosRonda(rondaId, ligaId, [{ p1a: a, p1b: b, p2a: c, p2b: d }], null, { preview: true })

    return getRondaConPartidos(ligaId, rondaId)
  }

  if (ronda.tipo === 'wb' || ronda.tipo === 'lb') {
    const { data: filasBracket, error: bracketError } = await supabase
      .from('torneo_bracket')
      .select('*')
      .eq('liga_id', ligaId)
      .eq('lado', ronda.tipo)
      .eq('ronda_id', rondaId)
      .eq('estado', 'activo')
    if (bracketError) throw bracketError

    await supabase.from('torneo_partidos').delete().eq('ronda_id', rondaId)

    const parejasPrevias = await getParejasPrevias(ligaId, ronda.tipo)
    const ids = filasBracket.map((f) => f.jugador_id)
    const { partidos: partidosIds, bye } = generarParejasPlayoff(ids, parejasPrevias)
    if (partidosIds.length === 0) {
      throw new Error('No se puede repetir el sorteo: el número de jugadores no permite formar ningún partido.')
    }
    await crearPartidosRonda(rondaId, ligaId, partidosIds, null, { preview: true })

    const idsConBye = new Set(bye)
    await Promise.all(
      filasBracket.map((f) => supabase.from('torneo_bracket').update({ bye: idsConBye.has(f.jugador_id) }).eq('id', f.id))
    )

    return getRondaConPartidos(ligaId, rondaId)
  }

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
  const jugadorDescansaAhora = calcularJugadoresSinPartido(pool, partidosGenerados)[0]?.jugador_id ?? null
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

// El número de una nueva ronda extra continúa la numeración global de la
// liga (no reinicia en 1): el siguiente al máximo `numero` existente entre
// TODAS las rondas de la liga, sin filtrar por tipo.
async function obtenerSiguienteNumeroRonda(ligaId) {
  const { data, error } = await supabase
    .from('torneo_rondas')
    .select('numero')
    .eq('liga_id', ligaId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.numero ?? 0) + 1
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
    const numero = await obtenerSiguienteNumeroRonda(ligaId)
    const { data: ronda, error: rondaError } = await supabase
      .from('torneo_rondas')
      .insert({ liga_id: ligaId, tipo: 'extra', numero, estado: 'pendiente' })
      .select()
      .single()
    if (rondaError) throw rondaError

    const partidosGenerados = generarParejasAleatorias(activosRestantes, new Set())
    await crearPartidosRonda(ronda.id, ligaId, partidosGenerados, null, { preview: true })

    const { error: estadoError } = await supabase.from('ligas').update({ torneo_estado: siguienteFase }).eq('id', ligaId)
    if (estadoError) throw estadoError
  } else {
    // iniciarPlayoff() ya deja torneo_estado en 'playoff' como último paso,
    // junto con la creación del bracket, para que ambas cosas queden atómicas.
    await iniciarPlayoff(ligaId)
  }

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

  const numero = await obtenerSiguienteNumeroRonda(ligaId)
  const { data: ronda, error: rondaError } = await supabase
    .from('torneo_rondas')
    .insert({ liga_id: ligaId, tipo: 'extra', numero, estado: 'pendiente' })
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

// ── Pestaña "Partidos" del torneo ────────────────────────────────────────────

// A diferencia de la liga estándar, en el torneo solo el admin puede
// registrar y modificar resultados — los jugadores no pueden editar ni
// siquiera los partidos en los que juegan.
export function puedeEditarTorneo(esAdmin) {
  return { puede: esAdmin, pareja: null }
}

// Todos los partidos del torneo (cualquier fase) con los nombres de los 4
// jugadores ya resueltos y el tipo/número de su ronda, para la pestaña
// "Partidos". Excluye los partidos de rondas aún en preview (todavía no
// confirmadas por el admin) y ordena por número de ronda y luego por fecha
// de creación — torneo_partidos no tiene columna `fecha` propia (se generan
// automáticamente, no se registran a mano), a diferencia de `partidos`.
export async function getTodosPartidosTorneo(ligaId) {
  const [{ data: partidos, error: partidosError }, { data: jugadores, error: jugadoresError }] = await Promise.all([
    supabase
      .from('torneo_partidos')
      .select('*, torneo_rondas ( tipo, numero )')
      .eq('liga_id', ligaId)
      .eq('preview', false),
    supabase.from('liga_jugadores').select('id, nombre').eq('liga_id', ligaId),
  ])
  if (partidosError) throw partidosError
  if (jugadoresError) throw jugadoresError

  const jugadorMap = Object.fromEntries((jugadores ?? []).map((j) => [j.id, j]))

  return (partidos ?? [])
    .map((p) => ({
      ...p,
      ronda_tipo: p.torneo_rondas?.tipo ?? null,
      ronda_numero: p.torneo_rondas?.numero ?? null,
      p1j1: jugadorMap[p.p1_jugador1_id] ?? null,
      p1j2: jugadorMap[p.p1_jugador2_id] ?? null,
      p2j1: jugadorMap[p.p2_jugador1_id] ?? null,
      p2j2: jugadorMap[p.p2_jugador2_id] ?? null,
    }))
    .sort((a, b) => {
      if (a.ronda_numero !== b.ronda_numero) return (a.ronda_numero ?? 0) - (b.ronda_numero ?? 0)
      return new Date(a.created_at) - new Date(b.created_at)
    })
}

// ── Pestaña "Mi Perfil" del torneo ───────────────────────────────────────────

function ganoPartidoJugador(partido, jugadorId) {
  return (
    (partido.resultado === 'pareja1' && (partido.p1_jugador1_id === jugadorId || partido.p1_jugador2_id === jugadorId)) ||
    (partido.resultado === 'pareja2' && (partido.p2_jugador1_id === jugadorId || partido.p2_jugador2_id === jugadorId))
  )
}

// Estado de un jugador en el torneo para la pestaña "Mi Perfil": su récord de
// fase suiza, si llegó al playoff y su récord ahí, si ya es campeón, y hasta
// qué fase llegó una vez queda fuera. No usa `torneo_bracket.estado` para
// detectar campeón/finalista porque `avanzarBracket()` no lo actualiza en la
// Gran Final (ver comentario en avanzarBracket) — en su lugar busca
// directamente si el jugador jugó una ronda `tipo='final'` y quién la ganó.
export async function getParticipacionTorneoJugador(ligaId, jugadorId) {
  const { data: participante, error: participanteError } = await supabase
    .from('torneo_participantes')
    .select('*')
    .eq('liga_id', ligaId)
    .eq('jugador_id', jugadorId)
    .maybeSingle()
  if (participanteError) throw participanteError
  if (!participante) return null

  const resultado = {
    estado: participante.estado,
    victoriasSuiza: participante.victorias,
    derrotasSuiza: participante.derrotas,
    esCampeon: !!participante.campeon,
    enPlayoff: false,
    victoriasPlayoff: 0,
    derrotasPlayoff: 0,
    faseAlcanzada: null,
  }

  const { data: filaBracket, error: bracketError } = await supabase
    .from('torneo_bracket')
    .select('estado')
    .eq('liga_id', ligaId)
    .eq('jugador_id', jugadorId)
    .maybeSingle()
  if (bracketError) throw bracketError
  if (!filaBracket) return resultado

  resultado.enPlayoff = true

  const record = await calcularRecordPlayoff(ligaId)
  resultado.victoriasPlayoff = record.get(jugadorId)?.victorias ?? 0
  resultado.derrotasPlayoff = record.get(jugadorId)?.derrotas ?? 0

  const { data: rondas, error: rondasError } = await supabase
    .from('torneo_rondas')
    .select('id, tipo, numero')
    .eq('liga_id', ligaId)
    .in('tipo', ['wb', 'lb', 'final'])
  if (rondasError) throw rondasError
  const rondaPorId = new Map(rondas.map((r) => [r.id, r]))
  const rondaIds = rondas.map((r) => r.id)

  const { data: partidosRondas, error: partidosError } = rondaIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('torneo_partidos').select('*').in('ronda_id', rondaIds).eq('preview', false)
  if (partidosError) throw partidosError

  const jugados = (partidosRondas ?? [])
    .filter((p) =>
      (p.resultado === 'pareja1' || p.resultado === 'pareja2') &&
      [p.p1_jugador1_id, p.p1_jugador2_id, p.p2_jugador1_id, p.p2_jugador2_id].includes(jugadorId)
    )
    .map((p) => ({ ...p, ronda: rondaPorId.get(p.ronda_id) }))
    .sort((a, b) => b.ronda.numero - a.ronda.numero)

  const partidoFinal = jugados.find((p) => p.ronda.tipo === 'final')
  if (partidoFinal) {
    resultado.faseAlcanzada = ganoPartidoJugador(partidoFinal, jugadorId) ? 'Campeón' : 'Finalista'
  } else if (filaBracket.estado === 'eliminado') {
    const ultimaDerrota = jugados.find((p) => !ganoPartidoJugador(p, jugadorId))
    if (ultimaDerrota) {
      const numeroRelativo = await contarRondaRelativa(ligaId, ultimaDerrota.ronda)
      const nombreLado = ultimaDerrota.ronda.tipo === 'wb' ? 'WB' : 'LB'
      resultado.faseAlcanzada = `Eliminado en ${nombreLado} Ronda ${numeroRelativo}`
    }
  }

  return resultado
}
