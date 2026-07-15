const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

function authmiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.headers.token;

    if (!token) {
        return res.status(401).json({ message: "Not logged in" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.userId) {
            return res.status(401).json({ message: "Invalid token" });
        }
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

module.exports = authmiddleware;
