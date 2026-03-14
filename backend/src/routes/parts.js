const express = require('express');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/parts - Search and list parts
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, serial_number, product_code, status, wo_id } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (serial_number) {
            params.push(`%${serial_number}%`);
            whereClause += ` AND p.serial_number ILIKE $${params.length}`;
        }
        if (product_code) { params.push(`%${product_code}%`); whereClause += ` AND p.product_code ILIKE $${params.length}`; }
        if (status) { params.push(status); whereClause += ` AND p.status = $${params.length}`; }
        if (wo_id) { params.push(wo_id); whereClause += ` AND p.wo_id = $${params.length}`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM parts p ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT p.*, wo.wo_number, b.bom_number FROM parts p
       LEFT JOIN work_orders wo ON p.wo_id = wo.id
       LEFT JOIN boms b ON p.bom_id = b.id
       ${whereClause} ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/parts/:serial - Full traceability by serial number
router.get('/trace/:serial', auth, async (req, res) => {
    try {
        const part = await db.query(
            `SELECT p.*, wo.wo_number, wo.planned_quantity, wo.customer_order,
       b.bom_number, b.product_name as bom_product, b.drawing_number
       FROM parts p
       LEFT JOIN work_orders wo ON p.wo_id = wo.id
       LEFT JOIN boms b ON p.bom_id = b.id
       WHERE p.serial_number = $1 OR p.qr_code = $1`,
            [req.params.serial]
        );
        if (!part.rows.length) return res.status(404).json({ success: false, message: 'Part not found.' });

        const history = await db.query(
            `SELECT ph.*, mc.name as machine_name, mc.machine_code, u.name as operator_name,
       mb.batch_number as material_batch, i.inspection_number
       FROM part_history ph
       LEFT JOIN machines mc ON ph.machine_id = mc.id
       LEFT JOIN users u ON ph.operator_id = u.id
       LEFT JOIN material_batches mb ON ph.material_batch_id = mb.id
       LEFT JOIN inspections i ON ph.inspection_id = i.id
       WHERE ph.part_id = $1 ORDER BY ph.created_at ASC`,
            [part.rows[0].id]
        );

        const inspections = await db.query(
            `SELECT i.*, u.name as inspector_name FROM inspections i
       LEFT JOIN users u ON i.inspector_id = u.id
       WHERE i.part_id = $1 ORDER BY i.inspection_date DESC`,
            [part.rows[0].id]
        );

        // Get material batches used for the work order
        const materials = await db.query(
            `SELECT wom.*, m.name as material_name, m.code as material_code, mb.batch_number, mb.heat_number, s.name as supplier_name
       FROM work_order_materials wom
       JOIN materials m ON wom.material_id = m.id
       LEFT JOIN material_batches mb ON wom.batch_id = mb.id
       LEFT JOIN suppliers s ON mb.supplier_id = s.id
       WHERE wom.wo_id = $1`,
            [part.rows[0].wo_id]
        );

        res.json({
            success: true,
            data: {
                part: part.rows[0],
                history: history.rows,
                inspections: inspections.rows,
                materials: materials.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/parts/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const part = await db.query(
            `SELECT p.*, wo.wo_number, b.bom_number FROM parts p
       LEFT JOIN work_orders wo ON p.wo_id = wo.id
       LEFT JOIN boms b ON p.bom_id = b.id
       WHERE p.id = $1`,
            [req.params.id]
        );
        if (!part.rows.length) return res.status(404).json({ success: false, message: 'Part not found.' });

        const history = await db.query(
            `SELECT ph.*, u.name as operator_name FROM part_history ph
       LEFT JOIN users u ON ph.operator_id = u.id WHERE ph.part_id = $1 ORDER BY ph.created_at ASC`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...part.rows[0], history: history.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/parts/:id/status
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const result = await db.query(
            "UPDATE parts SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
            [status, req.params.id]
        );

        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Part not found.' });

        // Log to part history
        await db.query(
            `INSERT INTO part_history (part_id, event_type, event_description, operator_id)
       VALUES ($1, 'status_change', $2, $3)`,
            [req.params.id, `Status changed to ${status}. ${notes || ''}`, req.user.id]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
