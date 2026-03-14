require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const seed = async () => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Seed Users
        const hashedPassword = await bcrypt.hash('Password@123', 10);

        await client.query(`
      INSERT INTO users (name, email, password, role, department, phone) VALUES
      ('Admin User', 'admin@trinixerp.com', $1, 'admin', 'Management', '9876543210'),
      ('Rajesh Kumar', 'purchase@trinixerp.com', $1, 'purchase_manager', 'Procurement', '9876543211'),
      ('Suresh Patel', 'production@trinixerp.com', $1, 'production_manager', 'Production', '9876543212'),
      ('Anil Sharma', 'operator@trinixerp.com', $1, 'machine_operator', 'Shop Floor', '9876543213'),
      ('Priya Singh', 'quality@trinixerp.com', $1, 'quality_inspector', 'Quality', '9876543214')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

        // Seed Suppliers
        await client.query(`
      INSERT INTO suppliers (name, code, contact_person, email, phone, address, city, state, gst_number, payment_terms, lead_time_days, rating) VALUES
      ('Steel India Ltd', 'SUP-001', 'Vikram Mehta', 'vikram@steelindia.com', '9800001111', '123 Industrial Area, Phase 1', 'Pune', 'Maharashtra', '27AABCS1234A1Z5', 'Net 30', 14, 4.5),
      ('MetalCraft Solutions', 'SUP-002', 'Rohan Gupta', 'rohan@metalcraft.com', '9800002222', '456 MIDC Area', 'Mumbai', 'Maharashtra', '27AABCM5678B2Z6', 'Net 15', 7, 4.2),
      ('Precision Parts Co', 'SUP-003', 'Deepak Shah', 'deepak@precisionparts.com', '9800003333', '789 Industrial Estate', 'Nashik', 'Maharashtra', '27AABCP9012C3Z7', 'Net 45', 21, 3.8),
      ('Allied Materials Pvt Ltd', 'SUP-004', 'Kavita Joshi', 'kavita@allied.com', '9800004444', '321 SEZ Area', 'Aurangabad', 'Maharashtra', '27AABCA3456D4Z8', 'Net 30', 10, 4.7),
      ('Bharat Metals & Alloys', 'SUP-005', 'Sanjay Desai', 'sanjay@bharatmetals.com', '9800005555', '654 GIDC Phase 2', 'Surat', 'Gujarat', '24AABCB7890E5Z9', 'Net 60', 18, 4.0)
      ON CONFLICT (code) DO NOTHING
    `);

        // Seed Materials
        await client.query(`
      INSERT INTO materials (code, name, description, category, unit, minimum_stock, reorder_point, current_stock, unit_cost, material_type) VALUES
      ('MAT-001', 'MS Flat Bar 50x10', 'Mild Steel Flat Bar 50mm x 10mm IS 2062 Grade A', 'Steel', 'kg', 500, 750, 1200, 65.00, 'raw_material'),
      ('MAT-002', 'EN8 Round Bar 50mm', 'EN8 Steel Round Bar 50mm dia', 'Steel', 'kg', 300, 500, 850, 82.00, 'raw_material'),
      ('MAT-003', 'Aluminum 6061 Sheet 3mm', 'Aluminum 6061-T6 Sheet 3mm thick', 'Aluminum', 'kg', 200, 350, 620, 185.00, 'raw_material'),
      ('MAT-004', 'SS 304 Pipe 2"', 'Stainless Steel 304 Pipe 2 inch', 'Stainless Steel', 'mtr', 100, 150, 280, 450.00, 'raw_material'),
      ('MAT-005', 'Cutting Oil 20L', 'Cutting Oil for CNC/Milling operations', 'Consumables', 'ltr', 50, 80, 160, 95.00, 'consumable'),
      ('MAT-006', 'MS Round Bar 25mm', 'Mild Steel Round Bar 25mm dia IS 2062', 'Steel', 'kg', 400, 600, 980, 58.00, 'raw_material'),
      ('MAT-007', 'Brass Rod 20mm', 'Brass Rod 20mm dia Free Cutting', 'Brass', 'kg', 100, 150, 250, 320.00, 'raw_material'),
      ('MAT-008', 'Insert TNMG 16', 'Carbide Insert TNMG 160408 for CNC Turning', 'Tooling', 'pcs', 20, 30, 45, 380.00, 'consumable')
      ON CONFLICT (code) DO NOTHING
    `);

        // Seed Machines
        await client.query(`
      INSERT INTO machines (machine_code, name, machine_type, manufacturer, model, serial_number, location, capacity, status, hourly_rate) VALUES
      ('MCH-001', 'VMC-1 Vertical Machining Center', 'cnc', 'BFW India', 'TC500', 'BFW2024001', 'Shop Floor A', '500x400x450mm', 'available', 850.00),
      ('MCH-002', 'CNC Turning Center-1', 'cnc', 'ACE Micromatic', 'Eco Turn 350', 'ACE2024001', 'Shop Floor A', 'dia 350mm L 750mm', 'available', 750.00),
      ('MCH-003', 'Horizontal Milling Machine', 'milling', 'HMT', 'FN2V', 'HMT2023001', 'Shop Floor B', '400x200mm table', 'available', 450.00),
      ('MCH-004', 'Vertical Milling Machine', 'milling', 'HMT', 'FN3V', 'HMT2023002', 'Shop Floor B', '500x250mm table', 'in_use', 450.00),
      ('MCH-005', 'Cylindrical Grinding Machine', 'grinding', 'Paragon', 'PGM-500', 'PAR2022001', 'Shop Floor C', 'dia 300mm L 1000mm', 'available', 600.00),
      ('MCH-006', 'Coordinate Measuring Machine', 'inspection', 'Mitutoyo', 'Crysta-Apex S 776', 'MIT2024001', 'QC Lab', '700x700x600mm', 'available', 1200.00)
      ON CONFLICT (machine_code) DO NOTHING
    `);

        // Seed BOMs
        const bomResult = await client.query(`
      INSERT INTO boms (bom_number, product_name, product_code, version, description, drawing_number, status, created_by)
      SELECT 'BOM-2024-001', 'Hydraulic Cylinder Body', 'HCB-001', '1.0', 'Hydraulic cylinder body for industrial press', 'DRG-HCB-001-RevA', 'active', id
      FROM users WHERE role = 'admin' LIMIT 1
      ON CONFLICT (product_code) DO NOTHING
      RETURNING id
    `);

        if (bomResult.rows.length > 0) {
            const bomId = bomResult.rows[0].id;

            await client.query(`
        INSERT INTO bom_items (bom_id, material_id, material_name, quantity, unit, sequence_number, is_critical)
        SELECT $1, id, name, quantity, unit, seq, is_crit FROM (VALUES
          ((SELECT id FROM materials WHERE code='MAT-002'), 'EN8 Round Bar 50mm', 3.5, 'kg', 1, true),
          ((SELECT id FROM materials WHERE code='MAT-001'), 'MS Flat Bar 50x10', 1.2, 'kg', 2, false),
          ((SELECT id FROM materials WHERE code='MAT-005'), 'Cutting Oil 20L', 0.5, 'ltr', 3, false)
        ) AS t(id, name, quantity, unit, seq, is_crit)
      `, [bomId]);

            await client.query(`
        INSERT INTO bom_operations (bom_id, operation_name, operation_type, sequence_number, estimated_time_hours, machine_type) VALUES
        ($1, 'Raw Material Cutting', 'other', 1, 0.5, 'other'),
        ($1, 'CNC Turning - Rough', 'cnc', 2, 1.5, 'cnc'),
        ($1, 'CNC Turning - Finish', 'cnc', 3, 1.0, 'cnc'),
        ($1, 'Milling Operations', 'milling', 4, 2.0, 'milling'),
        ($1, 'Grinding - ID/OD', 'grinding', 5, 1.5, 'grinding'),
        ($1, 'Final Quality Inspection', 'quality_check', 6, 0.5, 'inspection')
      `, [bomId]);
        }

        // Seed a BOM for another product
        const bom2Result = await client.query(`
      INSERT INTO boms (bom_number, product_name, product_code, version, description, status, created_by)
      SELECT 'BOM-2024-002', 'Precision Shaft Assembly', 'PSA-001', '2.0', 'Precision shaft for gearbox application', 'active', id
      FROM users WHERE role = 'admin' LIMIT 1
      ON CONFLICT (product_code) DO NOTHING
      RETURNING id
    `);

        console.log('✅ Seed data inserted successfully!');
        console.log('📧 Login credentials:');
        console.log('   Admin: admin@trinixerp.com / Password@123');
        console.log('   Purchase Manager: purchase@trinixerp.com / Password@123');
        console.log('   Production Manager: production@trinixerp.com / Password@123');
        console.log('   Machine Operator: operator@trinixerp.com / Password@123');
        console.log('   Quality Inspector: quality@trinixerp.com / Password@123');

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
