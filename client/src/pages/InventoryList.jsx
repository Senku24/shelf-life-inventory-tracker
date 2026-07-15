import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Alert, ConfirmModal, Empty, Loading, Modal, Spinner } from '../components/ui'
import ItemCard from '../components/ItemCard'
import { CATEGORIES, CATEGORY_ICON, toDateInput } from '../lib/items'

const STATUS_TABS = [
  { key: 'shelf', label: 'On shelf', query: 'fresh,expiring-soon,expired' },
  { key: 'fresh', label: 'Fresh', query: 'fresh' },
  { key: 'expiring-soon', label: 'Expiring', query: 'expiring-soon' },
  { key: 'expired', label: 'Expired', query: 'expired' },
  { key: 'resolved', label: 'History', query: 'used,wasted' },
]

function EditModal({ item, onClose, onSaved }) {
  const { error: toastError } = useToast()
  const [form, setForm] = useState({
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    expiryDate: toDateInput(item.expiryDate),
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.updateItem(item._id, { ...form, quantity: Number(form.quantity) })
      onSaved()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit item" onClose={onClose}>
      <form onSubmit={save}>
        <div className="field">
          <label htmlFor="e-name">Name</label>
          <input id="e-name" className="input" value={form.name} onChange={set('name')} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
          <div className="field">
            <label htmlFor="e-cat">Category</label>
            <select id="e-cat" className="input" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_ICON[c]} {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="e-qty">Qty</label>
            <input
              id="e-qty"
              className="input"
              type="number"
              min="1"
              value={form.quantity}
              onChange={set('quantity')}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="e-exp">Expiry date</label>
          <input
            id="e-exp"
            className="input"
            type="date"
            value={form.expiryDate}
            onChange={set('expiryDate')}
            required
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? <Spinner /> : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function InventoryList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast, error: toastError } = useToast()
  const [params, setParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [adminId, setAdminId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')

  // The URL is the source of truth for filters, so links like /items?status=expired work.
  const tab = params.get('status') ?? 'shelf'
  const category = params.get('category') ?? ''
  const sort = params.get('sort') ?? 'expiryDate'
  const activeTab = STATUS_TABS.find((t) => t.key === tab) ?? STATUS_TABS[0]

  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ items: rows }, { household }] = await Promise.all([
        api.items({ status: activeTab.query, category, sort }),
        api.myHousehold(),
      ])
      setItems(rows)
      setAdminId(String(household.admin))
      setError('')
    } catch (err) {
      if (err.status === 403) navigate('/household', { replace: true })
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeTab.query, category, sort, navigate])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items
  }, [items, search])

  const canEdit = (item) => item.addedBy?._id === user?._id || adminId === user?._id

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

  async function confirmDelete() {
    setBusyId(deleting._id)
    try {
      await api.deleteItem(deleting._id)
      toast(`${deleting.name} deleted`)
      setDeleting(null)
      await load()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inventory</h1>
          <p className="sub">Everything your household is keeping track of.</p>
        </div>
        <Link className="btn" to="/add">
          ＋ Add item
        </Link>
      </div>

      <div className="toolbar">
        <div className="seg">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={t.key === activeTab.key ? 'on' : ''}
              onClick={() => setParam('status', t.key === 'shelf' ? '' : t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          className="input grow"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="input" value={category} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_ICON[c]} {c}
            </option>
          ))}
        </select>

        <select className="input" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
          <option value="expiryDate">Sort: expiry date</option>
          <option value="name">Sort: name</option>
          <option value="createdAt">Sort: recently added</option>
        </select>
      </div>

      <Alert>{error}</Alert>

      {loading ? (
        <Loading />
      ) : visible.length === 0 ? (
        <div className="card">
          <Empty
            title={search ? 'No matches' : 'Nothing here'}
            action={
              !search && (
                <Link className="btn" to="/add">
                  Add an item
                </Link>
              )
            }
          >
            {search
              ? `No items match "${search}".`
              : 'Try a different filter, or add something to the shelf.'}
          </Empty>
        </div>
      ) : (
        <div className="shelf-items">
          {visible.map((item) => (
            <ItemCard
              key={item._id}
              item={item}
              busy={busyId === item._id}
              canEdit={canEdit(item)}
              onUse={(i) => resolve(i, 'used')}
              onWaste={(i) => resolve(i, 'wasted')}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast('Item updated')
            load()
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete item?"
          body={`"${deleting.name}" will be removed from the inventory. This can't be undone.`}
          confirmLabel="Delete"
          busy={busyId === deleting._id}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
