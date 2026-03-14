const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult, query } = require('express-validator');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', auth, authorize('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length})`;
        }
        if (role) {
            params.push(role);
            whereClause += ` AND role = $${params.length}`;
        }

        const countResult = await db.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);

        params.push(limit, offset);
        const result = await db.query(
            `SELECT id, name, email, role, department, phone, is_active, last_login, created_at 
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/users
router.post('/', auth, authorize('admin'), [
    body('name').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['admin', 'purchase_manager', 'production_manager', 'machine_operator', 'quality_inspector'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { name, email, password, role, department, phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            `INSERT INTO users (name, email, password, role, department, phone) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, department, phone`,
            [name, email, hashedPassword, role, department, phone]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Email already exists.' });
        }
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/users/:id
router.put('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const { name, role, department, phone, is_active } = req.body;

        const result = await db.query(
            `UPDATE users SET name=$1, role=$2, department=$3, phone=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id, name, email, role, department, phone, is_active`,
            [name, role, department, phone, is_active, req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /api/users/:id
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete yourself.' });
        }

        await db.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: 'User deactivated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
