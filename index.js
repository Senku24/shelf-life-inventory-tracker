const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const authmiddleware = require("./authMiddleware");
const { userModel, householdModel, itemModel } = require("./models");

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());    

// create endpoints
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const userExists = await userModel.findOne({username});

    if(userExists) {
        return res.status(400).json({ message: "User already exists" });
    }

    const newUser = await userModel.create({ username, password });
    res.status(201).json({ message: "User created successfully"});
});
app.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    const userCheck = await userModel.findOne({ username, password });

    if(!userCheck) {
        return res.status(400).json({ message: "Invalid username or password" });
    }
    const token = jwt.sign({ userId: userCheck._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: "Signin successful", token });
});
app.post('/household', authmiddleware, async (req, res) => {
    const userId = req.userId;

    const newHousehold = await householdModel.create({
        householdName: req.body.householdName,
        inviteCode: req.body.inviteCode,
        members: [userId]
    })
    res.status(201).json({ message: "Household created successfully", household: newHousehold._id });
    await userModel.updateOne({_id: userId}, { $set: { householdId: newHousehold._id } });
});
app.post('/household/join', authmiddleware, async (req, res) => { // bug: need unique invite code for each household
    const userId = req.userId;
    const inviteCode = req.body.inviteCode;

    const house = await householdModel.findOne({ inviteCode });
    if(!house) {
        return res.status(404).json({ message: "Household not found" });
    }
    const isMember = house.members.some(member => member.equals(userId));
    if(isMember) {
        return res.status(400).json({ message: "User already a member of this household" });
    }
    const addmember = await householdModel.updateOne({_id: house._id}, { $addToSet: { members: userId } });
    const updateUser = await userModel.findByIdAndUpdate(userId, { $set: { householdId: house._id } });
    res.status(200).json({ message: "Joined household successfully" });
});
app.post('/item', authmiddleware, async (req, res) => { //bug: if same item is being added by same user with same details it needs to update count not make a new entery.
    const userId = req.userId;
    const { itemName, expirationDate, quantity, category } = req.body;
    const user = await userModel.findById(userId).select("householdId");
    if(!user.householdId){
        return res.status(403).json({ message: "User is not a member of any household" });

    }
    const items = await itemModel.create({ itemName, expirationDate, quantity, category, householdId: user.householdId, addedBy: userId });
    res.status(201).json({ message: "Item created successfully", item: items });
});
// read endpoints
app.get('/household', authmiddleware, async (req, res) => { 
    const userId = req.userId;
    const user = await userModel.findById(userId).select("householdId");

    if(!user.householdId) {
        return res.status(404).json({ message: "User is not a member of any household" });
    }
    const household = await householdModel.findById(user.householdId).populate('members', 'username');
    res.status(200).json({ message: "Household details retrieved successfully-", household });
});
app.get('/item', authmiddleware, async (req, res) => {
    const userId = req.userId;
    const user = await userModel.findById(userId).select("householdId");
    if(!user.householdId){
        return res.status(403).json({ message: "User is not a member of any household" });
    }
    const items = await itemModel.find({ householdId: user.householdId });
    res.status(200).json({ message: "Items retrieved successfully", items });
})

// update endpoints
app.put('/item/:id', authmiddleware, async (req, res) => {
    const userId = req.userId;
    const itemId = req.params.id;
    const { itemName, expirationDate, quantity, category } = req.body;
    const user = await userModel.findById(userId).select("householdId");
    if(!user.householdId){
        return res.status(403).json({ message: "User is not a member of any household" });
    }
    const item = await itemModel.findOneAndUpdate({ _id: itemId, householdId: user.householdId }, 
        { itemName, expirationDate, quantity, category }, 
        { new: true }
    );
    if(!item) {
        return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item updated successfully", item });
})
// delete endpoints
app.delete('/item/:id', authmiddleware, async (req, res) => {
    const userId = req.userId;
    const itemId = req.params.id;
    const user = await userModel.findById(userId).select("householdId");
    if(!user.householdId){
        return res.status(403).json({ message: "User is not a member of any household" });
    }
    const item = await itemModel.findOneAndDelete({ _id: itemId, householdId: user.householdId });
    if(!item) {
        return res.status(404).json({ message: "Item not found" });
    }
    res.status(200).json({ message: "Item deleted successfully", item });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});