import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h2 style={styles.title}>🏙️ Kentsel Veri Analitiği</h2>
        <p style={styles.subtitle}>Devam etmek için giriş yapın</p>

        <label style={styles.label}>E-posta</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@kentsel.io"
          required
          autoFocus
        />

        <label style={styles.label}>Şifre</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  title: {
    color: '#f1f5f9',
    margin: 0,
    fontSize: '1.25rem',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    margin: '0 0 0.5rem',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  label: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    marginBottom: '-0.25rem',
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#f1f5f9',
    padding: '0.6rem 0.8rem',
    fontSize: '0.9rem',
    outline: 'none',
  },
  error: {
    color: '#f87171',
    fontSize: '0.8rem',
    margin: 0,
    textAlign: 'center',
  },
  button: {
    marginTop: '0.5rem',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '0.7rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontWeight: 600,
  },
}
