const mongoose = require('mongoose');

const CATEGORIES = ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'other'];
const STATUSES = ['fresh', 'expiring-soon', 'expired', 'used', 'wasted'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 30 },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
  },
  password: { type: String, required: true },
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'household', default: null },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const householdSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 30 },
  inviteCode: { type: String, required: true, unique: true, uppercase: true, minlength: 6, maxlength: 6 },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'user' }],
  wasteScore: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'household', required: true, index: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: CATEGORIES, default: 'other' },
  quantity: { type: Number, default: 1, min: 1 },
  expiryDate: { type: Date, required: true },
  status: { type: String, enum: STATUSES, default: 'fresh' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  barcode: { type: String, default: null },
}, { timestamps: true });

// Same item (name + category + expiry) added twice to a household should bump quantity,
// not create a duplicate row. Only applies to items still on the shelf.
itemSchema.index(
  { householdId: 1, name: 1, category: 1, expiryDate: 1 },
  { partialFilterExpression: { status: { $in: ['fresh', 'expiring-soon', 'expired'] } } },
);

const userModel = mongoose.model('user', userSchema);
const householdModel = mongoose.model('household', householdSchema);
const itemModel = mongoose.model('item', itemSchema);

module.exports = { userModel, householdModel, itemModel, CATEGORIES, STATUSES };
