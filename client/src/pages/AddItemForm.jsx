import { lazy, Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../context/ToastContext'
import { Alert, Spinner } from '../components/ui'
import { CATEGORIES, CATEGORY_ICON, daysUntil } from '../lib/items'

// The ZXing decoder is ~450kB and most sessions never scan — fetch it on demand.
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))

// Rough shelf life per category, used only to pre-fill the date picker.
const DEFAULT_SHELF_DAYS = { produce: 7, dairy: 10, meat: 3, pantry: 180, frozen: 90, other: 14 }

function dateInDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const BLANK = { name: '', category: 'other', quantity: 1, expiryDate: dateInDays(14), barcode: null }

export default function AddItemForm() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Changing category re-suggests an expiry date, but never overwrites a date
  // the user picked themselves.
  const [dateTouched, setDateTouched] = useState(false)
  function onCategory(e) {
    const category = e.target.value
    setForm((f) => ({
      ...f,
      category,
      expiryDate: dateTouched ? f.expiryDate : dateInDays(DEFAULT_SHELF_DAYS[category]),
    }))
  }

  const onDetected = useCallback(
    ({ barcode, name }) => {
      setScanning(false)
      setForm((f) => ({ ...f, barcode, name: name || f.name }))
      toast(name ? `Found: ${name}` : `Scanned ${barcode} — no product match, add the name yourself`)
    },
    [toast],
  )

  async function submit(e, addAnother = false) {
    e.preventDefault()
    if (!form.name.trim()) return setError('Give the item a name')
    setError('')
    setBusy(true)
    try {
      const { message } = await api.addItem({ ...form, quantity: Number(form.quantity) })
      toast(message)
      if (addAnother) setForm({ ...BLANK, category: form.category })
      else navigate('/items')
    } catch (err) {
      if (err.status === 403) navigate('/household')
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const days = daysUntil(form.expiryDate)
  const preview =
    days < 0 ? 'expired' : days <= 3 ? 'expiring-soon' : 'fresh'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Add an item</h1>
          <p className="sub">Scan a barcode or fill it in by hand.</p>
        </div>
      </div>

      <div style={{ maxWidth: 520 }}>
        <form className="card" onSubmit={(e) => submit(e, false)}>
          <Alert>{error}</Alert>

          <button
            type="button"
            className="btn ghost block"
            style={{ marginBottom: 18 }}
            onClick={() => setScanning(true)}
          >
            📷 Scan barcode
          </button>

          <div className="field">
            <label htmlFor="name">Item name</label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={set('name')}
              placeholder="Whole milk"
              autoFocus
            />
            {form.barcode && <span className="hint">Barcode {form.barcode}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" className="input" value={form.category} onChange={onCategory}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICON[c]} {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                className="input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={set('quantity')}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="expiryDate">Expiry date</label>
            <input
              id="expiryDate"
              className="input"
              type="date"
              value={form.expiryDate}
              onChange={(e) => {
                setDateTouched(true)
                set('expiryDate')(e)
              }}
              required
            />
            <span className="hint">
              Will be tracked as{' '}
              <strong style={{ color: `var(--${preview === 'expiring-soon' ? 'soon' : preview})` }}>
                {preview.replace('-', ' ')}
              </strong>
              {days >= 0 && ` · ${days} day${days === 1 ? '' : 's'} left`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? <Spinner /> : 'Add item'}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={(e) => submit(e, true)}
            >
              Save & add another
            </button>
          </div>
        </form>
      </div>

      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />
        </Suspense>
      )}
    </>
  )
}
