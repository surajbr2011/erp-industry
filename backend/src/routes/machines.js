const express = require('express');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/machines
router.get('/', auth, async (req, res) => {
    try {
        const { status, machine_type } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) { params.push(status); whereClause += ` AND status = $${params.length}`; }
        if (machine_type) { params.push(machine_type); whereClause += ` AND machine_type = $${params.length}`; }

        const result = await db.query(`SELECT * FROM machines ${whereClause} ORDER BY machine_code`, params);

        // Get utilization data
        const utilization = await db.query(`
      SELECT machine_id, 
        ROUND(SUM(run_time_hours)::numeric, 2) as total_hours,
        COUNT(*) as job_count
      FROM machine_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY machine_id
    `);

        const utilizationMap = {};
        utilization.rows.forEach(u => utilizationMap[u.machine_id] = u);

        const data = result.rows.map(m => ({
            ...m,
            utilization_30d: utilizationMap[m.id] || { total_hours: 0, job_count: 0 }
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/machines/logs/all — BUG-004 FIX: must be before /:id to prevent route shadowing
router.get('/logs/all', auth, async (req, res) => {
    try {
        const { machine_id, from_date, to_date } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (machine_id) { params.push(machine_id); whereClause += ` AND ml.machine_id = $${params.length}`; }
        if (from_date) { params.push(from_date); whereClause += ` AND ml.start_time >= $${params.length}`; }
        if (to_date) { params.push(to_date); whereClause += ` AND ml.start_time <= $${params.length}`; }

        const result = await db.query(
            `SELECT ml.*, m.name as machine_name, m.machine_code, u.name as operator_name
       FROM machine_logs ml
       JOIN machines m ON ml.machine_id = m.id
       LEFT JOIN users u ON ml.operator_id = u.id
       ${whereClause} ORDER BY ml.start_time DESC LIMIT 100`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/machines/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const machine = await db.query('SELECT * FROM machines WHERE id = $1', [req.params.id]);
        if (!machine.rows.length) return res.status(404).json({ success: false, message: 'Machine not found.' });

        const logs = await db.query(
            `SELECT ml.*, u.name as operator_name, wo.wo_number, wo.product_name
       FROM machine_logs ml
       LEFT JOIN users u ON ml.operator_id = u.id
       LEFT JOIN work_order_operations woo ON ml.wo_operation_id = woo.id
       LEFT JOIN work_orders wo ON woo.wo_id = wo.id
       WHERE ml.machine_id = $1 ORDER BY ml.start_time DESC LIMIT 20`,
            [req.params.id]
        );

        const currentOp = await db.query(
            `SELECT woo.*, wo.wo_number, wo.product_name, u.name as operator_name
       FROM work_order_operations woo
       JOIN work_orders wo ON woo.wo_id = wo.id
       LEFT JOIN users u ON woo.operator_id = u.id
       WHERE woo.machine_id = $1 AND woo.status = 'in_progress'`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...machine.rows[0], logs: logs.rows, current_operation: currentOp.rows[0] || null } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/machines
router.post('/', auth, authorize('admin'), async (req, res) => {
    try {
        const { machine_code, name, machine_type, manufacturer, model, serial_number, location, capacity, hourly_rate, notes } = req.body;

        const result = await db.query(
            `INSERT INTO machines (machine_code, name, machine_type, manufacturer, model, serial_number, location, capacity, hourly_rate, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [machine_code, name, machine_type, manufacturer, model, serial_number, location, capacity, hourly_rate || 0, notes]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ success: false, message: 'Machine code already exists.' });
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/machines/:id
router.put('/:id', auth, authorize('admin', 'production_manager'), async (req, res) => {
    try {
        const { name, machine_type, manufacturer, model, location, capacity, status, hourly_rate, last_maintenance, next_maintenance, notes } = req.body;

        const result = await db.query(
            `UPDATE machines SET name=$1, machine_type=$2, manufacturer=$3, model=$4, location=$5, capacity=$6, 
       status=$7, hourly_rate=$8, last_maintenance=$9, next_maintenance=$10, notes=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
            [name, machine_type, manufacturer, model, location, capacity, status, hourly_rate, last_maintenance, next_maintenance, notes, req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Machine not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
