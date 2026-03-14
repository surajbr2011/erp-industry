const express = require('express');
const db = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard - Summary statistics
router.get('/dashboard', auth, async (req, res) => {
    try {
        const [
            workOrderStats, inventoryStats, qualityStats, machineStats,
            recentWOs, lowStockMaterials, recentInspections
        ] = await Promise.all([
            db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'in_process') as in_process,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold
        FROM work_orders`),

            db.query(`
        SELECT 
          COUNT(*) as total_materials,
          COUNT(*) FILTER (WHERE current_stock <= minimum_stock) as critical_stock,
          COUNT(*) FILTER (WHERE current_stock <= reorder_point AND current_stock > minimum_stock) as low_stock,
          SUM(current_stock * unit_cost) as total_inventory_value
        FROM materials WHERE is_active = true`),

            db.query(`
        SELECT 
          COUNT(*) as total_inspections,
          COUNT(*) FILTER (WHERE overall_status = 'passed') as passed,
          COUNT(*) FILTER (WHERE overall_status = 'failed') as failed,
          COUNT(*) FILTER (WHERE overall_status = 'rework_required') as rework,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE overall_status = 'failed') / NULLIF(COUNT(*), 0), 2
          ) as rejection_rate
        FROM inspections WHERE inspection_date >= NOW() - INTERVAL '30 days'`),

            db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'in_use') as in_use,
          COUNT(*) FILTER (WHERE status = 'available') as available,
          COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
        FROM machines`),

            db.query(`
        SELECT wo.wo_number, wo.product_name, wo.status, wo.priority, wo.planned_end, wo.created_at
        FROM work_orders wo ORDER BY wo.created_at DESC LIMIT 5`),

            db.query(`
        SELECT code, name, current_stock, minimum_stock, reorder_point, unit
        FROM materials WHERE current_stock <= reorder_point AND is_active = true 
        ORDER BY current_stock / NULLIF(minimum_stock, 1) ASC LIMIT 5`),

            db.query(`
        SELECT i.inspection_number, i.overall_status, i.inspection_date, i.quantity_inspected,
               wo.product_name, u.name as inspector_name
        FROM inspections i
        LEFT JOIN work_orders wo ON i.wo_id = wo.id
        LEFT JOIN users u ON i.inspector_id = u.id
        ORDER BY i.inspection_date DESC LIMIT 5`)
        ]);

        res.json({
            success: true,
            data: {
                work_orders: workOrderStats.rows[0],
                inventory: inventoryStats.rows[0],
                quality: qualityStats.rows[0],
                machines: machineStats.rows[0],
                recent_work_orders: recentWOs.rows,
                low_stock_alerts: lowStockMaterials.rows,
                recent_inspections: recentInspections.rows
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/reports/production
router.get('/production', auth, async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const fromDate = from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = to_date || new Date().toISOString().split('T')[0];

        const [productionSummary, machineUtilization, operationStats] = await Promise.all([
            db.query(`
        SELECT 
          product_name, product_code,
          COUNT(*) as total_orders,
          SUM(planned_quantity) as planned_qty,
          SUM(produced_quantity) as produced_qty,
          SUM(rejected_quantity) as rejected_qty,
          ROUND(100.0 * SUM(produced_quantity) / NULLIF(SUM(planned_quantity), 0), 2) as efficiency
        FROM work_orders
        WHERE created_at BETWEEN $1 AND $2::date + INTERVAL '1 day'
        GROUP BY product_name, product_code ORDER BY total_orders DESC`,
                [fromDate, toDate]),

            db.query(`
        SELECT m.name as machine_name, m.machine_code, m.machine_type,
               COUNT(ml.id) as job_count,
               ROUND(SUM(ml.run_time_hours)::numeric, 2) as total_hours,
               ROUND(AVG(ml.run_time_hours)::numeric, 2) as avg_hours_per_job,
               SUM(ml.output_quantity) as total_output
        FROM machines m
        LEFT JOIN machine_logs ml ON m.id = ml.machine_id 
          AND ml.start_time BETWEEN $1 AND $2::date + INTERVAL '1 day'
        GROUP BY m.id, m.name, m.machine_code, m.machine_type
        ORDER BY total_hours DESC NULLS LAST`,
                [fromDate, toDate]),

            db.query(`
        SELECT operation_type, COUNT(*) as count, 
               ROUND(AVG(actual_hours)::numeric, 2) as avg_hours,
               SUM(output_quantity) as total_output,
               SUM(rejected_quantity) as total_rejected
        FROM work_order_operations WHERE actual_end BETWEEN $1 AND $2::date + INTERVAL '1 day'
        GROUP BY operation_type ORDER BY count DESC`,
                [fromDate, toDate])
        ]);

        res.json({
            success: true,
            data: { production_summary: productionSummary.rows, machine_utilization: machineUtilization.rows, operation_stats: operationStats.rows, from_date: fromDate, to_date: toDate }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/reports/quality
router.get('/quality', auth, async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const fromDate = from_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = to_date || new Date().toISOString().split('T')[0];

        const [qcSummary, qcByProduct, inspectorPerformance] = await Promise.all([
            db.query(`
        SELECT 
          COUNT(*) as total_inspections,
          SUM(quantity_inspected) as total_qty_inspected,
          SUM(quantity_passed) as total_passed,
          SUM(quantity_failed) as total_failed,
          SUM(quantity_rework) as total_rework,
          ROUND(100.0 * SUM(quantity_failed) / NULLIF(SUM(quantity_inspected), 0), 2) as rejection_rate,
          ROUND(100.0 * SUM(quantity_passed) / NULLIF(SUM(quantity_inspected), 0), 2) as pass_rate
        FROM inspections WHERE inspection_date BETWEEN $1 AND $2::date + INTERVAL '1 day'`,
                [fromDate, toDate]),

            db.query(`
        SELECT wo.product_name, wo.product_code,
               COUNT(i.id) as inspections,
               SUM(i.quantity_inspected) as qty_inspected,
               SUM(i.quantity_passed) as qty_passed,
               SUM(i.quantity_failed) as qty_failed,
               ROUND(100.0 * SUM(i.quantity_failed) / NULLIF(SUM(i.quantity_inspected), 0), 2) as rejection_rate
        FROM inspections i JOIN work_orders wo ON i.wo_id = wo.id
        WHERE i.inspection_date BETWEEN $1 AND $2::date + INTERVAL '1 day'
        GROUP BY wo.product_name, wo.product_code ORDER BY rejection_rate DESC NULLS LAST`,
                [fromDate, toDate]),

            db.query(`
        SELECT u.name as inspector_name,
               COUNT(i.id) as inspections_done,
               SUM(i.quantity_inspected) as qty_inspected,
               COUNT(i.id) FILTER (WHERE i.overall_status = 'passed') as passed,
               COUNT(i.id) FILTER (WHERE i.overall_status = 'failed') as failed
        FROM inspections i JOIN users u ON i.inspector_id = u.id
        WHERE i.inspection_date BETWEEN $1 AND $2::date + INTERVAL '1 day'
        GROUP BY u.id, u.name ORDER BY inspections_done DESC`,
                [fromDate, toDate])
        ]);

        res.json({
            success: true,
            data: { summary: qcSummary.rows[0], by_product: qcByProduct.rows, inspector_performance: inspectorPerformance.rows, from_date: fromDate, to_date: toDate }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/reports/inventory
router.get('/inventory', auth, async (req, res) => {
    try {
        const [stockSummary, categoryBreakdown, recentTransactions] = await Promise.all([
            db.query(`
        SELECT 
          COUNT(*) as total_materials,
          SUM(current_stock * unit_cost) as total_value,
          COUNT(*) FILTER (WHERE current_stock <= minimum_stock) as critical,
          COUNT(*) FILTER (WHERE current_stock <= reorder_point AND current_stock > minimum_stock) as low_stock,
          COUNT(*) FILTER (WHERE current_stock > reorder_point) as healthy
        FROM materials WHERE is_active = true`),

            db.query(`
        SELECT category, COUNT(*) as count, 
               SUM(current_stock * unit_cost) as value,
               COUNT(*) FILTER (WHERE current_stock <= minimum_stock) as critical_count
        FROM materials WHERE is_active = true GROUP BY category ORDER BY value DESC`),

            db.query(`
        SELECT it.*, m.name as material_name, m.code as material_code, u.name as created_by_name
        FROM inventory_transactions it
        JOIN materials m ON it.material_id = m.id
        LEFT JOIN users u ON it.created_by = u.id
        ORDER BY it.created_at DESC LIMIT 20`)
        ]);

        res.json({
            success: true,
            data: { summary: stockSummary.rows[0], category_breakdown: categoryBreakdown.rows, recent_transactions: recentTransactions.rows }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// GET /api/reports/purchase
router.get('/purchase', auth, async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const fromDate = from_date || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = to_date || new Date().toISOString().split('T')[0];

        const [poSummary, supplierPerformance] = await Promise.all([
            db.query(`
        SELECT 
          COUNT(*) as total_pos,
          SUM(total_amount) as total_spend,
          COUNT(*) FILTER (WHERE status = 'received') as completed,
          COUNT(*) FILTER (WHERE status IN ('draft', 'sent', 'approved')) as pending,
          COUNT(*) FILTER (WHERE actual_delivery > expected_delivery AND actual_delivery IS NOT NULL) as late_deliveries
        FROM purchase_orders WHERE order_date BETWEEN $1 AND $2::date + INTERVAL '1 day'`,
                [fromDate, toDate]),

            db.query(`
        SELECT s.name as supplier_name, s.code as supplier_code,
               COUNT(po.id) as total_orders, SUM(po.total_amount) as total_spend,
               COUNT(*) FILTER (WHERE po.status = 'received') as completed_orders,
               ROUND(AVG(CASE WHEN po.actual_delivery IS NOT NULL 
                 THEN EXTRACT(DAY FROM po.actual_delivery - po.expected_delivery) ELSE NULL END)::numeric, 1) as avg_delay_days
        FROM suppliers s LEFT JOIN purchase_orders po ON s.id = po.supplier_id
          AND po.order_date BETWEEN $1 AND $2::date + INTERVAL '1 day'
        GROUP BY s.id, s.name, s.code ORDER BY total_spend DESC NULLS LAST LIMIT 10`,
                [fromDate, toDate])
        ]);

        res.json({
            success: true,
            data: { summary: poSummary.rows[0], supplier_performance: supplierPerformance.rows, from_date: fromDate, to_date: toDate }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
