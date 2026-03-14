import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ClipboardList, Package, CheckSquare, Cog, AlertTriangle,
    ArrowRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { reportsAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Header from '../components/Header';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        reportsAPI.dashboard()
            .then(r => setData(r.data.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <>
            <Header title="Dashboard" subtitle="Manufacturing Overview" />
            <div className="page-content">
                <div className="loading-overlay">
                    <div className="loading-spinner loading-spinner-lg" />
                    <div className="loading-text">Loading dashboard...</div>
                </div>
            </div>
        </>
    );

    const wo = data?.work_orders || {};
    const inv = data?.inventory || {};
    const qc = data?.quality || {};
    const machines = data?.machines || {};

    const woChartData = [
        { name: 'Pending', value: parseInt(wo.pending) || 0 },
        { name: 'In Process', value: parseInt(wo.in_process) || 0 },
        { name: 'Completed', value: parseInt(wo.completed) || 0 },
        { name: 'On Hold', value: parseInt(wo.on_hold) || 0 },
    ];

    const machineChartData = [
        { name: 'Available', value: parseInt(machines.available) || 0 },
        { name: 'In Use', value: parseInt(machines.in_use) || 0 },
        { name: 'Maintenance', value: parseInt(machines.maintenance) || 0 },
    ];

    return (
        <>
            <Header title="Dashboard" subtitle="Real-time manufacturing overview" />
            <div className="page-content">
                {/* KPI Cards */}
                <div className="grid-4 mb-6">
                    {[
                        {
                            icon: <ClipboardList size={20} />, color: '#2563eb', bg: '#eff6ff',
                            value: wo.total || 0, label: 'Total Work Orders',
                            sub: `${wo.in_process || 0} in progress`, accent: '#2563eb'
                        },
                        {
                            icon: <Package size={20} />, color: '#16a34a', bg: '#f0fdf4',
                            value: parseInt(inv.total_materials) || 0, label: 'Materials',
                            sub: `${inv.critical_stock || 0} critical stock`, accent: '#16a34a'
                        },
                        {
                            icon: <CheckSquare size={20} />, color: '#d97706', bg: '#fffbeb',
                            value: `${qc.pass_rate || 0}%`, label: 'Pass Rate (30d)',
                            sub: `${qc.rejection_rate || 0}% rejection rate`, accent: '#d97706'
                        },
                        {
                            icon: <Cog size={20} />, color: '#7c3aed', bg: '#faf5ff',
                            value: machines.total || 0, label: 'Machines',
                            sub: `${machines.in_use || 0} currently active`, accent: '#7c3aed'
                        },
                    ].map((card, i) => (
                        <div className="stat-card" key={i}>
                            <div className="stat-card-accent" style={{ background: card.accent }} />
                            <div className="stat-card-icon" style={{ background: card.bg, color: card.color }}>
                                {card.icon}
                            </div>
                            <div className="stat-card-value">{card.value}</div>
                            <div className="stat-card-label">{card.label}</div>
                            <div className="stat-card-change text-muted" style={{ color: '#64748b' }}>
                                {card.sub}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Inventory Alert */}
                {parseInt(inv.critical_stock) > 0 && (
                    <div className="alert alert-danger mb-4" style={{ marginBottom: 20 }}>
                        <AlertTriangle size={16} />
                        <strong>{inv.critical_stock} materials</strong> are critically low (below minimum stock level).
                        <a onClick={() => navigate('/materials?low_stock=true')} style={{ cursor: 'pointer', marginLeft: 8, fontWeight: 700, textDecoration: 'underline' }}>
                            View &rarr;
                        </a>
                    </div>
                )}

                <div className="grid-2 mb-6">
                    {/* Work Order Status Chart */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Work Order Status</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/work-orders')}>
                                View All <ArrowRight size={13} />
                            </button>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={woChartData} barSize={36}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 13 }} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Machine Status Chart */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Machine Utilization</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/machines')}>
                                View All <ArrowRight size={13} />
                            </button>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={machineChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                                        {machineChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 13 }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="grid-2">
                    {/* Recent Work Orders */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Recent Work Orders</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/work-orders')}>
                                View All <ArrowRight size={13} />
                            </button>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>WO Number</th>
                                        <th>Product</th>
                                        <th>Status</th>
                                        <th>Priority</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.recent_work_orders?.map((wo: any) => (
                                        <tr key={wo.wo_number} onClick={() => navigate('/work-orders')} style={{ cursor: 'pointer' }}>
                                            <td><span style={{ fontWeight: 600, color: '#2563eb' }}>{wo.wo_number}</span></td>
                                            <td><span className="truncate" style={{ maxWidth: 150, display: 'block' }}>{wo.product_name}</span></td>
                                            <td><StatusBadge status={wo.status} /></td>
                                            <td><StatusBadge status={wo.priority} /></td>
                                        </tr>
                                    ))}
                                    {(!data?.recent_work_orders?.length) && (
                                        <tr><td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No work orders yet</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Low Stock Alerts */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title">Low Stock Alerts</span>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/materials')}>
                                View All <ArrowRight size={13} />
                            </button>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Stock</th>
                                        <th>Min Level</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.low_stock_alerts?.map((mat: any) => (
                                        <tr key={mat.code}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{mat.name}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{mat.code}</div>
                                            </td>
                                            <td><span style={{ fontWeight: 700, color: parseFloat(mat.current_stock) <= parseFloat(mat.minimum_stock) ? '#dc2626' : '#d97706' }}>{mat.current_stock} {mat.unit}</span></td>
                                            <td style={{ color: '#64748b' }}>{mat.minimum_stock} {mat.unit}</td>
                                            <td>
                                                {parseFloat(mat.current_stock) <= parseFloat(mat.minimum_stock) ? (
                                                    <span className="badge badge-danger">Critical</span>
                                                ) : (
                                                    <span className="badge badge-warning">Low</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {(!data?.low_stock_alerts?.length) && (
                                        <tr><td colSpan={4} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>✓ All stock levels healthy</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Quality Summary */}
                <div className="card mt-5" style={{ marginTop: 20 }}>
                    <div className="card-header">
                        <span className="card-title">Quality Summary (Last 30 Days)</span>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')}>Reports <ArrowRight size={13} /></button>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                            {[
                                { label: 'Total Inspections', value: qc.total_inspections || 0, color: '#2563eb' },
                                { label: 'Passed', value: qc.passed || 0, color: '#16a34a' },
                                { label: 'Failed', value: qc.failed || 0, color: '#dc2626' },
                                { label: 'Rework', value: qc.rework || 0, color: '#d97706' },
                            ].map((item, i) => (
                                <div key={i} style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: 8 }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: item.color }}>{item.value}</div>
                                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginTop: 4 }}>{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
