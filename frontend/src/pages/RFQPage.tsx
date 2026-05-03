import { useEffect, useState } from 'react';
import { Plus, Search, Send, Trash2 } from 'lucide-react';
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
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [form, setForm] = useState({
        title: '', description: '', required_by: '', notes: '',
        items: [{ material_name: '', quantity: '', unit: 'kg', specifications: '' }],
        supplier_ids: [] as number[]
    });

    // RFQ_015: RFQ Title — letters, digits, spaces and common punctuation only
    const RFQ_TITLE_REGEX = /^[A-Za-z0-9\s\-_.,()&/:'"]+$/;
    // RFQ_016: today's date in YYYY-MM-DD format for min attribute and past-date check
    const getTodayISO = () => new Date().toISOString().split('T')[0];
    // RFQ_017: Material Name — letters, digits, spaces and basic material-description punctuation
    const MATERIAL_NAME_REGEX = /^[A-Za-z0-9\s\-_.,()/%]+$/;
    // RFQ_021: Description limits
    const DESC_MAX = 500;
    const DESC_MIN = 10;

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

        // RFQ_015: validate RFQ Title before submission
        const errors: Record<string, string> = {};
        if (!form.title.trim()) {
            errors.title = 'RFQ Title is required';
        } else if (!RFQ_TITLE_REGEX.test(form.title)) {
            errors.title = 'RFQ Title contains invalid characters. Allowed: letters, digits, spaces, - _ . , ( ) & / : \' "';
        }
        // RFQ_016: Required By must not be in the past
        if (form.required_by && form.required_by < getTodayISO()) {
            errors.required_by = 'Required By date cannot be in the past. Please select today or a future date';
        }
        // RFQ_021: Description — optional but if provided must be meaningful (10–500 chars, no HTML tags)
        if (form.description.trim()) {
            if (form.description.trim().length < DESC_MIN) {
                errors.description = `Description is too short — please enter at least ${DESC_MIN} characters`;
            } else if (form.description.length > DESC_MAX) {
                errors.description = `Description cannot exceed ${DESC_MAX} characters (currently ${form.description.length})`;
            }
        }
        // RFQ_019: at least one material item is required
        if (form.items.length === 0) {
            errors.items_empty = 'At least one Required Material must be added';
        }
        // RFQ_017 / RFQ_018 / RFQ_019: validate each item's material_name and quantity
        form.items.forEach((item, i) => {
            if (!item.material_name.trim()) {
                errors[`item_${i}_material_name`] = 'Material Name is required';
            } else if (!MATERIAL_NAME_REGEX.test(item.material_name)) {
                errors[`item_${i}_material_name`] = 'Material Name contains invalid characters. Allowed: letters, digits, spaces, - _ . , ( ) / %';
            }
            // RFQ_018: quantity must be a positive number (> 0); 000000 evaluates to 0
            const qty = Number(item.quantity);
            if (item.quantity === '' || isNaN(qty)) {
                errors[`item_${i}_quantity`] = 'Quantity is required';
            } else if (qty <= 0) {
                errors[`item_${i}_quantity`] = 'Quantity must be greater than 0 (zero or all-zeros not allowed)';
            }
        });
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        setSaving(true);
        try {
            await rfqsAPI.create(form);
            toast.success('RFQ created successfully!');
            setModalOpen(false);
            setForm({ title: '', description: '', required_by: '', notes: '', items: [{ material_name: '', quantity: '', unit: 'kg', specifications: '' }], supplier_ids: [] });
            setFormErrors({});
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

    // RFQ_019: clear items_empty error when a new item is added
    const addItem = () => {
        setForm({ ...form, items: [...form.items, { material_name: '', quantity: '', unit: 'kg', specifications: '' }] });
        setFormErrors(fe => ({ ...fe, items_empty: '' }));
    };
    const updateItem = (i: number, key: string, val: string) => {
        const items = [...form.items];
        items[i] = { ...items[i], [key]: val };
        setForm({ ...form, items });
        // RFQ_017: clear per-item material_name error on edit
        if (key === 'material_name') {
            setFormErrors(fe => ({ ...fe, [`item_${i}_material_name`]: '' }));
        }
        // RFQ_018: clear per-item quantity error on edit
        if (key === 'quantity') {
            setFormErrors(fe => ({ ...fe, [`item_${i}_quantity`]: '' }));
        }
    };

    // RFQ_022: remove an item row and clear its per-item errors; disabled when only 1 row remains (RFQ_019)
    const removeItem = (i: number) => {
        if (form.items.length <= 1) return;
        const items = form.items.filter((_, idx) => idx !== i);
        setForm({ ...form, items });
        // clear errors for the removed row and re-index remaining rows
        setFormErrors(fe => {
            const next = { ...fe };
            delete next[`item_${i}_material_name`];
            delete next[`item_${i}_quantity`];
            return next;
        });
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
                                {/* RFQ_015: validated input — strips invalid chars live */}
                                <input
                                    className={`form-control${formErrors.title ? ' is-invalid' : ''}`}
                                    value={form.title}
                                    onChange={e => {
                                        // strip characters not in the allowed set as user types
                                        const val = e.target.value.replace(/[^A-Za-z0-9\s\-_.,()&/:'"]/g, '');
                                        setForm({ ...form, title: val });
                                        setFormErrors(fe => ({ ...fe, title: '' }));
                                    }}
                                    required
                                    placeholder="e.g. EN8 Steel Bars Q1 2024"
                                />
                                {formErrors.title && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.title}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                {/* RFQ_016: Required By is mandatory and must not be in the past */}
                                <label className="form-label required">Required By</label>
                                <input
                                    className={`form-control${formErrors.required_by ? ' is-invalid' : ''}`}
                                    type="date"
                                    value={form.required_by}
                                    min={getTodayISO()}
                                    onChange={e => {
                                        setForm({ ...form, required_by: e.target.value });
                                        setFormErrors(fe => ({ ...fe, required_by: '' }));
                                    }}
                                    required
                                />
                                {formErrors.required_by && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.required_by}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 20 }}>
                            <label className="form-label">Description</label>
                            {/* RFQ_021: optional but validated — min 10 chars if provided, max 500, no HTML */}
                            <textarea
                                className={`form-control${formErrors.description ? ' is-invalid' : ''}`}
                                value={form.description}
                                onChange={e => {
                                    // strip < and > to prevent HTML/script injection
                                    const val = e.target.value.replace(/[<>]/g, '');
                                    setForm({ ...form, description: val });
                                    setFormErrors(fe => ({ ...fe, description: '' }));
                                }}
                                rows={2}
                                maxLength={DESC_MAX}
                                placeholder="Brief description of requirements (min 10 characters)..."
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                {formErrors.description
                                    ? <span style={{ color: '#ef4444', fontSize: 12 }}>{formErrors.description}</span>
                                    : <span style={{ fontSize: 12, color: '#94a3b8' }}>Optional — min 10 chars if provided</span>
                                }
                                <span style={{ fontSize: 11, color: form.description.length > DESC_MAX * 0.9 ? '#f59e0b' : '#94a3b8' }}>
                                    {form.description.length}/{DESC_MAX}
                                </span>
                            </div>
                        </div>

                        {/* Items */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                {/* RFQ_019: Required Materials is mandatory — marked with required class */}
                                <label className="form-label required" style={{ marginBottom: 0 }}>Required Materials</label>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
                            </div>
                            {/* RFQ_019: section-level error when all item rows are deleted */}
                            {formErrors.items_empty && (
                                <span style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, display: 'block' }}>
                                    {formErrors.items_empty}
                                </span>
                            )}
                            {form.items.map((item, i) => {
                                // RFQ_022: row-level error — card border turns red if ANY field in this row has an error
                                const rowHasError = !!formErrors[`item_${i}_material_name`] || !!formErrors[`item_${i}_quantity`];
                                return (
                                <div key={i} style={{
                                    marginBottom: 10, padding: '10px 12px',
                                    background: rowHasError ? '#fff5f5' : '#f8fafc',
                                    borderRadius: 8,
                                    border: `1.5px solid ${rowHasError ? '#ef4444' : '#e2e8f0'}`,
                                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'start'
                                }}>
                                    <div className="form-group">
                                        {/* RFQ_017/RFQ_019: Material Name is mandatory */}
                                        <label className="form-label required" style={{ fontSize: 11 }}>Material Name</label>
                                        {/* RFQ_017: live character filtering for material name */}
                                        <input
                                            className={`form-control${formErrors[`item_${i}_material_name`] ? ' is-invalid' : ''}`}
                                            value={item.material_name}
                                            onChange={e => {
                                                const val = e.target.value.replace(/[^A-Za-z0-9\s\-_.,()/%]/g, '');
                                                updateItem(i, 'material_name', val);
                                            }}
                                            placeholder="e.g. EN8 Steel Rod"
                                            required
                                        />
                                        {formErrors[`item_${i}_material_name`] && (
                                            <span style={{ color: '#ef4444', fontSize: 11, marginTop: 3, display: 'block' }}>
                                                {formErrors[`item_${i}_material_name`]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        {/* RFQ_018: quantity must be > 0 */}
                                        <label className="form-label required" style={{ fontSize: 11 }}>Quantity</label>
                                        <input
                                            className={`form-control${formErrors[`item_${i}_quantity`] ? ' is-invalid' : ''}`}
                                            type="number"
                                            value={item.quantity}
                                            onChange={e => updateItem(i, 'quantity', e.target.value)}
                                            placeholder="e.g. 100"
                                            min="1"
                                            step="any"
                                            required
                                        />
                                        {formErrors[`item_${i}_quantity`] && (
                                            <span style={{ color: '#ef4444', fontSize: 11, marginTop: 3, display: 'block' }}>
                                                {formErrors[`item_${i}_quantity`]}
                                            </span>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 11 }}>Unit</label>
                                        <select className="form-control" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                                            <option>kg</option><option>mtr</option><option>pcs</option><option>ltr</option><option>ton</option>
                                        </select>
                                    </div>
                                    {/* RFQ_022: Remove row button — disabled when only 1 row remains */}
                                    <div style={{ paddingTop: 22 }}>
                                        <button
                                            type="button"
                                            className="btn btn-danger btn-icon btn-sm"
                                            onClick={() => removeItem(i)}
                                            disabled={form.items.length <= 1}
                                            title={form.items.length <= 1 ? 'At least one item is required' : 'Remove this item'}
                                            style={{ opacity: form.items.length <= 1 ? 0.35 : 1 }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                                );
                            })}
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
