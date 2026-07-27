# Padel Liga — Contexto del Proyecto

## Descripción
Plataforma web para gestionar ligas de pádel. Cualquier usuario puede crear su propia liga, invitar a jugadores con un código, configurar las reglas de puntuación y gestionar los partidos. Cada jugador tiene su perfil con estadísticas personales.

## Stack Tecnológico
- **Frontend:** React + Vite (JavaScript)
- **Backend:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth con Google
- **Routing:** React Router DOM
- **IDE:** WebStorm (JetBrains)
- **Control de versiones:** GitHub (repositorio privado)
- **Despliegue:** Vercel (gratuito)

## Arquitectura
Aplicación web tipo PWA. Sin framework de estado global por ahora — Context API de React para auth y liga activa. Separación clara entre lógica de negocio (services/) y UI (pages/ y components/).

```
src/
├── main.jsx
├── App.jsx                    # Router principal
├── lib/
│   └── supabase.js            # Cliente Supabase
├── services/
│   ├── auth.service.js        # Login, logout, sesión
│   ├── ligas.service.js       # CRUD ligas, unirse con código
│   ├── partidos.service.js    # CRUD partidos
│   ├── miembros.service.js    # Gestión de miembros por liga
│   └── clasificacion.service.js # Cálculo de ranking
├── context/
│   ├── AuthContext.jsx        # Usuario autenticado global
│   └── LigaContext.jsx        # Liga activa seleccionada
├── pages/
│   ├── Login.jsx
│   ├── MisLigas.jsx           # Listado de ligas del usuario
│   ├── liga/
│   │   ├── Clasificacion.jsx
│   │   ├── Partidos.jsx
│   │   ├── MiPerfil.jsx
│   │   └── Configuracion.jsx  # Solo admin
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx
│   │   └── ProtectedRoute.jsx
│   └── shared/               # Componentes reutilizables
└── hooks/
    ├── useAuth.js
    └── useLiga.js
```

### Responsabilidades de cada capa
- **pages/** → UI y lógica de presentación. Llama a services.
- **services/** → lógica de negocio y acceso a Supabase. Sin JSX.
- **context/** → estado global (auth y liga activa).
- **components/** → widgets reutilizables sin lógica de negocio.
- **hooks/** → lógica reutilizable entre componentes.

## Schema de Base de Datos (Supabase/PostgreSQL)

### Tabla: usuarios
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | = auth.users.id |
| email | TEXT | NOT NULL |
| nombre | TEXT | NOT NULL |
| avatar_url | TEXT | nullable |
| created_at | TIMESTAMPTZ | default now() |

### Tabla: ligas
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| nombre | TEXT | NOT NULL |
| descripcion | TEXT | nullable |
| codigo_invitacion | TEXT | UNIQUE |
| temporadas_activas | BOOLEAN | default false |
| pts_victoria | NUMERIC | default 3 |
| pts_derrota | NUMERIC | default 1 |
| pts_no_finalizado | NUMERIC | default 1.5 |
| ventana_dias | INT | nullable (sin límite si null) |
| max_partidos | INT | nullable (sin límite si null) |
| criterio_seleccion | ENUM | 'mas_recientes', 'mejores_resultados', 'recientes_sin_peores' |
| created_at | TIMESTAMPTZ | default now() |
| metodo_ranking | ENUM | 'puntos_totales', 'media_puntos', 'ratio_sets', 'media_puntos_minimo' |
| min_partidos_ranking | INT | default 3, solo aplica cuando metodo_ranking = 'media_puntos_minimo' |
| max_partidos_companero | INT | nullable, default null (sin límite) |

### Tabla: liga_miembros
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| usuario_id | UUID FK | → usuarios.id |
| rol | ENUM | 'admin', 'jugador' |
| activo | BOOLEAN | default true |
| fecha_union | TIMESTAMPTZ | default now() |

### Tabla: liga_jugadores
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| nombre | TEXT | NOT NULL |
| usuario_id | UUID FK | nullable → usuarios.id (null si no tiene cuenta) |
| activo | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | default now() |

### Concepto clave: Jugador vs Usuario
- **usuario** → persona con cuenta de Google (auth)
- **liga_jugador** → entidad del ranking de una liga
- Un jugador puede existir sin usuario (añadido por el admin manualmente)
- Un usuario se vincula a un jugador al entrar por primera vez a la liga
- Un usuario puede ser jugador en varias ligas simultáneamente

### Tabla: temporadas
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| nombre | TEXT | NOT NULL |
| fecha_inicio | DATE | NOT NULL |
| fecha_fin | DATE | nullable |
| activa | BOOLEAN | default true |

### Tabla: partidos
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| temporada_id | UUID FK | nullable → temporadas.id |
| fecha | DATE | NOT NULL |
| p1_jugador1_id | UUID FK | → liga_jugadores.id |
| p1_jugador2_id | UUID FK | → liga_jugadores.id |
| p2_jugador1_id | UUID FK | → liga_jugadores.id |
| p2_jugador2_id | UUID FK | → liga_jugadores.id |
| set1_p1 | INT | NOT NULL |
| set1_p2 | INT | NOT NULL |
| set2_p1 | INT | nullable |
| set2_p2 | INT | nullable |
| set3_p1 | INT | nullable |
| set3_p2 | INT | nullable |
| resultado | ENUM | 'pareja1', 'pareja2', 'no_finalizado' |
| creado_por | UUID FK | → usuarios.id |
| editado_por_p1 | BOOLEAN | default false — true cuando la pareja 1 confirma los sets |
| editado_por_p2 | BOOLEAN | default false — true cuando la pareja 2 confirma los sets |
| created_at | TIMESTAMPTZ | default now() |

### Credenciales Supabase
- URL: https://woquuneospuzwkqykkvt.supabase.co
- anonKey: almacenada en src/lib/supabase.js

## Sistema de Puntuación (configurable por liga)
- Victoria: pts_victoria (default 3)
- Derrota: pts_derrota (default 1)
- No finalizado: pts_no_finalizado (default 1.5)
- Ventana temporal: ventana_dias días (default sin límite)
- Máximo de partidos: max_partidos (default sin límite)
- Criterio cuando se supera el máximo:
    * mas_recientes: los últimos N partidos
    * mejores_resultados: los N partidos con más puntos
    * descartar_peores: de los últimos N+5, descartar los 5 peores
- Método de ranking: metodo_ranking (default puntos_totales)
- Mínimo de partidos para aparecer en ranking: min_partidos_ranking (default 3, solo para media_puntos_minimo)

## Roles y permisos
- **Admin de liga:** puede gestionar todos los partidos, miembros y configuración de su liga
- **Jugador:** puede añadir y editar solo sus propios partidos. Ve clasificación y estadísticas.
- Un usuario puede ser admin en una liga y jugador en otra simultáneamente.
- Un usuario puede pertenecer a varias ligas.

## Convenciones de Código
- **Idioma del código:** todo en inglés (variables, funciones, comentarios)
- **Texto de la UI:** en español
- **Nomenclatura:** camelCase para variables/funciones, PascalCase para componentes, kebab-case para archivos
- **Async:** siempre async/await, nunca .then()
- **Errores:** try/catch en todos los services, propagar errores a la UI
- **Componentes:** funcionales con hooks, nunca clases

## Comandos del Proyecto
- Desarrollo: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`

## Mejoras Futuras
- Notificaciones cuando alguien añade un partido
- Sistema de temporadas con historial
- Modo oscuro

## Módulo Torneo

### Descripción
Tipo de liga alternativo al estándar. Se selecciona al crear la liga.
Formato: fase suiza + ronda extra + playoff double elimination.

### Configuración del torneo (campos en tabla ligas)
| Campo | Tipo | Notas |
|-------|------|-------|
| tipo | TEXT | 'estandar' o 'torneo' |
| torneo_max_jugadores | INT | múltiplo de 4, configurable |
| torneo_max_derrotas | INT | número de derrotas para eliminar, configurable |
| torneo_admin_juega | BOOLEAN | si el admin participa como jugador |
| torneo_estado | TEXT | 'configuracion', 'suiza', 'ronda_extra', 'playoff', 'finalizado' |
| torneo_min_clasificados | INT | nullable, mínimo de clasificados para playoff |
| torneo_max_eliminados | INT | nullable, máximo de eliminados para cerrar fase suiza |
| torneo_ganador_id | UUID FK | nullable → liga_jugadores.id, un único jugador de referencia de la pareja campeona (ver nota en "Gran Final") |

### Tablas nuevas

**torneo_participantes**: jugadores inscritos con victorias, derrotas y estado
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| jugador_id | UUID FK | → liga_jugadores.id |
| victorias | INT | default 0 |
| derrotas | INT | default 0 |
| estado | TEXT | 'activo', 'eliminado', 'clasificado' — default 'activo' |
| campeon | BOOLEAN | default false — true para los 2 jugadores de la pareja que gana la Gran Final |
| seed | INT | nullable, orden/semilla para el playoff |

Nota: esta tabla no tiene `created_at`; no usar ese campo en queries.

**torneo_rondas**: rondas del torneo (suiza, extra, wb, lb, final)
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| tipo | TEXT | 'suiza', 'extra', 'wb', 'lb', 'final' |
| numero | INT | número de ronda dentro de ese tipo |
| estado | TEXT | 'pendiente' (en preview, sin confirmar), 'en_curso' (confirmada y jugable), 'finalizada' |
| jugador_descanso | UUID FK | nullable → liga_jugadores.id, quién descansó en esta ronda (si alguien lo hizo) |
| created_at | TIMESTAMPTZ | default now() |

**torneo_partidos**: partidos del torneo con mismo sistema de permisos que liga
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| ronda_id | UUID FK | → torneo_rondas.id |
| p1_jugador1_id / p1_jugador2_id | UUID FK | → liga_jugadores.id |
| p2_jugador1_id / p2_jugador2_id | UUID FK | → liga_jugadores.id |
| set1_p1 / set1_p2 / set2_p1 / set2_p2 / set3_p1 / set3_p2 | INT | nullable, igual que partidos |
| resultado | ENUM | 'pareja1', 'pareja2', 'no_finalizado' |
| creado_por | UUID FK | → usuarios.id, nullable cuando generado_auto = true |
| generado_auto | BOOLEAN | default false — true cuando lo crea el algoritmo de emparejamiento |
| preview | BOOLEAN | default false — true mientras la ronda no ha sido confirmada por el admin |
| editado_por_p1 / editado_por_p2 | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | default now() |

**torneo_bracket**: estado del bracket del playoff — una fila por jugador clasificado, creada una única vez en `iniciarPlayoff()` y actualizada in place a medida que avanza el bracket (no se insertan filas nuevas cada ronda)
| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | gen_random_uuid() |
| liga_id | UUID FK | → ligas.id |
| ronda_id | UUID FK | → torneo_rondas.id — ronda a la que está asociado actualmente (la de su próximo partido, o la última si ya quedó eliminado) |
| jugador_id | UUID FK | → liga_jugadores.id |
| posicion | INT | orden de clasificación al iniciar el playoff (1 = mejor record de fase suiza); fijo, no cambia aunque el jugador se mueva de lado |
| lado | TEXT | 'wb' o 'lb' |
| estado | TEXT | 'activo' o 'eliminado' — 'eliminado' solo ocurre al perder estando ya en LB |
| bye | BOOLEAN | default false — true si en la ronda actual (`ronda_id`) no tiene partido; se recalcula en cada ronda nueva de ese lado |

### Lógica de la fase suiza
- Cada ronda agrupa a los participantes activos por record exacto (victorias-derrotas), ordenados de mejor a peor, en dos fases (`generarParejasAleatorias()`):
  1. Dentro de cada grupo de record se forman primero todos los partidos "puros" que quepan (barajando el grupo antes de repartir, así quién queda de sobrante varía entre rondas); el sobrante de cada grupo (0-3 jugadores) se guarda aparte, sin mezclarlo todavía.
  2. Solo cuando ya se han extraído los puros de **todos** los records, se juntan esos sobrantes en una única lista (manteniendo el orden de mejor a peor) y se agrupan de 4 en 4 consecutivos — así cada partido mixto junta siempre a los sobrantes de record más cercano entre sí posible, nunca a alguien de un extremo con alguien del otro salvo que no quede nadie de record intermedio disponible (p. ej. si un record intermedio formó grupos puros exactos y no dejó sobrante, no hay "puente" posible; es una consecuencia inherente de priorizar los partidos puros, no un bug).
  Si el total de activos no es múltiplo de 4, el sobrante final (los peor clasificados sin hueco) descansa esa ronda.
- Restricción de "no repetir compañero de pareja" **por fase independiente** (`getParejasPrevias(ligaId, tipoFase)`):
  * `'suiza'` → solo cuenta parejas de rondas tipo suiza
  * `'wb'` / `'lb'` → cuenta parejas de todo el playoff (wb + lb); sí pueden repetirse parejas ya jugadas en la fase suiza
  * `'extra'` → sin restricción (Set vacío)
  * Siempre excluye partidos con `preview = true` (`.eq('preview', false)`) — si no, el propio preview que se está editando se compararía contra sí mismo y todas sus parejas saldrían como "repetidas".
- Dentro de cada grupo de 4 ya formado se elige la combinación 2 vs 2 que evite repetir compañero; si las tres combinaciones posibles repiten, se acepta la repetición (es la única situación en la que se permite).
- Si el número total de activos no es múltiplo de 4, el sobrante final descansa esa ronda (no se le genera partido).
- **Prioridad de descanso**: `generarParejasAleatorias(participantes, parejasPrevias, jugadorQueDescanso)` acepta un tercer parámetro opcional: si se indica y ese jugador pertenece a un grupo de record, se coloca primero en la lista de ese grupo (antes de barajar el resto), de forma que sea el último en quedar fuera si el grupo tiene sobrantes. Esto es una fuerte prioridad, no una garantía absoluta: si hay un conflicto real de parejas repetidas que fuerza a excluirlo, puede seguir sin jugar. Cada ronda de fase suiza se crea con `jugador_descanso` = quién quedó sin partido en ELLA (calculado comparando el pool de entrada contra los partidos generados), para que la siguiente ronda pueda dar prioridad a esa persona (`obtenerJugadorDescansoAnterior()` busca la ronda inmediatamente anterior del mismo tipo). `getRondaActual()`/`getRondaConPartidos()` devuelven `ronda.jugadorDescansoAnterior` ({id, nombre}) para mostrarlo en la UI.
- Al cerrarse **cualquier ronda** (fase suiza o extra; todos sus partidos con resultado; `torneo_rondas.estado` pasa a `finalizada`), se aplica exactamente la misma lógica en `cerrarRonda()`: se actualizan victorias/derrotas de los jugadores que jugaron y se recalcula su estado: `victorias >= torneo_max_derrotas` → `clasificado`; `derrotas >= torneo_max_derrotas` → `eliminado`; si no, `activo`. `generarParejasAleatorias()` solo recibe participantes con estado `activo`. **Ninguna ronda decide automáticamente el siguiente paso** (ni continuar la fase suiza, ni pasar a playoff tras una ronda extra) — eso lo decide el admin explícitamente pulsando "Finalizar fase suiza" (ver más abajo), botón que se muestra tanto en la vista de fase suiza como en la de ronda extra.
- El número (`numero`) de una ronda extra nueva (creada por `finalizarFaseSuiza()` o `crearRondaFinal()`) continúa la numeración global de la liga: es el siguiente al `MAX(numero)` de **todas** las rondas de esa liga (`obtenerSiguienteNumeroRonda()`, sin filtrar por `tipo`) — no reinicia en 1.
- **Gestión de fin de fase suiza (botones solo admin)**: la sección "Gestión de fase" en `TorneoHome.jsx` se muestra cuando `eliminados >= torneo_max_eliminados` Y no hay ninguna ronda activa/pendiente (`ronda == null`, es decir, todos los partidos de la última ronda ya tienen resultado). Los dos botones no son excluyentes, pueden mostrarse ambos a la vez.
  * **"Finalizar fase suiza"** → abre un modal donde el admin escribe cuántos jugadores clasifican al playoff (par, >= `torneo_min_clasificados`; por defecto clasificados + activos actuales). `calcularCorteFinalSuiza(participantes, numClasifican, repescadosIds)` (función pura, exportada) calcula:
    - `clasificados` = clasificados existentes + los mejores activos por record hasta completar el número (+ repescados si hacen falta)
    - `eliminados` = el resto de eliminados (no repescados) + los peores activos que no entran
    - `zonaGris` = si el corte cae justo en un empate de record entre activos, TODO ese grupo empatado (a ambos lados del corte) se deja fuera de ambas listas — ni clasifica ni se elimina, para desempatar en una ronda extra
    - `necesitanRepescar` = cuántos eliminados hacen falta si `numClasifican` supera clasificados+activos existentes; si es > 0 se muestra la sección "Seleccionar eliminados que repescan" (ordenados por menos derrotas primero) y hay que marcar exactamente esa cantidad
    - El modal muestra un resumen (clasificados con nombre+record, nº de eliminados, nº en zona gris si aplica) antes de confirmar.
    - Al confirmar llama a `finalizarFaseSuiza(ligaId, clasificadosIds, eliminadosIds)` (recibe jugador_id, no participante.id): marca esos estados y decide `torneo_estado` — si tras aplicar los cambios quedan >= 2 participantes que siguen `'activo'` (la zona gris que se dejó fuera) → crea directamente una ronda `tipo='extra'` en preview con todos ellos (sin restricción de repetición) y pone `torneo_estado = 'ronda_extra'`; si no → `torneo_estado = 'playoff'`.
  * **"Ronda final"** (solo visible si hay algún activo con `derrotas === torneo_max_derrotas - 1`) → abre un modal con **todos** los participantes del torneo (clasificados por victorias desc, luego activos por victorias desc/derrotas asc, luego eliminados por derrotas asc), cada uno con nombre, record y badge de estado; el admin marca con checkbox cualquier combinación múltiplo de 4, sin restricción de estado. Al confirmar, `crearRondaFinal(ligaId, jugadorIds)` crea la ronda `tipo='extra'` en preview con esos jugadores (usando `generarParejasAleatorias()` para el sorteo inicial, igual que el resto de rondas extra) y pone `torneo_estado = 'ronda_extra'`; a los `'activo'` que no participen en esta ronda final se les marca `'clasificado'` (no queda otra pantalla de fase suiza donde resolver su estado una vez se transiciona).
- **Importante**: dado que ambas funciones ya crean la ronda extra con su pool completo, `generarPreviewRonda()` ya NO tiene una rama para `'ronda_extra'` — solo genera rondas de fase suiza (lanza error si `torneo_estado` no es `'suiza'`). Si el admin necesita repetir el sorteo de una ronda `'extra'`, usa `repetirSorteo()`, que para ese tipo reconstruye el pool a partir de quién está actualmente en los partidos de esa ronda (no recalcula ninguna regla de negocio, porque ya no hay una regla automática recalculable una vez los participantes pasan a `'clasificado'`).
- **Generación manual de rondas de fase suiza (preview/confirmar)**: cuando la ronda en curso se cierra y no hay ninguna otra en estado `pendiente`/`en_curso`, el admin debe generar la siguiente explícitamente:
  * `generarPreviewRonda(ligaId)` → calcula los activos, les da prioridad de descanso, y crea la ronda con `estado='pendiente'` y sus partidos con `preview=true`. Solo visible para el admin en la UI.
  * `repetirSorteo(ligaId, rondaId)` → borra los partidos de esa ronda en preview y genera otros nuevos con `generarParejasAleatorias()` (misma prioridad de descanso para fase suiza), sin tocar el estado de la ronda.
  * `confirmarRonda(ligaId, rondaId)` → pone `torneo_partidos.preview=false` y `torneo_rondas.estado='en_curso'`; a partir de ahí es visible y jugable para todos.
  * La ronda 1 (creada por `iniciarTorneo`) no pasa por preview: se crea directamente confirmada, ya que iniciar el torneo es en sí mismo la confirmación del admin.
- **Edición manual del preview**: mientras una ronda está en preview, el admin puede tocar dos jugadores en `TorneoHome.jsx` para intercambiarlos — de partidos distintos, de un partido con uno que descansa, entre dos que descansan, o **dos del mismo partido** (recompone las parejas de ese enfrentamiento: p. ej. con pareja1 = A+B vs pareja2 = C+D, intercambiar A↔C deja pareja1 = C+B vs pareja2 = A+D). La única combinación que no se permite es intercambiar un jugador consigo mismo. El cambio se aplica primero de forma optimista en el estado local y luego se persiste con `intercambiarJugadores(rondaId, lado1, lado2)`, donde cada "lado" es `{ partidoId, pos, jugadorId }` (`pos` ∈ `'p1j1' | 'p1j2' | 'p2j1' | 'p2j2'`) y `partidoId` es `null` cuando ese jugador descansa (no tiene fila en `torneo_partidos`, así que ese lado no escribe nada); cuando ambos lados son del mismo partido, cada uno escribe una columna distinta de la misma fila, así que las dos actualizaciones no chocan entre sí. Si falla la escritura se revierte el cambio local. Tras cada intercambio (también los de dentro del mismo partido) se recalcula con `verificarParejasRepetidas(partidos, parejasPrevias)` si alguna pareja quedaría repetida respecto a la fase correspondiente (`getParejasPrevias(ligaId, ronda.tipo)`); mientras haya repetidas, el botón "Confirmar ronda" queda deshabilitado.
- **Jugadores que descansan**: solo se calcula para rondas de fase suiza (`ronda.descansan`, devuelto por `getRondaActual()`/`getRondaConPartidos()` mientras `ronda.estado === 'pendiente'`) comparando los activos contra quién aparece en los partidos. Para rondas `'extra'` siempre es `[]`: como se crean con su pool completo resuelto por `finalizarFaseSuiza()`/`crearRondaFinal()` (normalmente múltiplo de 4, sin sobrante), no hay una regla recalculable para saber quién "debería" estar jugando — limitación conocida y aceptada. En `TorneoHome.jsx` los que descansan se muestran en una sección "Descansan esta ronda" con su record (V-D), también tappables para intercambiarlos con cualquier jugador de un partido.

### Lógica del playoff (double elimination)
- **Arranque** (`iniciarPlayoff(ligaId)`, llamado automáticamente por `finalizarFaseSuiza()` en cuanto ya no queda ninguna ronda extra pendiente — nunca se llama desde `crearRondaFinal()`): toma los participantes `'clasificado'` ordenados por victorias desc / derrotas asc. El número de clasificados debe ser múltiplo de 4, o múltiplo de 4 + 2 (si no, lanza error).
  * Múltiplo de 4: todos entran en una única ronda `tipo='wb'` en preview (`bye=false` para todos).
  * Múltiplo de 4 + 2 (sorteo aleatorio si empatan exactamente en record en el puesto 1-2): los 2 primeros quedan con `bye=true` asociados a esa misma ronda `tipo='wb'` pero sin partido (esperan a WB Ronda 2); los demás (múltiplo de 4) juegan la ronda `tipo='wb'` en preview con normalidad.
  **TODOS los clasificados entran en `torneo_bracket` con `lado='wb'`** (`posicion`=orden de clasificación global, fijo) — no se crea ninguna ronda LB en este momento. El LB arranca completamente vacío y solo se puebla más adelante con los perdedores de la propia WB Ronda 1 (vía `avanzarBracket()`, ver más abajo). Dejar `torneo_estado='playoff'` es el último paso, para que la creación del bracket y la transición de fase queden atómicas.
- **Emparejamiento** (`generarParejasPlayoff(clasificados, parejasPreviasPlayoff)`, función pura): a diferencia de la fase suiza, el pool ya pertenece a un solo lado del bracket (WB o LB) y no hace falta agrupar por record — simplemente se baraja y se agrupa de 4 en 4 (`formarPartidos()`, reutilizada de la fase suiza) evitando repetir pareja **dentro del playoff**; las parejas de la fase suiza sí pueden repetirse (`getParejasPrevias(ligaId, 'wb'|'lb')` ya cuenta conjuntamente wb+lb, ver sección anterior). El sobrante (pool no múltiplo de 4) queda con bye esa ronda.
- **Bye generalizado**: no es solo un concepto de la primera ronda — cualquier ronda de WB o LB cuyo pool no sea múltiplo de 4 genera un bye (mecánica de "sobrante" reutilizada de la fase suiza), determinado por `generarParejasPlayoff()` y no por seed (el seed solo decide el bye de la ronda 1 de WB). Cada vez que se crea una ronda de WB/LB (`crearRondaBracket()`), se recalculan y sobrescriben los `bye` de **todas** las filas activas de ese lado — no se acumulan de rondas anteriores.
- **WB y LB pueden tener cada uno una ronda activa en paralelo** (nunca al arrancar el playoff, ya que el LB empieza vacío — pero sí en cuanto se cierra la WB Ronda 1: sus perdedores pueblan el LB por primera vez y, si los ganadores de WB siguen siendo >2, se crea WB Ronda 2 al mismo tiempo que se crea LB Ronda 1; lo mismo puede repetirse en rondas posteriores). Por eso `avanzarBracket()` comprueba cada lado de forma independiente y nunca crea una ronda nueva para un lado que ya tenga una `pendiente`/`en_curso` (`hayRondaActivaDeTipo()`), aunque el otro lado sí la necesite. En la UI, `getEstadoPlayoff()` devuelve `rondaWb` y `rondaLb` por separado (en vez de una única `ronda`) y `TorneoHome.jsx` las muestra como dos secciones independientes ("Winner Bracket - Ronda X" / "Loser Bracket - Ronda Y"); la sección de un lado no se muestra en absoluto hasta que ese lado tenga al menos un jugador (así el LB no aparece vacío mientras solo existe la WB Ronda 1), y si ya tiene jugadores pero no ronda activa en ese momento, se muestra igualmente con un "Sin ronda activa".
- **Avance automático del bracket** (`avanzarBracket(ligaId, rondaId)`, disparado automáticamente al cerrarse una ronda de WB/LB/Gran Final — a diferencia de fase suiza/extra, donde el avance es siempre una acción manual del admin):
  1. Procesa los resultados de la ronda que se acaba de cerrar: ganadores de WB → siguen en WB; perdedores de WB → caen a LB (siguen `'activo'`); ganadores de LB → siguen en LB; perdedores de LB → `'eliminado'`.
  2. Con el estado **global** ya actualizado (no solo el de la ronda que se cerró, para tener en cuenta también a quien viniera esperando de una ronda anterior) cuenta cuántos siguen `'activo'` en cada lado: si WB > 2 y no hay ya una ronda WB activa → nueva ronda de WB; si LB > 2 y no hay ya una ronda LB activa → nueva ronda de LB (ambas comprobaciones son independientes, no "else if"); si ambos quedan en exactamente 2 (y no hay ya Gran Final activa) → se crea la Gran Final.
- **Gran Final** (`crearGranFinal()`): partido único, sin pareja fija ni ventaja para nadie — los 4 finalistas (2 que llegan del WB, 2 del LB) se barajan y se reparten al azar en 2 parejas nuevas con `barajar()` (no hay restricción de "no repetir pareja" especial para esta ronda; se comprueba igual que cualquier otra vía `getParejasPrevias`/`verificarParejasRepetidas`). Gana quien gane este partido, directamente campeón — `avanzarBracket()` no hace nada cuando cierra una ronda `tipo='final'` (no existe ronda de desempate ni bracket reset). Como el sorteo es aleatorio (no fijo), `repetirSorteo()` funciona igual para la Gran Final que para cualquier otra ronda (releyendo el pool de `torneo_bracket` por `ronda_id`, sin filtrar por `lado`) y el botón "Repetir sorteo" ya no se oculta para ella en la UI.
- **Campeón y pantalla final**: en cuanto la Gran Final queda `'finalizada'`, `getEstadoPlayoff(ligaId)` lo detecta porque ni `rondaWb` ni `rondaLb` ni `rondaFinal` quedan activas (las tres, vía `getRondaActivaDeTipo()`, devuelven `null`) y entonces busca la última ronda `tipo='final'` con `estado='finalizada'`, derivando el campeón (pareja de 2 jugadores) de su `resultado`. La UI (`GranFinalCard`) muestra a los 4 finalistas con su procedencia ("Viene del Winner Bracket" / "Viene del Loser Bracket") y deja claro que es un partido único sin ventaja. La pantalla de celebración (`VistaCampeon`) tiene el botón "Finalizar torneo" (solo admin) → `finalizarTorneo(ligaId, campeonId)`:
  * Releé el resultado de la última ronda `'final'` finalizada (no confía en que el llamador le pase los 2 ganadores correctos) y marca `campeon=true` en `torneo_participantes` para los 2 jugadores de la pareja ganadora.
  * Guarda `campeonId` en `ligas.torneo_ganador_id` — como esta columna solo admite **un** jugador de referencia (no una pareja), la UI le pasa `campeon.j1.id` (el primero de los dos ganadores); el otro (`j2`) queda igualmente marcado como campeón vía el badge de `torneo_participantes`, así que ningún dato se pierde, solo `torneo_ganador_id` no puede representar a ambos.
  * Pone `torneo_estado='finalizado'`. `VistaFinalizado` sigue funcionando después de esto porque `getEstadoPlayoff()` no depende de `torneo_estado` para encontrar al campeón.
- **Récord de playoff**: las victorias/derrotas mostradas en el bracket (V-D) son solo del playoff (wb+lb+final), calculadas al vuelo por `calcularRecordPlayoff()` a partir de `torneo_partidos` — no se guardan en `torneo_bracket` para no duplicar estado.
- **Clasificación final del playoff** (`getClasificacionPlayoff(ligaId)`, usada en la pantalla de `torneo_estado='finalizado'`): calcula la posición de cada jugador que llegó al playoff a partir del historial real de `torneo_rondas`/`torneo_partidos` — no de `estado`/`ronda_id` de `torneo_bracket`, que para los 4 finalistas de la Gran Final quedan "congelados" tal cual entraron a esa ronda (`avanzarBracket()` no los toca cuando el tipo es `'final'`). Reglas:
  * 1º y 2º → ganadores y perdedores de la ronda `'final'` (2 personas cada uno, empatadas, porque la Gran Final es 2 vs 2 y no hay desempate de posición individual dentro de la pareja).
  * 3º-4º → perdedores de la última ronda `tipo='lb'` (por `numero`) antes de la final — siempre exactamente un partido de 4 jugadores, porque el LB solo llega a reducirse a 2 jugando una ronda cuyo pool ya era 4.
  * El resto se agrupa por la ronda LB en la que perdió cada uno (rondas más recientes primero), continuando la numeración de posiciones después del hueco que deja el grupo anterior.
  Devuelve `[{jugadorId, nombre, posicion, victoriasPlayoff, derrotasPlayoff}]`, ordenado por posición.
- **Estadísticas del torneo** (`getTorneoStats(ligaId)`): total de partidos confirmados (`preview=false`, con `resultado`) en toda la liga, y número de rondas contando `'suiza'`+`'extra'` como "rondas de fase suiza" y `'wb'`+`'lb'`+`'final'` como "rondas de playoff".
- **Pantalla de torneo finalizado** (`VistaFinalizado` en `TorneoHome.jsx`): 4 secciones — campeón (🏆 grande), clasificación del playoff (con medalla 🥇🥈🥉 para las posiciones 1-3 y "Xº" para el resto), estadísticas del torneo, y la tabla de clasificación de fase suiza reutilizada (`TablaClasificacionSuiza`, con su nuevo prop `titulo` para retitularla "Clasificación fase suiza" en vez de "Clasificación").
- **Título de la ronda en la UI**: en vez del `numero` absoluto (que continúa la numeración global de toda la liga, incluyendo suiza/extra), `TorneoHome.jsx` muestra "Winner Bracket - Ronda X" / "Loser Bracket - Ronda X" con un contador relativo e independiente por lado (`ronda.numeroRelativo`, calculado por `contarRondaRelativa()`: cuenta solo rondas anteriores del mismo tipo — wb o lb — y sí reinicia en 1 al empezar LB, aunque WB ya lleve varias rondas). La Gran Final no lleva número, se muestra simplemente como "Gran Final".
- **Reutilización de la fase suiza**: preview/confirmar (`confirmarRonda`), intercambio de jugadores en preview (`intercambiarJugadores`) y `RegistrarResultadoModal` se reutilizan tal cual para rondas de WB/LB/Gran Final. `repetirSorteo()` tiene una rama para WB/LB (recalcula bye igual que `crearRondaBracket()`) y otra para la Gran Final (baraja de nuevo a los 4 finalistas, sin bye posible); el aviso de "pareja repetida" (`verificarParejasRepetidas`) se calcula igual para las tres, ya que ninguna tiene pareja fija.
- **Limitaciones conocidas** (aceptadas explícitamente por complejidad/alcance, no resueltas):
  - Si el pool de un lado del bracket se reduce a un tamaño para el que `generarParejasPlayoff()` no puede formar ningún partido (p. ej. exactamente 3 jugadores activos y ninguno con bye pendiente), `crearRondaBracket()`/`repetirSorteo()` lanzan un error explícito en vez de crear una ronda vacía — pero no hay un algoritmo de bye-planning que evite llegar a ese tamaño, así que en teoría el torneo podría quedarse bloqueado sin ninguna ronda nueva. La UI lo muestra como "no hay ninguna ronda en curso, contacta con el admin" en vez de romperse.
  - Un partido marcado `'no_finalizado'` en WB/LB/Gran Final no produce ganador/perdedor: en WB/LB esos 4 jugadores simplemente se quedan `'activo'` en su lado actual y entran en la siguiente ronda de ese lado con normalidad; en la Gran Final, `avanzarBracket()` no hace nada y el torneo queda a la espera de que se corrija el resultado (el admin puede usar "Repetir sorteo" o corregir el resultado del partido).

### Refresco de la vista tras cambiar torneo_estado
`TorneoHome.jsx` decide qué vista renderizar (`VistaSuiza`/`VistaRondaExtra`/`VistaPlayoff`/`VistaFinalizado`) directamente a partir de `ligaActiva.torneo_estado`, que viene de `LigaContext` — **no** de un estado local recalculado en cada carga. Como `ligaActiva` solo se fetchea una vez al entrar a la liga (`LigaLayout.jsx`), cualquier acción que cambie `torneo_estado` en Supabase (`finalizarFaseSuiza`, `crearRondaFinal`, `iniciarPlayoff`, `finalizarTorneo`, `iniciarTorneo`) debe refrescar también la copia local de `ligaActiva`, o la UI se queda mostrando la vista anterior aunque los datos ya hayan cambiado en la base de datos (bug real: tras "Finalizar fase suiza" con éxito, el admin seguía viendo la fase suiza en vez del playoff).
- En `TorneoHome.jsx`, la función `recargarTodo()` del componente principal hace `getLigaById(ligaActiva.id)` + `setLigaActiva(...)` (actualiza el contexto) y además incrementa `refreshKey` (para forzar el re-fetch de participantes/ronda/estadoPlayoff aunque `torneo_estado` no haya cambiado, p. ej. al registrar un resultado normal). Es la única función que se pasa como `onCambio` a `VistaSuiza`/`VistaRondaExtra`/`VistaPlayoff` y como `onGuardado` a `RegistrarResultadoModal` — todas las acciones anidadas (botones de `SeccionGestionFase`, `SeccionRondaActual`, `VistaCampeon`) llegan a ella subiendo la misma prop, así que basta con mantener esa única función actualizada en vez de repetir la lógica en cada acción.
- En `TorneoConfig.jsx`, `handleIniciar()` (que llama a `iniciarTorneo`) sigue el mismo patrón: `setLigaActiva(await getLigaById(ligaActiva.id))` en vez de parchear el objeto a mano, aunque aquí navega inmediatamente después a `/liga/:id/torneo` (un montaje nuevo de `TorneoHome`, no depende de `refreshKey`).

### Fases del torneo
1. **Configuración**: admin configura parámetros e inscribe jugadores
2. **Fase suiza**: rondas hasta eliminar max_jugadores/2 jugadores
3. **Ronda extra**: desempate entre 2-2 y 2-3 para completar clasificados
4. **Playoff**: double elimination con WB y LB; parejas re-sorteadas al azar cada ronda, incluida la Gran Final (partido único, sin ventaja para nadie)
5. **Finalizado**: ganador determinado, torneo archivado

### Pestañas Partidos y Mi Perfil (torneo)
Ambas páginas (`src/pages/liga/Partidos.jsx` y `src/pages/liga/MiPerfil.jsx`) hacen de wrapper: el `export default` comprueba `ligaActiva.tipo === 'torneo'` y renderiza un componente interno separado (`PartidosTorneo`/`MiPerfilTorneo`) en vez del ya existente (`PartidosEstandar`/`MiPerfilEstandar`, renombrados pero sin ningún cambio de comportamiento) — así la liga estándar sigue funcionando exactamente igual.
- **`getTodosPartidosTorneo(ligaId)`** (torneo.service.js): todos los partidos de **cualquier fase** del torneo (`preview=false` únicamente), con `ronda_tipo`/`ronda_numero` resueltos vía join a `torneo_rondas` y los 4 nombres de jugador vía `liga_jugadores`, ordenados por número de ronda y luego por `created_at` (torneo_partidos no tiene columna `fecha` propia, a diferencia de `partidos`, porque se generan solos en vez de registrarse a mano).
- **`puedeEditarTorneo(partido, rondaActualId, jugadorActualId, esAdmin)`**: a diferencia de la liga estándar, en el torneo un partido solo se puede editar mientras su ronda sigue `'en_curso'` — en cuanto la ronda cierra (`'finalizada'`), queda de solo lectura para siempre (aunque `puedeEditar()` en sí seguiría permitiéndolo a la pareja que no usó su edición). Primero comprueba `partido.ronda_id !== rondaActualId` (si no coincide, "ronda cerrada", `puede=false`) y solo entonces delega en `puedeEditar()` de `partidos.service.js` (mismas columnas `editado_por_p1`/`editado_por_p2`, misma regla). No existe "la" ronda actual única — WB y LB pueden tener cada uno una ronda `'en_curso'` a la vez — así que `rondaActualId` lo decide el llamador **por cada partido**: `getTodosPartidosTorneo()` añade `ronda_estado` a cada fila, y `PartidosTorneo` le pasa `partido.ronda_id` cuando `partido.ronda_estado === 'en_curso'` (coincide trivialmente) o `null` en caso contrario.
- **`PartidosTorneo`**: agrupa `getTodosPartidosTorneo()` en 3 secciones — "Fase suiza" (`ronda_tipo='suiza'`), "Ronda extra" (`ronda_tipo='extra'`, solo si hay) y "Playoff" (`wb`/`lb`/`final`), esta última con una subsección por ronda ("WB Ronda X" / "LB Ronda X" / "Gran Final") calculando el número relativo por lado en cliente (`agruparPlayoffPorRonda()`, mismo criterio que `contarRondaRelativa()` mostrado en `TorneoHome.jsx`). Reutiliza los helpers de color/resultado ya definidos en el archivo (`resultadoParaJugador`, `COLOR_FONDO`, `resultadoBadge`, `setsDisplay`). No hay botón "+" para crear partidos a mano — el lápiz de editar (visible solo si `puedeEditarTorneo` lo permite) abre el mismo `RegistrarResultadoModal` que ya usa `TorneoHome.jsx`, reutilizado tal cual.
- **`getParticipacionTorneoJugador(ligaId, jugadorId)`** (torneo.service.js): para "Mi Perfil". Devuelve `{ estado, victoriasSuiza, derrotasSuiza, esCampeon, enPlayoff, victoriasPlayoff, derrotasPlayoff, faseAlcanzada }`. Como `avanzarBracket()` no actualiza `torneo_bracket.estado` ni `torneo_participantes.estado` para los 4 jugadores de la Gran Final (ver limitaciones del playoff), esta función NO se fía de esos campos para detectar campeón/finalista: busca directamente si el jugador jugó una ronda `tipo='final'` y quién la ganó. Si no jugó la final, y su fila de `torneo_bracket` está `'eliminado'`, busca su derrota más reciente (por `numero` de ronda) para construir `"Eliminado en WB/LB Ronda X"`.
- **`MiPerfilTorneo`**: sección 1 con avatar, nombre, badge de estado (🏆 Campeón > ❌ Eliminado > ✅ Clasificado > 🎾 Activo, en ese orden de prioridad) y récord de fase suiza (+ récord de playoff si `enPlayoff`); un texto secundario opcional (`faseAlcanzadaTexto()`) cubre los casos que el badge no distingue (p. ej. "Finalista" para quien perdió la Gran Final pero sigue con `estado='clasificado'` en la base de datos, o "Eliminado en fase suiza" para quien nunca llegó al bracket). Sección 2 reutiliza `MiniPartidoCard` (ya definido en el archivo) con todos los partidos del jugador de `getTodosPartidosTorneo()`, agrupados en "Fase suiza" (incluye `'extra'`) y "Playoff", sin límite de partidos mostrados.

### Lo que se reutiliza de la liga estándar
- Código de invitación y sistema de unirse
- Gestión de jugadores (liga_jugadores)
- Sistema de autenticación y roles
- Componentes de UI
- Sistema de permisos de edición de partidos

### Navegación
- Al crear liga: elegir tipo (estándar o torneo)
- Dentro del torneo: tabs propios diferentes a la liga estándar