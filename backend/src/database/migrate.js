require('dotenv').config();
const db = require('../config/database');

const createTables = async () => {
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        // Users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'purchase_manager', 'production_manager', 'machine_operator', 'quality_inspector')),
        department VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Audit logs
        await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100),
        entity_id INTEGER,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Suppliers table
        await client.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',
        pincode VARCHAR(20),
        gst_number VARCHAR(50),
        payment_terms VARCHAR(100),
        lead_time_days INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        on_time_delivery_rate DECIMAL(5,2) DEFAULT 0,
        quality_rating DECIMAL(3,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blacklisted')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // RFQs
        await client.query(`
      CREATE TABLE IF NOT EXISTS rfqs (
        id SERIAL PRIMARY KEY,
        rfq_number VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        required_by DATE,
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'quotations_received', 'closed', 'cancelled')),
        created_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS rfq_items (
        id SERIAL PRIMARY KEY,
        rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
        material_name VARCHAR(255) NOT NULL,
        description TEXT,
        quantity DECIMAL(12,3) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        specifications TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS rfq_suppliers (
        id SERIAL PRIMARY KEY,
        rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
        supplier_id INTEGER REFERENCES suppliers(id),
        sent_at TIMESTAMP,
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'responded', 'declined')),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Quotations
        await client.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        quotation_number VARCHAR(50) UNIQUE NOT NULL,
        rfq_id INTEGER REFERENCES rfqs(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        validity_date DATE,
        total_amount DECIMAL(15,2),
        currency VARCHAR(10) DEFAULT 'INR',
        payment_terms VARCHAR(100),
        delivery_days INTEGER,
        status VARCHAR(30) DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'approved', 'rejected')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        rfq_item_id INTEGER REFERENCES rfq_items(id),
        material_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(12,3) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        unit_price DECIMAL(12,4) NOT NULL,
        total_price DECIMAL(15,2) NOT NULL,
        tax_percentage DECIMAL(5,2) DEFAULT 18,
        lead_time_days INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Purchase Orders
        await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        po_number VARCHAR(50) UNIQUE NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        quotation_id INTEGER REFERENCES quotations(id),
        rfq_id INTEGER REFERENCES rfqs(id),
        order_date DATE DEFAULT CURRENT_DATE,
        expected_delivery DATE,
        actual_delivery DATE,
        status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'received', 'cancelled', 'partially_received')),
        payment_terms VARCHAR(100),
        shipping_address TEXT,
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'INR',
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
        material_name VARCHAR(255) NOT NULL,
        description TEXT,
        quantity DECIMAL(12,3) NOT NULL,
        received_quantity DECIMAL(12,3) DEFAULT 0,
        unit VARCHAR(50) NOT NULL,
        unit_price DECIMAL(12,4) NOT NULL,
        total_price DECIMAL(15,2) NOT NULL,
        tax_percentage DECIMAL(5,2) DEFAULT 18,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Materials
        await client.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id SERIAL PRIMARY KEY,
        code VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        unit VARCHAR(50) NOT NULL,
        minimum_stock DECIMAL(12,3) DEFAULT 0,
        reorder_point DECIMAL(12,3) DEFAULT 0,
        current_stock DECIMAL(12,3) DEFAULT 0,
        unit_cost DECIMAL(12,4) DEFAULT 0,
        material_type VARCHAR(50) DEFAULT 'raw_material' CHECK (material_type IN ('raw_material', 'semi_finished', 'consumable', 'packaging')),
        specifications TEXT,
        hsn_code VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Material Batches
        await client.query(`
      CREATE TABLE IF NOT EXISTS material_batches (
        id SERIAL PRIMARY KEY,
        batch_number VARCHAR(100) UNIQUE NOT NULL,
        heat_number VARCHAR(100),
        material_id INTEGER REFERENCES materials(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        po_id INTEGER REFERENCES purchase_orders(id),
        received_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE,
        quantity DECIMAL(12,3) NOT NULL,
        available_quantity DECIMAL(12,3) NOT NULL,
        unit_cost DECIMAL(12,4),
        total_cost DECIMAL(15,2),
        certificate_number VARCHAR(100),
        qc_status VARCHAR(30) DEFAULT 'pending' CHECK (qc_status IN ('pending', 'approved', 'rejected', 'on_hold')),
        storage_location VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Inventory Transactions
        await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id SERIAL PRIMARY KEY,
        material_id INTEGER REFERENCES materials(id),
        batch_id INTEGER REFERENCES material_batches(id),
        transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('purchase_receipt', 'production_issue', 'return', 'adjustment', 'scrap', 'transfer')),
        quantity DECIMAL(12,3) NOT NULL,
        reference_type VARCHAR(50),
        reference_id INTEGER,
        unit_cost DECIMAL(12,4),
        total_cost DECIMAL(15,2),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // BOMs
        await client.query(`
      CREATE TABLE IF NOT EXISTS boms (
        id SERIAL PRIMARY KEY,
        bom_number VARCHAR(50) UNIQUE NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_code VARCHAR(100) UNIQUE NOT NULL,
        version VARCHAR(20) DEFAULT '1.0',
        description TEXT,
        drawing_number VARCHAR(100),
        revision_date DATE,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'obsolete')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS bom_items (
        id SERIAL PRIMARY KEY,
        bom_id INTEGER REFERENCES boms(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES materials(id),
        material_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(12,4) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        scrap_percentage DECIMAL(5,2) DEFAULT 0,
        sequence_number INTEGER DEFAULT 1,
        is_critical BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS bom_operations (
        id SERIAL PRIMARY KEY,
        bom_id INTEGER REFERENCES boms(id) ON DELETE CASCADE,
        operation_name VARCHAR(255) NOT NULL,
        operation_type VARCHAR(50) CHECK (operation_type IN ('milling', 'cnc', 'turning', 'grinding', 'welding', 'assembly', 'quality_check', 'other')),
        sequence_number INTEGER NOT NULL,
        estimated_time_hours DECIMAL(8,2),
        machine_type VARCHAR(100),
        skill_required VARCHAR(100),
        instructions TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Machines
        await client.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY,
        machine_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        machine_type VARCHAR(50) CHECK (machine_type IN ('milling', 'cnc', 'turning', 'grinding', 'welding', 'assembly', 'inspection', 'other')),
        manufacturer VARCHAR(255),
        model VARCHAR(255),
        serial_number VARCHAR(100),
        location VARCHAR(100),
        capacity VARCHAR(100),
        status VARCHAR(30) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'breakdown', 'idle')),
        last_maintenance DATE,
        next_maintenance DATE,
        hourly_rate DECIMAL(10,2) DEFAULT 0,
        specifications JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Work Orders
        await client.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id SERIAL PRIMARY KEY,
        wo_number VARCHAR(50) UNIQUE NOT NULL,
        bom_id INTEGER REFERENCES boms(id),
        product_name VARCHAR(255) NOT NULL,
        product_code VARCHAR(100),
        planned_quantity DECIMAL(12,3) NOT NULL,
        produced_quantity DECIMAL(12,3) DEFAULT 0,
        rejected_quantity DECIMAL(12,3) DEFAULT 0,
        planned_start DATE,
        planned_end DATE,
        actual_start TIMESTAMP,
        actual_end TIMESTAMP,
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'in_process', 'completed', 'on_hold', 'cancelled')),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        customer_order VARCHAR(100),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        production_manager INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_materials (
        id SERIAL PRIMARY KEY,
        wo_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
        material_id INTEGER REFERENCES materials(id),
        batch_id INTEGER REFERENCES material_batches(id),
        required_quantity DECIMAL(12,3) NOT NULL,
        issued_quantity DECIMAL(12,3) DEFAULT 0,
        returned_quantity DECIMAL(12,3) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partially_issued', 'fully_issued')),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_operations (
        id SERIAL PRIMARY KEY,
        wo_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE,
        operation_name VARCHAR(255) NOT NULL,
        operation_type VARCHAR(50),
        sequence_number INTEGER NOT NULL,
        machine_id INTEGER REFERENCES machines(id),
        operator_id INTEGER REFERENCES users(id),
        planned_start TIMESTAMP,
        planned_end TIMESTAMP,
        actual_start TIMESTAMP,
        actual_end TIMESTAMP,
        planned_hours DECIMAL(8,2),
        actual_hours DECIMAL(8,2),
        planned_quantity DECIMAL(12,3),
        output_quantity DECIMAL(12,3),
        rejected_quantity DECIMAL(12,3) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Machine Logs
        await client.query(`
      CREATE TABLE IF NOT EXISTS machine_logs (
        id SERIAL PRIMARY KEY,
        machine_id INTEGER REFERENCES machines(id),
        wo_operation_id INTEGER REFERENCES work_order_operations(id),
        operator_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        run_time_hours DECIMAL(8,2),
        output_quantity DECIMAL(12,3),
        cycle_time_seconds DECIMAL(10,2),
        downtime_minutes DECIMAL(8,2) DEFAULT 0,
        downtime_reason VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Parts (for traceability)
        await client.query(`
      CREATE TABLE IF NOT EXISTS parts (
        id SERIAL PRIMARY KEY,
        serial_number VARCHAR(100) UNIQUE NOT NULL,
        qr_code VARCHAR(255) UNIQUE,
        wo_id INTEGER REFERENCES work_orders(id),
        bom_id INTEGER REFERENCES boms(id),
        product_name VARCHAR(255) NOT NULL,
        product_code VARCHAR(100),
        batch_number VARCHAR(100),
        status VARCHAR(30) DEFAULT 'in_production' CHECK (status IN ('in_production', 'inspecting', 'passed', 'failed', 'rework', 'scrapped', 'dispatched')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS part_history (
        id SERIAL PRIMARY KEY,
        part_id INTEGER REFERENCES parts(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_description TEXT,
        operation_id INTEGER REFERENCES work_order_operations(id),
        machine_id INTEGER REFERENCES machines(id),
        operator_id INTEGER REFERENCES users(id),
        material_batch_id INTEGER REFERENCES material_batches(id),
        inspection_id INTEGER,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Inspections
        await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_plans (
        id SERIAL PRIMARY KEY,
        bom_id INTEGER REFERENCES boms(id),
        product_code VARCHAR(100),
        inspection_type VARCHAR(50) CHECK (inspection_type IN ('incoming', 'in_process', 'final', 'outgoing')),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_plan_items (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES inspection_plans(id) ON DELETE CASCADE,
        parameter_name VARCHAR(255) NOT NULL,
        parameter_type VARCHAR(50) CHECK (parameter_type IN ('dimensional', 'visual', 'functional', 'material')),
        nominal_value DECIMAL(12,4),
        upper_tolerance DECIMAL(12,4),
        lower_tolerance DECIMAL(12,4),
        unit VARCHAR(50),
        is_critical BOOLEAN DEFAULT false,
        measurement_method VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS inspections (
        id SERIAL PRIMARY KEY,
        inspection_number VARCHAR(50) UNIQUE NOT NULL,
        plan_id INTEGER REFERENCES inspection_plans(id),
        wo_id INTEGER REFERENCES work_orders(id),
        wo_operation_id INTEGER REFERENCES work_order_operations(id),
        part_id INTEGER REFERENCES parts(id),
        inspector_id INTEGER REFERENCES users(id),
        inspection_type VARCHAR(50),
        inspection_date TIMESTAMP DEFAULT NOW(),
        quantity_inspected DECIMAL(12,3),
        quantity_passed DECIMAL(12,3) DEFAULT 0,
        quantity_failed DECIMAL(12,3) DEFAULT 0,
        quantity_rework DECIMAL(12,3) DEFAULT 0,
        overall_status VARCHAR(20) DEFAULT 'pending' CHECK (overall_status IN ('pending', 'passed', 'failed', 'partial_pass', 'rework_required')),
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS inspection_results (
        id SERIAL PRIMARY KEY,
        inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,
        plan_item_id INTEGER REFERENCES inspection_plan_items(id),
        parameter_name VARCHAR(255) NOT NULL,
        measured_value DECIMAL(12,4),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'pass', 'fail', 'rework')),
        deviation DECIMAL(12,4),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Finished Goods
        await client.query(`
      CREATE TABLE IF NOT EXISTS finished_goods (
        id SERIAL PRIMARY KEY,
        item_code VARCHAR(100) UNIQUE NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_code VARCHAR(100),
        wo_id INTEGER REFERENCES work_orders(id),
        quantity DECIMAL(12,3) NOT NULL,
        available_quantity DECIMAL(12,3) NOT NULL,
        unit VARCHAR(50) DEFAULT 'pcs',
        batch_number VARCHAR(100),
        manufacturing_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE,
        quality_status VARCHAR(30) DEFAULT 'approved' CHECK (quality_status IN ('approved', 'on_hold', 'rejected')),
        storage_location VARCHAR(100),
        unit_cost DECIMAL(12,4),
        total_cost DECIMAL(15,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS dispatch_logs (
        id SERIAL PRIMARY KEY,
        dispatch_number VARCHAR(50) UNIQUE NOT NULL,
        finished_good_id INTEGER REFERENCES finished_goods(id),
        customer_name VARCHAR(255),
        customer_address TEXT,
        dispatch_date DATE DEFAULT CURRENT_DATE,
        quantity DECIMAL(12,3) NOT NULL,
        delivery_challan VARCHAR(100),
        invoice_number VARCHAR(100),
        transporter VARCHAR(255),
        vehicle_number VARCHAR(50),
        status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'delivered', 'returned')),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_work_orders_product ON work_orders(product_code)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_parts_serial ON parts(serial_number)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_parts_wo ON parts(wo_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_part_history_part ON part_history(part_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_inspections_part ON inspections(part_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_machine_logs_machine ON machine_logs(machine_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)');

        await client.query('COMMIT');
        console.log('✅ Database migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

createTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
