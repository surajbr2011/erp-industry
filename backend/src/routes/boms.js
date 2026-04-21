const express = require('express');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const generateBOMNumber = () => `BOM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

// GET /api/boms
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (b.product_name ILIKE $${params.length} OR b.product_code ILIKE $${params.length} OR b.bom_number ILIKE $${params.length})`;
        }
        if (status) { params.push(status); whereClause += ` AND b.status = $${params.length}`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM boms b ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT b.*, u.name as created_by_name,
       (SELECT COUNT(*) FROM bom_items WHERE bom_id = b.id) as item_count,
       (SELECT COUNT(*) FROM bom_operations WHERE bom_id = b.id) as operation_count,
       (SELECT COUNT(*) FROM work_orders WHERE bom_id = b.id) as work_order_count
       FROM boms b LEFT JOIN users u ON b.created_by = u.id
       ${whereClause} ORDER BY b.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/boms/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const bom = await db.query(
            `SELECT b.*, u.name as created_by_name, a.name as approved_by_name FROM boms b
       LEFT JOIN users u ON b.created_by = u.id LEFT JOIN users a ON b.approved_by = a.id WHERE b.id = $1`,
            [req.params.id]
        );
        if (!bom.rows.length) return res.status(404).json({ success: false, message: 'BOM not found.' });

        const items = await db.query(
            `SELECT bi.*, m.code as material_code, m.current_stock, m.unit as material_unit FROM bom_items bi
       LEFT JOIN materials m ON bi.material_id = m.id WHERE bi.bom_id = $1 ORDER BY bi.sequence_number`,
            [req.params.id]
        );
        const operations = await db.query(
            'SELECT * FROM bom_operations WHERE bom_id = $1 ORDER BY sequence_number',
            [req.params.id]
        );

        res.json({ success: true, data: { ...bom.rows[0], items: items.rows, operations: operations.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/boms
router.post('/', auth, authorize('admin', 'production_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { product_name, product_code, version, description, drawing_number, revision_date, notes, items, operations } = req.body;
        const bomNumber = generateBOMNumber();

        const result = await client.query(
            `INSERT INTO boms (bom_number, product_name, product_code, version, description, drawing_number, revision_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [bomNumber, product_name, product_code, version || '1.0', description, drawing_number, revision_date, notes, req.user.id]
        );
        const bomId = result.rows[0].id;

        if (items && items.length) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO bom_items (bom_id, material_id, material_name, quantity, unit, scrap_percentage, sequence_number, is_critical, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [bomId, item.material_id, item.material_name, item.quantity, item.unit, item.scrap_percentage || 0, item.sequence_number || 1, item.is_critical || false, item.notes]
                );
            }
        }

        if (operations && operations.length) {
            for (const op of operations) {
                await client.query(
                    `INSERT INTO bom_operations (bom_id, operation_name, operation_type, sequence_number, estimated_time_hours, machine_type, skill_required, instructions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [bomId, op.operation_name, op.operation_type, op.sequence_number, op.estimated_time_hours, op.machine_type, op.skill_required, op.instructions]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE' || (error.message && error.message.includes('UNIQUE constraint failed'))) return res.status(409).json({ success: false, message: 'Product code already exists.' });
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    } finally {
        client.release();
    }
});

// PUT /api/boms/:id
router.put('/:id', auth, authorize('admin', 'production_manager'), async (req, res) => {
    try {
        const { product_name, version, description, drawing_number, status, notes } = req.body;

        let queryStr = `UPDATE boms SET product_name=$1, version=$2, description=$3, drawing_number=$4, status=$5, notes=$6, updated_at=NOW()`;
        const params = [product_name, version, description, drawing_number, status, notes];

        if (status === 'active') {
            queryStr += `, approved_by=$7, approved_at=NOW() WHERE id=$8 RETURNING *`;
            params.push(req.user.id, req.params.id);
        } else {
            queryStr += ` WHERE id=$7 RETURNING *`;
            params.push(req.params.id);
        }

        const result = await db.query(queryStr, params);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'BOM not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
