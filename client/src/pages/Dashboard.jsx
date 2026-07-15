import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../context/ToastContext'
import { Alert, Empty, Loading } from '../components/ui'
import ItemCard from '../components/ItemCard'
import { expiryPhrase, initials, STATUS_COLOR } from '../lib/items'

const SHELVES = [
  { status: 'fresh', title: 'Fresh', icon: '🟢' },
  { status: 'expiring-soon', title: 'Expiring soon', icon: '🟡' },
  { status: 'expired', title: 'Expired', icon: '🔴' },
]

function ScoreRing({ score }) {
  const r = 42
  const circumference = 2 * Math.PI * r
  const tone = score >= 70 ? 'var(--fresh)' : score >= 40 ? 'var(--soon)' : 'var(--expired)'

  return (
    <div className="ring">
      <svg width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="ring-label" style={{ color: tone }}>
        {score}%
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { toast, error: toastError } = useToast()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    try {
      const [stats, items, leaders] = await Promise.all([
        api.stats(),
        api.items({ status: 'fresh,expiring-soon,expired', sort: 'expiryDate' }),
        api.leaderboard(),
      ])
      setData({ stats, items: items.items, leaderboard: leaders.leaderboard })
      setError('')
    } catch (err) {
      // No household yet is a setup step, not an error — route them there.
      if (err.status === 403) navigate('/household', { replace: true })
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    load()
  }, [load])

  async function resolve(item, status) {
    setBusyId(item._id)
    try {
      await api.setItemStatus(item._id, status)
      toast(`${item.name} marked ${status}`)
      await load()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>

  const { stats, items, leaderboard } = data
  const expiringSoon = items.filter((i) => i.status === 'expiring-soon' || i.status === 'expired')

  const tiles = [
    { key: 'fresh', label: 'Fresh', value: stats.counts.fresh, foot: 'Plenty of time' },
    { key: 'expiring-soon', label: 'Expiring soon', value: stats.counts['expiring-soon'], foot: 'Within 3 days' },
    { key: 'expired', label: 'Expired', value: stats.counts.expired, foot: 'Deal with these' },
    { key: 'used', label: 'Used', value: stats.counts.used, foot: `${stats.counts.wasted} wasted` },
  ]

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="sub">
            {stats.onShelf} item{stats.onShelf === 1 ? '' : 's'} on the shelf right now.
          </p>
        </div>
        <Link className="btn" to="/add">
          ＋ Add item
        </Link>
      </div>

      <div className="stat-grid">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            className="stat"
            style={{ '--accent': STATUS_COLOR[t.key] }}
            onClick={() => navigate(`/items?status=${t.key}`)}
          >
            <div className="label">{t.label}</div>
            <div className="value">{t.value}</div>
            <div className="foot">{t.foot}</div>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-head">
            <h2>The shelf</h2>
            <Link to="/items" style={{ fontSize: '0.85rem', color: 'var(--brand)' }}>
              View all →
            </Link>
          </div>

          {items.length === 0 ? (
            <Empty
              title="Nothing on the shelf"
              action={
                <Link className="btn" to="/add">
                  Add your first item
                </Link>
              }
            >
              Add groceries and they'll show up here, sorted by how soon they turn.
            </Empty>
          ) : (
            <div className="shelf">
              {SHELVES.map(({ status, title, icon }) => {
                const shelfItems = items.filter((i) => i.status === status)
                if (!shelfItems.length) return null
                return (
                  <div className="shelf-row" key={status}>
                    <div className="shelf-head">
                      <span>{icon}</span>
                      <h3 style={{ color: STATUS_COLOR[status] }}>{title}</h3>
                      <span className="count">{shelfItems.length}</span>
                    </div>
                    <div className="shelf-items">
                      {shelfItems.slice(0, 6).map((item) => (
                        <ItemCard
                          key={item._id}
                          item={item}
                          busy={busyId === item._id}
                          onUse={(i) => resolve(i, 'used')}
                          onWaste={(i) => resolve(i, 'wasted')}
                        />
                      ))}
                    </div>
                    <div className="shelf-plank" />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="card">
            <div className="card-head">
              <h2>Waste score</h2>
            </div>
            <div className="score-ring">
              <ScoreRing score={stats.wasteScore} />
              <div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {stats.totalResolved === 0
                    ? 'Mark items used or wasted to start scoring.'
                    : `${stats.counts.used} of ${stats.totalResolved} finished items got eaten.`}
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Needs attention</h2>
            </div>
            {expiringSoon.length === 0 ? (
              <Empty icon="✨" title="All clear">
                Nothing is expiring in the next few days.
              </Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {expiringSoon.slice(0, 5).map((item) => (
                  <div className="leader-row" key={item._id}>
                    <span
                      className="rank"
                      style={{ color: STATUS_COLOR[item.status], fontSize: '1rem' }}
                    >
                      ●
                    </span>
                    <div className="who">
                      <strong>{item.name}</strong>
                      <span>{expiryPhrase(item.expiryDate)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn sm ghost"
                      disabled={busyId === item._id}
                      onClick={() => resolve(item, 'used')}
                    >
                      Used
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Leaderboard</h2>
            </div>
            {leaderboard.every((l) => l.used + l.wasted === 0) ? (
              <Empty icon="🏅" title="No scores yet">
                Once people start marking items used, they'll rank here.
              </Empty>
            ) : (
              <div className="leader">
                {leaderboard.map((row, i) => (
                  <div className="leader-row" key={row.userId}>
                    <span className="rank">{i + 1}</span>
                    <div className="avatar">{initials(row.name)}</div>
                    <div className="who">
                      <strong>{row.name}</strong>
                      <span>
                        {row.used} used · {row.wasted} wasted
                      </span>
                      <div className="leader-bar">
                        <i style={{ width: `${row.score}%` }} />
                      </div>
                    </div>
                    <span className="pct">{row.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
