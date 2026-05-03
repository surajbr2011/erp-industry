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

// Allowed chars for Supplier Name: letters, digits, spaces, & - . , ( )
const SUPPLIER_NAME_REGEX = /^[A-Za-z0-9\s\-&.,()]+$/;
// SUP_004: Official Indian GSTIN format — 15 chars
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// SUP_005: City — letters, spaces, hyphens and dots only (no digits)
const CITY_REGEX = /^[A-Za-z\s\-.]+$/;
// SUP_006: Valid Indian states and Union Territories
const VALID_INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
    'Ladakh', 'Lakshadweep', 'Puducherry'
];

// SUP_008: Contact Person — letters, spaces, hyphens, apostrophes, dots only
const CONTACT_PERSON_REGEX = /^[A-Za-z\s\-''.]+$/;
// SUP_010: Maximum realistic supplier lead time in days
const MAX_LEAD_TIME_DAYS = 365;

// POST /api/suppliers
router.post('/', auth, authorize('admin', 'purchase_manager'), [
    body('name').notEmpty().trim()
        .matches(SUPPLIER_NAME_REGEX)
        .withMessage('Supplier Name contains invalid special characters. Allowed: letters, digits, spaces, & - . , ( )'),
    body('code').notEmpty().trim(),
    // SUP_008: Contact Person must contain only valid name characters
    body('contact_person').optional({ checkFalsy: true })
        .matches(CONTACT_PERSON_REGEX)
        .withMessage("Contact Person name can only contain letters, spaces, hyphens, apostrophes or dots"),
    // SUP_013: Email is mandatory on create; must be valid RFC format
    body('email').notEmpty().withMessage('Email address is required')
        .isEmail().normalizeEmail()
        .withMessage('Please enter a valid email address (e.g. contact@example.com)'),
    // SUP_014: Phone is mandatory on create
    body('phone').notEmpty().withMessage('Phone number is required')
        .custom(value => {
        const digits = value.replace(/[\s\-+]/g, '');
        if (!/^\d{7,15}$/.test(digits))
            throw new Error('Phone must contain 7–15 digits (e.g. +91 98765 43210)');
        if (/^(\d)\1+$/.test(digits))
            throw new Error('Phone number cannot be all the same digit (e.g. 0000000000)');
        return true;
    }),
    // SUP_014: GST Number is mandatory on create
    body('gst_number').notEmpty().withMessage('GST Number is required')
        .custom(value => {
        if (!GST_NUMBER_REGEX.test(value.toUpperCase()))
            throw new Error('Invalid GST number. Expected format: 27AABCS1234A1Z5 (15 characters)');
        return true;
    }),
    // SUP_014: City is mandatory on create
    body('city').notEmpty().withMessage('City is required')
        .matches(CITY_REGEX)
        .withMessage('City name must contain only letters, spaces, hyphens or dots (no numbers)'),
    // SUP_014: State is mandatory on create
    body('state').notEmpty().withMessage('State is required — please select from the list')
        .isIn(VALID_INDIAN_STATES)
        .withMessage('Please select a valid Indian state or Union Territory'),
    // SUP_014: Payment Terms is mandatory on create
    body('payment_terms').notEmpty().withMessage('Payment Terms is required'),
    // SUP_007 / SUP_009 / SUP_010: Lead Time between 1 and 365 days
    body('lead_time_days').optional({ checkFalsy: true }).custom(value => {
        const n = Number(value);
        if (!Number.isInteger(n)) throw new Error('Lead Time must be a whole number of days');
        if (n < 0) throw new Error('Lead Time cannot be negative. Enter a value of 1 or more');
        if (n < 1) throw new Error('Lead Time must be at least 1 day (0 is not allowed)');
        if (n > MAX_LEAD_TIME_DAYS) throw new Error(`Lead Time cannot exceed ${MAX_LEAD_TIME_DAYS} days (1 year). Enter a realistic value`);
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    try {
        const { name, code, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, notes } = req.body;

        // SUP_011: email uniqueness check — reject if another active supplier already uses this email
        if (email) {
            const dupCheck = await db.query(
                `SELECT id FROM suppliers WHERE LOWER(email) = LOWER($1) AND status != 'inactive' LIMIT 1`,
                [email]
            );
            if (dupCheck.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'This email address is already registered to another supplier.' });
            }
        }

        const result = await db.query(
            `INSERT INTO suppliers (name, code, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [name, code, contact_person, email, phone, address, city, state, country || 'India', pincode, gst_number, payment_terms, lead_time_days, notes]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        if (error.code === '23505' || error.code === 'SQLITE_CONSTRAINT_UNIQUE' || (error.message && error.message.includes('UNIQUE constraint failed'))) return res.status(409).json({ success: false, message: 'Supplier code already exists.' });
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// PUT /api/suppliers/:id
router.put('/:id', auth, authorize('admin', 'purchase_manager'), [
    body('name').optional().trim()
        .matches(SUPPLIER_NAME_REGEX)
        .withMessage('Supplier Name contains invalid special characters. Allowed: letters, digits, spaces, & - . , ( )'),
    // SUP_008: Contact Person must contain only valid name characters
    body('contact_person').optional({ checkFalsy: true })
        .matches(CONTACT_PERSON_REGEX)
        .withMessage("Contact Person name can only contain letters, spaces, hyphens, apostrophes or dots"),
    // SUP_002: validate email format when provided
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail()
        .withMessage('Please enter a valid email address (e.g. contact@example.com)'),
    // SUP_003: validate phone — reject all-zero / all-same-digit / wrong length
    body('phone').optional({ checkFalsy: true }).custom(value => {
        const digits = value.replace(/[\s\-+]/g, '');
        if (!/^\d{7,15}$/.test(digits))
            throw new Error('Phone must contain 7–15 digits (e.g. +91 98765 43210)');
        if (/^(\d)\1+$/.test(digits))
            throw new Error('Phone number cannot be all the same digit (e.g. 0000000000)');
        return true;
    }),
    // SUP_004: validate GST number format
    body('gst_number').optional({ checkFalsy: true }).custom(value => {
        if (!GST_NUMBER_REGEX.test(value.toUpperCase()))
            throw new Error('Invalid GST number. Expected format: 27AABCS1234A1Z5 (15 characters)');
        return true;
    }),
    // SUP_005: City must contain only letters, spaces, hyphens, dots — no digits
    body('city').optional({ checkFalsy: true })
        .matches(CITY_REGEX)
        .withMessage('City name must contain only letters, spaces, hyphens or dots (no numbers)'),
    // SUP_006: State must be a valid Indian state or Union Territory
    body('state').optional({ checkFalsy: true })
        .isIn(VALID_INDIAN_STATES)
        .withMessage('Please select a valid Indian state or Union Territory'),
    // SUP_007 / SUP_009: Lead Time must be a positive integer (>= 1); negatives explicitly rejected
    body('lead_time_days').optional({ checkFalsy: true }).custom(value => {
        const n = Number(value);
        if (!Number.isInteger(n)) throw new Error('Lead Time must be a whole number of days');
        if (n < 0) throw new Error('Lead Time cannot be negative. Enter a value of 1 or more');
        if (n < 1) throw new Error('Lead Time must be at least 1 day (0 is not allowed)');
        if (n > MAX_LEAD_TIME_DAYS) throw new Error(`Lead Time cannot exceed ${MAX_LEAD_TIME_DAYS} days (1 year). Enter a realistic value`);
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }
    try {
        // SUP_012: destructure `code` — it was missing, causing code changes to be silently ignored
        const { name, code, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, status, notes, rating } = req.body;

        // SUP_011: email uniqueness check — reject if a DIFFERENT active supplier already uses this email
        if (email) {
            const dupCheck = await db.query(
                `SELECT id FROM suppliers WHERE LOWER(email) = LOWER($1) AND id != $2 AND status != 'inactive' LIMIT 1`,
                [email, req.params.id]
            );
            if (dupCheck.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'This email address is already registered to another supplier.' });
            }
        }

        // SUP_012: code uniqueness check — reject if a DIFFERENT supplier already uses this code
        if (code) {
            const codeCheck = await db.query(
                `SELECT id FROM suppliers WHERE LOWER(code) = LOWER($1) AND id != $2 LIMIT 1`,
                [code, req.params.id]
            );
            if (codeCheck.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'Supplier code already exists. Please use a unique code.' });
            }
        }

        const result = await db.query(
            // SUP_012: added code=$2 to SET clause; shifted all subsequent param numbers by 1
            `UPDATE suppliers SET name=$1, code=$2, contact_person=$3, email=$4, phone=$5, address=$6, city=$7,
       state=$8, country=$9, pincode=$10, gst_number=$11, payment_terms=$12, lead_time_days=$13,
       status=$14, notes=$15, rating=$16, updated_at=NOW() WHERE id=$17 RETURNING *`,
            [name, code, contact_person, email, phone, address, city, state, country, pincode, gst_number, payment_terms, lead_time_days, status, notes, rating, req.params.id]
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
