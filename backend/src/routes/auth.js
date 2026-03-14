const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }

        // Update last login
        await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// PUT /api/auth/change-password
router.put('/change-password', auth, [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.user.id]);

        res.json({ success: true, message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
