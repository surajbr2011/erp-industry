const express = require('express');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const generateInspectionNumber = () => `INS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

// GET /api/inspections
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, wo_id, inspector_id } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) { params.push(status); whereClause += ` AND i.overall_status = $${params.length}`; }
        if (wo_id) { params.push(wo_id); whereClause += ` AND i.wo_id = $${params.length}`; }
        if (inspector_id) { params.push(inspector_id); whereClause += ` AND i.inspector_id = $${params.length}`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM inspections i ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT i.*, u.name as inspector_name, wo.wo_number, wo.product_name, p.serial_number
       FROM inspections i
       LEFT JOIN users u ON i.inspector_id = u.id
       LEFT JOIN work_orders wo ON i.wo_id = wo.id
       LEFT JOIN parts p ON i.part_id = p.id
       ${whereClause} ORDER BY i.inspection_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/inspections/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const inspection = await db.query(
            `SELECT i.*, u.name as inspector_name, wo.wo_number, wo.product_name, p.serial_number
       FROM inspections i LEFT JOIN users u ON i.inspector_id = u.id
       LEFT JOIN work_orders wo ON i.wo_id = wo.id LEFT JOIN parts p ON i.part_id = p.id
       WHERE i.id = $1`,
            [req.params.id]
        );
        if (!inspection.rows.length) return res.status(404).json({ success: false, message: 'Inspection not found.' });

        const results = await db.query(
            'SELECT * FROM inspection_results WHERE inspection_id = $1',
            [req.params.id]
        );

        res.json({ success: true, data: { ...inspection.rows[0], results: results.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/inspections
router.post('/', auth, authorize('admin', 'quality_inspector', 'production_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { plan_id, wo_id, wo_operation_id, part_id, inspection_type, quantity_inspected, remarks, results } = req.body;
        const inspectionNumber = generateInspectionNumber();

        // Calculate pass/fail counts
        let passCount = 0, failCount = 0, reworkCount = 0;
        if (results) {
            results.forEach(r => {
                if (r.status === 'pass') passCount++;
                else if (r.status === 'fail') failCount++;
                else if (r.status === 'rework') reworkCount++;
            });
        }

        let overallStatus = 'passed';
        if (failCount > 0) overallStatus = 'failed';
        else if (reworkCount > 0) overallStatus = 'rework_required';

        const result = await client.query(
            `INSERT INTO inspections (inspection_number, plan_id, wo_id, wo_operation_id, part_id, inspector_id, inspection_type, quantity_inspected, quantity_passed, quantity_failed, quantity_rework, overall_status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [inspectionNumber, plan_id, wo_id, wo_operation_id, part_id, req.user.id, inspection_type, quantity_inspected,
                Math.round(quantity_inspected * passCount / (results?.length || 1)),
                Math.round(quantity_inspected * failCount / (results?.length || 1)),
                Math.round(quantity_inspected * reworkCount / (results?.length || 1)),
                overallStatus, remarks]
        );
        const inspectionId = result.rows[0].id;

        if (results && results.length) {
            for (const r of results) {
                const deviation = r.measured_value && r.nominal_value ? r.measured_value - r.nominal_value : null;
                await client.query(
                    `INSERT INTO inspection_results (inspection_id, plan_item_id, parameter_name, measured_value, status, deviation, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [inspectionId, r.plan_item_id, r.parameter_name, r.measured_value, r.status, deviation, r.notes]
                );
            }
        }

        // Update part status if applicable
        if (part_id) {
            const newPartStatus = overallStatus === 'passed' ? 'passed' :
                overallStatus === 'failed' ? 'failed' : 'rework';
            await client.query('UPDATE parts SET status=$1, updated_at=NOW() WHERE id=$2', [newPartStatus, part_id]);

            await client.query(
                `INSERT INTO part_history (part_id, event_type, event_description, operator_id, inspection_id)
         VALUES ($1, 'inspection', $2, $3, $4)`,
                [part_id, `Inspection ${overallStatus}: ${remarks || ''}`, req.user.id, inspectionId]
            );
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

// GET /api/inspections/plans/all
router.get('/plans/all', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ip.*, b.product_name, b.bom_number,
       (SELECT COUNT(*) FROM inspection_plan_items WHERE plan_id = ip.id) as item_count
       FROM inspection_plans ip LEFT JOIN boms b ON ip.bom_id = b.id ORDER BY ip.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/inspections/plans
router.post('/plans', auth, authorize('admin', 'quality_inspector'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { bom_id, product_code, inspection_type, name, description, items } = req.body;

        const result = await client.query(
            'INSERT INTO inspection_plans (bom_id, product_code, inspection_type, name, description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
            [bom_id, product_code, inspection_type, name, description]
        );
        const planId = result.rows[0].id;

        if (items && items.length) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO inspection_plan_items (plan_id, parameter_name, parameter_type, nominal_value, upper_tolerance, lower_tolerance, unit, is_critical, measurement_method)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [planId, item.parameter_name, item.parameter_type, item.nominal_value, item.upper_tolerance, item.lower_tolerance, item.unit, item.is_critical || false, item.measurement_method]
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

module.exports = router;
