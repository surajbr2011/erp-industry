/**
 * Trinix ERP — Full Demo Seed Script
 * Seeds rich demo data for ALL 13 modules so every page has meaningful content.
 * Run: node backend/src/database/seed_demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

const pw = bcrypt.hashSync('Password@123', 10);

function run(sql, params = []) {
    try { return db.prepare(sql).run(...params); }
    catch (e) { return null; }
}
function get(sql, params = []) { return db.prepare(sql).get(...params); }
function all(sql, params = []) { return db.prepare(sql).all(...params); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0]; }
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; }
function cnt(t) { return db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; }

console.log('\n🌱  Starting full demo seed...\n');

// ─── USERS ────────────────────────────────────────────────────────────────────
console.log('[1/13] Users...');
const users = [
    ['Admin User',      'admin@trinixerp.com',      'admin',              'Management',  '9876543210'],
    ['Rajesh Kumar',    'purchase@trinixerp.com',   'purchase_manager',   'Procurement', '9876543211'],
    ['Suresh Patel',    'production@trinixerp.com', 'production_manager', 'Production',  '9876543212'],
    ['Anil Sharma',     'operator@trinixerp.com',   'machine_operator',   'Shop Floor',  '9876543213'],
    ['Priya Singh',     'quality@trinixerp.com',    'quality_inspector',  'Quality',     '9876543214'],
    ['Deepak Verma',    'deepak@trinixerp.com',     'machine_operator',   'Shop Floor',  '9876543215'],
    ['Kavita Joshi',    'kavita@trinixerp.com',     'quality_inspector',  'Quality',     '9876543216'],
    ['Mohit Rana',      'mohit@trinixerp.com',      'purchase_manager',   'Procurement', '9876543217'],
];
for (const [name, email, role, dept, phone] of users) {
    run(`INSERT OR IGNORE INTO users (name,email,password,role,department,phone) VALUES (?,?,?,?,?,?)`,
        [name, email, pw, role, dept, phone]);
}
const admin    = get(`SELECT id FROM users WHERE email='admin@trinixerp.com'`);
const purchase = get(`SELECT id FROM users WHERE email='purchase@trinixerp.com'`);
const prod     = get(`SELECT id FROM users WHERE email='production@trinixerp.com'`);
const oper     = get(`SELECT id FROM users WHERE email='operator@trinixerp.com'`);
const quality  = get(`SELECT id FROM users WHERE email='quality@trinixerp.com'`);

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
console.log('[2/13] Suppliers...');
const suppData = [
    ['Steel India Ltd',          'SUP-001','Vikram Mehta',   'vikram@steelindia.com',    '9800001111','123 Industrial Area, Phase 1','Pune',      'Maharashtra','27AABCS1234A1Z5','Net 30',14,4.5,'active'],
    ['MetalCraft Solutions',     'SUP-002','Rohan Gupta',    'rohan@metalcraft.com',     '9800002222','456 MIDC Area',              'Mumbai',    'Maharashtra','27AABCM5678B2Z6','Net 15', 7,4.2,'active'],
    ['Precision Parts Co',       'SUP-003','Deepak Shah',    'deepak@precisionparts.com','9800003333','789 Industrial Estate',      'Nashik',    'Maharashtra','27AABCP9012C3Z7','Net 45',21,3.8,'active'],
    ['Allied Materials Pvt Ltd', 'SUP-004','Kavita Joshi',   'kavita@allied.com',        '9800004444','321 SEZ Area',               'Aurangabad','Maharashtra','27AABCA3456D4Z8','Net 30',10,4.7,'active'],
    ['Bharat Metals & Alloys',   'SUP-005','Sanjay Desai',   'sanjay@bharatmetals.com',  '9800005555','654 GIDC Phase 2',           'Surat',     'Gujarat',    '24AABCB7890E5Z9','Net 60',18,4.0,'active'],
    ['TechnoForge Industries',   'SUP-006','Amit Sharma',    'amit@technoforge.com',     '9800006666','12 Ambad MIDC',              'Nashik',    'Maharashtra','27AABCT1111F6Z1','Net 30',12,4.3,'active'],
    ['Mahindra Steel Corp',      'SUP-007','Ravi Pillai',    'ravi@mahindrasteel.com',   '9800007777','78 Pirangut Road',           'Pune',      'Maharashtra','27AABCM2222G7Z2','Net 45',20,3.5,'inactive'],
    ['Omega Fasteners Ltd',      'SUP-008','Neha Deshpande', 'neha@omegafasteners.com',  '9800008888','90 Jejuri MIDC',             'Pune',      'Maharashtra','27AABCO3333H8Z3','Net 30', 8,4.6,'active'],
];
for (const [name,code,cp,email,phone,addr,city,state,gst,pt,ltd,rating,status] of suppData) {
    run(`INSERT OR IGNORE INTO suppliers (name,code,contact_person,email,phone,address,city,state,gst_number,payment_terms,lead_time_days,rating,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [name,code,cp,email,phone,addr,city,state,gst,pt,ltd,rating,status]);
}
const supIds = all(`SELECT id,code FROM suppliers`).reduce((m,r)=>{m[r.code]=r.id;return m;},{});

// ─── MATERIALS ────────────────────────────────────────────────────────────────
console.log('[3/13] Materials...');
const matData = [
    ['MAT-001','MS Flat Bar 50x10',       'Mild Steel Flat Bar 50x10mm IS2062','Steel',          'kg', 500,750,1200, 65.00,'raw_material'],
    ['MAT-002','EN8 Round Bar 50mm',      'EN8 Steel Round Bar 50mm dia',      'Steel',          'kg', 300,500, 850, 82.00,'raw_material'],
    ['MAT-003','Aluminum 6061 Sheet 3mm', 'Aluminum 6061-T6 Sheet 3mm thick',  'Aluminum',       'kg', 200,350, 620,185.00,'raw_material'],
    ['MAT-004','SS 304 Pipe 2"',          'Stainless Steel 304 Pipe 2 inch',   'Stainless Steel','mtr',100,150, 280,450.00,'raw_material'],
    ['MAT-005','Cutting Oil 20L',         'CNC/Milling Cutting Oil',           'Consumables',   'ltr',  50, 80,  35, 95.00,'consumable'],
    ['MAT-006','MS Round Bar 25mm',       'Mild Steel Round Bar 25mm IS2062',  'Steel',          'kg', 400,600, 980, 58.00,'raw_material'],
    ['MAT-007','Brass Rod 20mm',          'Brass Rod 20mm dia Free Cutting',   'Brass',          'kg', 100,150, 250,320.00,'raw_material'],
    ['MAT-008','Insert TNMG 16',          'Carbide Insert TNMG 160408 Turning','Tooling',       'pcs',  20, 30,  18,380.00,'consumable'],
    ['MAT-009','EN19 Round Bar 40mm',     'EN19 Alloy Steel 40mm dia',         'Steel',          'kg', 150,250, 410,110.00,'raw_material'],
    ['MAT-010','Copper Sheet 2mm',        'Copper Sheet 99.9% pure 2mm thick', 'Copper',         'kg',  80,120, 190,680.00,'raw_material'],
    ['MAT-011','O-Ring Kit NBR',          'NBR O-Ring assorted sizes kit',     'Seals',         'set',  30, 50,  12,220.00,'consumable'],
    ['MAT-012','Bearing 6205',            'Deep groove ball bearing 6205',     'Bearings',      'pcs', 100,150,  75,185.00,'semi_finished'],
];
for (const [code,name,desc,cat,unit,min,reorder,stock,cost,type] of matData) {
    run(`INSERT OR IGNORE INTO materials (code,name,description,category,unit,minimum_stock,reorder_point,current_stock,unit_cost,material_type)
         VALUES (?,?,?,?,?,?,?,?,?,?)`, [code,name,desc,cat,unit,min,reorder,stock,cost,type]);
}
const matIds = all(`SELECT id,code FROM materials`).reduce((m,r)=>{m[r.code]=r.id;return m;},{});

// ─── MACHINES ─────────────────────────────────────────────────────────────────
console.log('[4/13] Machines...');
const machData = [
    ['MCH-001','VMC-1 Vertical Machining Center','VMC',       'BFW India',    'TC500',             'Shop Floor A','available',  90,daysFromNow(45)],
    ['MCH-002','CNC Turning Center-1',           'CNC Lathe', 'ACE Micromatic','Eco Turn 350',     'Shop Floor A','available',  90,daysFromNow(30)],
    ['MCH-003','Horizontal Milling Machine',     'Milling',   'HMT',          'FN2V',              'Shop Floor B','available', 180,daysFromNow(90)],
    ['MCH-004','Vertical Milling Machine',       'Milling',   'HMT',          'FN3V',              'Shop Floor B','in_use',    180,daysFromNow(75)],
    ['MCH-005','Cylindrical Grinding Machine',   'Grinding',  'Paragon',      'PGM-500',           'Shop Floor C','available',  90,daysFromNow(15)],
    ['MCH-006','Coordinate Measuring Machine',   'CMM',       'Mitutoyo',     'Crysta-Apex S 776', 'QC Lab',      'available', 365,daysFromNow(200)],
    ['MCH-007','CNC Turning Center-2',           'CNC Lathe', 'JYOTI CNC',    'DX 200',            'Shop Floor A','maintenance',90,daysFromNow(2)],
    ['MCH-008','Surface Grinding Machine',       'Grinding',  'Okamoto',      'ACC-618CNC',        'Shop Floor C','available',  90,daysFromNow(60)],
];
for (const [code,name,type,mfr,model,loc,status,interval,nxt] of machData) {
    run(`INSERT OR IGNORE INTO machines (machine_code,name,machine_type,manufacturer,model_number,location,status,maintenance_interval_days,next_maintenance_date)
         VALUES (?,?,?,?,?,?,?,?,?)`, [code,name,type,mfr,model,loc,status,interval,nxt]);
}
const machIds = all(`SELECT id,machine_code FROM machines`).reduce((m,r)=>{m[r.machine_code]=r.id;return m;},{});

// Machine logs (for 30-day utilization charts)
for (const [mcode, days, hrs, qty] of [
    ['MCH-001',5,7.5,4],['MCH-001',4,6.0,3],['MCH-001',3,8.0,5],['MCH-001',2,5.5,3],
    ['MCH-002',6,7.0,4],['MCH-002',3,8.0,5],['MCH-002',1,6.5,4],
    ['MCH-004',1,7.5,4],['MCH-004',4,8.0,5],
    ['MCH-005',7,6.0,3],['MCH-005',2,7.0,4],
    ['MCH-008',5,5.0,2],
]) {
    const mid = machIds[mcode];
    if (!mid) continue;
    const date = daysAgo(days);
    run(`INSERT INTO machine_logs (machine_id,operator_id,start_time,end_time,run_time_hours,output_quantity,notes) VALUES (?,?,?,?,?,?,?)`,
        [mid, oper.id, `${date} 08:00:00`, `${date} 16:00:00`, hrs, qty, 'Production run']);
}

// ─── BOMs ─────────────────────────────────────────────────────────────────────
console.log('[5/13] BOMs...');
const bomDefs = [
    { num:'BOM-2024-001', name:'Hydraulic Cylinder Body',   code:'HCB-001', ver:'1.0', status:'active',
      items:[['MAT-002',3.5,'kg',1,1],['MAT-001',1.2,'kg',2,0],['MAT-005',0.5,'ltr',3,0]],
      ops:[['Raw Material Cutting','other',1,0.5],['CNC Turning Rough','cnc',2,1.5],['CNC Turning Finish','cnc',3,1.0],['Milling','milling',4,2.0],['Grinding','grinding',5,1.5],['Final QC','quality_check',6,0.5]]},
    { num:'BOM-2024-002', name:'Precision Shaft Assembly',  code:'PSA-001', ver:'2.0', status:'active',
      items:[['MAT-006',2.0,'kg',1,1],['MAT-005',0.3,'ltr',2,0]],
      ops:[['CNC Turning','cnc',1,2.0],['Grinding','grinding',2,1.0],['QC Inspection','quality_check',3,0.5]]},
    { num:'BOM-2024-003', name:'Aluminum Bracket Assembly', code:'ABA-001', ver:'1.0', status:'active',
      items:[['MAT-003',1.8,'kg',1,1],['MAT-005',0.2,'ltr',2,0]],
      ops:[['CNC Milling','milling',1,1.5],['Drilling','other',2,0.5],['Deburring','other',3,0.5],['Inspection','quality_check',4,0.3]]},
    { num:'BOM-2024-004', name:'Stainless Steel Flange',    code:'SSF-001', ver:'1.0', status:'active',
      items:[['MAT-004',0.8,'mtr',1,1],['MAT-008',2.0,'pcs',2,0]],
      ops:[['Cutting','other',1,0.3],['CNC Turning','cnc',2,1.2],['Drilling & Tapping','other',3,0.8],['QC','quality_check',4,0.3]]},
    { num:'BOM-2024-005', name:'Brass Valve Housing',       code:'BVH-001', ver:'1.0', status:'draft',
      items:[['MAT-007',1.5,'kg',1,1]],
      ops:[['CNC Turning','cnc',1,1.5],['Drilling','other',2,0.5],['Inspection','quality_check',3,0.3]]},
];
for (const b of bomDefs) {
    const res = run(`INSERT OR IGNORE INTO boms (bom_number,product_name,product_code,version,status,created_by) VALUES (?,?,?,?,?,?)`,
        [b.num,b.name,b.code,b.ver,b.status,admin.id]);
    if (!res?.lastInsertRowid) continue;
    const bomId = res.lastInsertRowid;
    for (const [mc,qty,unit,seq,crit] of b.items) {
        const matId = matIds[mc];
        const n = matId ? get(`SELECT name FROM materials WHERE id=?`,[matId])?.name||mc : mc;
        if (matId) run(`INSERT INTO bom_items (bom_id,material_id,material_name,quantity,unit,sequence_number,is_critical) VALUES (?,?,?,?,?,?,?)`,
            [bomId,matId,n,qty,unit,seq,crit]);
    }
    for (const [opName,opType,seq,hrs] of b.ops) {
        run(`INSERT INTO bom_operations (bom_id,operation_name,operation_type,sequence_number,estimated_time_hours) VALUES (?,?,?,?,?)`,
            [bomId,opName,opType,seq,hrs]);
    }
}
const bomIds = all(`SELECT id,product_code FROM boms`).reduce((m,r)=>{m[r.product_code]=r.id;return m;},{});

// ─── RFQs ─────────────────────────────────────────────────────────────────────
console.log('[6/13] RFQs & Quotations...');
const rfqDefs = [
    { num:'RFQ-2026-001', title:'Q1 Steel Raw Materials',     status:'quotations_received', reqBy:daysFromNow(15),
      items:[{mat:'EN8 Round Bar 50mm',qty:500,unit:'kg'},{mat:'MS Flat Bar 50x10',qty:1000,unit:'kg'}],
      sups:['SUP-001','SUP-002'] },
    { num:'RFQ-2026-002', title:'Aluminum Sheet Procurement',  status:'sent',               reqBy:daysFromNow(20),
      items:[{mat:'Aluminum 6061 Sheet 3mm',qty:300,unit:'kg'}],
      sups:['SUP-003','SUP-004'] },
    { num:'RFQ-2026-003', title:'Consumables & Tooling Q2',    status:'draft',              reqBy:daysFromNow(30),
      items:[{mat:'Cutting Oil 20L',qty:100,unit:'ltr'},{mat:'Insert TNMG 16',qty:50,unit:'pcs'}],
      sups:['SUP-005'] },
    { num:'RFQ-2026-004', title:'SS Pipe & Fittings',          status:'closed',             reqBy:daysAgo(10),
      items:[{mat:'SS 304 Pipe 2"',qty:150,unit:'mtr'}],
      sups:['SUP-001','SUP-006'] },
];
for (const rfq of rfqDefs) {
    const res = run(`INSERT OR IGNORE INTO rfqs (rfq_number,title,status,required_by,created_by) VALUES (?,?,?,?,?)`,
        [rfq.num,rfq.title,rfq.status,rfq.reqBy,purchase.id]);
    if (!res?.lastInsertRowid) continue;
    const rfqId = res.lastInsertRowid;
    for (const item of rfq.items) {
        run(`INSERT INTO rfq_items (rfq_id,material_name,quantity,unit) VALUES (?,?,?,?)`,
            [rfqId,item.mat,item.qty,item.unit]);
    }
    for (const sc of rfq.sups) {
        const supId = supIds[sc];
        if (supId) run(`INSERT OR IGNORE INTO rfq_suppliers (rfq_id,supplier_id,status) VALUES (?,?,?)`,
            [rfqId,supId,rfq.status==='draft'?'pending':'sent']);
    }
}
const rfqIds = all(`SELECT id,rfq_number FROM rfqs`).reduce((m,r)=>{m[r.rfq_number]=r.id;return m;},{});

// Quotations for RFQ-001 (quotations_received)
const rfq1Id = rfqIds['RFQ-2026-001'];
if (rfq1Id) {
    const rfqItems = all(`SELECT id FROM rfq_items WHERE rfq_id=?`,[rfq1Id]);
    const q1 = run(`INSERT OR IGNORE INTO quotations (quotation_number,rfq_id,supplier_id,total_amount,validity_date,delivery_days,status)
                    VALUES (?,?,?,?,?,?,?)`,
        ['QUO-2026-001',rfq1Id,supIds['SUP-001'],97350,daysFromNow(30),14,'approved']);
    if (q1?.lastInsertRowid) {
        run(`INSERT INTO quotation_items (quotation_id,rfq_item_id,material_name,quantity,unit,unit_price,total_price) VALUES (?,?,?,?,?,?,?)`,
            [q1.lastInsertRowid,rfqItems[0]?.id||null,'EN8 Round Bar 50mm',500,'kg',82,41000]);
        run(`INSERT INTO quotation_items (quotation_id,rfq_item_id,material_name,quantity,unit,unit_price,total_price) VALUES (?,?,?,?,?,?,?)`,
            [q1.lastInsertRowid,rfqItems[1]?.id||null,'MS Flat Bar 50x10',1000,'kg',41.5,41500]);
    }
    run(`INSERT OR IGNORE INTO quotations (quotation_number,rfq_id,supplier_id,total_amount,validity_date,delivery_days,status)
         VALUES (?,?,?,?,?,?,?)`,
        ['QUO-2026-002',rfq1Id,supIds['SUP-002'],101480,daysFromNow(30),10,'rejected']);
}

// ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────
console.log('[7/13] Purchase Orders...');
const poDefs = [
    { num:'PO-2026-001', supCode:'SUP-001', status:'received', od:daysAgo(45), ed:daysAgo(30), ad:daysAgo(28),
      items:[{mat:'MAT-002',name:'EN8 Round Bar 50mm',qty:500,rcvd:500,up:82,tax:18},{mat:'MAT-001',name:'MS Flat Bar 50x10',qty:1000,rcvd:1000,up:41.5,tax:18}] },
    { num:'PO-2026-002', supCode:'SUP-003', status:'received', od:daysAgo(35), ed:daysAgo(15), ad:daysAgo(14),
      items:[{mat:'MAT-003',name:'Aluminum 6061 Sheet 3mm',qty:300,rcvd:300,up:185,tax:18}] },
    { num:'PO-2026-003', supCode:'SUP-002', status:'approved', od:daysAgo(10), ed:daysFromNow(10), ad:null,
      items:[{mat:'MAT-006',name:'MS Round Bar 25mm',qty:500,rcvd:0,up:58,tax:18}] },
    { num:'PO-2026-004', supCode:'SUP-004', status:'sent',     od:daysAgo(5),  ed:daysFromNow(20),  ad:null,
      items:[{mat:'MAT-007',name:'Brass Rod 20mm',qty:200,rcvd:0,up:320,tax:18}] },
    { num:'PO-2026-005', supCode:'SUP-005', status:'draft',    od:daysAgo(2),  ed:daysFromNow(25),  ad:null,
      items:[{mat:'MAT-005',name:'Cutting Oil 20L',qty:100,rcvd:0,up:95,tax:5}] },
    { num:'PO-2026-006', supCode:'SUP-001', status:'received', od:daysAgo(60), ed:daysAgo(45), ad:daysAgo(42),
      items:[{mat:'MAT-009',name:'EN19 Round Bar 40mm',qty:200,rcvd:200,up:110,tax:18}] },
    { num:'PO-2026-007', supCode:'SUP-006', status:'received', od:daysAgo(20), ed:daysAgo(8),  ad:daysAgo(6),
      items:[{mat:'MAT-004',name:'SS 304 Pipe 2"',qty:100,rcvd:100,up:450,tax:18}] },
];
for (const po of poDefs) {
    const supId = supIds[po.supCode];
    const subtotal = po.items.reduce((s,i)=>s+(i.qty*i.up),0);
    const taxAmt   = po.items.reduce((s,i)=>s+(i.qty*i.up*i.tax/100),0);
    const total    = subtotal + taxAmt;
    const res = run(`INSERT OR IGNORE INTO purchase_orders (po_number,supplier_id,order_date,expected_delivery,actual_delivery,status,subtotal,tax_amount,total_amount,created_by,approved_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [po.num, supId, po.od, po.ed, po.ad, po.status, subtotal, taxAmt, total, purchase.id,
         ['approved','received','sent'].includes(po.status) ? admin.id : null]);
    if (!res?.lastInsertRowid) continue;
    const poId = res.lastInsertRowid;
    for (const item of po.items) {
        const iTotal = item.qty * item.up * (1 + item.tax/100);
        run(`INSERT INTO purchase_order_items (po_id,material_name,quantity,received_quantity,unit_price,total_price,tax_percentage)
             VALUES (?,?,?,?,?,?,?)`,
            [poId, item.name, item.qty, item.rcvd, item.up, iTotal, item.tax]);
        const matId = matIds[item.mat];
        if (po.status === 'received' && item.rcvd > 0 && matId) {
            const batchNo = `BATCH-${po.num}-${item.mat}`;
            const bRes = run(`INSERT OR IGNORE INTO material_batches (batch_number,material_id,supplier_id,po_id,quantity,available_quantity,received_date,qc_status,notes)
                              VALUES (?,?,?,?,?,?,?,?,?)`,
                [batchNo, matId, supId, poId, item.rcvd, item.rcvd, po.ad||po.od, 'approved', `Received via ${po.num}`]);
            run(`INSERT INTO inventory_transactions (material_id,batch_id,transaction_type,quantity,reference_type,reference_id,notes,created_by)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [matId, bRes?.lastInsertRowid||null, 'purchase_receipt', item.rcvd, 'purchase_order', poId, `PO Receipt: ${po.num}`, purchase.id]);
        }
    }
}

// ─── WORK ORDERS ──────────────────────────────────────────────────────────────
console.log('[8/13] Work Orders...');
const woDefs = [
    { num:'WO-2026-001', bom:'HCB-001', pName:'Hydraulic Cylinder Body',  pCode:'HCB-001', qty:10, produced:8, rejected:0, status:'in_process', priority:'high',   sd:daysAgo(15), ed:daysFromNow(5) },
    { num:'WO-2026-002', bom:'PSA-001', pName:'Precision Shaft Assembly',  pCode:'PSA-001', qty:25, produced:25,rejected:1, status:'completed',  priority:'normal', sd:daysAgo(30), ed:daysAgo(10) },
    { num:'WO-2026-003', bom:'ABA-001', pName:'Aluminum Bracket Assembly', pCode:'ABA-001', qty:15, produced:0, rejected:0, status:'pending',    priority:'normal', sd:daysFromNow(3),  ed:daysFromNow(18) },
    { num:'WO-2026-004', bom:'SSF-001', pName:'Stainless Steel Flange',    pCode:'SSF-001', qty:20, produced:0, rejected:0, status:'released',   priority:'urgent', sd:daysAgo(2),  ed:daysFromNow(12) },
    { num:'WO-2026-005', bom:'HCB-001', pName:'Hydraulic Cylinder Body',   pCode:'HCB-001', qty:5,  produced:0, rejected:0, status:'on_hold',    priority:'high',   sd:daysAgo(8),  ed:daysFromNow(7) },
    { num:'WO-2026-006', bom:'PSA-001', pName:'Precision Shaft Assembly',  pCode:'PSA-001', qty:12, produced:12,rejected:0, status:'completed',  priority:'normal', sd:daysAgo(45), ed:daysAgo(20) },
    { num:'WO-2026-007', bom:'ABA-001', pName:'Aluminum Bracket Assembly', pCode:'ABA-001', qty:8,  produced:0, rejected:0, status:'cancelled',  priority:'low',    sd:daysAgo(20), ed:daysAgo(5) },
    { num:'WO-2026-008', bom:'SSF-001', pName:'Stainless Steel Flange',    pCode:'SSF-001', qty:30, produced:0, rejected:0, status:'pending',    priority:'normal', sd:daysFromNow(5),  ed:daysFromNow(25) },
];
for (const wo of woDefs) {
    const bomId = bomIds[wo.bom];
    const res = run(`INSERT OR IGNORE INTO work_orders (wo_number,bom_id,product_name,product_code,planned_quantity,produced_quantity,rejected_quantity,planned_start,planned_end,status,priority,created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [wo.num, bomId, wo.pName, wo.pCode, wo.qty, wo.produced, wo.rejected, wo.sd, wo.ed, wo.status, wo.priority, prod.id]);
    if (!res?.lastInsertRowid) continue;
    const woId = res.lastInsertRowid;
    const ops  = bomId ? all(`SELECT * FROM bom_operations WHERE bom_id=? ORDER BY sequence_number`,[bomId]) : [];
    const mchCodes = ['MCH-001','MCH-002','MCH-004','MCH-005'];
    const completedStatuses = ['completed'];
    for (let i=0; i<ops.length; i++) {
        const op = ops[i];
        const opStat = wo.status==='completed'?'completed': wo.status==='in_process'&&i<3?'completed':wo.status==='in_process'&&i===3?'in_progress':'pending';
        const mchId  = machIds[mchCodes[i%mchCodes.length]];
        run(`INSERT OR IGNORE INTO work_order_operations (wo_id,operation_name,operation_type,sequence_number,machine_id,operator_id,planned_hours,actual_hours,output_quantity,status)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [woId, op.operation_name, op.operation_type, op.sequence_number, mchId, oper.id,
             op.estimated_time_hours, opStat==='completed'?op.estimated_time_hours*1.05:null,
             opStat==='completed'?wo.produced:0, opStat]);
    }
}
const woIds = all(`SELECT id,wo_number FROM work_orders`).reduce((m,r)=>{m[r.wo_number]=r.id;return m;},{});

// ─── PARTS ────────────────────────────────────────────────────────────────────
console.log('[9/13] Parts...');
const partStatusList = ['passed','passed','passed','failed','rework','passed','in_production','inspecting'];
for (const [woNum, pCode, prodQty] of [['WO-2026-002','PSA-001',8],['WO-2026-006','PSA-001',5],['WO-2026-001','HCB-001',8]]) {
    const woId = woIds[woNum];
    if (!woId) continue;
    const pName = get(`SELECT product_name FROM work_orders WHERE id=?`,[woId])?.product_name || pCode;
    for (let i=1; i<=prodQty; i++) {
        const serial = `SN-${pCode}-${String(woId).padStart(3,'0')}-${String(i).padStart(4,'0')}`;
        const qr     = `QR-${pCode}-${woId}-${i}`;
        const status = woNum==='WO-2026-001' ? (i<=5?'inspecting':'in_production') : partStatusList[i%partStatusList.length];
        const res = run(`INSERT OR IGNORE INTO parts (serial_number,qr_code,wo_id,product_name,product_code,status,created_by) VALUES (?,?,?,?,?,?,?)`,
            [serial,qr,woId,pName,pCode,status,prod.id]);
        if (res?.lastInsertRowid) {
            run(`INSERT INTO part_history (part_id,event_type,notes,performed_by) VALUES (?,?,?,?)`,
                [res.lastInsertRowid,'created','Part created from work order',prod.id]);
        }
    }
}

// ─── INSPECTION PLANS ─────────────────────────────────────────────────────────
console.log('[10/13] Inspection Plans...');
for (const [bomCode, type, name, items] of [
    ['HCB-001','final','HCB Final Inspection',[['Outer Diameter','dimensional',50.0,0.05,-0.05,'mm',1],['Inner Bore Dia','dimensional',30.0,0.02,-0.02,'mm',1],['Surface Finish','visual',null,null,null,'Ra',0],['Overall Length','dimensional',200.0,0.1,-0.1,'mm',0]]],
    ['HCB-001','in_process','HCB In-Process QC',[['OD After Rough Cut','dimensional',51.0,0.2,-0.2,'mm',1],['Length After Cutting','dimensional',202.0,0.5,-0.5,'mm',0]]],
    ['PSA-001','final','PSA Final Inspection',[['Shaft Diameter','dimensional',25.0,0.02,-0.02,'mm',1],['Straightness','dimensional',0,0.05,0,'mm',1],['Surface Roughness','visual',null,null,null,'Ra',0]]],
    ['ABA-001','incoming','Aluminum Incoming QC',[['Sheet Thickness','dimensional',3.0,0.1,-0.1,'mm',1],['Material Grade','chemical',null,null,null,'grade',1]]],
]) {
    const bomId = bomIds[bomCode];
    if (!bomId) continue;
    const res = run(`INSERT OR IGNORE INTO inspection_plans (bom_id,product_code,inspection_type,name) VALUES (?,?,?,?)`,
        [bomId,bomCode,type,name]);
    if (!res?.lastInsertRowid) continue;
    const planId = res.lastInsertRowid;
    for (const [pname,ptype,nom,ut,lt,unit,crit] of items) {
        run(`INSERT INTO inspection_plan_items (plan_id,parameter_name,parameter_type,nominal_value,upper_tolerance,lower_tolerance,unit,is_critical) VALUES (?,?,?,?,?,?,?,?)`,
            [planId,pname,ptype,nom,ut,lt,unit,crit]);
    }
}
const planMap = all(`SELECT id,product_code,inspection_type FROM inspection_plans`);
function getPlanId(code, type) { return planMap.find(p=>p.product_code===code&&p.inspection_type===type)?.id||null; }

// ─── INSPECTIONS ──────────────────────────────────────────────────────────────
console.log('[10b/13] Inspections...');
const inspDefs = [
    {num:'INS-2026-001',woNum:'WO-2026-002',planId:getPlanId('PSA-001','final'),type:'final',     qty:25,passed:24,failed:1,rework:0,status:'failed',   remarks:'1 part OD out of tolerance',date:daysAgo(8)},
    {num:'INS-2026-002',woNum:'WO-2026-002',planId:getPlanId('PSA-001','final'),type:'final',     qty:24,passed:24,failed:0,rework:0,status:'passed',   remarks:'All within spec after rework',date:daysAgo(6)},
    {num:'INS-2026-003',woNum:'WO-2026-001',planId:getPlanId('HCB-001','in_process'),type:'in_process',qty:5,passed:4,failed:0,rework:1,status:'rework_required',remarks:'Surface finish on 1 part requires rework',date:daysAgo(5)},
    {num:'INS-2026-004',woNum:'WO-2026-001',planId:getPlanId('HCB-001','in_process'),type:'in_process',qty:3,passed:3,failed:0,rework:0,status:'passed',   remarks:'Re-inspection all passed',date:daysAgo(3)},
    {num:'INS-2026-005',woNum:'WO-2026-006',planId:getPlanId('PSA-001','final'),type:'final',     qty:12,passed:12,failed:0,rework:0,status:'passed',   remarks:'100% pass rate',date:daysAgo(20)},
    {num:'INS-2026-006',woNum:'WO-2026-004',planId:null,type:'incoming',qty:20,passed:18,failed:2,rework:0,status:'failed',   remarks:'2 flanges with dimensional deviation',date:daysAgo(2)},
    {num:'INS-2026-007',woNum:'WO-2026-001',planId:getPlanId('HCB-001','final'),type:'final',     qty:8, passed:8, failed:0,rework:0,status:'passed',   remarks:'Batch approved for dispatch',date:daysAgo(1)},
];
for (const ins of inspDefs) {
    const woId = woIds[ins.woNum];
    const res = run(`INSERT OR IGNORE INTO inspections (inspection_number,plan_id,wo_id,inspector_id,inspection_type,inspection_date,quantity_inspected,quantity_passed,quantity_failed,quantity_rework,overall_status,remarks)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ins.num,ins.planId,woId,quality.id,ins.type,ins.date,ins.qty,ins.passed,ins.failed,ins.rework,ins.status,ins.remarks]);
    if (!res?.lastInsertRowid) continue;
    const insId = res.lastInsertRowid;
    const resultSets = {
        'INS-2026-001':[['Shaft Diameter',25.03,'pass'],['Straightness',0.08,'fail']],
        'INS-2026-002':[['Shaft Diameter',25.01,'pass'],['Straightness',0.03,'pass']],
        'INS-2026-003':[['Outer Diameter',50.02,'pass'],['Inner Bore Dia',30.01,'pass'],['Surface Finish',null,'rework']],
        'INS-2026-004':[['Outer Diameter',50.01,'pass'],['Inner Bore Dia',30.00,'pass'],['Surface Finish',null,'pass']],
        'INS-2026-005':[['Shaft Diameter',24.99,'pass'],['Straightness',0.02,'pass']],
        'INS-2026-006':[['Sheet Thickness',3.22,'fail'],['Material Grade',null,'pass']],
        'INS-2026-007':[['Outer Diameter',49.98,'pass'],['Inner Bore Dia',29.99,'pass'],['Surface Finish',null,'pass'],['Overall Length',200.05,'pass']],
    };
    for (const [pname,val,stat] of resultSets[ins.num]||[]) {
        run(`INSERT INTO inspection_results (inspection_id,parameter_name,measured_value,status) VALUES (?,?,?,?)`,
            [insId,pname,val,stat]);
    }
}

// ─── FINISHED GOODS ───────────────────────────────────────────────────────────
console.log('[11/13] Finished Goods...');
const fgDefs = [
    {code:'FG-2026-001',name:'Hydraulic Cylinder Body',  pcode:'HCB-001',woNum:'WO-2026-001',qty:8, avail:5, unit:'pcs',cost:4800,qStatus:'approved', loc:'Rack A-01'},
    {code:'FG-2026-002',name:'Precision Shaft Assembly',  pcode:'PSA-001',woNum:'WO-2026-002',qty:24,avail:20,unit:'pcs',cost:1850,qStatus:'approved', loc:'Rack A-02'},
    {code:'FG-2026-003',name:'Precision Shaft Assembly',  pcode:'PSA-001',woNum:'WO-2026-006',qty:12,avail:12,unit:'pcs',cost:1900,qStatus:'approved', loc:'Rack A-03'},
    {code:'FG-2026-004',name:'Hydraulic Cylinder Body',  pcode:'HCB-001',woNum:'WO-2026-001',qty:3, avail:0, unit:'pcs',cost:4850,qStatus:'on_hold',  loc:'Hold Area'},
    {code:'FG-2026-005',name:'Aluminum Bracket Assembly',pcode:'ABA-001',woNum:null,          qty:10,avail:8, unit:'pcs',cost:2200,qStatus:'approved', loc:'Rack B-01'},
    {code:'FG-2026-006',name:'Stainless Steel Flange',   pcode:'SSF-001',woNum:null,          qty:5, avail:5, unit:'pcs',cost:3100,qStatus:'approved', loc:'Rack B-02'},
];
for (const fg of fgDefs) {
    const woId = fg.woNum ? woIds[fg.woNum] : null;
    run(`INSERT OR IGNORE INTO finished_goods (item_code,product_name,product_code,wo_id,quantity,available_quantity,unit,unit_cost,total_cost,quality_status,storage_location)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [fg.code,fg.name,fg.pcode,woId,fg.qty,fg.avail,fg.unit,fg.cost,fg.qty*fg.cost,fg.qStatus,fg.loc]);
}
const fgIds = all(`SELECT id,item_code FROM finished_goods`).reduce((m,r)=>{m[r.item_code]=r.id;return m;},{});

// ─── DISPATCH LOGS ────────────────────────────────────────────────────────────
console.log('[12/13] Dispatch Logs...');
for (const [num,fgCode,customer,cAddr,qty,date,challan,invoice,trans,vehicle,status] of [
    ['DISP-2026-001','FG-2026-002','Mahindra & Mahindra Ltd','Nashik Plant, MH',5,daysAgo(10),'DC-M001','INV-M001','VRL Logistics','MH12AB1234','delivered'],
    ['DISP-2026-002','FG-2026-002','Tata Motors Ltd','Pune Plant, MH',8,daysAgo(5),'DC-T001','INV-T001','Gati Limited','GJ05CD5678','dispatched'],
    ['DISP-2026-003','FG-2026-003','Bajaj Auto Ltd','Waluj, Aurangabad, MH',6,daysAgo(3),'DC-B001','INV-B001','DTDC Courier','MH14EF9012','dispatched'],
    ['DISP-2026-004','FG-2026-001','Kirloskar Brothers Ltd','Kirloskarvadi, MH',3,daysAgo(1),'DC-K001','INV-K001','VRL Logistics','KA09GH3456','pending'],
    ['DISP-2026-005','FG-2026-005','Bharat Forge Ltd','Mundhwa, Pune, MH',2,daysAgo(15),'DC-BF001','INV-BF001','Ekart','MH02IJ7890','delivered'],
    ['DISP-2026-006','FG-2026-006','L&T Heavy Engineering','Mumbai, MH',5,daysAgo(7),'DC-L001','INV-L001','GATI Ltd','MH04KL1122','delivered'],
]) {
    const fgId = fgIds[fgCode];
    if (!fgId) continue;
    run(`INSERT OR IGNORE INTO dispatch_logs (dispatch_number,finished_good_id,customer_name,customer_address,dispatch_date,quantity,delivery_challan,invoice_number,transporter,vehicle_number,status,created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [num,fgId,customer,cAddr,date,qty,challan,invoice,trans,vehicle,status,prod.id]);
}

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
console.log('[13/13] Audit Logs...');
for (const [uid,action,entity,ip] of [
    [admin.id,   'LOGIN',         'user',          '127.0.0.1'],
    [purchase.id,'CREATE',        'rfq',           '127.0.0.1'],
    [purchase.id,'CREATE',        'purchase_order','127.0.0.1'],
    [purchase.id,'STATUS_UPDATE', 'purchase_order','127.0.0.1'],
    [prod.id,    'CREATE',        'work_order',    '127.0.0.1'],
    [prod.id,    'STATUS_UPDATE', 'work_order',    '127.0.0.1'],
    [oper.id,    'STATUS_UPDATE', 'work_order',    '127.0.0.1'],
    [quality.id, 'CREATE',        'inspection',    '127.0.0.1'],
    [quality.id, 'CREATE',        'inspection',    '127.0.0.1'],
    [prod.id,    'CREATE',        'finished_goods','127.0.0.1'],
    [prod.id,    'CREATE',        'dispatch',      '127.0.0.1'],
    [admin.id,   'CREATE',        'user',          '127.0.0.1'],
]) {
    run(`INSERT INTO audit_logs (user_id,action,entity_type,ip_address) VALUES (?,?,?,?)`, [uid,action,entity,ip]);
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
console.log('\n✅  Full demo seed complete!');
console.log('📊  Record counts:');
const tables = {Users:'users',Suppliers:'suppliers',Materials:'materials',Machines:'machines',
    'Machine Logs':'machine_logs',BOMs:'boms',RFQs:'rfqs',Quotations:'quotations',
    'Purchase Orders':'purchase_orders','Work Orders':'work_orders',Parts:'parts',
    'Inspection Plans':'inspection_plans',Inspections:'inspections',
    'Finished Goods':'finished_goods','Dispatch Logs':'dispatch_logs','Audit Logs':'audit_logs'};
for (const [label, table] of Object.entries(tables)) {
    console.log(`   ${label.padEnd(18)}: ${cnt(table)}`);
}
