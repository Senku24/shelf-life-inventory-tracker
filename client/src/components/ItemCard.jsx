import { StatusBadge } from './ui'
import { CATEGORY_ICON, expiryPhrase, formatDate } from '../lib/items'

const RESOLVED = ['used', 'wasted']

export default function ItemCard({ item, canEdit, onUse, onWaste, onEdit, onDelete, busy }) {
  const resolved = RESOLVED.includes(item.status)

  return (
    <article className={`item-card ${resolved ? 'resolved' : `is-${item.status}`}`}>
      <div className="top">
        <div style={{ minWidth: 0 }}>
          <div className="name">{item.name}</div>
          <div className="cat">
            <span>{CATEGORY_ICON[item.category]}</span>
            {item.category}
            {item.addedBy?.name && <span>· {item.addedBy.name}</span>}
          </div>
        </div>
        <span className="qty-pill">×{item.quantity}</span>
      </div>

      <div>
        <StatusBadge status={item.status} />
        <div className="when" style={{ marginTop: 6 }}>
          {resolved ? formatDate(item.expiryDate) : expiryPhrase(item.expiryDate)}
        </div>
      </div>

      {!resolved && (
        <div className="actions">
          <button type="button" className="btn sm" onClick={() => onUse(item)} disabled={busy}>
            Used
          </button>
          <button type="button" className="btn sm ghost" onClick={() => onWaste(item)} disabled={busy}>
            Wasted
          </button>
          {canEdit && onEdit && (
            <button type="button" className="btn sm ghost" onClick={() => onEdit(item)} disabled={busy}>
              Edit
            </button>
          )}
          {canEdit && onDelete && (
            <button type="button" className="btn sm danger" onClick={() => onDelete(item)} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  )
}
