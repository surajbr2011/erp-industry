import { useEffect, useState } from 'react';
import { Plus, Eye, Play, CheckCircle, ClipboardList, Zap } from 'lucide-react';
import { workOrdersAPI, bomsAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const STATUS_TRANSITIONS: Record<string, string[]> = {
    pending: ['released', 'cancelled'],
    released: ['in_process', 'on_hold', 'cancelled'],
    in_process: ['completed', 'on_hold'],
    on_hold: ['in_process', 'cancelled'],
};

export default function WorkOrdersPage() {
    const [wos, setWos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [detailModal, setDetailModal] = useState<any>(null);
    const [boms, setBoms] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [genParts, setGenParts] = useState<{ woId: number; qty: number } | null>(null);
    const [form, setForm] = useState({
        bom_id: '', quantity: 1, priority: 'normal',
        start_date: '', due_date: '', notes: ''
    });

    const load = async () => {
        setLoading(true);
        try {
            const r = await workOrdersAPI.getAll({ page, limit: 15, status: status || undefined });
            setWos(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, status]);
    useEffect(() => { bomsAPI.getAll({ limit: 100, status: 'active' }).then(r => setBoms(r.data.data)); }, []);

    const viewDetail = async (id: number) => {
        const r = await workOrdersAPI.getById(id);
        setDetailModal(r.data.data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await workOrdersAPI.create(form);
            toast.success('Work Order created!');
            setModalOpen(false);
            setForm({ bom_id: '', quantity: 1, priority: 'normal', start_date: '', due_date: '', notes: '' });
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create WO');
        } finally { setSaving(false); }
    };

    const handleStatusChange = async (id: number, newStatus: string) => {
        try {
            await workOrdersAPI.updateStatus(id, newStatus);
            toast.success(`Work Order ${newStatus}`);
            load();
            if (detailModal?.id === id) viewDetail(id);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const handleGenerateParts = async () => {
        if (!genParts) return;
        setSaving(true);
        try {
            const r = await workOrdersAPI.generateParts(genParts.woId, genParts.qty);
            toast.success(`${r.data.data.count} parts generated!`);
            setGenParts(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to generate parts');
        } finally { setSaving(false); }
    };

    const progressPercent = (wo: any) => {
        if (!wo.total_operations || wo.total_operations === 0) return 0;
        return Math.round((wo.completed_operations / wo.total_operations) * 100);
    };

    return (
        <>
            <Header title="Work Orders" subtitle="Manage production orders and track progress" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Work Orders</h2>
                        <p>{total} work orders</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> New Work Order</button>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="filter-bar">
                            {['', 'pending', 'released', 'in_process', 'completed', 'on_hold'].map(s => (
                                <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => { setStatus(s); setPage(1); }}>
                                    {s ? s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>WO Number</th><th>Product</th><th>Qty</th><th>Priority</th>
                                    <th>Progress</th><th>Due Date</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {wos.map(wo => {
                                        const progress = progressPercent(wo);
                                        return (
                                            <tr key={wo.id}>
                                                <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{wo.wo_number}</span></td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{wo.product_name}</div>
                                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{wo.product_code}</div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{wo.quantity}</td>
                                                <td><StatusBadge status={wo.priority} /></td>
                                                <td style={{ width: 120 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3 }}>
                                                            <div style={{ width: `${progress}%`, height: '100%', background: '#22c55e', borderRadius: 3, transition: 'width 0.3s' }} />
                                                        </div>
                                                        <span style={{ fontSize: 11, fontWeight: 600, minWidth: 30 }}>{progress}%</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {wo.due_date ? (
                                                        <span style={{ color: new Date(wo.due_date) < new Date() && wo.status !== 'completed' ? '#dc2626' : '#475569', fontWeight: new Date(wo.due_date) < new Date() ? 700 : 400 }}>
                                                            {format(new Date(wo.due_date), 'dd MMM yyyy')}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td><StatusBadge status={wo.status} /></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => viewDetail(wo.id)}><Eye size={13} /></button>
                                                        {STATUS_TRANSITIONS[wo.status]?.includes('in_process') && (
                                                            <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(wo.id, 'in_process')}>
                                                                <Play size={13} />
                                                            </button>
                                                        )}
                                                        {wo.status === 'in_process' && (
                                                            <button className="btn btn-success btn-sm" onClick={() => handleStatusChange(wo.id, 'completed')}>
                                                                <CheckCircle size={13} />
                                                            </button>
                                                        )}
                                                        {(wo.status === 'in_process' || wo.status === 'completed') && (
                                                            <button className="btn btn-warning btn-sm" style={{ background: '#f59e0b', color: 'white', border: 'none' }}
                                                                onClick={() => setGenParts({ woId: wo.id, qty: wo.quantity })}>
                                                                <Zap size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!wos.length && (
                                        <tr><td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><ClipboardList size={24} /></div>
                                                <h3>No work orders</h3>
                                                <p>Create your first production work order</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={15} onPageChange={setPage} />
                </div>

                {/* Create WO Modal */}
                <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Work Order" size="md"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />} Create
                            </button>
                        </>
                    }
                >
                    <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label required">BOM / Product</label>
                            <select className="form-control" value={form.bom_id} onChange={e => setForm({ ...form, bom_id: e.target.value })} required>
                                <option value="">Select BOM...</option>
                                {boms.map(b => <option key={b.id} value={b.id}>{b.product_name} - {b.bom_number}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Quantity</label>
                            <input className="form-control" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })} min={1} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Priority</label>
                            <select className="form-control" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                <option value="low">Low</option><option value="normal">Normal</option>
                                <option value="high">High</option><option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Start Date</label>
                            <input className="form-control" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Due Date</label>
                            <input className="form-control" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-control" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                    </div>
                </Modal>

                {/* WO Detail Modal */}
                {detailModal && (
                    <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title={`Work Order: ${detailModal.wo_number}`} size="xl">
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                                {[
                                    { label: 'Product', value: detailModal.product_name },
                                    { label: 'Status', value: <StatusBadge status={detailModal.status} /> },
                                    { label: 'Priority', value: <StatusBadge status={detailModal.priority} /> },
                                    { label: 'Quantity', value: detailModal.quantity },
                                    { label: 'Start Date', value: detailModal.start_date ? format(new Date(detailModal.start_date), 'dd MMM yyyy') : '—' },
                                    { label: 'Due Date', value: detailModal.due_date ? format(new Date(detailModal.due_date), 'dd MMM yyyy') : '—' },
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
                                        <div style={{ fontWeight: 600 }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <h4 style={{ fontWeight: 700, marginBottom: 10 }}>Production Operations</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {detailModal.operations?.map((op: any) => (
                                        <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: op.status === 'completed' ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${op.status === 'completed' ? '#bbf7d0' : '#e2e8f0'}` }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: op.status === 'completed' ? '#16a34a' : '#e2e8f0', color: op.status === 'completed' ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>{op.sequence_number}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{op.operation_name}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{op.operation_type?.replace('_', ' ')} • Est: {op.estimated_time_hours}h</div>
                                            </div>
                                            <StatusBadge status={op.status || 'pending'} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {STATUS_TRANSITIONS[detailModal.status]?.length > 0 && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {STATUS_TRANSITIONS[detailModal.status]?.map(s => (
                                        <button key={s} className={`btn ${s === 'completed' ? 'btn-success' : s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                                            onClick={() => handleStatusChange(detailModal.id, s)}>
                                            {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Generate Parts Modal */}
                <Modal isOpen={!!genParts} onClose={() => setGenParts(null)} title="Generate Parts" size="sm"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setGenParts(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleGenerateParts} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />} Generate Parts
                            </button>
                        </>
                    }
                >
                    {genParts && (
                        <div>
                            <p style={{ marginBottom: 16, color: '#475569' }}>Generate traceable parts with unique serial numbers and QR codes for this work order.</p>
                            <div className="form-group">
                                <label className="form-label">Number of Parts to Generate</label>
                                <input className="form-control" type="number" value={genParts.qty} min={1} max={500}
                                    onChange={e => setGenParts({ ...genParts, qty: parseInt(e.target.value) })} />
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </>
    );
}
