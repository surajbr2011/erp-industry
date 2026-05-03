import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Package, Trash2 } from 'lucide-react';
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
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // PO_023: Material name — letters, digits, spaces and standard material-description punctuation only
    const PO_MATERIAL_REGEX = /^[A-Za-z0-9\s\-_.,()/%]+$/;
    // PO_026: Address limits
    const ADDRESS_MAX = 250;
    const ADDRESS_MIN = 10;

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

        // PO_023: validate each item's material_name before submission
        const errors: Record<string, string> = {};
        if (!form.items || form.items.length === 0) {
            errors.items_empty = 'At least one PO item is required';
        }
        form.items.forEach((item: any, i: number) => {
            if (!item.material_name.trim()) {
                errors[`item_${i}_material`] = 'Material name is required';
            } else if (!PO_MATERIAL_REGEX.test(item.material_name)) {
                errors[`item_${i}_material`] = 'Material name contains invalid characters. Allowed: letters, digits, spaces, - _ . , ( ) / %';
            }
            // PO_024: quantity must be present and > 0
            const qty = Number(item.quantity);
            if (item.quantity === '' || item.quantity === null || item.quantity === undefined) {
                errors[`item_${i}_qty`] = 'Quantity is required';
            } else if (isNaN(qty) || qty <= 0) {
                errors[`item_${i}_qty`] = 'Quantity must be greater than 0';
            }
            // PO_025: Rate (unit_price) is mandatory and must be >= 0
            const rate = Number(item.unit_price);
            if (item.unit_price === '' || item.unit_price === null || item.unit_price === undefined) {
                errors[`item_${i}_rate`] = 'Rate is required';
            } else if (isNaN(rate) || rate < 0) {
                errors[`item_${i}_rate`] = 'Rate must be 0 or a positive number';
            }
        });
        
        // PO_026: validate shipping address
        if (form.shipping_address.trim()) {
            if (form.shipping_address.trim().length < ADDRESS_MIN) {
                errors.shipping_address = `Shipping address is too short — please enter at least ${ADDRESS_MIN} characters`;
            } else if (form.shipping_address.length > ADDRESS_MAX) {
                errors.shipping_address = `Shipping address cannot exceed ${ADDRESS_MAX} characters`;
            }
        }
        
        // PO_027: Payment Terms is required
        if (!form.payment_terms) {
            errors.payment_terms = 'Payment Terms are required';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        setSaving(true);
        try {
            await purchaseOrdersAPI.create(form);
            toast.success('Purchase Order created!');
            setModalOpen(false);
            setForm(INITIAL_FORM);
            setFormErrors({});
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

    const addItem = () => {
        setForm({ ...form, items: [...form.items, { material_name: '', quantity: '', unit: 'kg', unit_price: '', tax_percentage: 18 }] });
        setFormErrors((fe: Record<string, string>) => ({ ...fe, items_empty: '' }));
    };
    const removeItem = (i: number) => {
        if (form.items.length <= 1) return;
        const items = form.items.filter((_: any, idx: number) => idx !== i);
        setForm({ ...form, items });
        setFormErrors((fe: Record<string, string>) => {
            const next = { ...fe };
            delete next[`item_${i}_material`];
            delete next[`item_${i}_qty`];
            delete next[`item_${i}_rate`];
            return next;
        });
    };
    const updateItem = (i: number, k: string, v: any) => {
        const items = [...form.items]; items[i] = { ...items[i], [k]: v }; setForm({ ...form, items });
        // PO_023: clear per-item material error on edit
        if (k === 'material_name') setFormErrors((fe: Record<string, string>) => ({ ...fe, [`item_${i}_material`]: '' }));
        // PO_024: clear per-item quantity error on edit
        if (k === 'quantity') setFormErrors((fe: Record<string, string>) => ({ ...fe, [`item_${i}_qty`]: '' }));
        // PO_025: clear per-item rate error on edit
        if (k === 'unit_price') setFormErrors((fe: Record<string, string>) => ({ ...fe, [`item_${i}_rate`]: '' }));
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
                                {/* PO_027: Payment Terms is mandatory */}
                                <label className="form-label required">Payment Terms</label>
                                <select 
                                    className={`form-control${formErrors.payment_terms ? ' is-invalid' : ''}`} 
                                    value={form.payment_terms} 
                                    onChange={e => {
                                        setForm({ ...form, payment_terms: e.target.value });
                                        setFormErrors(fe => ({ ...fe, payment_terms: '' }));
                                    }} 
                                    required
                                >
                                    <option value="">Select...</option>
                                    <option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Advance</option>
                                </select>
                                {formErrors.payment_terms && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.payment_terms}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>PO Items</label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Row</button>
                            </div>
                            {formErrors.items_empty && (
                                <span style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, display: 'block' }}>{formErrors.items_empty}</span>
                            )}
                            {form.items.map((item: any, i: number) => {
                                // PO_023/PO_024/PO_025: row border turns red when any field in this row has an error
                                const rowHasError = !!formErrors[`item_${i}_material`] || !!formErrors[`item_${i}_qty`] || !!formErrors[`item_${i}_rate`];
                                return (
                                <div key={i} style={{
                                    display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr 80px auto',
                                    gap: 8, marginBottom: 8, padding: '10px',
                                    background: rowHasError ? '#fff5f5' : '#f8fafc',
                                    borderRadius: 8,
                                    border: `1.5px solid ${rowHasError ? '#ef4444' : '#e2e8f0'}`
                                }}>
                                    <div className="form-group">
                                        {/* PO_023: Material is mandatory with character restriction */}
                                        <label className="form-label required" style={{ fontSize: 10 }}>Material</label>
                                        <input
                                            className={`form-control${formErrors[`item_${i}_material`] ? ' is-invalid' : ''}`}
                                            value={item.material_name}
                                            onChange={e => {
                                                // strip invalid chars as user types
                                                const val = e.target.value.replace(/[^A-Za-z0-9\s\-_.,()/%]/g, '');
                                                updateItem(i, 'material_name', val);
                                            }}
                                            placeholder="e.g. EN8 Steel Rod"
                                            required
                                        />
                                        {formErrors[`item_${i}_material`] && (
                                            <span style={{ color: '#ef4444', fontSize: 10, marginTop: 2, display: 'block' }}>
                                                {formErrors[`item_${i}_material`]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        {/* PO_024: Qty is mandatory and must be > 0 */}
                                        <label className="form-label required" style={{ fontSize: 10 }}>Qty</label>
                                        <input
                                            className={`form-control${formErrors[`item_${i}_qty`] ? ' is-invalid' : ''}`}
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => updateItem(i, 'quantity', e.target.value)}
                                            placeholder="e.g. 50"
                                            min={1}
                                            step="any"
                                            required
                                        />
                                        {formErrors[`item_${i}_qty`] && (
                                            <span style={{ color: '#ef4444', fontSize: 10, marginTop: 2, display: 'block' }}>
                                                {formErrors[`item_${i}_qty`]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Unit</label>
                                        <select className="form-control" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                                            <option>kg</option><option>mtr</option><option>pcs</option><option>ltr</option><option>ton</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        {/* PO_025: Rate is mandatory */}
                                        <label className="form-label required" style={{ fontSize: 10 }}>Rate (₹)</label>
                                        <input
                                            className={`form-control${formErrors[`item_${i}_rate`] ? ' is-invalid' : ''}`}
                                            type="number"
                                            value={item.unit_price}
                                            onChange={e => updateItem(i, 'unit_price', e.target.value)}
                                            placeholder="e.g. 250.00"
                                            min={0}
                                            step="0.01"
                                            required
                                        />
                                        {formErrors[`item_${i}_rate`] && (
                                            <span style={{ color: '#ef4444', fontSize: 10, marginTop: 2, display: 'block' }}>
                                                {formErrors[`item_${i}_rate`]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 10 }}>Tax%</label>
                                        <input className="form-control" type="number" value={item.tax_percentage} onChange={e => updateItem(i, 'tax_percentage', parseFloat(e.target.value))} min={0} />
                                    </div>
                                    <div style={{ paddingTop: 20 }}>
                                        <button
                                            type="button"
                                            className="btn btn-danger btn-icon btn-sm"
                                            onClick={() => removeItem(i)}
                                            disabled={form.items.length <= 1}
                                            title={form.items.length <= 1 ? 'At least one item required' : 'Remove row'}
                                            style={{ opacity: form.items.length <= 1 ? 0.35 : 1 }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">Shipping Address</label>
                            {/* PO_026: optional but validated — min 10 chars if provided, max 250, no HTML */}
                            <textarea
                                className={`form-control${formErrors.shipping_address ? ' is-invalid' : ''}`}
                                value={form.shipping_address}
                                onChange={e => {
                                    // strip < and > to prevent HTML/script injection
                                    const val = e.target.value.replace(/[<>]/g, '');
                                    setForm({ ...form, shipping_address: val });
                                    setFormErrors((fe: Record<string, string>) => ({ ...fe, shipping_address: '' }));
                                }}
                                rows={2}
                                maxLength={ADDRESS_MAX}
                                placeholder="Delivery address (min 10 characters)..."
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                {formErrors.shipping_address
                                    ? <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.shipping_address}</span>
                                    : <span style={{ fontSize: 12, color: '#94a3b8' }}>Optional — min 10 chars if provided</span>
                                }
                                <span style={{ fontSize: 11, color: form.shipping_address.length > ADDRESS_MAX * 0.9 ? '#f59e0b' : '#94a3b8' }}>
                                    {form.shipping_address.length}/{ADDRESS_MAX}
                                </span>
                            </div>
                        </div>
                    </form>
                </Modal>
            </div>
        </>
    );
}
