const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { householdModel, itemModel } = require('./models');
const { refreshStatuses } = require('./status');

const DAY_MS = 24 * 60 * 60 * 1000;

function buildTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function itemsExpiringWithin24h(householdId) {
  const now = new Date();
  return itemModel
    .find({
      householdId,
      status: { $in: ['fresh', 'expiring-soon'] },
      expiryDate: { $gte: now, $lte: new Date(now.getTime() + DAY_MS) },
    })
    .populate('addedBy', 'name')
    .sort({ expiryDate: 1 });
}

function renderDigest(householdName, items) {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.category}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${new Date(i.expiryDate).toLocaleString()}</td>
      </tr>`,
    )
    .join('');

  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">🥬 ShelfLife daily digest</h2>
      <p style="color:#666;margin:0 0 20px">
        ${items.length} item${items.length === 1 ? '' : 's'} in <strong>${householdName}</strong> expire${items.length === 1 ? 's' : ''} within 24 hours.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <thead>
          <tr style="text-align:left;color:#888;font-size:12px;text-transform:uppercase">
            <th style="padding:8px 12px">Item</th><th style="padding:8px 12px">Qty</th>
            <th style="padding:8px 12px">Category</th><th style="padding:8px 12px">Expires</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#666;margin-top:20px">Use them up before they go to waste!</p>
    </div>`;
}

async function sendDailyDigests() {
  await refreshStatuses();
  const transport = buildTransport();
  const households = await householdModel.find().populate('members', 'name email');
  let sent = 0;

  for (const household of households) {
    const items = await itemsExpiringWithin24h(household._id);
    if (!items.length) continue;

    const recipients = household.members.map((m) => m.email).filter(Boolean);
    if (!recipients.length) continue;

    const message = {
      from: process.env.MAIL_FROM || 'ShelfLife <no-reply@shelflife.app>',
      to: recipients,
      subject: `${items.length} item${items.length === 1 ? '' : 's'} expiring in ${household.name}`,
      html: renderDigest(household.name, items),
    };

    if (!transport) {
      console.log(`[digest] SMTP not configured — would email ${recipients.join(', ')}:`,
        items.map((i) => i.name).join(', '));
      continue;
    }

    try {
      await transport.sendMail(message);
      sent += 1;
    } catch (err) {
      console.error(`[digest] failed for ${household.name}:`, err.message);
    }
  }
  return sent;
}

function startCron() {
  // Every day at 08:00 server time.
  cron.schedule(process.env.DIGEST_CRON || '0 8 * * *', () => {
    sendDailyDigests().catch((err) => console.error('[digest] job failed:', err));
  });
  console.log('[digest] daily expiry digest scheduled');
}

module.exports = { startCron, sendDailyDigests, itemsExpiringWithin24h };
