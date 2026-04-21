const express = require('express');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const { parseExcel, exportToExcel } = require('../utils/excel');

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// GET /api/materials
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, low_stock } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (code ILIKE $${params.length} OR name ILIKE $${params.length} OR category ILIKE $${params.length})`;
        }
        if (category) { params.push(category); whereClause += ` AND category = $${params.length}`; }
        if (low_stock === 'true') { whereClause += ` AND current_stock <= reorder_point`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM materials ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT * FROM materials ${whereClause} ORDER BY 
       CASE WHEN current_stock <= minimum_stock THEN 0 WHEN current_stock <= reorder_point THEN 1 ELSE 2 END, 
       name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/materials/batches/all — BUG-003 FIX: before /:id to prevent shadowing
router.get('/batches/all', auth, async (req, res) => {
    try {
        const { material_id, qc_status } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];
        if (material_id) { params.push(material_id); whereClause += ` AND mb.material_id = $${params.length}`; }
        if (qc_status)   { params.push(qc_status);   whereClause += ` AND mb.qc_status = $${params.length}`; }
        const result = await db.query(
            `SELECT mb.*, m.name as material_name, m.code as material_code, m.unit, s.name as supplier_name
       FROM material_batches mb
       JOIN materials m ON mb.material_id = m.id
       LEFT JOIN suppliers s ON mb.supplier_id = s.id
       ${whereClause} ORDER BY mb.received_date DESC LIMIT 100`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/materials/export/template — BUG-003 FIX: before /:id
router.get('/export/template', auth, (req, res) => {
    const template = [
        { Code: 'MAT-001', Name: 'Example Material', Description: 'Description here', Category: 'Steel', Unit: 'kg', Cost: 100 }
    ];
    const buffer = exportToExcel(template);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=materials_template.xlsx');
    res.send(buffer);
});

// GET /api/materials/export/all — BUG-003 FIX: before /:id
router.get('/export/all', auth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM materials ORDER BY name ASC');
        const buffer = exportToExcel(result.rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=materials.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Export failed.' });
    }
});

// GET /api/materials/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const material = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
        if (!material.rows.length) return res.status(404).json({ success: false, message: 'Material not found.' });

        const batches = await db.query(
            `SELECT mb.*, s.name as supplier_name FROM material_batches mb
       LEFT JOIN suppliers s ON mb.supplier_id = s.id WHERE mb.material_id = $1 ORDER BY mb.received_date DESC LIMIT 10`,
            [req.params.id]
        );

        const transactions = await db.query(
            `SELECT it.*, u.name as created_by_name FROM inventory_transactions it
       LEFT JOIN users u ON it.created_by = u.id WHERE it.material_id = $1 ORDER BY it.created_at DESC LIMIT 20`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...material.rows[0], batches: batches.rows, transactions: transactions.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/materials
router.post('/', auth, authorize('admin', 'purchase_manager', 'production_manager'), async (req, res) => {
    try {
        const { code, name, description, category, unit, minimum_stock, reorder_point, unit_cost, material_type, specifications, hsn_code } = req.body;

        const result = await db.query(
            `INSERT INTO materials (code, name, description, category, unit, minimum_stock, reorder_point, unit_cost, material_type, specifications, hsn_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [code, name, description, category, unit, minimum_stock || 0, reorder_point || 0, unit_cost || 0, material_type || 'raw_material', specifications, hsn_code]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE' || (error.message && error.message.includes('UNIQUE constraint failed'))) return res.status(409).json({ success: false, message: 'Material code already exists.' });
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/materials/:id
router.put('/:id', auth, authorize('admin', 'purchase_manager', 'production_manager'), async (req, res) => {
    try {
        const { name, description, category, unit, minimum_stock, reorder_point, unit_cost, material_type, specifications, hsn_code, is_active } = req.body;

        const result = await db.query(
            `UPDATE materials SET name=$1, description=$2, category=$3, unit=$4, minimum_stock=$5, reorder_point=$6, unit_cost=$7, material_type=$8, specifications=$9, hsn_code=$10, is_active=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
            [name, description, category, unit, minimum_stock, reorder_point, unit_cost, material_type, specifications, hsn_code, is_active !== undefined ? is_active : true, req.params.id]
        );

        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Material not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/materials/:id/adjust-stock
router.post('/:id/adjust-stock', auth, authorize('admin', 'production_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { adjustment, reason, batch_id } = req.body;

        const material = await client.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
        if (!material.rows.length) throw new Error('Material not found');

        const newStock = parseFloat(material.rows[0].current_stock) + parseFloat(adjustment);
        if (newStock < 0) throw new Error('Insufficient stock');

        await client.query('UPDATE materials SET current_stock = $1, updated_at = NOW() WHERE id = $2', [newStock, req.params.id]);

        await client.query(
            `INSERT INTO inventory_transactions (material_id, batch_id, transaction_type, quantity, notes, created_by)
       VALUES ($1,$2,'adjustment',$3,$4,$5)`,
            [req.params.id, batch_id, adjustment, reason, req.user.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Stock adjusted.', new_stock: newStock });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Server error.' });
    } finally {
        client.release();
    }
});

// GET /api/materials/batches/all
router.get('/batches/all', auth, async (req, res) => {
    try {
        const { material_id, qc_status } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (material_id) { params.push(material_id); whereClause += ` AND mb.material_id = $${params.length}`; }
        if (qc_status) { params.push(qc_status); whereClause += ` AND mb.qc_status = $${params.length}`; }

        const result = await db.query(
            `SELECT mb.*, m.name as material_name, m.code as material_code, m.unit, s.name as supplier_name
       FROM material_batches mb
       JOIN materials m ON mb.material_id = m.id
       LEFT JOIN suppliers s ON mb.supplier_id = s.id
       ${whereClause} ORDER BY mb.received_date DESC LIMIT 100`,
            params
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/materials/export/template — original location removed (moved above /:id)
// GET /api/materials/export/all — original location removed (moved above /:id)

// POST /api/materials/bulk-upload — BUG-015 FIX: per-row error details returned
router.post('/bulk-upload', auth, authorize('admin', 'purchase_manager'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    try {
        const data = parseExcel(req.file.buffer);
        let imported = 0;
        const errorDetails = [];
        for (const [idx, row] of data.entries()) {
            try {
                const code = row.Code || row.code || row['Material Code'] || row['Item Code'];
                const name = row.Name || row.name || row['Material Name'] || row['Item Name'];
                if (!code || !name) { errorDetails.push({ row: idx + 2, reason: 'Missing Code or Name' }); continue; }
                const description = row.Description || row.description || '';
                const category    = row.Category    || row.category    || 'General';
                const unit        = row.Unit        || row.unit        || 'pcs';
                const unit_cost   = parseFloat(row.Cost || row.cost || row['Unit Cost'] || 0);
                await db.query(
                    `INSERT INTO materials (code, name, description, category, unit, unit_cost)
                     VALUES ($1,$2,$3,$4,$5,$6)
                     ON CONFLICT (code) DO UPDATE SET
                     name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category, unit=EXCLUDED.unit, unit_cost=EXCLUDED.unit_cost`,
                    [code, name, description, category, unit, unit_cost]
                );
                imported++;
            } catch (err) {
                console.error('Row error:', err);
                errorDetails.push({ row: idx + 2, code: row.Code || row.code, reason: err.message });
            }
        }
        res.json({ success: true, message: `Imported ${imported} materials. Errors: ${errorDetails.length}`, errorDetails });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Upload failed.' });
    }
});

module.exports = router;
