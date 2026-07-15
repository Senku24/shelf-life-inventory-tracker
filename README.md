# ShelfLife — Household Inventory Tracker

Collaborative expiry tracking for shared households. Roommates manage groceries together,
get expiration alerts, and compete to reduce waste.

**Stack:** MongoDB · Express · Node.js · React (MERN)

---

## Running it

```bash
# 1. backend
cp .env.example .env        # fill in MONGOOSE_URI and JWT_SECRET
npm install
npm run dev                 # http://localhost:3000

# 2. frontend (separate terminal)
npm run client:install
npm run client              # http://localhost:5173
```

Vite proxies `/api` to `localhost:3000`, so the two run side by side with no CORS setup.

| Script | What it does |
|--------|--------------|
| `npm run dev` | API with file watching |
| `npm start` | API, production mode |
| `npm run client` | Vite dev server |
| `npm run digest` | Run the email digest job once, by hand |

Without `SMTP_HOST` set, the digest job logs what it *would* send instead of failing —
you can develop the whole app without a mail server.

---

## Project layout

```
index.js            all API routes
models.js           mongoose schemas
authmiddleware.js   JWT verification
status.js           expiry date math (fresh / expiring-soon / expired)
notifications.js    daily cron + nodemailer digest
client/             React app (Vite)
  src/api.js        fetch wrapper, token handling
  src/context/      auth + toast providers
  src/components/   Layout, ItemCard, BarcodeScanner, ui primitives
  src/pages/        one file per route
```

---

## Design notes

A few decisions worth knowing about:

**Status is derived, not just stored.** `fresh` / `expiring-soon` / `expired` are a function of
today's date, so a stored value goes stale the moment the clock rolls over. Reads recompute
them (`status.js`), and the cron persists the drift so aggregations stay honest. `used` and
`wasted` are human decisions and are never overwritten by date math.

**Waste score is `used / (used + wasted)`.** Items still on the shelf are excluded — they
haven't been won or lost yet, and counting them would drag every household to near zero on
day one.

**Permissions split by action.** Editing and deleting an item is limited to whoever added it
or the household admin, per the brief. Marking something used or wasted is open to any member —
you shouldn't need the owner present to drink the milk.

**Adding a duplicate tops up quantity.** Same name, category, and expiry in the same household
bumps the count instead of creating a second row.

**Household lifecycle.** The creator is admin. If the admin leaves, admin passes to the next
member; if the last member leaves, the household and its items are deleted rather than orphaned.

---

## API

All authenticated routes take `Authorization: Bearer <token>`.

### Auth
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{name, email, password}` | `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` | `{token, user}` |
| GET | `/api/auth/me` | — | `{user}` |

### Households
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/households` | Create; invite code is auto-generated |
| POST | `/api/households/join` | `{inviteCode}` → join existing |
| GET | `/api/households/me` | Current user's household |
| GET | `/api/households/:id/members` | List members (own household only) |
| POST | `/api/households/leave` | Leave, with admin handoff |

### Items
| Method | Endpoint | Query params | Description |
|--------|----------|--------------|-------------|
| GET | `/api/items` | `?status=&category=&sort=&order=` | List household items |
| POST | `/api/items` | — | Create (or top up a duplicate) |
| PUT | `/api/items/:id` | — | Update details — creator or admin |
| PATCH | `/api/items/:id/status` | `{status}` | Mark `used` / `wasted` — any member |
| DELETE | `/api/items/:id` | — | Remove — creator or admin |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Waste score, counts by status |
| GET | `/api/dashboard/expiring` | Items expiring in 24h |
| GET | `/api/dashboard/leaderboard` | Per-member used/wasted ranking |

---

## Frontend routes

| Path | Component | Access |
|------|-----------|--------|
| `/login` | LoginForm | Public |
| `/register` | RegisterForm | Public |
| `/dashboard` | Dashboard | Private |
| `/household` | HouseholdManager | Private |
| `/items` | InventoryList | Private |
| `/add` | AddItemForm | Private |

Members without a household are routed to `/household` to create or join one before
the inventory pages will load.

Barcode scanning uses the browser camera via ZXing and resolves product names against
Open Food Facts — the one external API the brief allows. It is lazy-loaded (~410kB) so
sessions that never scan don't pay for it, and falls back to manual entry when the camera
is unavailable or the product is unknown.

---

## Housekeeping

`.npm-cache/` was committed to the repo in an earlier commit. It's now gitignored, but the
tracked copies are still in the index — `git rm -r --cached .npm-cache` will drop them
when you're ready.
