const express = require('express');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const generateFGCode = () => `FG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
const generateDispatchNumber = () => `DISP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

// GET /api/finished-goods
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, quality_status } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (fg.product_name ILIKE $${params.length} OR fg.item_code ILIKE $${params.length})`;
        }
        if (quality_status) { params.push(quality_status); whereClause += ` AND fg.quality_status = $${params.length}`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM finished_goods fg ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT fg.*, wo.wo_number FROM finished_goods fg
       LEFT JOIN work_orders wo ON fg.wo_id = wo.id
       ${whereClause} ORDER BY fg.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/finished-goods
router.post('/', auth, authorize('admin', 'production_manager', 'quality_inspector'), async (req, res) => {
    try {
        const { product_name, product_code, wo_id, quantity, unit, batch_number, manufacturing_date, expiry_date, storage_location, unit_cost, notes } = req.body;
        const itemCode = generateFGCode();

        const result = await db.query(
            `INSERT INTO finished_goods (item_code, product_name, product_code, wo_id, quantity, available_quantity, unit, batch_number, manufacturing_date, expiry_date, storage_location, unit_cost, total_cost, notes)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [itemCode, product_name, product_code, wo_id, quantity, unit || 'pcs', batch_number, manufacturing_date, expiry_date, storage_location, unit_cost || 0, (unit_cost || 0) * quantity, notes]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/finished-goods/dispatches/all — BUG-010 FIX: added pagination
router.get('/dispatches/all', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];
        if (status) { params.push(status); whereClause += ` AND dl.status = $${params.length}`; }

        const countResult = await db.query(
            `SELECT COUNT(*) FROM dispatch_logs dl ${whereClause}`, params
        );

        params.push(limit, offset);
        const result = await db.query(
            `SELECT dl.*, fg.product_name, fg.item_code, u.name as created_by_name
       FROM dispatch_logs dl JOIN finished_goods fg ON dl.finished_good_id = fg.id
       LEFT JOIN users u ON dl.created_by = u.id
       ${whereClause} ORDER BY dl.dispatch_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        res.json({
            success: true,
            data: result.rows,
            pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/finished-goods/:id/dispatch
router.post('/:id/dispatch', auth, authorize('admin', 'production_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { customer_name, customer_address, dispatch_date, quantity, delivery_challan, invoice_number, transporter, vehicle_number, notes } = req.body;

        const fg = await client.query('SELECT * FROM finished_goods WHERE id = $1', [req.params.id]);
        if (!fg.rows.length) throw new Error('Finished goods not found');
        if (parseFloat(fg.rows[0].available_quantity) < parseFloat(quantity)) throw new Error('Insufficient available quantity');

        const dispatchNumber = generateDispatchNumber();
        const result = await client.query(
            `INSERT INTO dispatch_logs (dispatch_number, finished_good_id, customer_name, customer_address, dispatch_date, quantity, delivery_challan, invoice_number, transporter, vehicle_number, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'dispatched',$12) RETURNING *`,
            [dispatchNumber, req.params.id, customer_name, customer_address, dispatch_date, quantity, delivery_challan, invoice_number, transporter, vehicle_number, notes, req.user.id]
        );

        await client.query(
            'UPDATE finished_goods SET available_quantity = available_quantity - $1, updated_at = NOW() WHERE id = $2',
            [quantity, req.params.id]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Server error.' });
    } finally {
        client.release();
    }
});

module.exports = router;
