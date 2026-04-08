const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { randomBytes } = require('crypto');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// BUG-009 FIX: Use crypto for collision-safe number generation
const generateWONumber = () => `WO-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;

// BUG-012 FIX: Enforce valid WO status transitions
const WO_STATUS_TRANSITIONS = {
    draft:      ['pending', 'cancelled'],
    pending:    ['in_process', 'on_hold', 'cancelled'],
    in_process: ['completed', 'on_hold', 'cancelled'],
    on_hold:    ['in_process', 'cancelled'],
    completed:  [],
    cancelled:  []
};

// GET /api/work-orders
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, priority, search } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) { params.push(status); whereClause += ` AND wo.status = $${params.length}`; }
        if (priority) { params.push(priority); whereClause += ` AND wo.priority = $${params.length}`; }
        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (wo.wo_number ILIKE $${params.length} OR wo.product_name ILIKE $${params.length} OR wo.product_code ILIKE $${params.length})`;
        }

        const countResult = await db.query(`SELECT COUNT(*) FROM work_orders wo ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT wo.*, b.bom_number, u.name as created_by_name, pm.name as production_manager_name
       FROM work_orders wo
       LEFT JOIN boms b ON wo.bom_id = b.id
       LEFT JOIN users u ON wo.created_by = u.id
       LEFT JOIN users pm ON wo.production_manager = pm.id
       ${whereClause} ORDER BY 
       CASE wo.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
       wo.planned_start ASC NULLS LAST, wo.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/work-orders/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const wo = await db.query(
            `SELECT wo.*, b.bom_number, b.product_name as bom_product, u.name as created_by_name
       FROM work_orders wo LEFT JOIN boms b ON wo.bom_id = b.id LEFT JOIN users u ON wo.created_by = u.id
       WHERE wo.id = $1`,
            [req.params.id]
        );
        if (!wo.rows.length) return res.status(404).json({ success: false, message: 'Work order not found.' });

        const materials = await db.query(
            `SELECT wom.*, m.name as material_name, m.code as material_code, m.unit, mb.batch_number
       FROM work_order_materials wom
       JOIN materials m ON wom.material_id = m.id
       LEFT JOIN material_batches mb ON wom.batch_id = mb.id
       WHERE wom.wo_id = $1`,
            [req.params.id]
        );

        const operations = await db.query(
            `SELECT woo.*, mc.name as machine_name, mc.machine_code, u.name as operator_name
       FROM work_order_operations woo
       LEFT JOIN machines mc ON woo.machine_id = mc.id
       LEFT JOIN users u ON woo.operator_id = u.id
       WHERE woo.wo_id = $1 ORDER BY woo.sequence_number`,
            [req.params.id]
        );

        const parts = await db.query(
            'SELECT id, serial_number, status, created_at FROM parts WHERE wo_id = $1 ORDER BY created_at DESC LIMIT 20',
            [req.params.id]
        );

        res.json({ success: true, data: { ...wo.rows[0], materials: materials.rows, operations: operations.rows, parts: parts.rows } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/work-orders
router.post('/', auth, authorize('admin', 'production_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { bom_id, product_name, product_code, planned_quantity, planned_start, planned_end, priority, customer_order, notes, materials, operations, production_manager } = req.body;
        const woNumber = generateWONumber();

        const result = await client.query(
            `INSERT INTO work_orders (wo_number, bom_id, product_name, product_code, planned_quantity, planned_start, planned_end, priority, customer_order, notes, created_by, production_manager)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [woNumber, bom_id, product_name, product_code, planned_quantity, planned_start, planned_end, priority || 'normal', customer_order, notes, req.user.id, production_manager || req.user.id]
        );
        const woId = result.rows[0].id;

        if (materials && materials.length) {
            for (const mat of materials) {
                await client.query(
                    `INSERT INTO work_order_materials (wo_id, material_id, batch_id, required_quantity)
           VALUES ($1,$2,$3,$4)`,
                    [woId, mat.material_id, mat.batch_id, mat.required_quantity]
                );
            }
        }

        if (operations && operations.length) {
            for (const op of operations) {
                await client.query(
                    `INSERT INTO work_order_operations (wo_id, operation_name, operation_type, sequence_number, machine_id, operator_id, planned_hours, planned_quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [woId, op.operation_name, op.operation_type, op.sequence_number, op.machine_id, op.operator_id, op.planned_hours, op.planned_quantity || planned_quantity]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    } finally {
        client.release();
    }
});

// PUT /api/work-orders/:id/status — BUG-012 FIX: enforce valid transitions
router.put('/:id/status', auth, authorize('admin', 'production_manager', 'machine_operator'), async (req, res) => {
    try {
        const { status } = req.body;

        // Fetch current status
        const current = await db.query('SELECT status FROM work_orders WHERE id=$1', [req.params.id]);
        if (!current.rows.length) return res.status(404).json({ success: false, message: 'Work order not found.' });

        const currentStatus = current.rows[0].status;
        const allowed = WO_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition from '${currentStatus}' to '${status}'. Allowed: [${allowed.join(', ') || 'none'}]`
            });
        }

        let updateData = 'status=$1, updated_at=NOW()';
        const params = [status];
        if (status === 'in_process') { updateData += ', actual_start=NOW()'; }
        if (status === 'completed') { updateData += ', actual_end=NOW()'; }

        params.push(req.params.id);
        const result = await db.query(`UPDATE work_orders SET ${updateData} WHERE id=$${params.length} RETURNING *`, params);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/work-orders/operations/:id — BUG-002 FIX: 404 check before side-effects; guard null machine_id
router.put('/operations/:id', auth, async (req, res) => {
    try {
        const { machine_id, operator_id, actual_start, actual_end, output_quantity, rejected_quantity, status, notes } = req.body;

        let actual_hours = null;
        if (actual_start && actual_end) {
            actual_hours = (new Date(actual_end) - new Date(actual_start)) / 3600000;
        }

        const result = await db.query(
            `UPDATE work_order_operations SET machine_id=$1, operator_id=$2, actual_start=$3, actual_end=$4,
       output_quantity=$5, rejected_quantity=$6, status=$7, notes=$8, actual_hours=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
            [machine_id, operator_id, actual_start, actual_end, output_quantity, rejected_quantity || 0, status, notes, actual_hours, req.params.id]
        );

        // BUG-002 FIX: check existence BEFORE touching other tables
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Operation not found.' });

        // Only update machine status if machine_id is provided
        if (machine_id) {
            if (actual_start && status === 'in_progress') {
                await db.query("UPDATE machines SET status='in_use', updated_at=NOW() WHERE id=$1", [machine_id]);
            }
            if (status === 'completed' && actual_end) {
                await db.query("UPDATE machines SET status='available', updated_at=NOW() WHERE id=$1", [machine_id]);
                if (actual_start) {
                    await db.query(
                        `INSERT INTO machine_logs (machine_id, wo_operation_id, operator_id, start_time, end_time, run_time_hours, output_quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                        [machine_id, req.params.id, operator_id, actual_start, actual_end, actual_hours, output_quantity]
                    );
                }
            }
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/work-orders/:id/generate-parts
router.post('/:id/generate-parts', auth, authorize('admin', 'production_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { quantity } = req.body;

        const wo = await client.query('SELECT * FROM work_orders WHERE id = $1', [req.params.id]);
        if (!wo.rows.length) throw new Error('Work order not found');

        const generatedParts = [];
        for (let i = 0; i < quantity; i++) {
            const serialNumber = `SN-${wo.rows[0].product_code}-${Date.now()}-${i + 1}`;
            const qrCode = `QR-${uuidv4()}`;

            const partResult = await client.query(
                `INSERT INTO parts (serial_number, qr_code, wo_id, bom_id, product_name, product_code, batch_number)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [serialNumber, qrCode, req.params.id, wo.rows[0].bom_id, wo.rows[0].product_name, wo.rows[0].product_code, `BATCH-${wo.rows[0].wo_number}`]
            );

            await client.query(
                `INSERT INTO part_history (part_id, event_type, event_description, operator_id)
         VALUES ($1, 'created', $2, $3)`,
                [partResult.rows[0].id, `Part created for Work Order ${wo.rows[0].wo_number}`, req.user.id]
            );

            generatedParts.push(partResult.rows[0]);
        }

        await client.query(
            'UPDATE work_orders SET produced_quantity = produced_quantity + $1, updated_at = NOW() WHERE id = $2',
            [quantity, req.params.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, data: generatedParts, message: `${quantity} parts generated.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Server error.' });
    } finally {
        client.release();
    }
});

module.exports = router;
