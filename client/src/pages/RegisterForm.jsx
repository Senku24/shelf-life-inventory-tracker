import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert, Spinner } from '../components/ui'
import AuthAside from './AuthAside'

function validate({ name, email, password }) {
  const errs = {}
  if (name.trim().length < 2 || name.trim().length > 30) errs.name = 'Name must be 2-30 characters'
  if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address'
  if (password.length < 6) errs.password = 'Password must be at least 6 characters'
  return errs
}

export default function RegisterForm() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [touched, setTouched] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const errs = validate(form)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }))
  const showErr = (k) => (touched[k] ? errs[k] : '')

  async function onSubmit(e) {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true })
    if (Object.keys(errs).length) return

    setError('')
    setBusy(true)
    try {
      await register(form.name, form.email, form.password)
      // No household yet — send them straight to setting one up.
      navigate('/household', { replace: true })
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
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <h1>Create your account</h1>
          <p className="lede">Takes about twenty seconds.</p>

          <Alert>{error}</Alert>

          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={set('name')}
              onBlur={blur('name')}
              autoComplete="name"
            />
            {showErr('name') && <span className="err">{errs.name}</span>}
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              value={form.email}
              onChange={set('email')}
              onBlur={blur('email')}
              autoComplete="email"
            />
            {showErr('email') && <span className="err">{errs.email}</span>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              onBlur={blur('password')}
              autoComplete="new-password"
            />
            {showErr('password') ? (
              <span className="err">{errs.password}</span>
            ) : (
              <span className="hint">At least 6 characters</span>
            )}
          </div>

          <button className="btn block" type="submit" disabled={busy}>
            {busy ? <Spinner /> : 'Create account'}
          </button>

          <p className="swap">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
