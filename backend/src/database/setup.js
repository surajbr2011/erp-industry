/**
 * SQLite Database Setup - Creates tables and seeds initial data
 * Compatible with better-sqlite3 (synchronous operations)
 */
require('dotenv').config();
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

function setup() {
    console.log('🔧 Setting up SQLite database...');

    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'purchase_manager', 'production_manager', 'machine_operator', 'quality_inspector')),
      department TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      country TEXT DEFAULT 'India',
      pincode TEXT,
      gst_number TEXT,
      payment_terms TEXT,
      lead_time_days INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      on_time_delivery_rate REAL DEFAULT 0,
      quality_rating REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rfqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      required_by TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'quotations_received', 'closed', 'cancelled')),
      created_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rfq_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
      material_name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      specifications TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rfq_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
      supplier_id INTEGER REFERENCES suppliers(id),
      sent_at TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'declined')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT UNIQUE NOT NULL,
      rfq_id INTEGER REFERENCES rfqs(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      validity_date TEXT,
      total_amount REAL,
      currency TEXT DEFAULT 'INR',
      payment_terms TEXT,
      delivery_days INTEGER,
      status TEXT DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'approved', 'rejected')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
      rfq_item_id INTEGER REFERENCES rfq_items(id),
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      tax_percentage REAL DEFAULT 18,
      lead_time_days INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      quotation_id INTEGER REFERENCES quotations(id),
      rfq_id INTEGER REFERENCES rfqs(id),
      order_date TEXT DEFAULT (date('now')),
      expected_delivery TEXT,
      actual_delivery TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'received', 'cancelled', 'partially_received')),
      payment_terms TEXT,
      shipping_address TEXT,
      subtotal REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
      material_name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL,
      received_quantity REAL DEFAULT 0,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      tax_percentage REAL DEFAULT 18,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      unit TEXT NOT NULL,
      minimum_stock REAL DEFAULT 0,
      reorder_point REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      unit_cost REAL DEFAULT 0,
      material_type TEXT DEFAULT 'raw_material' CHECK (material_type IN ('raw_material', 'semi_finished', 'consumable', 'packaging')),
      specifications TEXT,
      hsn_code TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS material_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT UNIQUE NOT NULL,
      heat_number TEXT,
      material_id INTEGER REFERENCES materials(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      received_date TEXT DEFAULT (date('now')),
      expiry_date TEXT,
      quantity REAL NOT NULL,
      available_quantity REAL NOT NULL,
      unit_cost REAL,
      total_cost REAL,
      certificate_number TEXT,
      qc_status TEXT DEFAULT 'pending' CHECK (qc_status IN ('pending', 'approved', 'rejected', 'on_hold')),
      storage_location TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER REFERENCES materials(id),
      batch_id INTEGER REFERENCES material_batches(id),
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase_receipt', 'production_issue', 'return', 'adjustment', 'scrap', 'transfer')),
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      unit_cost REAL,
      total_cost REAL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_number TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      product_code TEXT UNIQUE NOT NULL,
      version TEXT DEFAULT '1.0',
      description TEXT,
      drawing_number TEXT,
      revision_date TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'obsolete')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bom_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_id INTEGER REFERENCES boms(id) ON DELETE CASCADE,
      material_id INTEGER REFERENCES materials(id),
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      scrap_percentage REAL DEFAULT 0,
      sequence_number INTEGER DEFAULT 1,
      is_critical INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bom_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_id INTEGER REFERENCES boms(id) ON DELETE CASCADE,
      operation_name TEXT NOT NULL,
      operation_type TEXT CHECK (operation_type IN ('milling', 'cnc', 'turning', 'grinding', 'welding', 'assembly', 'quality_check', 'other')),
      sequence_number INTEGER NOT NULL,
      estimated_time_hours REAL,
      machine_type TEXT,
      skill_required TEXT,
      instructions TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      machine_type TEXT,
      manufacturer TEXT,
      model TEXT,
      model_number TEXT,
      serial_number TEXT,
      location TEXT,
      capacity TEXT,
      capacity_unit TEXT,
      year_of_manufacture TEXT,
      maintenance_interval_days INTEGER DEFAULT 90,
      status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'breakdown', 'idle')),
      last_maintenance TEXT,
      next_maintenance_date TEXT,
      hourly_rate REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_number TEXT UNIQUE NOT NULL,
      bom_id INTEGER REFERENCES boms(id),
      product_name TEXT NOT NULL,
      product_code TEXT,
      quantity INTEGER NOT NULL,
      planned_quantity REAL,
      produced_quantity REAL DEFAULT 0,
      rejected_quantity REAL DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      planned_start TEXT,
      planned_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'in_process', 'completed', 'on_hold', 'cancelled')),
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      customer_order TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      production_manager INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_order_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wo_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
      operation_name TEXT NOT NULL,
      operation_type TEXT,
      sequence_number INTEGER NOT NULL,
      machine_id INTEGER REFERENCES machines(id),
      operator_id INTEGER REFERENCES users(id),
      planned_hours REAL,
      actual_hours REAL,
      output_quantity REAL,
      rejected_quantity REAL DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold')),
      estimated_time_hours REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS machine_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER REFERENCES machines(id),
      wo_operation_id INTEGER REFERENCES work_order_operations(id),
      operator_id INTEGER REFERENCES users(id),
      start_time TEXT NOT NULL,
      end_time TEXT,
      run_time_hours REAL,
      output_quantity REAL,
      cycle_time_seconds REAL,
      downtime_minutes REAL DEFAULT 0,
      downtime_reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serial_number TEXT UNIQUE NOT NULL,
      qr_code TEXT UNIQUE,
      wo_id INTEGER REFERENCES work_orders(id),
      bom_id INTEGER REFERENCES boms(id),
      product_name TEXT NOT NULL,
      product_code TEXT,
      batch_number TEXT,
      status TEXT DEFAULT 'in_production' CHECK (status IN ('in_production', 'inspecting', 'passed', 'failed', 'rework', 'scrapped', 'dispatched')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS part_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      event_description TEXT,
      notes TEXT,
      operation_id INTEGER REFERENCES work_order_operations(id),
      machine_id INTEGER REFERENCES machines(id),
      operator_id INTEGER REFERENCES users(id),
      material_batch_id INTEGER REFERENCES material_batches(id),
      inspection_id INTEGER,
      data TEXT,
      event_timestamp TEXT DEFAULT (datetime('now')),
      performed_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspection_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_id INTEGER REFERENCES boms(id),
      product_code TEXT,
      inspection_type TEXT CHECK (inspection_type IN ('incoming', 'in_process', 'final', 'outgoing')),
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspection_plan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER REFERENCES inspection_plans(id) ON DELETE CASCADE,
      parameter_name TEXT NOT NULL,
      parameter_type TEXT CHECK (parameter_type IN ('dimensional', 'visual', 'functional', 'material')),
      nominal_value REAL,
      upper_tolerance REAL,
      lower_tolerance REAL,
      unit TEXT,
      is_critical INTEGER DEFAULT 0,
      measurement_method TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_number TEXT UNIQUE NOT NULL,
      plan_id INTEGER REFERENCES inspection_plans(id),
      wo_id INTEGER REFERENCES work_orders(id),
      wo_operation_id INTEGER REFERENCES work_order_operations(id),
      part_id INTEGER REFERENCES parts(id),
      inspector_id INTEGER REFERENCES users(id),
      inspection_type TEXT,
      inspection_date TEXT DEFAULT (datetime('now')),
      quantity_inspected REAL,
      quantity_passed REAL DEFAULT 0,
      quantity_failed REAL DEFAULT 0,
      quantity_rework REAL DEFAULT 0,
      result TEXT DEFAULT 'passed' CHECK (result IN ('passed', 'failed', 'partial_pass', 'rework_required')),
      overall_status TEXT DEFAULT 'pending' CHECK (overall_status IN ('pending', 'passed', 'failed', 'partial_pass', 'rework_required')),
      remarks TEXT,
      notes TEXT,
      measurements TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inspection_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
      plan_item_id INTEGER REFERENCES inspection_plan_items(id),
      parameter_name TEXT NOT NULL,
      measured_value REAL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'rework')),
      deviation REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parts_dispatches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_number TEXT UNIQUE NOT NULL,
      part_id INTEGER REFERENCES parts(id),
      serial_number TEXT,
      product_name TEXT,
      customer_name TEXT NOT NULL,
      customer_po TEXT,
      shipping_address TEXT,
      dispatch_date TEXT DEFAULT (date('now')),
      dispatched_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS finished_goods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      product_code TEXT,
      wo_id INTEGER REFERENCES work_orders(id),
      quantity REAL NOT NULL,
      available_quantity REAL NOT NULL,
      unit TEXT DEFAULT 'pcs',
      batch_number TEXT,
      manufacturing_date TEXT DEFAULT (date('now')),
      expiry_date TEXT,
      quality_status TEXT DEFAULT 'approved' CHECK (quality_status IN ('approved', 'on_hold', 'rejected')),
      storage_location TEXT,
      unit_cost REAL,
      total_cost REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dispatch_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dispatch_number TEXT UNIQUE NOT NULL,
      finished_good_id INTEGER REFERENCES finished_goods(id),
      customer_name TEXT,
      customer_address TEXT,
      dispatch_date TEXT DEFAULT (date('now')),
      quantity REAL NOT NULL,
      delivery_challan TEXT,
      invoice_number TEXT,
      transporter TEXT,
      vehicle_number TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'delivered', 'returned')),
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
    CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
    CREATE INDEX IF NOT EXISTS idx_parts_serial ON parts(serial_number);
    CREATE INDEX IF NOT EXISTS idx_part_history_part ON part_history(part_id);
    CREATE INDEX IF NOT EXISTS idx_inspections_part ON inspections(part_id);
  `);

    console.log('✅ Tables created!');

    // Seed data (only if users table is empty)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count > 0) {
        console.log('✅ Database already seeded, skipping...');
        return;
    }

    const hashedPassword = bcrypt.hashSync('Password@123', 10);

    // Users
    const insertUser = db.prepare(`INSERT OR IGNORE INTO users (name, email, password, role, department, phone) VALUES (?, ?, ?, ?, ?, ?)`);
    insertUser.run('Admin User', 'admin@trinixerp.com', hashedPassword, 'admin', 'Management', '9876543210');
    insertUser.run('Rajesh Kumar', 'purchase@trinixerp.com', hashedPassword, 'purchase_manager', 'Procurement', '9876543211');
    insertUser.run('Suresh Patel', 'production@trinixerp.com', hashedPassword, 'production_manager', 'Production', '9876543212');
    insertUser.run('Anil Sharma', 'operator@trinixerp.com', hashedPassword, 'machine_operator', 'Shop Floor', '9876543213');
    insertUser.run('Priya Singh', 'quality@trinixerp.com', hashedPassword, 'quality_inspector', 'Quality', '9876543214');

    // Suppliers
    const insertSupplier = db.prepare(`INSERT OR IGNORE INTO suppliers (name, code, contact_person, email, phone, address, city, state, gst_number, payment_terms, lead_time_days, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertSupplier.run('Steel India Ltd', 'SUP-001', 'Vikram Mehta', 'vikram@steelindia.com', '9800001111', '123 Industrial Area, Phase 1', 'Pune', 'Maharashtra', '27AABCS1234A1Z5', 'Net 30', 14, 4.5);
    insertSupplier.run('MetalCraft Solutions', 'SUP-002', 'Rohan Gupta', 'rohan@metalcraft.com', '9800002222', '456 MIDC Area', 'Mumbai', 'Maharashtra', '27AABCM5678B2Z6', 'Net 15', 7, 4.2);
    insertSupplier.run('Precision Parts Co', 'SUP-003', 'Deepak Shah', 'deepak@precisionparts.com', '9800003333', '789 Industrial Estate', 'Nashik', 'Maharashtra', '27AABCP9012C3Z7', 'Net 45', 21, 3.8);
    insertSupplier.run('Allied Materials Pvt Ltd', 'SUP-004', 'Kavita Joshi', 'kavita@allied.com', '9800004444', '321 SEZ Area', 'Aurangabad', 'Maharashtra', '27AABCA3456D4Z8', 'Net 30', 10, 4.7);
    insertSupplier.run('Bharat Metals & Alloys', 'SUP-005', 'Sanjay Desai', 'sanjay@bharatmetals.com', '9800005555', '654 GIDC Phase 2', 'Surat', 'Gujarat', '24AABCB7890E5Z9', 'Net 60', 18, 4.0);

    // Materials
    const insertMat = db.prepare(`INSERT OR IGNORE INTO materials (code, name, description, category, unit, minimum_stock, reorder_point, current_stock, unit_cost, material_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertMat.run('MAT-001', 'MS Flat Bar 50x10', 'Mild Steel Flat Bar 50mm x 10mm IS 2062', 'Steel', 'kg', 500, 750, 1200, 65.00, 'raw_material');
    insertMat.run('MAT-002', 'EN8 Round Bar 50mm', 'EN8 Steel Round Bar 50mm dia', 'Steel', 'kg', 300, 500, 850, 82.00, 'raw_material');
    insertMat.run('MAT-003', 'Aluminum 6061 Sheet 3mm', 'Aluminum 6061-T6 Sheet 3mm thick', 'Aluminum', 'kg', 200, 350, 620, 185.00, 'raw_material');
    insertMat.run('MAT-004', 'SS 304 Pipe 2"', 'Stainless Steel 304 Pipe 2 inch', 'Stainless Steel', 'mtr', 100, 150, 280, 450.00, 'raw_material');
    insertMat.run('MAT-005', 'Cutting Oil 20L', 'Cutting Oil for CNC/Milling operations', 'Consumables', 'ltr', 50, 80, 35, 95.00, 'consumable');
    insertMat.run('MAT-006', 'MS Round Bar 25mm', 'Mild Steel Round Bar 25mm dia IS 2062', 'Steel', 'kg', 400, 600, 980, 58.00, 'raw_material');
    insertMat.run('MAT-007', 'Brass Rod 20mm', 'Brass Rod 20mm dia Free Cutting', 'Brass', 'kg', 100, 150, 250, 320.00, 'raw_material');
    insertMat.run('MAT-008', 'Insert TNMG 16', 'Carbide Insert TNMG 160408 for Turning', 'Tooling', 'pcs', 20, 30, 18, 380.00, 'consumable');

    // Machines
    const insertMach = db.prepare(`INSERT OR IGNORE INTO machines (machine_code, name, type, manufacturer, model_number, location, status, maintenance_interval_days, next_maintenance_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertMach.run('MCH-001', 'VMC-1 Vertical Machining Center', 'VMC', 'BFW India', 'TC500', 'Shop Floor A', 'available', 90, '2025-03-15');
    insertMach.run('MCH-002', 'CNC Turning Center-1', 'CNC Lathe', 'ACE Micromatic', 'Eco Turn 350', 'Shop Floor A', 'available', 90, '2025-04-01');
    insertMach.run('MCH-003', 'Horizontal Milling Machine', 'Milling', 'HMT', 'FN2V', 'Shop Floor B', 'available', 180, '2025-06-01');
    insertMach.run('MCH-004', 'Vertical Milling Machine', 'Milling', 'HMT', 'FN3V', 'Shop Floor B', 'in_use', 180, '2025-06-15');
    insertMach.run('MCH-005', 'Cylindrical Grinding Machine', 'Grinding', 'Paragon', 'PGM-500', 'Shop Floor C', 'available', 90, '2025-03-30');
    insertMach.run('MCH-006', 'Coordinate Measuring Machine', 'CMM', 'Mitutoyo', 'Crysta-Apex S 776', 'QC Lab', 'available', 365, '2025-12-01');

    // Admin user id
    const adminUser = db.prepare(`SELECT id FROM users WHERE role='admin' LIMIT 1`).get();
    if (!adminUser) return;

    // BOM 1
    const bom1 = db.prepare(`INSERT OR IGNORE INTO boms (bom_number, product_name, product_code, version, description, drawing_number, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'BOM-2024-001', 'Hydraulic Cylinder Body', 'HCB-001', '1.0',
        'Hydraulic cylinder body for industrial press', 'DRG-HCB-001-RevA', 'active', adminUser.id
    );
    if (bom1.changes > 0) {
        const bomId = bom1.lastInsertRowid;
        const mat2 = db.prepare(`SELECT id FROM materials WHERE code='MAT-002'`).get();
        const mat1 = db.prepare(`SELECT id FROM materials WHERE code='MAT-001'`).get();
        const mat5 = db.prepare(`SELECT id FROM materials WHERE code='MAT-005'`).get();
        const insertItem = db.prepare(`INSERT INTO bom_items (bom_id, material_id, material_name, quantity, unit, sequence_number, is_critical) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        if (mat2) insertItem.run(bomId, mat2.id, 'EN8 Round Bar 50mm', 3.5, 'kg', 1, 1);
        if (mat1) insertItem.run(bomId, mat1.id, 'MS Flat Bar 50x10', 1.2, 'kg', 2, 0);
        if (mat5) insertItem.run(bomId, mat5.id, 'Cutting Oil 20L', 0.5, 'ltr', 3, 0);
        const insertOp = db.prepare(`INSERT INTO bom_operations (bom_id, operation_name, operation_type, sequence_number, estimated_time_hours) VALUES (?, ?, ?, ?, ?)`);
        insertOp.run(bomId, 'Raw Material Cutting', 'other', 1, 0.5);
        insertOp.run(bomId, 'CNC Turning - Rough', 'cnc', 2, 1.5);
        insertOp.run(bomId, 'CNC Turning - Finish', 'cnc', 3, 1.0);
        insertOp.run(bomId, 'Milling Operations', 'milling', 4, 2.0);
        insertOp.run(bomId, 'Grinding - ID/OD', 'grinding', 5, 1.5);
        insertOp.run(bomId, 'Final Quality Inspection', 'quality_check', 6, 0.5);
    }

    // BOM 2
    const bom2 = db.prepare(`INSERT OR IGNORE INTO boms (bom_number, product_name, product_code, version, description, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        'BOM-2024-002', 'Precision Shaft Assembly', 'PSA-001', '2.0',
        'Precision shaft for gearbox application', 'active', adminUser.id
    );
    if (bom2.changes > 0) {
        const bomId2 = bom2.lastInsertRowid;
        const mat6 = db.prepare(`SELECT id FROM materials WHERE code='MAT-006'`).get();
        const insertItem2 = db.prepare(`INSERT INTO bom_items (bom_id, material_id, material_name, quantity, unit, sequence_number, is_critical) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        if (mat6) insertItem2.run(bomId2, mat6.id, 'MS Round Bar 25mm', 2.0, 'kg', 1, 1);
        const insertOp2 = db.prepare(`INSERT INTO bom_operations (bom_id, operation_name, operation_type, sequence_number, estimated_time_hours) VALUES (?, ?, ?, ?, ?)`);
        insertOp2.run(bomId2, 'CNC Turning', 'cnc', 1, 2.0);
        insertOp2.run(bomId2, 'Grinding', 'grinding', 2, 1.0);
        insertOp2.run(bomId2, 'Quality Inspection', 'quality_check', 3, 0.5);
    }

    // Demo Work Orders
    const insertWO = db.prepare(`INSERT OR IGNORE INTO work_orders (wo_number, bom_id, product_name, product_code, quantity, planned_quantity, start_date, due_date, status, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const bom1Row = db.prepare(`SELECT id FROM boms WHERE product_code='HCB-001'`).get();
    const bom2Row = db.prepare(`SELECT id FROM boms WHERE product_code='PSA-001'`).get();
    if (bom1Row) {
        insertWO.run('WO-2024-001', bom1Row.id, 'Hydraulic Cylinder Body', 'HCB-001', 10, 10, '2025-01-15', '2025-02-15', 'in_process', 'high', adminUser.id);
        insertWO.run('WO-2024-003', bom1Row.id, 'Hydraulic Cylinder Body', 'HCB-001', 5, 5, '2025-02-01', '2025-03-01', 'pending', 'normal', adminUser.id);
    }
    if (bom2Row) {
        insertWO.run('WO-2024-002', bom2Row.id, 'Precision Shaft Assembly', 'PSA-001', 25, 25, '2025-01-20', '2025-02-20', 'completed', 'normal', adminUser.id);
    }
    insertWO.run('WO-2024-004', null, 'Custom Bracket Assembly', 'CBA-001', 15, 15, '2025-02-10', '2025-03-10', 'released', 'urgent', adminUser.id);

    // Inspection Plans
    if (bom1Row) {
        const plan = db.prepare(`INSERT INTO inspection_plans (bom_id, product_code, inspection_type, name, description) VALUES (?, ?, ?, ?, ?)`).run(
            bom1Row.id, 'HCB-001', 'final', 'HCB Final Inspection', 'Final inspection for Hydraulic Cylinder Body'
        );
        const planId = plan.lastInsertRowid;
        const insertPI = db.prepare(`INSERT INTO inspection_plan_items (plan_id, parameter_name, parameter_type, nominal_value, upper_tolerance, lower_tolerance, unit, is_critical) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        insertPI.run(planId, 'Outer Diameter', 'dimensional', 50.0, 0.05, -0.05, 'mm', 1);
        insertPI.run(planId, 'Inner Bore Diameter', 'dimensional', 30.0, 0.02, -0.02, 'mm', 1);
        insertPI.run(planId, 'Surface Finish', 'visual', null, null, null, 'Ra', 0);
        insertPI.run(planId, 'Overall Length', 'dimensional', 200.0, 0.1, -0.1, 'mm', 0);
    }

    console.log('✅ Seed data inserted successfully!');
    console.log('📧 Login credentials:');
    console.log('   Admin: admin@trinixerp.com / Password@123');
    console.log('   Purchase Manager: purchase@trinixerp.com / Password@123');
    console.log('   Production Manager: production@trinixerp.com / Password@123');
    console.log('   Machine Operator: operator@trinixerp.com / Password@123');
    console.log('   Quality Inspector: quality@trinixerp.com / Password@123');
}

module.exports = { setup };

if (require.main === module) {
    setup();
    process.exit(0);
}
