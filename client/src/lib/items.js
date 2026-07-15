export const CATEGORIES = ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'other']

export const CATEGORY_ICON = {
  produce: '🥬',
  dairy: '🥛',
  meat: '🥩',
  pantry: '🥫',
  frozen: '🧊',
  other: '📦',
}

export const STATUS_LABEL = {
  fresh: 'Fresh',
  'expiring-soon': 'Expiring soon',
  expired: 'Expired',
  used: 'Used',
  wasted: 'Wasted',
}

export const STATUS_COLOR = {
  fresh: 'var(--fresh)',
  'expiring-soon': 'var(--soon)',
  expired: 'var(--expired)',
  used: 'var(--used)',
  wasted: 'var(--expired)',
}

const DAY_MS = 24 * 60 * 60 * 1000

// Compare calendar days, not elapsed hours — "expires tomorrow" shouldn't flip to
// "in 0 days" just because it's late in the evening.
export function daysUntil(expiryDate) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(expiryDate)
  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((then - today) / DAY_MS)
}

export function expiryPhrase(expiryDate) {
  const days = daysUntil(expiryDate)
  if (days < -1) return `Expired ${Math.abs(days)} days ago`
  if (days === -1) return 'Expired yesterday'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function toDateInput(value) {
  const d = new Date(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
