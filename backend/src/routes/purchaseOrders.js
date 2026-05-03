const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// PO_023: Material name — letters, digits, spaces and standard punctuation only
const PO_MATERIAL_REGEX = /^[A-Za-z0-9\s\-_.,()/%]+$/;

const generatePONumber = () => `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

// GET /api/purchase-orders
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, supplier_id } = req.query;
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) { params.push(status); whereClause += ` AND po.status = $${params.length}`; }
        if (supplier_id) { params.push(supplier_id); whereClause += ` AND po.supplier_id = $${params.length}`; }

        const countResult = await db.query(`SELECT COUNT(*) FROM purchase_orders po ${whereClause}`, params);
        params.push(limit, offset);

        const result = await db.query(
            `SELECT po.*, s.name as supplier_name, u.name as created_by_name
       FROM purchase_orders po 
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.created_by = u.id
       ${whereClause} ORDER BY po.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ success: true, data: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/purchase-orders/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const po = await db.query(
            `SELECT po.*, s.name as supplier_name, s.address as supplier_address, s.gst_number,
       u.name as created_by_name, a.name as approved_by_name
       FROM purchase_orders po 
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       LEFT JOIN users u ON po.created_by = u.id
       LEFT JOIN users a ON po.approved_by = a.id
       WHERE po.id = $1`,
            [req.params.id]
        );
        if (!po.rows.length) return res.status(404).json({ success: false, message: 'Purchase order not found.' });

        const items = await db.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [req.params.id]);

        res.json({ success: true, data: { ...po.rows[0], items: items.rows } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/purchase-orders
router.post('/', auth, authorize('admin', 'purchase_manager'), [
    // Supplier must be selected
    body('supplier_id').notEmpty().withMessage('Supplier is required'),
    // PO_027: Payment Terms is required
    body('payment_terms').notEmpty().withMessage('Payment Terms is required'),
    // At least one item
    body('items').isArray({ min: 1 }).withMessage('At least one PO item is required'),
    // PO_023: each item material_name must be valid
    body('items.*.material_name')
        .notEmpty().withMessage('Material name is required for all items')
        .matches(PO_MATERIAL_REGEX)
        .withMessage('Material name contains invalid characters. Allowed: letters, digits, spaces, - _ . , ( ) / %'),
    // quantity > 0
    body('items.*.quantity')
        .notEmpty().withMessage('Quantity is required for all items')
        .isFloat({ gt: 0 }).withMessage('Quantity must be greater than 0'),
    // unit_price >= 0
    body('items.*.unit_price')
        .notEmpty().withMessage('Rate is required for all items')
        .isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
    // PO_026: shipping address validation
    body('shipping_address').optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 10 }).withMessage('Shipping address is too short — please enter at least 10 characters')
        .isLength({ max: 250 }).withMessage('Shipping address cannot exceed 250 characters')
        .custom(value => {
            if (/<[^>]*>/.test(value)) throw new Error('Shipping address must not contain HTML tags');
            return true;
        })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { supplier_id, quotation_id, rfq_id, expected_delivery, payment_terms, shipping_address, notes, items } = req.body;

        const poNumber = generatePONumber();
        const subtotal = items ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0) : 0;
        const taxAmount = items ? items.reduce((sum, i) => sum + (i.unit_price * i.quantity * (i.tax_percentage || 18) / 100), 0) : 0;
        const totalAmount = subtotal + taxAmount;

        const result = await client.query(
            `INSERT INTO purchase_orders (po_number, supplier_id, quotation_id, rfq_id, expected_delivery, payment_terms, shipping_address, notes, subtotal, tax_amount, total_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [poNumber, supplier_id, quotation_id, rfq_id, expected_delivery, payment_terms, shipping_address, notes, subtotal, taxAmount, totalAmount, req.user.id]
        );
        const poId = result.rows[0].id;

        if (items && items.length) {
            for (const item of items) {
                await client.query(
                    `INSERT INTO purchase_order_items (po_id, material_name, description, quantity, unit, unit_price, total_price, tax_percentage)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    [poId, item.material_name, item.description, item.quantity, item.unit, item.unit_price, item.unit_price * item.quantity, item.tax_percentage || 18]
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

// PUT /api/purchase-orders/:id/status
router.put('/:id/status', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    try {
        const { status } = req.body;
        let query = "UPDATE purchase_orders SET status=$1, updated_at=NOW()";
        const params = [status];

        if (status === 'approved') {
            query += ", approved_by=$2, approved_at=NOW() WHERE id=$3";
            params.push(req.user.id, req.params.id);
        } else {
            query += " WHERE id=$2";
            params.push(req.params.id);
        }

        query += " RETURNING *";
        const result = await db.query(query, params);

        if (!result.rows.length) return res.status(404).json({ success: false, message: 'PO not found.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// POST /api/purchase-orders/:id/receive
router.post('/:id/receive', auth, authorize('admin', 'purchase_manager'), async (req, res) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const { received_items, receipt_date, notes } = req.body;

        const po = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);
        if (!po.rows.length) throw new Error('PO not found');

        for (const item of received_items) {
            await client.query(
                'UPDATE purchase_order_items SET received_quantity = received_quantity + $1 WHERE id = $2',
                [item.received_quantity, item.item_id]
            );

            // Create material batch
            const batchNumber = `BATCH-${Date.now()}-${item.item_id}`;
            const poItem = await client.query('SELECT * FROM purchase_order_items WHERE id = $1', [item.item_id]);

            if (item.material_id) {
                const batchResult = await client.query(
                    `INSERT INTO material_batches (batch_number, heat_number, material_id, supplier_id, po_id, quantity, available_quantity, unit_cost, total_cost, received_date)
           VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9) RETURNING id`,
                    [batchNumber, item.heat_number, item.material_id, po.rows[0].supplier_id, po.rows[0].id, item.received_quantity, item.unit_cost || 0, (item.unit_cost || 0) * item.received_quantity, receipt_date || new Date()]
                );

                // Update material stock
                await client.query(
                    'UPDATE materials SET current_stock = current_stock + $1, updated_at = NOW() WHERE id = $2',
                    [item.received_quantity, item.material_id]
                );

                // Log inventory transaction
                await client.query(
                    `INSERT INTO inventory_transactions (material_id, batch_id, transaction_type, quantity, reference_type, reference_id, unit_cost, total_cost, created_by)
           VALUES ($1,$2,'purchase_receipt',$3,'purchase_order',$4,$5,$6,$7)`,
                    [item.material_id, batchResult.rows[0].id, item.received_quantity, po.rows[0].id, item.unit_cost || 0, (item.unit_cost || 0) * item.received_quantity, req.user.id]
                );
            }
        }

        // Check if fully received
        const items = await client.query('SELECT * FROM purchase_order_items WHERE po_id = $1', [req.params.id]);
        const allReceived = items.rows.every(i => parseFloat(i.received_quantity) >= parseFloat(i.quantity));
        const anyReceived = items.rows.some(i => parseFloat(i.received_quantity) > 0);

        const newStatus = allReceived ? 'received' : (anyReceived ? 'partially_received' : 'approved');
        await client.query(
            "UPDATE purchase_orders SET status=$1, actual_delivery=NOW(), updated_at=NOW() WHERE id=$2",
            [newStatus, req.params.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Materials received and inventory updated.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    } finally {
        client.release();
    }
});

module.exports = router;
