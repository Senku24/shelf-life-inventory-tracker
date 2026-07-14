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
    res.status(201).json({ message: "User created successfully", user: newUser });
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
        name: req.body.name,
        inviteCode: req.body.inviteCode,
        members: [userId]
    })
    res.status(201).json({ message: "Household created successfully", household: newHousehold._id });
});
app.post('/household/:join', authmiddleware, async (req, res) => {
    const userId = req.userId;
});
// read endpoints
// update endpoints
// delete endpoints


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});