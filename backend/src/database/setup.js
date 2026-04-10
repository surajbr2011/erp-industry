/**
 * SQLite Database Setup - Creates tables and seeds initial data
 * Compatible with better-sqlite3 (synchronous operations)
 */
require('dotenv').config();
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

function setup() {
    console.log('ðŸ”§ Setting up SQLite database...');

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

    console.log('âœ… Tables created!');

    // Seed data (only if users table is empty)
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count > 0) {
        console.log('âœ… Database already seeded, skipping...');
        return;
    }

    console.log('ðŸŒ± Seeding demo data for all modules...');

    const pw = bcrypt.hashSync('Password@123', 10);
    const G  = (sql, p=[]) => db.prepare(sql).get(...p);
    const R  = (sql, p=[]) => { try { return db.prepare(sql).run(...p); } catch(e) { return null; } };
    const DA = (sql, p=[]) => db.prepare(sql).all(...p);

    // helpers for relative dates
    const ago  = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; };
    const fwd  = n => { const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; };

    // â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const userRows = [
        ['Admin User',    'admin@trinixerp.com',      'admin',              'Management',  '9876543210'],
        ['Rajesh Kumar',  'purchase@trinixerp.com',   'purchase_manager',   'Procurement', '9876543211'],
        ['Suresh Patel',  'production@trinixerp.com', 'production_manager', 'Production',  '9876543212'],
        ['Anil Sharma',   'operator@trinixerp.com',   'machine_operator',   'Shop Floor',  '9876543213'],
        ['Priya Singh',   'quality@trinixerp.com',    'quality_inspector',  'Quality',     '9876543214'],
        ['Deepak Verma',  'deepak@trinixerp.com',     'machine_operator',   'Shop Floor',  '9876543215'],
        ['Kavita Joshi',  'kavita@trinixerp.com',     'quality_inspector',  'Quality',     '9876543216'],
        ['Mohit Rana',    'mohit@trinixerp.com',      'purchase_manager',   'Procurement', '9876543217'],
    ];
    for (const [name,email,role,dept,phone] of userRows)
        R(`INSERT OR IGNORE INTO users (name,email,password,role,department,phone) VALUES (?,?,?,?,?,?)`,
            [name,email,pw,role,dept,phone]);

    const admin    = G(`SELECT id FROM users WHERE email='admin@trinixerp.com'`);
    const purchase = G(`SELECT id FROM users WHERE email='purchase@trinixerp.com'`);
    const prod     = G(`SELECT id FROM users WHERE email='production@trinixerp.com'`);
    const oper     = G(`SELECT id FROM users WHERE email='operator@trinixerp.com'`);
    const quality  = G(`SELECT id FROM users WHERE email='quality@trinixerp.com'`);

    // â”€â”€ SUPPLIERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const suppRows = [
        ['Steel India Ltd',          'SUP-001','Vikram Mehta',   'vikram@steelindia.com',    '9800001111','123 Industrial Area, Phase 1','Pune',      'Maharashtra','27AABCS1234A1Z5','Net 30',14,4.5,'active'],
        ['MetalCraft Solutions',     'SUP-002','Rohan Gupta',    'rohan@metalcraft.com',     '9800002222','456 MIDC Area',              'Mumbai',    'Maharashtra','27AABCM5678B2Z6','Net 15', 7,4.2,'active'],
        ['Precision Parts Co',       'SUP-003','Deepak Shah',    'deepak@precisionparts.com','9800003333','789 Industrial Estate',      'Nashik',    'Maharashtra','27AABCP9012C3Z7','Net 45',21,3.8,'active'],
        ['Allied Materials Pvt Ltd', 'SUP-004','Kavita Joshi',   'kavita@allied.com',        '9800004444','321 SEZ Area',               'Aurangabad','Maharashtra','27AABCA3456D4Z8','Net 30',10,4.7,'active'],
        ['Bharat Metals & Alloys',   'SUP-005','Sanjay Desai',   'sanjay@bharatmetals.com',  '9800005555','654 GIDC Phase 2',           'Surat',     'Gujarat',    '24AABCB7890E5Z9','Net 60',18,4.0,'active'],
        ['TechnoForge Industries',   'SUP-006','Amit Sharma',    'amit@technoforge.com',     '9800006666','12 Ambad MIDC',              'Nashik',    'Maharashtra','27AABCT1111F6Z1','Net 30',12,4.3,'active'],
        ['Mahindra Steel Corp',      'SUP-007','Ravi Pillai',    'ravi@mahindrasteel.com',   '9800007777','78 Pirangut Road',           'Pune',      'Maharashtra','27AABCM2222G7Z2','Net 45',20,3.5,'inactive'],
        ['Omega Fasteners Ltd',      'SUP-008','Neha Deshpande', 'neha@omegafasteners.com',  '9800008888','90 Jejuri MIDC',             'Pune',      'Maharashtra','27AABCO3333H8Z3','Net 30', 8,4.6,'active'],
    ];
    for (const [name,code,cp,email,phone,addr,city,state,gst,pt,ltd,rating,status] of suppRows)
        R(`INSERT OR IGNORE INTO suppliers (name,code,contact_person,email,phone,address,city,state,gst_number,payment_terms,lead_time_days,rating,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [name,code,cp,email,phone,addr,city,state,gst,pt,ltd,rating,status]);
    const supId = code => G(`SELECT id FROM suppliers WHERE code=?`,[code])?.id;

    // â”€â”€ MATERIALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const matRows = [
        ['MAT-001','MS Flat Bar 50x10',       'Mild Steel Flat Bar 50x10mm IS2062','Steel',          'kg', 500,750,1200, 65.00,'raw_material'],
        ['MAT-002','EN8 Round Bar 50mm',      'EN8 Steel Round Bar 50mm dia',      'Steel',          'kg', 300,500, 850, 82.00,'raw_material'],
        ['MAT-003','Aluminum 6061 Sheet 3mm', 'Aluminum 6061-T6 Sheet 3mm thick',  'Aluminum',       'kg', 200,350, 620,185.00,'raw_material'],
        ['MAT-004','SS 304 Pipe 2"',          'Stainless Steel 304 Pipe 2 inch',   'Stainless Steel','mtr',100,150, 280,450.00,'raw_material'],
        ['MAT-005','Cutting Oil 20L',         'CNC/Milling Cutting Oil',           'Consumables',   'ltr',  50, 80,  35, 95.00,'consumable'],
        ['MAT-006','MS Round Bar 25mm',       'Mild Steel Round Bar 25mm IS2062',  'Steel',          'kg', 400,600, 980, 58.00,'raw_material'],
        ['MAT-007','Brass Rod 20mm',          'Brass Rod 20mm dia Free Cutting',   'Brass',          'kg', 100,150, 250,320.00,'raw_material'],
        ['MAT-008','Insert TNMG 16',          'Carbide Insert TNMG 160408',        'Tooling',       'pcs',  20, 30,  18,380.00,'consumable'],
        ['MAT-009','EN19 Round Bar 40mm',     'EN19 Alloy Steel 40mm dia',         'Steel',          'kg', 150,250, 410,110.00,'raw_material'],
        ['MAT-010','Copper Sheet 2mm',        'Copper Sheet 99.9% pure 2mm',       'Copper',         'kg',  80,120, 190,680.00,'raw_material'],
        ['MAT-011','O-Ring Kit NBR',          'NBR O-Ring assorted sizes kit',     'Seals',         'set',  30, 50,  12,220.00,'consumable'],
        ['MAT-012','Bearing 6205',            'Deep groove ball bearing 6205',     'Bearings',      'pcs', 100,150,  75,185.00,'semi_finished'],
    ];
    for (const [code,name,desc,cat,unit,min,reorder,stock,cost,type] of matRows)
        R(`INSERT OR IGNORE INTO materials (code,name,description,category,unit,minimum_stock,reorder_point,current_stock,unit_cost,material_type) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [code,name,desc,cat,unit,min,reorder,stock,cost,type]);
    const matId = code => G(`SELECT id FROM materials WHERE code=?`,[code])?.id;

    // â”€â”€ MACHINES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const machRows = [
        ['MCH-001','VMC-1 Vertical Machining Center','VMC',       'BFW India',    'TC500',             'Shop Floor A','available',  90,fwd(45)],
        ['MCH-002','CNC Turning Center-1',           'CNC Lathe', 'ACE Micromatic','Eco Turn 350',     'Shop Floor A','available',  90,fwd(30)],
        ['MCH-003','Horizontal Milling Machine',     'Milling',   'HMT',          'FN2V',              'Shop Floor B','available', 180,fwd(90)],
        ['MCH-004','Vertical Milling Machine',       'Milling',   'HMT',          'FN3V',              'Shop Floor B','in_use',    180,fwd(75)],
        ['MCH-005','Cylindrical Grinding Machine',   'Grinding',  'Paragon',      'PGM-500',           'Shop Floor C','available',  90,fwd(15)],
        ['MCH-006','Coordinate Measuring Machine',   'CMM',       'Mitutoyo',     'Crysta-Apex S 776', 'QC Lab',      'available', 365,fwd(200)],
        ['MCH-007','CNC Turning Center-2',           'CNC Lathe', 'JYOTI CNC',    'DX 200',            'Shop Floor A','maintenance',90,fwd(2)],
        ['MCH-008','Surface Grinding Machine',       'Grinding',  'Okamoto',      'ACC-618CNC',        'Shop Floor C','available',  90,fwd(60)],
    ];
    for (const [code,name,type,mfr,model,loc,status,interval,nxt] of machRows)
        R(`INSERT OR IGNORE INTO machines (machine_code,name,machine_type,manufacturer,model_number,location,status,maintenance_interval_days,next_maintenance_date) VALUES (?,?,?,?,?,?,?,?,?)`,
            [code,name,type,mfr,model,loc,status,interval,nxt]);
    const machId = code => G(`SELECT id FROM machines WHERE machine_code=?`,[code])?.id;

    // Machine logs (30-day utilisation data)
    for (const [mc,days,hrs,qty] of [
        ['MCH-001',5,7.5,4],['MCH-001',4,6.0,3],['MCH-001',3,8.0,5],['MCH-001',2,5.5,3],
        ['MCH-002',6,7.0,4],['MCH-002',3,8.0,5],['MCH-002',1,6.5,4],
        ['MCH-004',1,7.5,4],['MCH-004',4,8.0,5],
        ['MCH-005',7,6.0,3],['MCH-005',2,7.0,4],
        ['MCH-008',5,5.0,2],
    ]) {
        const mid = machId(mc); if (!mid) continue;
        const date = ago(days);
        R(`INSERT INTO machine_logs (machine_id,operator_id,start_time,end_time,run_time_hours,output_quantity,notes) VALUES (?,?,?,?,?,?,?)`,
            [mid,oper.id,`${date} 08:00:00`,`${date} 16:00:00`,hrs,qty,'Production run']);
    }

    // â”€â”€ BOMs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const bomDefs = [
        { num:'BOM-2024-001', name:'Hydraulic Cylinder Body',   code:'HCB-001', ver:'1.0', status:'active',
          items:[['MAT-002',3.5,'kg',1,1],['MAT-001',1.2,'kg',2,0],['MAT-005',0.5,'ltr',3,0]],
          ops:[['Raw Material Cutting','other',1,0.5],['CNC Turning Rough','cnc',2,1.5],['CNC Turning Finish','cnc',3,1.0],['Milling','milling',4,2.0],['Grinding','grinding',5,1.5],['Final QC','quality_check',6,0.5]] },
        { num:'BOM-2024-002', name:'Precision Shaft Assembly',  code:'PSA-001', ver:'2.0', status:'active',
          items:[['MAT-006',2.0,'kg',1,1],['MAT-005',0.3,'ltr',2,0]],
          ops:[['CNC Turning','cnc',1,2.0],['Grinding','grinding',2,1.0],['QC Inspection','quality_check',3,0.5]] },
        { num:'BOM-2024-003', name:'Aluminum Bracket Assembly', code:'ABA-001', ver:'1.0', status:'active',
          items:[['MAT-003',1.8,'kg',1,1],['MAT-005',0.2,'ltr',2,0]],
          ops:[['CNC Milling','milling',1,1.5],['Drilling','other',2,0.5],['Deburring','other',3,0.5],['Inspection','quality_check',4,0.3]] },
        { num:'BOM-2024-004', name:'Stainless Steel Flange',    code:'SSF-001', ver:'1.0', status:'active',
          items:[['MAT-004',0.8,'mtr',1,1],['MAT-008',2.0,'pcs',2,0]],
          ops:[['Cutting','other',1,0.3],['CNC Turning','cnc',2,1.2],['Drilling & Tapping','other',3,0.8],['QC','quality_check',4,0.3]] },
        { num:'BOM-2024-005', name:'Brass Valve Housing',       code:'BVH-001', ver:'1.0', status:'draft',
          items:[['MAT-007',1.5,'kg',1,1]],
          ops:[['CNC Turning','cnc',1,1.5],['Drilling','other',2,0.5],['Inspection','quality_check',3,0.3]] },
    ];
    for (const b of bomDefs) {
        const res = R(`INSERT OR IGNORE INTO boms (bom_number,product_name,product_code,version,status,created_by) VALUES (?,?,?,?,?,?)`,
            [b.num,b.name,b.code,b.ver,b.status,admin.id]);
        if (!res?.lastInsertRowid) continue;
        const bomId = res.lastInsertRowid;
        for (const [mc,qty,unit,seq,crit] of b.items) {
            const mid = matId(mc); if (!mid) continue;
            const mname = G(`SELECT name FROM materials WHERE id=?`,[mid])?.name||mc;
            R(`INSERT INTO bom_items (bom_id,material_id,material_name,quantity,unit,sequence_number,is_critical) VALUES (?,?,?,?,?,?,?)`,
                [bomId,mid,mname,qty,unit,seq,crit]);
        }
        for (const [opName,opType,seq,hrs] of b.ops)
            R(`INSERT INTO bom_operations (bom_id,operation_name,operation_type,sequence_number,estimated_time_hours) VALUES (?,?,?,?,?)`,
                [bomId,opName,opType,seq,hrs]);
    }
    const bomId = code => G(`SELECT id FROM boms WHERE product_code=?`,[code])?.id;

    // â”€â”€ RFQs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const rfqDefs = [
        { num:'RFQ-2026-001', title:'Q1 Steel Raw Materials',     status:'quotations_received', reqBy:fwd(15),
          items:[{mat:'EN8 Round Bar 50mm',qty:500,unit:'kg'},{mat:'MS Flat Bar 50x10',qty:1000,unit:'kg'}],
          sups:['SUP-001','SUP-002'] },
        { num:'RFQ-2026-002', title:'Aluminum Sheet Procurement',  status:'sent',               reqBy:fwd(20),
          items:[{mat:'Aluminum 6061 Sheet 3mm',qty:300,unit:'kg'}],
          sups:['SUP-003','SUP-004'] },
        { num:'RFQ-2026-003', title:'Consumables & Tooling Q2',    status:'draft',              reqBy:fwd(30),
          items:[{mat:'Cutting Oil 20L',qty:100,unit:'ltr'},{mat:'Insert TNMG 16',qty:50,unit:'pcs'}],
          sups:['SUP-005'] },
        { num:'RFQ-2026-004', title:'SS Pipe & Fittings',          status:'closed',             reqBy:ago(10),
          items:[{mat:'SS 304 Pipe 2"',qty:150,unit:'mtr'}],
          sups:['SUP-001','SUP-006'] },
    ];
    for (const rfq of rfqDefs) {
        const res = R(`INSERT OR IGNORE INTO rfqs (rfq_number,title,status,required_by,created_by) VALUES (?,?,?,?,?)`,
            [rfq.num,rfq.title,rfq.status,rfq.reqBy,purchase.id]);
        if (!res?.lastInsertRowid) continue;
        const rfqId = res.lastInsertRowid;
        for (const item of rfq.items)
            R(`INSERT INTO rfq_items (rfq_id,material_name,quantity,unit) VALUES (?,?,?,?)`,
                [rfqId,item.mat,item.qty,item.unit]);
        for (const sc of rfq.sups) {
            const si = supId(sc); if (!si) continue;
            R(`INSERT OR IGNORE INTO rfq_suppliers (rfq_id,supplier_id,status) VALUES (?,?,?)`,
                [rfqId,si,rfq.status==='draft'?'pending':'sent']);
        }
    }
    const rfq1 = G(`SELECT id FROM rfqs WHERE rfq_number='RFQ-2026-001'`);
    if (rfq1) {
        const rfqItems = DA(`SELECT id FROM rfq_items WHERE rfq_id=?`,[rfq1.id]);
        const q1 = R(`INSERT OR IGNORE INTO quotations (quotation_number,rfq_id,supplier_id,total_amount,validity_date,delivery_days,status) VALUES (?,?,?,?,?,?,?)`,
            ['QUO-2026-001',rfq1.id,supId('SUP-001'),97350,fwd(30),14,'approved']);
        if (q1?.lastInsertRowid) {
            R(`INSERT INTO quotation_items (quotation_id,rfq_item_id,material_name,quantity,unit,unit_price,total_price) VALUES (?,?,?,?,?,?,?)`,
                [q1.lastInsertRowid,rfqItems[0]?.id||null,'EN8 Round Bar 50mm',500,'kg',82,41000]);
            R(`INSERT INTO quotation_items (quotation_id,rfq_item_id,material_name,quantity,unit,unit_price,total_price) VALUES (?,?,?,?,?,?,?)`,
                [q1.lastInsertRowid,rfqItems[1]?.id||null,'MS Flat Bar 50x10',1000,'kg',41.5,41500]);
        }
        R(`INSERT OR IGNORE INTO quotations (quotation_number,rfq_id,supplier_id,total_amount,validity_date,delivery_days,status) VALUES (?,?,?,?,?,?,?)`,
            ['QUO-2026-002',rfq1.id,supId('SUP-002'),101480,fwd(30),10,'rejected']);
    }

    // â”€â”€ PURCHASE ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const poDefs = [
        { num:'PO-2026-001', sc:'SUP-001', status:'received', od:ago(45), ed:ago(30), ad:ago(28),
          items:[{mc:'MAT-002',name:'EN8 Round Bar 50mm',qty:500,rcvd:500,up:82,tax:18},{mc:'MAT-001',name:'MS Flat Bar 50x10',qty:1000,rcvd:1000,up:41.5,tax:18}] },
        { num:'PO-2026-002', sc:'SUP-003', status:'received', od:ago(35), ed:ago(15), ad:ago(14),
          items:[{mc:'MAT-003',name:'Aluminum 6061 Sheet 3mm',qty:300,rcvd:300,up:185,tax:18}] },
        { num:'PO-2026-003', sc:'SUP-002', status:'approved', od:ago(10), ed:fwd(10), ad:null,
          items:[{mc:'MAT-006',name:'MS Round Bar 25mm',qty:500,rcvd:0,up:58,tax:18}] },
        { num:'PO-2026-004', sc:'SUP-004', status:'sent',     od:ago(5),  ed:fwd(20), ad:null,
          items:[{mc:'MAT-007',name:'Brass Rod 20mm',qty:200,rcvd:0,up:320,tax:18}] },
        { num:'PO-2026-005', sc:'SUP-005', status:'draft',    od:ago(2),  ed:fwd(25), ad:null,
          items:[{mc:'MAT-005',name:'Cutting Oil 20L',qty:100,rcvd:0,up:95,tax:5}] },
        { num:'PO-2026-006', sc:'SUP-001', status:'received', od:ago(60), ed:ago(45), ad:ago(42),
          items:[{mc:'MAT-009',name:'EN19 Round Bar 40mm',qty:200,rcvd:200,up:110,tax:18}] },
        { num:'PO-2026-007', sc:'SUP-006', status:'received', od:ago(20), ed:ago(8),  ad:ago(6),
          items:[{mc:'MAT-004',name:'SS 304 Pipe 2"',qty:100,rcvd:100,up:450,tax:18}] },
    ];
    for (const po of poDefs) {
        const si = supId(po.sc);
        const sub  = po.items.reduce((s,i)=>s+(i.qty*i.up),0);
        const taxA = po.items.reduce((s,i)=>s+(i.qty*i.up*i.tax/100),0);
        const res = R(`INSERT OR IGNORE INTO purchase_orders (po_number,supplier_id,order_date,expected_delivery,actual_delivery,status,subtotal,tax_amount,total_amount,created_by,approved_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [po.num,si,po.od,po.ed,po.ad,po.status,sub,taxA,sub+taxA,purchase.id,
             ['approved','received','sent'].includes(po.status)?admin.id:null]);
        if (!res?.lastInsertRowid) continue;
        const poId = res.lastInsertRowid;
        for (const item of po.items) {
            const iTotal = item.qty*item.up*(1+item.tax/100);
            R(`INSERT INTO purchase_order_items (po_id,material_name,quantity,received_quantity,unit_price,total_price,tax_percentage) VALUES (?,?,?,?,?,?,?)`,
                [poId,item.name,item.qty,item.rcvd,item.up,iTotal,item.tax]);
            const mid = matId(item.mc);
            if (po.status==='received' && item.rcvd>0 && mid) {
                const bRes = R(`INSERT OR IGNORE INTO material_batches (batch_number,material_id,supplier_id,po_id,quantity,available_quantity,received_date,qc_status,notes) VALUES (?,?,?,?,?,?,?,?,?)`,
                    [`BATCH-${po.num}-${item.mc}`,mid,si,poId,item.rcvd,item.rcvd,po.ad||po.od,'approved',`Received via ${po.num}`]);
                R(`INSERT INTO inventory_transactions (material_id,batch_id,transaction_type,quantity,reference_type,reference_id,notes,created_by) VALUES (?,?,?,?,?,?,?,?)`,
                    [mid,bRes?.lastInsertRowid||null,'purchase_receipt',item.rcvd,'purchase_order',poId,`PO Receipt: ${po.num}`,purchase.id]);
            }
        }
    }

    // â”€â”€ WORK ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const woDefs = [
        { num:'WO-2026-001', bom:'HCB-001', pName:'Hydraulic Cylinder Body',  pCode:'HCB-001', qty:10, produced:8, rejected:0, status:'in_process', priority:'high',   sd:ago(15), ed:fwd(5)  },
        { num:'WO-2026-002', bom:'PSA-001', pName:'Precision Shaft Assembly',  pCode:'PSA-001', qty:25, produced:25,rejected:1, status:'completed',  priority:'normal', sd:ago(30), ed:ago(10) },
        { num:'WO-2026-003', bom:'ABA-001', pName:'Aluminum Bracket Assembly', pCode:'ABA-001', qty:15, produced:0, rejected:0, status:'pending',    priority:'normal', sd:fwd(3),  ed:fwd(18) },
        { num:'WO-2026-004', bom:'SSF-001', pName:'Stainless Steel Flange',    pCode:'SSF-001', qty:20, produced:0, rejected:0, status:'released',   priority:'urgent', sd:ago(2),  ed:fwd(12) },
        { num:'WO-2026-005', bom:'HCB-001', pName:'Hydraulic Cylinder Body',   pCode:'HCB-001', qty:5,  produced:0, rejected:0, status:'on_hold',    priority:'high',   sd:ago(8),  ed:fwd(7)  },
        { num:'WO-2026-006', bom:'PSA-001', pName:'Precision Shaft Assembly',  pCode:'PSA-001', qty:12, produced:12,rejected:0, status:'completed',  priority:'normal', sd:ago(45), ed:ago(20) },
        { num:'WO-2026-007', bom:'ABA-001', pName:'Aluminum Bracket Assembly', pCode:'ABA-001', qty:8,  produced:0, rejected:0, status:'cancelled',  priority:'low',    sd:ago(20), ed:ago(5)  },
        { num:'WO-2026-008', bom:'SSF-001', pName:'Stainless Steel Flange',    pCode:'SSF-001', qty:30, produced:0, rejected:0, status:'pending',    priority:'normal', sd:fwd(5),  ed:fwd(25) },
    ];
    for (const wo of woDefs) {
        const bid = bomId(wo.bom);
        const res = R(`INSERT OR IGNORE INTO work_orders (wo_number,bom_id,product_name,product_code,planned_quantity,produced_quantity,rejected_quantity,planned_start,planned_end,status,priority,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [wo.num,bid,wo.pName,wo.pCode,wo.qty,wo.produced,wo.rejected,wo.sd,wo.ed,wo.status,wo.priority,prod.id]);
        if (!res?.lastInsertRowid) continue;
        const woId = res.lastInsertRowid;
        const ops  = bid ? DA(`SELECT * FROM bom_operations WHERE bom_id=? ORDER BY sequence_number`,[bid]) : [];
        const mcs  = ['MCH-001','MCH-002','MCH-004','MCH-005'];
        for (let i=0; i<ops.length; i++) {
            const op = ops[i];
            const opStat = wo.status==='completed'?'completed':wo.status==='in_process'&&i<3?'completed':wo.status==='in_process'&&i===3?'in_progress':'pending';
            R(`INSERT OR IGNORE INTO work_order_operations (wo_id,operation_name,operation_type,sequence_number,machine_id,operator_id,planned_hours,actual_hours,output_quantity,status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [woId,op.operation_name,op.operation_type,op.sequence_number,machId(mcs[i%mcs.length]),oper.id,op.estimated_time_hours,opStat==='completed'?op.estimated_time_hours*1.05:null,opStat==='completed'?wo.produced:0,opStat]);
        }
    }
    const woId = num => G(`SELECT id FROM work_orders WHERE wo_number=?`,[num])?.id;

    // â”€â”€ PARTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const partStatList = ['passed','passed','passed','failed','rework','passed','in_production','inspecting'];
    for (const [woNum,pCode,n] of [['WO-2026-002','PSA-001',8],['WO-2026-006','PSA-001',5],['WO-2026-001','HCB-001',8]]) {
        const wid = woId(woNum); if (!wid) continue;
        const pName = G(`SELECT product_name FROM work_orders WHERE id=?`,[wid])?.product_name||pCode;
        for (let i=1; i<=n; i++) {
            const serial = `SN-${pCode}-${String(wid).padStart(3,'0')}-${String(i).padStart(4,'0')}`;
            const status = woNum==='WO-2026-001'?(i<=5?'inspecting':'in_production'):partStatList[i%partStatList.length];
            const res = R(`INSERT OR IGNORE INTO parts (serial_number,qr_code,wo_id,product_name,product_code,status,created_by) VALUES (?,?,?,?,?,?,?)`,
                [serial,`QR-${pCode}-${wid}-${i}`,wid,pName,pCode,status,prod.id]);
            if (res?.lastInsertRowid)
                R(`INSERT INTO part_history (part_id,event_type,notes,performed_by) VALUES (?,?,?,?)`,
                    [res.lastInsertRowid,'created','Part created from work order',prod.id]);
        }
    }

    // â”€â”€ INSPECTION PLANS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const planDefs = [
        ['HCB-001','final','HCB Final Inspection',[['Outer Diameter','dimensional',50.0,0.05,-0.05,'mm',1],['Inner Bore Dia','dimensional',30.0,0.02,-0.02,'mm',1],['Surface Finish','visual',null,null,null,'Ra',0],['Overall Length','dimensional',200.0,0.1,-0.1,'mm',0]]],
        ['HCB-001','in_process','HCB In-Process QC',[['OD After Rough Cut','dimensional',51.0,0.2,-0.2,'mm',1],['Length After Cutting','dimensional',202.0,0.5,-0.5,'mm',0]]],
        ['PSA-001','final','PSA Final Inspection',[['Shaft Diameter','dimensional',25.0,0.02,-0.02,'mm',1],['Straightness','dimensional',0,0.05,0,'mm',1],['Surface Roughness','visual',null,null,null,'Ra',0]]],
        ['ABA-001','incoming','Aluminum Incoming QC',[['Sheet Thickness','dimensional',3.0,0.1,-0.1,'mm',1],['Material Grade','chemical',null,null,null,'grade',1]]],
    ];
    for (const [bc,type,name,items] of planDefs) {
        const bid = bomId(bc); if (!bid) continue;
        const res = R(`INSERT OR IGNORE INTO inspection_plans (bom_id,product_code,inspection_type,name) VALUES (?,?,?,?)`,
            [bid,bc,type,name]);
        if (!res?.lastInsertRowid) continue;
        const planId = res.lastInsertRowid;
        for (const [pname,ptype,nom,ut,lt,unit,crit] of items)
            R(`INSERT INTO inspection_plan_items (plan_id,parameter_name,parameter_type,nominal_value,upper_tolerance,lower_tolerance,unit,is_critical) VALUES (?,?,?,?,?,?,?,?)`,
                [planId,pname,ptype,nom,ut,lt,unit,crit]);
    }
    const planId = (bc,tp) => G(`SELECT id FROM inspection_plans WHERE product_code=? AND inspection_type=?`,[bc,tp])?.id;

    // â”€â”€ INSPECTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const inspDefs = [
        {num:'INS-2026-001',woNum:'WO-2026-002',pid:planId('PSA-001','final'),type:'final',      qty:25,passed:24,failed:1,rework:0,status:'failed',         remarks:'1 part OD out of tolerance',  date:ago(8),
          results:[['Shaft Diameter',25.03,'pass'],['Straightness',0.08,'fail']]},
        {num:'INS-2026-002',woNum:'WO-2026-002',pid:planId('PSA-001','final'),type:'final',      qty:24,passed:24,failed:0,rework:0,status:'passed',          remarks:'All within spec after rework', date:ago(6),
          results:[['Shaft Diameter',25.01,'pass'],['Straightness',0.03,'pass']]},
        {num:'INS-2026-003',woNum:'WO-2026-001',pid:planId('HCB-001','in_process'),type:'in_process',qty:5,passed:4,failed:0,rework:1,status:'rework_required',remarks:'Surface finish needs rework',   date:ago(5),
          results:[['Outer Diameter',50.02,'pass'],['Inner Bore Dia',30.01,'pass'],['Surface Finish',null,'rework']]},
        {num:'INS-2026-004',woNum:'WO-2026-001',pid:planId('HCB-001','in_process'),type:'in_process',qty:3,passed:3,failed:0,rework:0,status:'passed',         remarks:'Re-inspection all passed',    date:ago(3),
          results:[['Outer Diameter',50.01,'pass'],['Inner Bore Dia',30.00,'pass'],['Surface Finish',null,'pass']]},
        {num:'INS-2026-005',woNum:'WO-2026-006',pid:planId('PSA-001','final'),type:'final',      qty:12,passed:12,failed:0,rework:0,status:'passed',          remarks:'100% pass rate',              date:ago(20),
          results:[['Shaft Diameter',24.99,'pass'],['Straightness',0.02,'pass']]},
        {num:'INS-2026-006',woNum:'WO-2026-004',pid:null,                     type:'incoming',   qty:20,passed:18,failed:2,rework:0,status:'failed',          remarks:'2 flanges with deviations',   date:ago(2),
          results:[['Sheet Thickness',3.22,'fail'],['Material Grade',null,'pass']]},
        {num:'INS-2026-007',woNum:'WO-2026-001',pid:planId('HCB-001','final'),type:'final',      qty:8, passed:8, failed:0,rework:0,status:'passed',          remarks:'Batch approved for dispatch', date:ago(1),
          results:[['Outer Diameter',49.98,'pass'],['Inner Bore Dia',29.99,'pass'],['Surface Finish',null,'pass'],['Overall Length',200.05,'pass']]},
    ];
    for (const ins of inspDefs) {
        const wid = woId(ins.woNum);
        const res = R(`INSERT OR IGNORE INTO inspections (inspection_number,plan_id,wo_id,inspector_id,inspection_type,inspection_date,quantity_inspected,quantity_passed,quantity_failed,quantity_rework,overall_status,remarks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [ins.num,ins.pid,wid,quality.id,ins.type,ins.date,ins.qty,ins.passed,ins.failed,ins.rework,ins.status,ins.remarks]);
        if (!res?.lastInsertRowid) continue;
        for (const [pname,val,stat] of ins.results)
            R(`INSERT INTO inspection_results (inspection_id,parameter_name,measured_value,status) VALUES (?,?,?,?)`,
                [res.lastInsertRowid,pname,val,stat]);
    }

    // â”€â”€ FINISHED GOODS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fgDefs = [
        {code:'FG-2026-001',name:'Hydraulic Cylinder Body',  pc:'HCB-001',wo:'WO-2026-001',qty:8, avail:5, unit:'pcs',cost:4800,qs:'approved', loc:'Rack A-01'},
        {code:'FG-2026-002',name:'Precision Shaft Assembly',  pc:'PSA-001',wo:'WO-2026-002',qty:24,avail:20,unit:'pcs',cost:1850,qs:'approved', loc:'Rack A-02'},
        {code:'FG-2026-003',name:'Precision Shaft Assembly',  pc:'PSA-001',wo:'WO-2026-006',qty:12,avail:12,unit:'pcs',cost:1900,qs:'approved', loc:'Rack A-03'},
        {code:'FG-2026-004',name:'Hydraulic Cylinder Body',  pc:'HCB-001',wo:'WO-2026-001',qty:3, avail:0, unit:'pcs',cost:4850,qs:'on_hold',  loc:'Hold Area'},
        {code:'FG-2026-005',name:'Aluminum Bracket Assembly',pc:'ABA-001',wo:null,          qty:10,avail:8, unit:'pcs',cost:2200,qs:'approved', loc:'Rack B-01'},
        {code:'FG-2026-006',name:'Stainless Steel Flange',   pc:'SSF-001',wo:null,          qty:5, avail:5, unit:'pcs',cost:3100,qs:'approved', loc:'Rack B-02'},
    ];
    for (const fg of fgDefs) {
        const wid = fg.wo ? woId(fg.wo) : null;
        R(`INSERT OR IGNORE INTO finished_goods (item_code,product_name,product_code,wo_id,quantity,available_quantity,unit,unit_cost,total_cost,quality_status,storage_location) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [fg.code,fg.name,fg.pc,wid,fg.qty,fg.avail,fg.unit,fg.cost,fg.qty*fg.cost,fg.qs,fg.loc]);
    }
    const fgId = code => G(`SELECT id FROM finished_goods WHERE item_code=?`,[code])?.id;

    // â”€â”€ DISPATCH LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const [num,fc,customer,cAddr,qty,date,challan,invoice,trans,vehicle,status] of [
        ['DISP-2026-001','FG-2026-002','Mahindra & Mahindra Ltd','Nashik Plant, MH',        5,ago(10),'DC-M001','INV-M001','VRL Logistics','MH12AB1234','delivered'],
        ['DISP-2026-002','FG-2026-002','Tata Motors Ltd',         'Pune Plant, MH',          8,ago(5), 'DC-T001','INV-T001','Gati Limited', 'GJ05CD5678','dispatched'],
        ['DISP-2026-003','FG-2026-003','Bajaj Auto Ltd',          'Waluj, Aurangabad, MH',   6,ago(3), 'DC-B001','INV-B001','DTDC Courier', 'MH14EF9012','dispatched'],
        ['DISP-2026-004','FG-2026-001','Kirloskar Brothers Ltd',  'Kirloskarvadi, MH',       3,ago(1), 'DC-K001','INV-K001','VRL Logistics','KA09GH3456','pending'],
        ['DISP-2026-005','FG-2026-005','Bharat Forge Ltd',        'Mundhwa, Pune, MH',       2,ago(15),'DC-BF001','INV-BF001','Ekart',       'MH02IJ7890','delivered'],
        ['DISP-2026-006','FG-2026-006','L&T Heavy Engineering',   'Mumbai, MH',              5,ago(7), 'DC-L001','INV-L001','GATI Ltd',    'MH04KL1122','delivered'],
    ]) {
        const fid = fgId(fc); if (!fid) continue;
        R(`INSERT OR IGNORE INTO dispatch_logs (dispatch_number,finished_good_id,customer_name,customer_address,dispatch_date,quantity,delivery_challan,invoice_number,transporter,vehicle_number,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [num,fid,customer,cAddr,date,qty,challan,invoice,trans,vehicle,status,prod.id]);
    }

    // â”€â”€ AUDIT LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for (const [uid,action,entity] of [
        [admin.id,'LOGIN','user'],[purchase.id,'CREATE','rfq'],[purchase.id,'CREATE','purchase_order'],
        [prod.id,'CREATE','work_order'],[prod.id,'STATUS_UPDATE','work_order'],
        [quality.id,'CREATE','inspection'],[prod.id,'CREATE','finished_goods'],
        [prod.id,'CREATE','dispatch'],[admin.id,'CREATE','user'],
    ]) R(`INSERT INTO audit_logs (user_id,action,entity_type,ip_address) VALUES (?,?,?,?)`,
        [uid,action,entity,'127.0.0.1']);

    console.log('âœ… Full demo seed complete!');
    console.log('ðŸ“§ Login credentials:');
    console.log('   Admin:              admin@trinixerp.com / Password@123');
    console.log('   Purchase Manager:   purchase@trinixerp.com / Password@123');
    console.log('   Production Manager: production@trinixerp.com / Password@123');
    console.log('   Machine Operator:   operator@trinixerp.com / Password@123');
    console.log('   Quality Inspector:  quality@trinixerp.com / Password@123');
}

module.exports = { setup };

if (require.main === module) {
    setup();
    process.exit(0);
}

