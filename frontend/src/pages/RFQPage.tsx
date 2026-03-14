import { useEffect, useState } from 'react';
import { Plus, Search, Send } from 'lucide-react';
import { rfqsAPI, suppliersAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function RFQPage() {
    const [rfqs, setRfqs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);

    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: '', description: '', required_by: '', notes: '',
        items: [{ material_name: '', quantity: '', unit: 'kg', specifications: '' }],
        supplier_ids: [] as number[]
    });

    const load = async () => {
        setLoading(true);
        try {
            const r = await rfqsAPI.getAll({ page, limit: 15 });
            setRfqs(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page]);
    useEffect(() => {
        suppliersAPI.getAll({ limit: 100 }).then(r => setSuppliers(r.data.data));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await rfqsAPI.create(form);
            toast.success('RFQ created successfully!');
            setModalOpen(false);
            setForm({ title: '', description: '', required_by: '', notes: '', items: [{ material_name: '', quantity: '', unit: 'kg', specifications: '' }], supplier_ids: [] });
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create RFQ');
        } finally { setSaving(false); }
    };

    const handleSend = async (id: number) => {
        try {
            await rfqsAPI.send(id);
            toast.success('RFQ sent to suppliers!');
            load();
        } catch { toast.error('Failed to send RFQ'); }
    };

    const addItem = () => setForm({ ...form, items: [...form.items, { material_name: '', quantity: '', unit: 'kg', specifications: '' }] });
    const updateItem = (i: number, key: string, val: string) => {
        const items = [...form.items];
        items[i] = { ...items[i], [key]: val };
        setForm({ ...form, items });
    };

    const toggleSupplier = (id: number) => {
        const ids = form.supplier_ids.includes(id) ? form.supplier_ids.filter(s => s !== id) : [...form.supplier_ids, id];
        setForm({ ...form, supplier_ids: ids });
    };

    return (
        <>
            <Header title="RFQ Management" subtitle="Request for Quotation and supplier comparison" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>RFQ Management</h2>
                        <p>{total} RFQs total</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Create RFQ</button>
                </div>

                <div className="card">
                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>RFQ Number</th><th>Title</th><th>Required By</th>
                                    <th>Quotations</th><th>Status</th><th>Created</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {rfqs.map(r => (
                                        <tr key={r.id}>
                                            <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.rfq_number}</span></td>
                                            <td style={{ fontWeight: 500 }}>{r.title}</td>
                                            <td>{r.required_by ? format(new Date(r.required_by), 'dd MMM yyyy') : '—'}</td>
                                            <td>
                                                <span style={{ padding: '2px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                                                    {r.quotation_count} quotes
                                                </span>
                                            </td>
                                            <td><StatusBadge status={r.status} /></td>
                                            <td style={{ color: '#94a3b8', fontSize: 12 }}>{format(new Date(r.created_at), 'dd MMM yyyy')}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {r.status === 'draft' && (
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleSend(r.id)}>
                                                            <Send size={13} /> Send
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!rfqs.length && (
                                        <tr><td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Search size={24} /></div>
                                                <h3>No RFQs yet</h3>
                                                <p>Create your first Request for Quotation</p>
                                                <button className="btn btn-primary" onClick={() => setModalOpen(true)}>Create RFQ</button>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={15} onPageChange={setPage} />
                </div>

                <Modal
                    isOpen={modalOpen} onClose={() => setModalOpen(false)}
                    title="Create New RFQ" size="xl"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />}
                                Create RFQ
                            </button>
                        </>
                    }
                >
                    <form onSubmit={handleSubmit}>
                        <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label required">RFQ Title</label>
                                <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. EN8 Steel Bars Q1 2024" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Required By</label>
                                <input className="form-control" type="date" value={form.required_by} onChange={e => setForm({ ...form, required_by: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">Description</label>
                            <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief description of requirements..." />
                        </div>

                        {/* Items */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>Required Materials</label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
                            </div>
                            {form.items.map((item, i) => (
                                <div key={i} className="form-row form-row-3" style={{ marginBottom: 10, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 11 }}>Material Name</label>
                                        <input className="form-control" value={item.material_name} onChange={e => updateItem(i, 'material_name', e.target.value)} placeholder="Material name" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 11 }}>Quantity</label>
                                        <input className="form-control" type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="0" min="0" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 11 }}>Unit</label>
                                        <select className="form-control" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                                            <option>kg</option><option>mtr</option><option>pcs</option><option>ltr</option><option>ton</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Suppliers */}
                        <div>
                            <label className="form-label">Select Suppliers to Send RFQ</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                                {suppliers.map(s => (
                                    <label key={s.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                        background: form.supplier_ids.includes(s.id) ? '#eff6ff' : '#f8fafc',
                                        border: `1.5px solid ${form.supplier_ids.includes(s.id) ? '#bfdbfe' : '#e2e8f0'}`,
                                        borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s'
                                    }}>
                                        <input type="checkbox" checked={form.supplier_ids.includes(s.id)} onChange={() => toggleSupplier(s.id)} />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.code}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </form>
                </Modal>
            </div>
        </>
    );
}
