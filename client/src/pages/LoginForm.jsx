import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert, Spinner } from '../components/ui'
import AuthAside from './AuthAside'

export default function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(form.email, form.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthAside />
      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={onSubmit}>
          <h1>Welcome back</h1>
          <p className="lede">Sign in to see what needs eating.</p>

          <Alert>{error}</Alert>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
              required
            />
          </div>

          <button className="btn block" type="submit" disabled={busy}>
            {busy ? <Spinner /> : 'Sign in'}
          </button>

          <p className="swap">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
