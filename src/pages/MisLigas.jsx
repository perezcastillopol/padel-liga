import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLiga } from '../context/LigaContext'
import { getMisLigas, crearLiga, unirseConCodigo } from '../services/ligas.service'
import { signOut } from '../services/auth.service'

// ── Modal crear liga ──────────────────────────────────────────────────────────

function ModalCrearLiga({ onClose, onCreada }) {
  const { user } = useAuth()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [configAbierta, setConfigAbierta] = useState(false)
  const [ptsVictoria, setPtsVictoria] = useState(3)
  const [ptsDerrota, setPtsDerrota] = useState(1)
  const [ptsNoFinalizado, setPtsNoFinalizado] = useState(1.5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    try {
      setLoading(true)
      setError(null)
      const liga = await crearLiga(user.id, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        config: {
          pts_victoria: Number(ptsVictoria),
          pts_derrota: Number(ptsDerrota),
          pts_no_finalizado: Number(ptsNoFinalizado),
        },
      })
      onCreada(liga)
    } catch (err) {
      setError(err.message || 'Error al crear la liga')
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.modalTitle}>Crear liga</h2>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Nombre de la liga *</label>
          <input
            style={s.input}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Mi liga de pádel"
            autoFocus
            required
          />

          <label style={s.label}>Descripción</label>
          <textarea
            style={{ ...s.input, resize: 'vertical', minHeight: '72px' }}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional"
          />

          <button
            type="button"
            style={s.toggleConfig}
            onClick={() => setConfigAbierta((v) => !v)}
          >
            {configAbierta ? '▲' : '▼'} Configuración inicial
          </button>

          {configAbierta && (
            <div style={s.configSection}>
              <label style={s.label}>Puntos por victoria</label>
              <input style={s.inputSmall} type="number" min="0" step="0.5" value={ptsVictoria} onChange={(e) => setPtsVictoria(e.target.value)} />
              <label style={s.label}>Puntos por derrota</label>
              <input style={s.inputSmall} type="number" min="0" step="0.5" value={ptsDerrota} onChange={(e) => setPtsDerrota(e.target.value)} />
              <label style={s.label}>Puntos por no finalizado</label>
              <input style={s.inputSmall} type="number" min="0" step="0.5" value={ptsNoFinalizado} onChange={(e) => setPtsNoFinalizado(e.target.value)} />
            </div>
          )}

          {error && <p style={s.error}>{error}</p>}

          <div style={s.modalActions}>
            <button type="button" style={s.btnSecondary} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" style={s.btnPrimary} disabled={loading || !nombre.trim()}>
              {loading ? 'Creando...' : 'Crear liga'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal código de invitación ────────────────────────────────────────────────

function ModalCodigo({ liga, onClose }) {
  const [copiado, setCopiado] = useState(false)

  async function handleCopiar() {
    await navigator.clipboard.writeText(liga.codigo_invitacion)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.modalTitle}>¡Liga creada!</h2>
        <p style={{ color: '#555', marginBottom: '8px' }}>
          Comparte este código con los jugadores que quieras invitar a <strong>{liga.nombre}</strong>:
        </p>
        <div style={s.codigoBox}>{liga.codigo_invitacion}</div>
        <button style={s.btnCopiar} onClick={handleCopiar}>
          {copiado ? '¡Copiado!' : 'Copiar código'}
        </button>
        <button style={{ ...s.btnPrimary, width: '100%', marginTop: '12px' }} onClick={onClose}>
          Entendido
        </button>
      </div>
    </div>
  )
}

// ── Modal unirse con código ───────────────────────────────────────────────────

function ModalUnirse({ onClose, onUnido }) {
  const { user } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (codigo.length !== 6) return
    try {
      setLoading(true)
      setError(null)
      const liga = await unirseConCodigo(user.id, codigo)
      onUnido(liga)
    } catch (err) {
      setError(err.message || 'Error al unirse a la liga')
      setLoading(false)
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={s.modalTitle}>Unirme con código</h2>
        <form onSubmit={handleSubmit}>
          <label style={s.label}>Código de invitación</label>
          <input
            style={{ ...s.input, textTransform: 'uppercase', letterSpacing: '4px', fontSize: '20px', textAlign: 'center' }}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="XXXXXX"
            maxLength={6}
            autoFocus
          />
          {error && <p style={s.error}>{error}</p>}
          <div style={s.modalActions}>
            <button type="button" style={s.btnSecondary} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" style={s.btnPrimary} disabled={loading || codigo.length !== 6}>
              {loading ? 'Uniéndome...' : 'Unirme'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card de liga ──────────────────────────────────────────────────────────────

function LigaCard({ liga, onEntrar }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <h3 style={s.cardNombre}>{liga.nombre}</h3>
        <span style={{ ...s.badge, ...(liga.rol === 'admin' ? s.badgeAdmin : s.badgeJugador) }}>
          {liga.rol === 'admin' ? 'Admin' : 'Jugador'}
        </span>
      </div>
      {liga.descripcion && <p style={s.cardDescripcion}>{liga.descripcion}</p>}
      <div style={s.cardFooter}>
        <span style={s.miembros}>
          {liga.num_miembros ?? '—'} {liga.num_miembros === 1 ? 'miembro' : 'miembros'}
        </span>
        <button style={s.btnEntrar} onClick={() => onEntrar(liga)}>
          Entrar →
        </button>
      </div>
    </div>
  )
}

// ── FAB (botón flotante) ──────────────────────────────────────────────────────

function FAB({ onCrear, onUnirse }) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div style={s.fabContainer}>
      {abierto && (
        <>
          <button style={s.fabOption} onClick={() => { setAbierto(false); onCrear() }}>
            Crear liga
          </button>
          <button style={s.fabOption} onClick={() => { setAbierto(false); onUnirse() }}>
            Unirme con código
          </button>
        </>
      )}
      <button style={s.fab} onClick={() => setAbierto((v) => !v)}>
        {abierto ? '✕' : '+'}
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function MisLigas() {
  const { user } = useAuth()
  const { setLigaActiva } = useLiga()
  const navigate = useNavigate()

  const [ligas, setLigas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modal, setModal] = useState(null) // 'crear' | 'unirse' | 'codigo'
  const [ligaRecienCreada, setLigaRecienCreada] = useState(null)

  async function cargarLigas() {
    try {
      setError(null)
      const data = await getMisLigas(user.id)
      setLigas(data)
    } catch (err) {
      setError('No se pudieron cargar las ligas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarLigas()
  }, [user.id])

  function handleEntrar(liga) {
    setLigaActiva(liga)
    navigate(`/liga/${liga.id}`)
  }

  function handleLigaCreada(liga) {
    setLigaRecienCreada(liga)
    setModal('codigo')
    cargarLigas()
  }

  function handleLigaUnido() {
    setModal(null)
    cargarLigas()
  }

  function handleCerrarCodigo() {
    setModal(null)
    setLigaRecienCreada(null)
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return <div style={s.centered}><p>Cargando...</p></div>
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <h1 style={s.headerTitle}>Mis ligas</h1>
        <button style={s.btnSignOut} onClick={handleSignOut}>Cerrar sesión</button>
      </header>

      {/* Contenido */}
      <main style={s.main}>
        {error && <p style={s.error}>{error}</p>}

        {ligas.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyText}>Aún no formas parte de ninguna liga</p>
            <div style={s.emptyActions}>
              <button style={s.btnPrimary} onClick={() => setModal('crear')}>Crear liga</button>
              <button style={s.btnSecondary} onClick={() => setModal('unirse')}>Unirme con código</button>
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            {ligas.map((liga) => (
              <LigaCard key={liga.id} liga={liga} onEntrar={handleEntrar} />
            ))}
          </div>
        )}
      </main>

      {/* FAB solo cuando hay ligas */}
      {ligas.length > 0 && (
        <FAB onCrear={() => setModal('crear')} onUnirse={() => setModal('unirse')} />
      )}

      {/* Modales */}
      {modal === 'crear' && (
        <ModalCrearLiga onClose={() => setModal(null)} onCreada={handleLigaCreada} />
      )}
      {modal === 'codigo' && ligaRecienCreada && (
        <ModalCodigo liga={ligaRecienCreada} onClose={handleCerrarCodigo} />
      )}
      {modal === 'unirse' && (
        <ModalUnirse onClose={() => setModal(null)} onUnido={handleLigaUnido} />
      )}
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = {
  page: { minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: 'system-ui, sans-serif' },
  centered: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', backgroundColor: '#fff', borderBottom: '1px solid #eee',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerTitle: { margin: 0, fontSize: '20px', fontWeight: '700' },
  btnSignOut: {
    padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
    border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#fff', color: '#555',
  },

  main: { maxWidth: '800px', margin: '0 auto', padding: '24px 16px' },

  empty: { textAlign: 'center', marginTop: '80px' },
  emptyText: { fontSize: '16px', color: '#888', marginBottom: '24px' },
  emptyActions: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' },

  card: {
    backgroundColor: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
  cardNombre: { margin: 0, fontSize: '16px', fontWeight: '600', color: '#111' },
  cardDescripcion: { margin: 0, fontSize: '13px', color: '#777', flex: 1 },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' },
  miembros: { fontSize: '13px', color: '#999' },

  badge: { padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' },
  badgeAdmin: { backgroundColor: '#EEF2FF', color: '#4F46E5' },
  badgeJugador: { backgroundColor: '#F0FDF4', color: '#16A34A' },

  btnEntrar: {
    padding: '6px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    border: 'none', borderRadius: '6px', backgroundColor: '#111', color: '#fff',
  },
  btnPrimary: {
    padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    border: 'none', borderRadius: '8px', backgroundColor: '#111', color: '#fff',
  },
  btnSecondary: {
    padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', color: '#333',
  },

  // FAB
  fabContainer: { position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' },
  fab: {
    width: '52px', height: '52px', borderRadius: '50%', fontSize: '24px', fontWeight: '300',
    border: 'none', backgroundColor: '#111', color: '#fff', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fabOption: {
    padding: '10px 18px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    border: 'none', borderRadius: '8px', backgroundColor: '#fff', color: '#111',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)', whiteSpace: 'nowrap',
  },

  // Modales
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px',
  },
  modal: {
    backgroundColor: '#fff', borderRadius: '16px', padding: '28px 24px',
    width: '100%', maxWidth: '420px', boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
  },
  modalTitle: { margin: '0 0 20px', fontSize: '20px', fontWeight: '700' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' },

  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '6px', marginTop: '14px' },
  input: {
    width: '100%', padding: '10px 12px', fontSize: '15px', boxSizing: 'border-box',
    border: '1px solid #ddd', borderRadius: '8px', outline: 'none',
  },
  inputSmall: {
    width: '80px', padding: '8px 10px', fontSize: '15px',
    border: '1px solid #ddd', borderRadius: '8px', outline: 'none',
  },

  toggleConfig: {
    marginTop: '14px', background: 'none', border: 'none', cursor: 'pointer',
    color: '#555', fontSize: '13px', fontWeight: '600', padding: 0,
  },
  configSection: {
    backgroundColor: '#f8f8f8', borderRadius: '8px', padding: '12px 14px', marginTop: '10px',
  },

  codigoBox: {
    fontSize: '32px', fontWeight: '700', letterSpacing: '8px', color: '#111',
    backgroundColor: '#f5f5f5', borderRadius: '10px', padding: '16px 24px',
    margin: '16px auto', display: 'inline-block',
  },
  btnCopiar: {
    marginTop: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fff', color: '#333', width: '100%',
  },

  error: { color: '#d32f2f', fontSize: '13px', marginTop: '10px', marginBottom: 0 },
}
