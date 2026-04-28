import { useState } from 'react'
import { signInWithGoogle } from '../services/auth.service'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGoogleLogin() {
    try {
      setLoading(true)
      setError(null)
      await signInWithGoogle()
    } catch (err) {
      setError('No se pudo iniciar sesión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Padel Liga</h1>
        <p style={styles.subtitle}>Gestiona tu liga de pádel</p>

        {error && <p style={styles.error}>{error}</p>}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={styles.button}
        >
          {loading ? 'Conectando...' : 'Entrar con Google'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '48px 40px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    textAlign: 'center',
    maxWidth: '360px',
    width: '100%',
  },
  title: {
    margin: '0 0 8px',
    fontSize: '28px',
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    margin: '0 0 32px',
    fontSize: '15px',
    color: '#666',
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    backgroundColor: '#4285F4',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  error: {
    marginBottom: '16px',
    fontSize: '14px',
    color: '#d32f2f',
  },
}
