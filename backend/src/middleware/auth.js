const jwt = require('jsonwebtoken');
const db = require('../config/database');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const result = await db.query(
            'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (!result.rows.length || !result.rows[0].is_active) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required roles: ${roles.join(', ')}`
            });
        }
        next();
    };
};

module.exports = { auth, authorize };
