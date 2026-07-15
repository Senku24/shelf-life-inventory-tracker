const POINTS = [
  { icon: '🏠', text: 'Share one fridge, one list, zero arguments' },
  { icon: '⏰', text: 'Daily email digest before food turns' },
  { icon: '📊', text: 'Track what your household saves vs. wastes' },
]

export default function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="brand-mark" style={{ padding: 0, color: '#fff' }}>
        <span className="dot">🥬</span>
        ShelfLife
      </div>
      <h2>Stop throwing money in the bin.</h2>
      <p>
        Track every item in your shared kitchen, get told before things expire, and see who is
        actually using the groceries.
      </p>
      <div className="points">
        {POINTS.map((p) => (
          <div className="point" key={p.text}>
            <span className="b">{p.icon}</span>
            {p.text}
          </div>
        ))}
      </div>
    </aside>
  )
}
