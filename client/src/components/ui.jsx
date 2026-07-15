import { useEffect } from 'react'
import { STATUS_LABEL } from '../lib/items'

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />
}

export function Loading() {
  return (
    <div className="loading-wrap">
      <Spinner />
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>
}

export function Empty({ icon = '🍃', title, children, action }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3>{title}</h3>
      {children && <p style={{ marginTop: 6, fontSize: '0.88rem' }}>{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function Alert({ tone = 'error', children }) {
  if (!children) return null
  return <div className={`alert ${tone}`}>{children}</div>
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function ConfirmModal({ title, body, confirmLabel = 'Confirm', onConfirm, onClose, busy }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{body}</p>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn danger" onClick={onConfirm} disabled={busy}>
          {busy ? <Spinner /> : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
