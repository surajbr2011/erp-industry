import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Package } from 'lucide-react';
import { purchaseOrdersAPI, suppliersAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const INITIAL_FORM = {
    supplier_id: '', expected_delivery: '', payment_terms: '', shipping_address: '', notes: '',
    items: [{ material_name: '', quantity: '', unit: 'kg', unit_price: '', tax_percentage: 18 }]
};

export default function PurchaseOrdersPage() {
    const [pos, setPOs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [status, setStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<any>(INITIAL_FORM);

    const load = async () => {
        setLoading(true);
        try {
            const r = await purchaseOrdersAPI.getAll({ page, limit: 15, status: status || undefined });
            setPOs(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, status]);
    useEffect(() => { suppliersAPI.getAll({ limit: 100 }).then(r => setSuppliers(r.data.data)); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await purchaseOrdersAPI.create(form);
            toast.success('Purchase Order created!');
            setModalOpen(false);
            setForm(INITIAL_FORM);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create PO');
        } finally { setSaving(false); }
    };

    const handleStatus = async (id: number, newStatus: string) => {
        try {
            await purchaseOrdersAPI.updateStatus(id, newStatus);
            toast.success(`PO ${newStatus}`);
            load();
        } catch { toast.error('Failed to update status'); }
    };

    const addItem = () => setForm({ ...form, items: [...form.items, { material_name: '', quantity: '', unit: 'kg', unit_price: '', tax_percentage: 18 }] });
    const updateItem = (i: number, k: string, v: any) => {
        const items = [...form.items]; items[i] = { ...items[i], [k]: v }; setForm({ ...form, items });
    };

    const totalAmount = form.items.reduce((sum: number, i: any) => sum + ((parseFloat(i.unit_price) || 0) * (parseFloat(i.quantity) || 0) * (1 + (i.tax_percentage || 18) / 100)), 0);

    return (
        <>
            <Header title="Purchase Orders" subtitle="Track and manage all procurement" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Purchase Orders</h2>
                        <p>{total} orders total</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Create PO</button>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="filter-bar">
                            {['', 'draft', 'sent', 'approved', 'received', 'cancelled'].map(s => (
                                <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setStatus(s); setPage(1); }}>
                                    {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
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
                                    <th>PO Number</th><th>Supplier</th><th>Order Date</th>
                                    <th>Expected</th><th>Amount</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {pos.map(p => (
                                        <tr key={p.id}>
                                            <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{p.po_number}</span></td>
                                            <td style={{ fontWeight: 500 }}>{p.supplier_name}</td>
                                            <td>{format(new Date(p.order_date), 'dd MMM yyyy')}</td>
                                            <td>{p.expected_delivery ? format(new Date(p.expected_delivery), 'dd MMM yyyy') : '—'}</td>
                                            <td style={{ fontWeight: 700 }}>₹{parseFloat(p.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td><StatusBadge status={p.status} /></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {p.status === 'draft' && (
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleStatus(p.id, 'sent')}>Send</button>
                                                    )}
                                                    {p.status === 'sent' && (
                                                        <button className="btn btn-success btn-sm" onClick={() => handleStatus(p.id, 'approved')}>
                                                            <CheckCircle size={13} /> Approve
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!pos.length && (
                                        <tr><td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Package size={24} /></div>
                                                <h3>No purchase orders</h3>
                                                <p>Create your first purchase order</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={15} onPageChange={setPage} />
                </div>

                <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Purchase Order" size="xl"
                    footer={
                        <>
                            <div style={{ flex: 1, fontWeight: 700 }}>Total: ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />} Create PO
                            </button>
                        </>
                    }
                >
                    <form onSubmit={handleSubmit}>
                        <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label required">Supplier</label>
                                <select className="form-control" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} required>
                                    <option value="">Select Supplier</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Expected Delivery</label>
                                <input className="form-control" type="date" value={form.expected_delivery} onChange={e => setForm({ ...form, expected_delivery: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payment Terms</label>
                                <select className="form-control" value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Advance</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>PO Items</label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Row</button>
                            </div>
                            {form.items.map((item: any, i: number) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr 80px', gap: 8, marginBottom: 8, padding: '10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Material</label>
                                        <input className="form-control" value={item.material_name} onChange={e => updateItem(i, 'material_name', e.target.value)} placeholder="Material name" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Qty</label>
                                        <input className="form-control" type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min={0} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Unit</label>
                                        <select className="form-control" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                                            <option>kg</option><option>mtr</option><option>pcs</option><option>ltr</option><option>ton</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Rate (₹)</label>
                                        <input className="form-control" type="number" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} min={0} step="0.01" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Tax%</label>
                                        <input className="form-control" type="number" value={item.tax_percentage} onChange={e => updateItem(i, 'tax_percentage', parseFloat(e.target.value))} min={0} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Shipping Address</label>
                            <textarea className="form-control" value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} rows={2} placeholder="Delivery address..." />
                        </div>
                    </form>
                </Modal>
            </div>
        </>
    );
}
