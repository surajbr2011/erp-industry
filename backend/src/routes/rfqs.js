const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const generateRFQNumber = () => `RFQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
const generateQuotationNumber = () => `QUO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

// GET /api/rfqs
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) { params.push(status); whereClause += ` AND r.status = $${params.length}`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM rfqs r ${whereClause}`, params);
        params.push(limit, offset);

        const result = await db.query(
            `SELECT r.*, u.name as created_by_name,
       (SELECT COUNT(*) FROM quotations WHERE rfq_id = r.id) as quotation_count
       FROM rfqs r LEFT JOIN users u ON r.created_by = u.id
       ${whereClause} ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/rfqs/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const rfq = await db.query(
            `SELECT r.*, u.name as created_by_name FROM rfqs r LEFT JOIN users u ON r.created_by = u.id WHERE r.id = $1`,
            [req.params.id]
        );
        if (!rfq.rows.length) return res.status(404).json({ success: false, message: 'RFQ not found.' });

        const items = await db.query('SELECT * FROM rfq_items WHERE rfq_id = $1', [req.params.id]);
        const suppliers = await db.query(
            `SELECT rs.*, s.name as supplier_name, s.email as supplier_email FROM rfq_suppliers rs
       JOIN suppliers s ON rs.supplier_id = s.id WHERE rs.rfq_id = $1`,
            [req.params.id]
        );
        const quotations = await db.query(
            `SELECT q.*, s.name as supplier_name FROM quotations q
       JOIN suppliers s ON q.supplier_id = s.id WHERE q.rfq_id = $1`,
            [req.params.id]
        );

        res.json({ success: true, data: { ...rfq.rows[0], items: items.rows, suppliers: suppliers.rows, quotations: quotations.rows } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/rfqs
router.post('/', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    try {
        const { title, description, required_by, notes, items, supplier_ids } = req.body;
        const rfqNumber = generateRFQNumber();

        const rfqResult = await db.query(
            `INSERT INTO rfqs (rfq_number, title, description, required_by, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [rfqNumber, title, description, required_by, notes, req.user.id]
        );
        const rfqId = rfqResult.rows[0].id;

        if (items && items.length) {
            for (const item of items) {
                await db.query(
                    'INSERT INTO rfq_items (rfq_id, material_name, description, quantity, unit, specifications) VALUES ($1,$2,$3,$4,$5,$6)',
                    [rfqId, item.material_name, item.description, item.quantity, item.unit, item.specifications]
                );
            }
        }

        if (supplier_ids && supplier_ids.length) {
            for (const supplierId of supplier_ids) {
                await db.query('INSERT INTO rfq_suppliers (rfq_id, supplier_id) VALUES ($1,$2)', [rfqId, supplierId]);
            }
        }

        res.status(201).json({ success: true, data: rfqResult.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/rfqs/:id/send
router.put('/:id/send', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    try {
        await db.query("UPDATE rfqs SET status='sent', updated_at=NOW() WHERE id=$1", [req.params.id]);
        await db.query("UPDATE rfq_suppliers SET status='sent', sent_at=NOW() WHERE rfq_id=$1", [req.params.id]);
        res.json({ success: true, message: 'RFQ sent to suppliers.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/rfqs/:id/quotations
router.post('/:id/quotations', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    try {
        const { supplier_id, validity_date, payment_terms, delivery_days, notes, items } = req.body;
        const quotationNumber = generateQuotationNumber();

        const totalAmount = items ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0) : 0;

        const result = await db.query(
            `INSERT INTO quotations (quotation_number, rfq_id, supplier_id, validity_date, total_amount, payment_terms, delivery_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [quotationNumber, req.params.id, supplier_id, validity_date, totalAmount, payment_terms, delivery_days, notes]
        );
        const quotationId = result.rows[0].id;

        if (items && items.length) {
            for (const item of items) {
                await db.query(
                    `INSERT INTO quotation_items (quotation_id, material_name, quantity, unit, unit_price, total_price, tax_percentage, lead_time_days)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [quotationId, item.material_name, item.quantity, item.unit, item.unit_price, item.unit_price * item.quantity, item.tax_percentage || 18, item.lead_time_days]
                );
            }
        }

        await db.query("UPDATE rfq_suppliers SET status='responded' WHERE rfq_id=$1 AND supplier_id=$2", [req.params.id, supplier_id]);
        await db.query("UPDATE rfqs SET status='quotations_received', updated_at=NOW() WHERE id=$1", [req.params.id]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/rfqs/quotations/:id/approve
router.put('/quotations/:id/approve', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    try {
        const result = await db.query(
            "UPDATE quotations SET status='approved', updated_at=NOW() WHERE id=$1 RETURNING *",
            [req.params.id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Quotation not found.' });

        // Reject other quotations for the same RFQ
        await db.query(
            "UPDATE quotations SET status='rejected' WHERE rfq_id=$1 AND id!=$2",
            [result.rows[0].rfq_id, req.params.id]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
