import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { reportsAPI } from '../services/api';
import Header from '../components/Header';
import { BarChart3, Package, ShoppingCart, CheckSquare, Factory } from 'lucide-react';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ReportsPage() {
    const [tab, setTab] = useState('dashboard');
    const [data, setData] = useState<any>({});
    const [loading, setLoading] = useState(false);

    const loadReport = async (type: string) => {
        setLoading(true);
        try {
            let r;
            if (type === 'dashboard') r = await reportsAPI.dashboard();
            else if (type === 'production') r = await reportsAPI.production();
            else if (type === 'quality') r = await reportsAPI.quality();
            else if (type === 'inventory') r = await reportsAPI.inventory();
            else if (type === 'purchase') r = await reportsAPI.purchase();
            setData(r?.data?.data || {});
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadReport(tab); }, [tab]);

    const tabs = [
        { id: 'dashboard', label: 'Overview', icon: BarChart3 },
        { id: 'production', label: 'Production', icon: Factory },
        { id: 'quality', label: 'Quality', icon: CheckSquare },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
    ];

    return (
        <>
            <Header title="Reports & Analytics" subtitle="Comprehensive manufacturing performance insights" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Reports & Analytics</h2>
                        <p>Data-driven insights for better decisions</p>
                    </div>
                </div>

                <div className="tabs mb-6" style={{ marginBottom: 24 }}>
                    {tabs.map(t => (
                        <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <t.icon size={14} /> {t.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /><div className="loading-text">Loading report...</div></div>
                ) : (
                    <>
                        {/* Overview Tab */}
                        {tab === 'dashboard' && (
                            <div>
                                <div className="grid-4 mb-6" style={{ marginBottom: 20 }}>
                                    {[
                                        { label: 'Active Work Orders', value: data?.work_orders?.in_process || 0, color: '#2563eb', bg: '#eff6ff' },
                                        { label: 'Materials', value: data?.inventory?.total_materials || 0, color: '#7c3aed', bg: '#faf5ff' },
                                        { label: 'Pass Rate', value: `${data?.quality?.pass_rate || 0}%`, color: '#16a34a', bg: '#f0fdf4' },
                                        { label: 'Machines Active', value: data?.machines?.in_use || 0, color: '#d97706', bg: '#fffbeb' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ padding: '20px', background: s.bg, borderRadius: 12, border: `1px solid ${s.color}20` }}>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid-2">
                                    {/* WO Status */}
                                    <div className="card">
                                        <div className="card-header"><span className="card-title">Work Order Status Distribution</span></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={[
                                                    { name: 'Pending', value: parseInt(data?.work_orders?.pending) || 0 },
                                                    { name: 'Released', value: parseInt(data?.work_orders?.released) || 0 },
                                                    { name: 'In Process', value: parseInt(data?.work_orders?.in_process) || 0 },
                                                    { name: 'Completed', value: parseInt(data?.work_orders?.completed) || 0 },
                                                    { name: 'On Hold', value: parseInt(data?.work_orders?.on_hold) || 0 },
                                                ]} barSize={32}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" name="Count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Machine Status */}
                                    <div className="card">
                                        <div className="card-header"><span className="card-title">Machine Utilization</span></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={250}>
                                                <PieChart>
                                                    <Pie data={[
                                                        { name: 'Available', value: parseInt(data?.machines?.available) || 0 },
                                                        { name: 'In Use', value: parseInt(data?.machines?.in_use) || 0 },
                                                        { name: 'Maintenance', value: parseInt(data?.machines?.maintenance) || 0 },
                                                        { name: 'Breakdown', value: parseInt(data?.machines?.breakdown) || 0 },
                                                    ]} dataKey="value" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={({ name, percent }) => (percent ?? 0) > 0 ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ''}>
                                                        {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Production Tab */}
                        {tab === 'production' && (
                            <div>
                                <div className="grid-3 mb-6" style={{ marginBottom: 20 }}>
                                    {[
                                        { label: 'Total WOs', value: data?.summary?.total_wos || 0 },
                                        { label: 'Completed WOs', value: data?.summary?.completed_wos || 0 },
                                        { label: 'Completion Rate', value: `${data?.summary?.completion_rate || 0}%` },
                                    ].map((s, i) => (
                                        <div key={i} style={{ padding: '20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{s.value}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {data?.by_product?.length > 0 && (
                                    <div className="card">
                                        <div className="card-header"><span className="card-title">Production by Product</span></div>
                                        <div className="card-body">
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={data.by_product.slice(0, 10)} barSize={40}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis dataKey="product_name" tick={{ fontSize: 11 }} />
                                                    <YAxis tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="total_quantity" name="Qty Produced" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quality Tab */}
                        {tab === 'quality' && (
                            <div>
                                <div className="grid-4 mb-6" style={{ marginBottom: 20 }}>
                                    {[
                                        { label: 'Total Inspections', value: data?.summary?.total_inspections || 0, color: '#2563eb' },
                                        { label: 'Passed', value: data?.summary?.passed || 0, color: '#16a34a' },
                                        { label: 'Failed', value: data?.summary?.failed || 0, color: '#dc2626' },
                                        { label: 'Pass Rate', value: `${data?.summary?.pass_rate || 0}%`, color: '#7c3aed' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ padding: '20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {data?.by_product?.length > 0 && (
                                    <div className="card">
                                        <div className="card-header"><span className="card-title">Quality by Product</span></div>
                                        <div className="card-body">
                                            <Table headers={['Product', 'Pass', 'Fail', 'Rework', 'Pass Rate']} rows={data.by_product.map((p: any) => [
                                                p.product_name, p.passed, p.failed, p.rework_required,
                                                <span style={{ fontWeight: 700, color: parseFloat(p.pass_rate) >= 95 ? '#16a34a' : parseFloat(p.pass_rate) >= 80 ? '#d97706' : '#dc2626' }}>{p.pass_rate}%</span>
                                            ])} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Inventory Tab */}
                        {tab === 'inventory' && (
                            <div>
                                <div className="grid-3 mb-6" style={{ marginBottom: 20 }}>
                                    {[
                                        { label: 'Total Materials', value: data?.summary?.total_materials || 0 },
                                        { label: 'Low Stock', value: data?.summary?.low_stock_count || 0, danger: true },
                                        { label: 'Critical Stock', value: data?.summary?.critical_stock_count || 0, danger: true },
                                    ].map((s, i) => (
                                        <div key={i} style={{ padding: '20px', background: s.danger ? '#fef2f2' : '#f8fafc', borderRadius: 12, border: `1px solid ${s.danger ? '#fecaca' : '#e2e8f0'}`, textAlign: 'center' }}>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: s.danger ? '#dc2626' : '#2563eb' }}>{s.value}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {data?.by_category?.length > 0 && (
                                    <div className="card">
                                        <div className="card-header"><span className="card-title">Stock by Category</span></div>
                                        <div className="card-body">
                                            <Table headers={['Category', 'Materials', 'Total Stock', 'Total Value']} rows={data.by_category.map((c: any) => [
                                                c.category || 'Uncategorized', c.count,
                                                `${parseFloat(c.total_stock || 0).toFixed(2)}`,
                                                `₹${parseFloat(c.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                            ])} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Purchase Tab */}
                        {tab === 'purchase' && (
                            <div>
                                <div className="grid-3 mb-6" style={{ marginBottom: 20 }}>
                                    {[
                                        { label: 'Total POs', value: data?.summary?.total_pos || 0 },
                                        { label: 'Total Spend', value: `₹${parseFloat(data?.summary?.total_spend || 0).toLocaleString('en-IN')}` },
                                        { label: 'Open POs', value: data?.summary?.open_pos || 0 },
                                    ].map((s, i) => (
                                        <div key={i} style={{ padding: '20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb' }}>{s.value}</div>
                                            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {data?.by_supplier?.length > 0 && (
                                    <div className="card">
                                        <div className="card-header"><span className="card-title">Performance by Supplier</span></div>
                                        <div className="card-body">
                                            <Table headers={['Supplier', 'POs', 'Delivered', 'On-time Rate', 'Total Spend']} rows={data.by_supplier.map((s: any) => [
                                                s.supplier_name, s.total_pos, s.delivered_pos, `${s.on_time_rate || 'N/A'}%`,
                                                `₹${parseFloat(s.total_spend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                            ])} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

// Simple table component
function Table({ headers, rows }: { headers: string[]; rows: any[][] }) {
    return (
        <div className="table-container">
            <table>
                <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                    ))}
                    {!rows.length && (
                        <tr><td colSpan={headers.length} style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>No data available</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
