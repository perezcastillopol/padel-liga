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

**torneo_bracket**: estado del bracket del playoff (pendiente de diseño detallado)

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
- Al cerrarse una ronda de fase suiza (todos sus partidos con resultado; `torneo_rondas.estado` pasa a `finalizada`), se actualizan victorias/derrotas de los jugadores que jugaron y se recalcula su estado: `victorias >= torneo_max_derrotas` → `clasificado` (dejan de jugar la fase suiza); `derrotas >= torneo_max_derrotas` → `eliminado`; si no, `activo`. `generarParejasAleatorias()` solo recibe participantes con estado `activo`. **Ya no se decide automáticamente si la fase suiza continúa o termina** — eso lo decide el admin explícitamente (ver más abajo). Al cerrarse una ronda de tipo `'extra'` sí se sigue transicionando automáticamente a `torneo_estado = 'playoff'` (no requiere criterio del admin).
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
- **Edición manual del preview**: mientras una ronda está en preview, el admin puede tocar dos jugadores en `TorneoHome.jsx` para intercambiarlos: dos de partidos distintos, o uno de un partido con uno que descansa (no se permite intercambiar dentro del mismo partido, ni entre dos que descansan). El cambio se aplica primero de forma optimista en el estado local y luego se persiste con `intercambiarJugadores(rondaId, lado1, lado2)`, donde cada "lado" es `{ partidoId, pos, jugadorId }` (`pos` ∈ `'p1j1' | 'p1j2' | 'p2j1' | 'p2j2'`) y `partidoId` es `null` cuando ese jugador descansa (no tiene fila en `torneo_partidos`, así que ese lado no escribe nada); si falla la escritura se revierte el cambio local. Tras cada intercambio se recalcula con `verificarParejasRepetidas(partidos, parejasPrevias)` si alguna pareja quedaría repetida respecto a la fase correspondiente (`getParejasPrevias(ligaId, ronda.tipo)`); mientras haya repetidas, el botón "Confirmar ronda" queda deshabilitado.
- **Jugadores que descansan**: solo se calcula para rondas de fase suiza (`ronda.descansan`, devuelto por `getRondaActual()`/`getRondaConPartidos()` mientras `ronda.estado === 'pendiente'`) comparando los activos contra quién aparece en los partidos. Para rondas `'extra'` siempre es `[]`: como se crean con su pool completo resuelto por `finalizarFaseSuiza()`/`crearRondaFinal()` (normalmente múltiplo de 4, sin sobrante), no hay una regla recalculable para saber quién "debería" estar jugando — limitación conocida y aceptada. En `TorneoHome.jsx` los que descansan se muestran en una sección "Descansan esta ronda" con su record (V-D), también tappables para intercambiarlos con cualquier jugador de un partido.

### Fases del torneo
1. **Configuración**: admin configura parámetros e inscribe jugadores
2. **Fase suiza**: rondas hasta eliminar max_jugadores/2 jugadores
3. **Ronda extra**: desempate entre 2-2 y 2-3 para completar clasificados
4. **Playoff**: double elimination con WB y LB, parejas aleatorias
5. **Finalizado**: ganador determinado, torneo archivado

### Lo que se reutiliza de la liga estándar
- Código de invitación y sistema de unirse
- Gestión de jugadores (liga_jugadores)
- Sistema de autenticación y roles
- Componentes de UI
- Sistema de permisos de edición de partidos

### Navegación
- Al crear liga: elegir tipo (estándar o torneo)
- Dentro del torneo: tabs propios diferentes a la liga estándar