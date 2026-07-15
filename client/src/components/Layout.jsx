import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/items'

const LINKS = [
  { to: '/dashboard', icon: '◧', label: 'Dashboard' },
  { to: '/items', icon: '☰', label: 'Inventory' },
  { to: '/add', icon: '＋', label: 'Add item' },
  { to: '/household', icon: '⌂', label: 'Household' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="dot">🥬</span>
          ShelfLife
        </div>

        <nav className="nav">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}>
              <span className="icon" aria-hidden="true">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="avatar">{initials(user?.name)}</div>
            <div className="meta">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>
          <button type="button" className="btn ghost sm" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
