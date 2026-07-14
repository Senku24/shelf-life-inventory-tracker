const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

async function authmiddleware(req, res, next) {
    const token = req.headers.token;

    if(!token) {
        return res.status(401).json({ message: "not logged in!" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    if(!userId){
            res.status(403).json({
                message: "incorrect token"
            })
            return;
        }
    req.userId = userId;

    next();
}

module.exports = authmiddleware;