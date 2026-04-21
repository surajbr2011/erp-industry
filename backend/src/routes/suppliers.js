const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const { parseExcel, exportToExcel } = require('../utils/excel');

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// GET /api/suppliers
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            whereClause += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length} OR contact_person ILIKE $${params.length})`;
        }
        if (status) {
            params.push(status);
            whereClause += ` AND status = $${params.length}`;
        }

        const countResult = await db.query(`SELECT COUNT(*) FROM suppliers ${whereClause}`, params);
        params.push(limit, offset);
        const result = await db.query(
            `SELECT * FROM suppliers ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({
            success: true,
            data: result.rows,
            pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/suppliers/export/template — BUG-005 FIX: before /:id to prevent shadowing
router.get('/export/template', auth, (req, res) => {
    const template = [
        { Code: 'SUP-001', Name: 'Example Supplier', 'Contact Person': 'John Doe', Email: 'john@example.com', Phone: '1234567890', 'GST Number': '27AAAAA0000A1Z5' }
    ];
    const buffer = exportToExcel(template);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=suppliers_template.xlsx');
    res.send(buffer);
});

// GET /api/suppliers/export/all — BUG-005 FIX: before /:id
router.get('/export/all', auth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM suppliers ORDER BY name ASC');
        const buffer = exportToExcel(result.rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=suppliers.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Export failed.' });
    }
});

// GET /api/suppliers/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Supplier not found.' });

        // Get recent POs for this supplier
        const posResult = await db.query(
            'SELECT id, po_number, order_date, status, total_amount FROM purchase_orders WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 5',
            [req.params.id]
        );

        res.json({ success: true, data: { ...result.rows[0], recent_orders: posResult.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/suppliers
router.post('/', auth, authorize('admin', 'purchase_manager'), [
    body('name').notEmpty().trim(),
    body('code').notEmpty().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { name, code, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, notes } = req.body;

        const result = await db.query(
            `INSERT INTO suppliers (name, code, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [name, code, contact_person, email, phone, address, city, state, country || 'India', pincode, gst_number, payment_terms, lead_time_days || 0, notes]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE' || (error.message && error.message.includes('UNIQUE constraint failed'))) return res.status(409).json({ success: false, message: 'Supplier code already exists.' });
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/suppliers/:id
router.put('/:id', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    try {
        const { name, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, status, notes, rating } = req.body;

        const result = await db.query(
            `UPDATE suppliers SET name=$1, contact_person=$2, email=$3, phone=$4, address=$5, city=$6, 
       state=$7, country=$8, pincode=$9, gst_number=$10, payment_terms=$11, lead_time_days=$12, 
       status=$13, notes=$14, rating=$15, updated_at=NOW() WHERE id=$16 RETURNING *`,
            [name, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, status, notes, rating, req.params.id]
        );

        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Supplier not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// DELETE /api/suppliers/:id
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        await db.query("UPDATE suppliers SET status='inactive', updated_at=NOW() WHERE id=$1", [req.params.id]);
        res.json({ success: true, message: 'Supplier deactivated.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/suppliers/export/template — original location removed (moved above /:id)
// GET /api/suppliers/export/all — original location removed (moved above /:id)

// POST /api/suppliers/bulk-upload — BUG-005 + BUG-015 FIX
router.post('/bulk-upload', auth, authorize('admin', 'purchase_manager'), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    try {
        const data = parseExcel(req.file.buffer);
        let imported = 0;
        const errorDetails = [];
        for (const [idx, row] of data.entries()) {
            try {
                const code = row.Code || row.code || row['Supplier Code'];
                const name = row.Name || row.name || row['Supplier Name'];
                if (!code || !name) { errorDetails.push({ row: idx + 2, reason: 'Missing Code or Name' }); continue; }
                const contact_person = row['Contact Person'] || row.contact_person || '';
                const email          = row.Email            || row.email            || '';
                const phone          = row.Phone            || row.phone            || '';
                const gst_number     = row['GST Number']    || row.gst_number      || '';
                await db.query(
                    `INSERT INTO suppliers (code, name, contact_person, email, phone, gst_number)
                     VALUES ($1,$2,$3,$4,$5,$6)
                     ON CONFLICT (code) DO UPDATE SET
                     name=EXCLUDED.name, contact_person=EXCLUDED.contact_person,
                     email=EXCLUDED.email, phone=EXCLUDED.phone, gst_number=EXCLUDED.gst_number`,
                    [code, name, contact_person, email, phone, gst_number]
                );
                imported++;
            } catch (err) {
                console.error('Row error:', err);
                errorDetails.push({ row: idx + 2, code: row.Code || row.code, reason: err.message });
            }
        }
        res.json({ success: true, message: `Imported ${imported} suppliers. Errors: ${errorDetails.length}`, errorDetails });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Upload failed.' });
    }
});

module.exports = router;
