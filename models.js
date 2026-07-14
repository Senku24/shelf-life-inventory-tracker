const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();
mongoose.connect(process.env.MONGOOSE_URI);

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true},
password: {
    type: String, required: true}
});
const userModel = mongoose.model('user', userSchema);

const householdSchema = new mongoose.Schema({
  householdName: {
    type: String, required: true},
    inviteCode: {
    type: String, required: true},
    wasteScore: {type: Number},
  members: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'user'}],
});
const householdModel = mongoose.model('household', householdSchema);

const itemSchema = new mongoose.Schema({
  itemName: {
    type: String, required: true},
  expirationDate: {
    type: Date, required: true},
  quantity: {
    type: Number, required: true},
    category: {
    type: String, required: true}
});
const itemModel = mongoose.model('item', itemSchema);

module.exports = { userModel, householdModel, itemModel };
  