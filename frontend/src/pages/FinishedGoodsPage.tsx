import { useEffect, useState } from 'react';
import { Archive, Truck } from 'lucide-react';
import { finishedGoodsAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function FinishedGoodsPage() {
    const [goods, setGoods] = useState<any[]>([]);
    const [dispatches, setDispatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [tab, setTab] = useState<'inventory' | 'dispatch'>('inventory');
    const [dispatchModal, setDispatchModal] = useState<any>(null);
    const [dispatchForm, setDispatchForm] = useState({ customer_name: '', customer_po: '', shipping_address: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            if (tab === 'inventory') {
                const r = await finishedGoodsAPI.getAll({ page, limit: 20 });
                setGoods(r.data.data);
                setTotal(r.data.pagination.total);
            } else {
                const r = await finishedGoodsAPI.getDispatches({ page, limit: 20 });
                setDispatches(r.data.data);
                setTotal(r.data.pagination.total);
            }
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, tab]);

    const handleDispatch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await finishedGoodsAPI.dispatch(dispatchModal.id, dispatchForm);
            toast.success('Part dispatched successfully!');
            setDispatchModal(null);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to dispatch');
        } finally { setSaving(false); }
    };

    return (
        <>
            <Header title="Finished Goods" subtitle="Manage finished inventory and customer dispatches" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Finished Goods</h2>
                        <p>{total} records</p>
                    </div>
                    <div className="tabs">
                        <button className={`tab ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>Inventory</button>
                        <button className={`tab ${tab === 'dispatch' ? 'active' : ''}`} onClick={() => setTab('dispatch')}>Dispatches</button>
                    </div>
                </div>

                <div className="card">
                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : tab === 'inventory' ? (
                            <table>
                                <thead><tr>
                                    <th>Serial Number</th><th>Product</th><th>Work Order</th><th>Inspected</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {goods.map(g => (
                                        <tr key={g.id}>
                                            <td><span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: 13 }}>{g.serial_number}</span></td>
                                            <td style={{ fontWeight: 600 }}>{g.product_name}</td>
                                            <td style={{ color: '#64748b' }}>{g.wo_number || '—'}</td>
                                            <td>
                                                {g.last_inspection_result ? <StatusBadge status={g.last_inspection_result} /> : <span className="badge badge-secondary">Not Inspected</span>}
                                            </td>
                                            <td><StatusBadge status={g.status} /></td>
                                            <td>
                                                {g.status === 'passed' && (
                                                    <button className="btn btn-primary btn-sm" onClick={() => { setDispatchModal(g); setDispatchForm({ customer_name: '', customer_po: '', shipping_address: '', notes: '' }); }}>
                                                        <Truck size={13} /> Dispatch
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {!goods.length && (
                                        <tr><td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Archive size={24} /></div>
                                                <h3>No finished goods</h3>
                                                <p>Completed work orders will appear here after inspection</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>Dispatch No.</th><th>Serial Number</th><th>Customer</th>
                                    <th>Customer PO</th><th>Dispatch Date</th><th>Dispatched By</th>
                                </tr></thead>
                                <tbody>
                                    {dispatches.map(d => (
                                        <tr key={d.id}>
                                            <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{d.dispatch_number}</span></td>
                                            <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{d.serial_number}</span></td>
                                            <td style={{ fontWeight: 600 }}>{d.customer_name}</td>
                                            <td style={{ color: '#64748b' }}>{d.customer_po || '—'}</td>
                                            <td>{format(new Date(d.dispatch_date), 'dd MMM yyyy')}</td>
                                            <td style={{ color: '#64748b' }}>{d.dispatched_by_name}</td>
                                        </tr>
                                    ))}
                                    {!dispatches.length && (
                                        <tr><td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Truck size={24} /></div>
                                                <h3>No dispatches yet</h3>
                                                <p>Dispatched goods will appear here</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
                </div>

                {/* Dispatch Modal */}
                <Modal isOpen={!!dispatchModal} onClose={() => setDispatchModal(null)} title="Dispatch to Customer" size="md"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setDispatchModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleDispatch} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />}
                                <Truck size={14} /> Dispatch
                            </button>
                        </>
                    }
                >
                    {dispatchModal && (
                        <form onSubmit={handleDispatch}>
                            <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>📦 {dispatchModal.serial_number}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{dispatchModal.product_name}</div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label required">Customer Name</label>
                                <input className="form-control" value={dispatchForm.customer_name} onChange={e => setDispatchForm({ ...dispatchForm, customer_name: e.target.value })} required placeholder="Customer company name" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label">Customer PO Number</label>
                                <input className="form-control" value={dispatchForm.customer_po} onChange={e => setDispatchForm({ ...dispatchForm, customer_po: e.target.value })} placeholder="Customer's PO reference" />
                            </div>
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label">Shipping Address</label>
                                <textarea className="form-control" rows={2} value={dispatchForm.shipping_address}
                                    onChange={e => setDispatchForm({ ...dispatchForm, shipping_address: e.target.value })} placeholder="Delivery address..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea className="form-control" rows={2} value={dispatchForm.notes}
                                    onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })} placeholder="Dispatch notes..." />
                            </div>
                        </form>
                    )}
                </Modal>
            </div>
        </>
    );
}
