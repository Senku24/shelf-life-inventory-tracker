import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Alert, ConfirmModal, Loading, Spinner } from '../components/ui'
import { formatDate, initials } from '../lib/items'

function Onboarding({ onDone }) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function run(kind, e) {
    e.preventDefault()
    setError('')
    setBusy(kind)
    try {
      if (kind === 'create') {
        const { household } = await api.createHousehold(name)
        toast(`${household.name} created — invite code ${household.inviteCode}`)
      } else {
        const { message } = await api.joinHousehold(code)
        toast(message)
      }
      await onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Set up your household</h1>
          <p className="sub">Start a new one, or join your roommates with their invite code.</p>
        </div>
      </div>

      <Alert>{error}</Alert>

      <div className="choice-grid">
        <form className="card" onSubmit={(e) => run('create', e)}>
          <div className="card-head">
            <h2>🏠 Create a household</h2>
          </div>
          <div className="field">
            <label htmlFor="hname">Household name</label>
            <input
              id="hname"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Flat 4B"
              minLength={3}
              maxLength={30}
              required
            />
            <span className="hint">3-30 characters. You'll get an invite code to share.</span>
          </div>
          <button className="btn block" type="submit" disabled={busy === 'create'}>
            {busy === 'create' ? <Spinner /> : 'Create household'}
          </button>
        </form>

        <form className="card" onSubmit={(e) => run('join', e)}>
          <div className="card-head">
            <h2>🔑 Join a household</h2>
          </div>
          <div className="field">
            <label htmlFor="code">Invite code</label>
            <input
              id="code"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AB12CD"
              maxLength={6}
              style={{ letterSpacing: '0.2em', fontFamily: 'ui-monospace, monospace' }}
              required
            />
            <span className="hint">Ask a housemate for the 6-character code.</span>
          </div>
          <button className="btn block ghost" type="submit" disabled={busy === 'join' || code.length !== 6}>
            {busy === 'join' ? <Spinner /> : 'Join household'}
          </button>
        </form>
      </div>
    </>
  )
}

export default function HouseholdManager() {
  const { user, refresh } = useAuth()
  const { toast, error: toastError } = useToast()

  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { household: h } = await api.myHousehold()
      const { members: m } = await api.members(h._id)
      setHousehold(h)
      setMembers(m)
      setError('')
    } catch (err) {
      // 403 means no household — show the create/join screen instead of an error.
      if (err.status === 403) setHousehold(null)
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function onJoined() {
    await refresh()
    await load()
  }

  async function confirmLeave() {
    setBusy(true)
    try {
      await api.leaveHousehold()
      toast('You left the household')
      setLeaving(false)
      await onJoined()
    } catch (err) {
      toastError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function copyCode() {
    navigator.clipboard
      .writeText(household.inviteCode)
      .then(() => toast('Invite code copied'))
      .catch(() => toastError('Could not copy — select the code manually'))
  }

  if (loading) return <Loading />
  if (error) return <Alert>{error}</Alert>
  if (!household) return <Onboarding onDone={onJoined} />

  const isAdmin = String(household.admin) === user?._id
  const isLastMember = members.length === 1

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{household.name}</h1>
          <p className="sub">
            {members.length} member{members.length === 1 ? '' : 's'} · created{' '}
            {formatDate(household.createdAt)}
          </p>
        </div>
        <button type="button" className="btn danger" onClick={() => setLeaving(true)}>
          Leave household
        </button>
      </div>

      <div className="choice-grid">
        <section className="card">
          <div className="card-head">
            <h2>Invite code</h2>
          </div>
          <div className="invite-code">
            <code>{household.inviteCode}</code>
            <button type="button" className="btn sm ghost" style={{ marginLeft: 'auto' }} onClick={copyCode}>
              Copy
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Share this with a housemate. They enter it on the join screen to get access to this
            inventory.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Members</h2>
            {isAdmin && <span className="badge fresh">You're admin</span>}
          </div>
          <div>
            {members.map((m) => (
              <div className="member-row" key={m._id}>
                <div className="avatar">{initials(m.name)}</div>
                <div className="who">
                  <strong>
                    {m.name}
                    {m._id === user?._id && ' (you)'}
                  </strong>
                  <span>{m.email}</span>
                </div>
                {m.isAdmin && <span className="badge used">Admin</span>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {leaving && (
        <ConfirmModal
          title="Leave this household?"
          body={
            isLastMember
              ? `You're the last member of ${household.name}. Leaving deletes the household and every item in it.`
              : isAdmin
                ? `You'll lose access to ${household.name}'s inventory, and admin passes to another member.`
                : `You'll lose access to ${household.name}'s inventory. You can rejoin with the invite code.`
          }
          confirmLabel={isLastMember ? 'Leave & delete' : 'Leave'}
          busy={busy}
          onConfirm={confirmLeave}
          onClose={() => setLeaving(false)}
        />
      )}
    </>
  )
}
