const { itemModel } = require('./models');

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 3;

// Items marked used/wasted are resolved — their status is a human decision and
// never gets overwritten by date math.
const SHELF_STATUSES = ['fresh', 'expiring-soon', 'expired'];

function daysUntil(expiryDate, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(expiryDate);
  const startOfExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  return Math.round((startOfExpiry - startOfToday) / DAY_MS);
}

function computeStatus(expiryDate, now = new Date()) {
  const days = daysUntil(expiryDate, now);
  if (days < 0) return 'expired';
  if (days <= EXPIRING_SOON_DAYS) return 'expiring-soon';
  return 'fresh';
}

// Stored status can drift as time passes, so recompute shelf items on read.
function withLiveStatus(item) {
  const obj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  if (SHELF_STATUSES.includes(obj.status)) {
    obj.status = computeStatus(obj.expiryDate);
    obj.daysUntilExpiry = daysUntil(obj.expiryDate);
  }
  return obj;
}

// Persist drifted statuses so cron queries and stats aggregations see the truth.
async function refreshStatuses(householdId) {
  const filter = { status: { $in: SHELF_STATUSES } };
  if (householdId) filter.householdId = householdId;

  const items = await itemModel.find(filter).select('expiryDate status');
  const ops = items
    .map((item) => ({ item, next: computeStatus(item.expiryDate) }))
    .filter(({ item, next }) => item.status !== next)
    .map(({ item, next }) => ({
      updateOne: { filter: { _id: item._id }, update: { $set: { status: next } } },
    }));

  if (ops.length) await itemModel.bulkWrite(ops);
  return ops.length;
}

module.exports = {
  computeStatus,
  withLiveStatus,
  refreshStatuses,
  daysUntil,
  SHELF_STATUSES,
  EXPIRING_SOON_DAYS,
};
