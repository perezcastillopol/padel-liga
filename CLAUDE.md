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

### Tablas nuevas
- **torneo_participantes**: jugadores inscritos con victorias, derrotas y estado
- **torneo_rondas**: rondas del torneo (suiza, extra, wb, lb, final)
- **torneo_partidos**: partidos del torneo con mismo sistema de permisos que liga
- **torneo_bracket**: estado del bracket del playoff

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