import { useAuth } from '../../context/AuthContext'
import { signOut } from '../../services/auth.service'

export default function Navbar() {
  const { user } = useAuth()

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>Padel Liga</span>
      {user && (
        <button onClick={handleSignOut} style={styles.button}>
          Cerrar sesión
        </button>
      )}
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #eee',
  },
  brand: {
    fontWeight: '700',
    fontSize: '18px',
  },
  button: {
    padding: '6px 14px',
    fontSize: '14px',
    cursor: 'pointer',
    border: '1px solid #ddd',
    borderRadius: '6px',
    backgroundColor: '#fff',
  },
}
