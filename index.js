const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const authmiddleware = require("./authMiddleware");
const { userModel, householdModel, itemModel, CATEGORIES } = require("./models");
const { withLiveStatus, refreshStatuses, computeStatus } = require("./status");
const { startCron, itemsExpiringWithin24h } = require("./notifications");

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());

// ---------- helpers ----------

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes (0/O, 1/I)

async function generateInviteCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = Array.from({ length: 6 },
            () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]).join("");
        if (!(await householdModel.exists({ inviteCode: code }))) return code;
    }
    throw new Error("Could not generate a unique invite code");
}

function signToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Every household-scoped route needs the caller's household; centralise the 403.
async function requireHousehold(req, res) {
    const user = await userModel.findById(req.userId).select("householdId");
    if (!user?.householdId) {
        res.status(403).json({ message: "You are not a member of any household" });
        return null;
    }
    return user.householdId;
}

// Wraps async handlers so a rejected promise becomes a 500 instead of a hung request.
const route = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// ---------- auth ----------

app.post('/api/auth/register', route(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || name.trim().length < 2 || name.trim().length > 30) {
        return res.status(400).json({ message: "Name must be 2-30 characters" });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: "A valid email is required" });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (await userModel.exists({ email: email.toLowerCase() })) {
        return res.status(409).json({ message: "An account with that email already exists" });
    }

    const user = await userModel.create({
        name: name.trim(),
        email: email.toLowerCase(),
        password: await bcrypt.hash(password, 10),
    });

    res.status(201).json({ token: signToken(user._id), user: user.toJSON() });
}));

app.post('/api/auth/login', route(async (req, res) => {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email: (email || "").toLowerCase() });

    // Same message either way so the response can't be used to enumerate accounts.
    if (!user || !(await bcrypt.compare(password || "", user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ token: signToken(user._id), user: user.toJSON() });
}));

app.get('/api/auth/me', authmiddleware, route(async (req, res) => {
    const user = await userModel.findById(req.userId).populate('householdId', 'name inviteCode');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user: user.toJSON() });
}));

// ---------- households ----------

app.post('/api/households', authmiddleware, route(async (req, res) => {
    const name = (req.body.name || "").trim();
    if (name.length < 3 || name.length > 30) {
        return res.status(400).json({ message: "Household name must be 3-30 characters" });
    }

    const user = await userModel.findById(req.userId).select("householdId");
    if (user.householdId) {
        return res.status(409).json({ message: "Leave your current household before creating a new one" });
    }

    const household = await householdModel.create({
        name,
        inviteCode: await generateInviteCode(),
        admin: req.userId,
        members: [req.userId],
    });
    await userModel.updateOne({ _id: req.userId }, { $set: { householdId: household._id } });

    res.status(201).json({ message: "Household created", household });
}));

app.post('/api/households/join', authmiddleware, route(async (req, res) => {
    const inviteCode = (req.body.inviteCode || "").trim().toUpperCase();
    const household = await householdModel.findOne({ inviteCode });
    if (!household) return res.status(404).json({ message: "No household found with that invite code" });

    const user = await userModel.findById(req.userId).select("householdId");
    if (user.householdId) {
        if (user.householdId.equals(household._id)) {
            return res.status(409).json({ message: "You are already in this household" });
        }
        return res.status(409).json({ message: "Leave your current household before joining another" });
    }

    await householdModel.updateOne({ _id: household._id }, { $addToSet: { members: req.userId } });
    await userModel.updateOne({ _id: req.userId }, { $set: { householdId: household._id } });

    res.status(200).json({ message: `Joined ${household.name}`, household });
}));

app.get('/api/households/me', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    const household = await householdModel.findById(householdId).populate('members', 'name email');
    res.status(200).json({ household });
}));

app.get('/api/households/:id/members', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    // Members of one household must not be able to read another's roster.
    if (!householdId.equals(req.params.id)) {
        return res.status(403).json({ message: "You can only view your own household" });
    }

    const household = await householdModel.findById(req.params.id).populate('members', 'name email');
    if (!household) return res.status(404).json({ message: "Household not found" });

    res.status(200).json({
        members: household.members.map((m) => ({
            ...m.toJSON(),
            isAdmin: household.admin.equals(m._id),
        })),
    });
}));

app.post('/api/households/leave', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    const household = await householdModel.findById(householdId);
    const remaining = household.members.filter((m) => !m.equals(req.userId));

    if (!remaining.length) {
        // Last member out deletes the household and its items rather than orphaning them.
        await itemModel.deleteMany({ householdId });
        await householdModel.deleteOne({ _id: householdId });
    } else {
        household.members = remaining;
        // Admin can't leave a household with no admin — hand off to the next member.
        if (household.admin.equals(req.userId)) household.admin = remaining[0];
        await household.save();
    }

    await userModel.updateOne({ _id: req.userId }, { $set: { householdId: null } });
    res.status(200).json({ message: "You left the household" });
}));

// ---------- items ----------

app.get('/api/items', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    await refreshStatuses(householdId);

    const filter = { householdId };
    if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
    if (req.query.category) filter.category = { $in: String(req.query.category).split(',') };

    const sortField = ['expiryDate', 'name', 'createdAt'].includes(req.query.sort)
        ? req.query.sort : 'expiryDate';
    const sortDir = req.query.order === 'desc' ? -1 : 1;

    const items = await itemModel.find(filter)
        .populate('addedBy', 'name')
        .sort({ [sortField]: sortDir });

    res.status(200).json({ items: items.map(withLiveStatus) });
}));

app.post('/api/items', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    const { name, category, quantity, expiryDate, barcode } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ message: "Item name is required" });
    if (category && !CATEGORIES.includes(category)) {
        return res.status(400).json({ message: `Category must be one of: ${CATEGORIES.join(', ')}` });
    }
    if (!expiryDate || Number.isNaN(Date.parse(expiryDate))) {
        return res.status(400).json({ message: "A valid expiry date is required" });
    }
    const qty = quantity === undefined ? 1 : Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ message: "Quantity must be a whole number of at least 1" });
    }

    const fields = {
        householdId,
        name: name.trim(),
        category: category || 'other',
        expiryDate: new Date(expiryDate),
        status: computeStatus(new Date(expiryDate)),
    };

    // Re-adding the same product with the same expiry tops up the existing entry.
    const existing = await itemModel.findOne({
        householdId,
        name: fields.name,
        category: fields.category,
        expiryDate: fields.expiryDate,
        status: { $in: ['fresh', 'expiring-soon', 'expired'] },
    });

    if (existing) {
        existing.quantity += qty;
        await existing.save();
        return res.status(200).json({ message: "Quantity updated on existing item", item: withLiveStatus(existing) });
    }

    const item = await itemModel.create({ ...fields, quantity: qty, addedBy: req.userId, barcode: barcode || null });
    res.status(201).json({ message: "Item added", item: withLiveStatus(item) });
}));

// Only the person who added an item, or the household admin, may change or remove it.
async function loadEditableItem(req, res) {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return null;

    const item = await itemModel.findOne({ _id: req.params.id, householdId });
    if (!item) {
        res.status(404).json({ message: "Item not found" });
        return null;
    }

    const household = await householdModel.findById(householdId).select('admin');
    const isOwner = item.addedBy.equals(req.userId);
    const isAdmin = household.admin.equals(req.userId);
    if (!isOwner && !isAdmin) {
        res.status(403).json({ message: "Only the person who added this item or the household admin can change it" });
        return null;
    }
    return item;
}

app.put('/api/items/:id', authmiddleware, route(async (req, res) => {
    const item = await loadEditableItem(req, res);
    if (!item) return;

    const { name, category, quantity, expiryDate } = req.body;

    if (name !== undefined) {
        if (!name.trim()) return res.status(400).json({ message: "Item name cannot be empty" });
        item.name = name.trim();
    }
    if (category !== undefined) {
        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({ message: `Category must be one of: ${CATEGORIES.join(', ')}` });
        }
        item.category = category;
    }
    if (quantity !== undefined) {
        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty < 1) {
            return res.status(400).json({ message: "Quantity must be a whole number of at least 1" });
        }
        item.quantity = qty;
    }
    if (expiryDate !== undefined) {
        if (Number.isNaN(Date.parse(expiryDate))) {
            return res.status(400).json({ message: "A valid expiry date is required" });
        }
        item.expiryDate = new Date(expiryDate);
    }

    // A new expiry date can move a shelf item between fresh/expiring-soon/expired.
    if (['fresh', 'expiring-soon', 'expired'].includes(item.status)) {
        item.status = computeStatus(item.expiryDate);
    }

    await item.save();
    res.status(200).json({ message: "Item updated", item: withLiveStatus(item) });
}));

app.patch('/api/items/:id/status', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    const { status } = req.body;
    // Any member can resolve an item — you shouldn't need the owner present to eat the milk.
    if (!['used', 'wasted'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'used' or 'wasted'" });
    }

    const item = await itemModel.findOne({ _id: req.params.id, householdId });
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (['used', 'wasted'].includes(item.status)) {
        return res.status(409).json({ message: `Item is already marked ${item.status}` });
    }

    item.status = status;
    item.resolvedBy = req.userId;
    await item.save();
    await recalculateWasteScore(householdId);

    res.status(200).json({ message: `Item marked ${status}`, item: withLiveStatus(item) });
}));

app.delete('/api/items/:id', authmiddleware, route(async (req, res) => {
    const item = await loadEditableItem(req, res);
    if (!item) return;

    await itemModel.deleteOne({ _id: item._id });
    await recalculateWasteScore(item.householdId);
    res.status(200).json({ message: "Item deleted", item: withLiveStatus(item) });
}));

// ---------- dashboard ----------

// Score is the share of *resolved* items that got used. Items still on the shelf
// haven't been won or lost yet, so counting them would drag every score to zero.
async function recalculateWasteScore(householdId) {
    const [used, wasted] = await Promise.all([
        itemModel.countDocuments({ householdId, status: 'used' }),
        itemModel.countDocuments({ householdId, status: 'wasted' }),
    ]);
    const resolved = used + wasted;
    const wasteScore = resolved === 0 ? 0 : Math.round((used / resolved) * 100);
    await householdModel.updateOne({ _id: householdId }, { $set: { wasteScore } });
    return { used, wasted, resolved, wasteScore };
}

app.get('/api/dashboard/stats', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    await refreshStatuses(householdId);
    const score = await recalculateWasteScore(householdId);

    const grouped = await itemModel.aggregate([
        { $match: { householdId: new mongoose.Types.ObjectId(householdId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts = { fresh: 0, 'expiring-soon': 0, expired: 0, used: 0, wasted: 0 };
    grouped.forEach((g) => { counts[g._id] = g.count; });

    res.status(200).json({
        wasteScore: score.wasteScore,
        counts,
        onShelf: counts.fresh + counts['expiring-soon'] + counts.expired,
        totalResolved: score.resolved,
    });
}));

app.get('/api/dashboard/expiring', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    await refreshStatuses(householdId);
    const items = await itemsExpiringWithin24h(householdId);
    res.status(200).json({ items: items.map(withLiveStatus) });
}));

app.get('/api/dashboard/leaderboard', authmiddleware, route(async (req, res) => {
    const householdId = await requireHousehold(req, res);
    if (!householdId) return;

    const rows = await itemModel.aggregate([
        {
            $match: {
                householdId: new mongoose.Types.ObjectId(householdId),
                status: { $in: ['used', 'wasted'] },
            },
        },
        {
            $group: {
                _id: '$addedBy',
                used: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } },
                wasted: { $sum: { $cond: [{ $eq: ['$status', 'wasted'] }, 1, 0] } },
            },
        },
    ]);

    const household = await householdModel.findById(householdId).populate('members', 'name email');
    const byUser = new Map(rows.map((r) => [String(r._id), r]));

    const leaderboard = household.members.map((member) => {
        const row = byUser.get(String(member._id)) || { used: 0, wasted: 0 };
        const resolved = row.used + row.wasted;
        return {
            userId: member._id,
            name: member.name,
            used: row.used,
            wasted: row.wasted,
            score: resolved === 0 ? 0 : Math.round((row.used / resolved) * 100),
        };
    }).sort((a, b) => b.score - a.score || b.used - a.used);

    res.status(200).json({ leaderboard });
}));

// ---------- errors ----------

app.use((err, _req, res, _next) => {
    console.error(err);
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: Object.values(err.errors)[0].message });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ message: "Malformed id" });
    }
    res.status(500).json({ message: "Something went wrong" });
});

async function start() {
    await mongoose.connect(process.env.MONGOOSE_URI);
    console.log("Connected to MongoDB");
    startCron();
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
