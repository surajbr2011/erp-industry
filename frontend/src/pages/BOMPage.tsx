import { useEffect, useState } from 'react';
import { Plus, Search, Eye, CheckCircle, Layers } from 'lucide-react';
import { bomsAPI, materialsAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const INITIAL_FORM = {
    product_name: '', product_code: '', version: '1.0', description: '', drawing_number: '',
    items: [{ material_id: '', material_name: '', quantity: '', unit: 'kg', scrap_percentage: 0, is_critical: false }],
    operations: [{ operation_name: '', operation_type: 'cnc', sequence_number: 1, estimated_time_hours: 0 }]
};

export default function BOMPage() {
    const [boms, setBoms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [detailModal, setDetailModal] = useState<any>(null);
    const [materials, setMaterials] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [form, setForm] = useState(INITIAL_FORM);

    // BOM_006: Product Name Validation
    const PRODUCT_NAME_REGEX = /^[A-Za-z0-9\s\-_.,()/%]+$/;

    const load = async () => {
        setLoading(true);
        try {
            const r = await bomsAPI.getAll({ page, limit: 15, search });
            setBoms(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, search]);
    useEffect(() => { materialsAPI.getAll({ limit: 200 }).then(r => setMaterials(r.data.data)); }, []);

    const viewDetail = async (id: number) => {
        const r = await bomsAPI.getById(id);
        setDetailModal(r.data.data);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const errors: Record<string, string> = {};
        if (!form.product_name.trim()) {
            errors.product_name = 'Product Name is required';
        } else if (!PRODUCT_NAME_REGEX.test(form.product_name)) {
            errors.product_name = 'Product name contains invalid characters. Allowed: letters, digits, spaces, - _ . , ( ) / %';
        }
        
        if (!form.product_code.trim()) errors.product_code = 'Product Code is required';
        
        // BOM_003: Validate materials
        if (!form.items || form.items.length === 0) {
            errors.items_empty = 'At least one material is required';
        }
        form.items.forEach((item: any, i: number) => {
            if (!item.material_id) {
                errors[`item_${i}_material`] = 'Please select a material';
            }
            const qty = Number(item.quantity);
            if (item.quantity === '' || item.quantity === null || item.quantity === undefined) {
                errors[`item_${i}_qty`] = 'Quantity is required';
            } else if (isNaN(qty) || qty < 0.01) {
                errors[`item_${i}_qty`] = 'Quantity must be >= 0.01';
            }
        });

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        setSaving(true);
        try {
            await bomsAPI.create(form);
            toast.success('BOM created!');
            setModalOpen(false);
            setForm(INITIAL_FORM);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create BOM');
        } finally { setSaving(false); }
    };

    const addItem = () => setForm({ ...form, items: [...form.items, { material_id: '', material_name: '', quantity: '', unit: 'kg', scrap_percentage: 0, is_critical: false }] });
    const addOp = () => setForm({ ...form, operations: [...form.operations, { operation_name: '', operation_type: 'cnc', sequence_number: form.operations.length + 1, estimated_time_hours: 0 }] });

    const updateItem = (i: number, k: string, v: any) => {
        const items = [...form.items];
        items[i] = { ...items[i], [k]: v };
        if (k === 'material_id') {
            const mat = materials.find(m => m.id === parseInt(v));
            if (mat) items[i].material_name = mat.name;
        }
        setForm({ ...form, items });
        // BOM_003: clear individual errors
        if (k === 'material_id') setFormErrors(fe => ({ ...fe, [`item_${i}_material`]: '' }));
        if (k === 'quantity') setFormErrors(fe => ({ ...fe, [`item_${i}_qty`]: '' }));
    };
    const updateOp = (i: number, k: string, v: any) => {
        const operations = [...form.operations]; operations[i] = { ...operations[i], [k]: v }; setForm({ ...form, operations });
    };

    const handleActivate = async (bom: any) => {
        // BOM_005: Prevent activation without materials or operations
        if (Number(bom.item_count) === 0 || Number(bom.operation_count) === 0) {
            toast.error('Cannot activate: BOM must have at least 1 material and 1 operation.');
            return;
        }
        
        try {
            await bomsAPI.update(bom.id, { ...bom, status: 'active' });
            toast.success('BOM activated!');
            load();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to activate'); }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setForm(INITIAL_FORM);
        setFormErrors({});
    };

    return (
        <>
            <Header title="Bill of Materials" subtitle="Define product structures and manufacturing processes" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Bill of Materials</h2>
                        <p>{total} BOMs defined</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Create BOM</button>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="search-wrapper" style={{ flex: 1, maxWidth: 320 }}>
                            <Search size={15} className="search-icon" />
                            <input className="form-control search-input" placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                        </div>
                    </div>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>BOM Number</th><th>Product</th><th>Code</th><th>Version</th>
                                    <th>Materials</th><th>Operations</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {boms.map(b => (
                                        <tr key={b.id}>
                                            <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{b.bom_number}</span></td>
                                            <td style={{ fontWeight: 600, maxWidth: 200 }}>
                                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.product_name}>
                                                    {b.product_name}
                                                </div>
                                            </td>
                                            <td style={{ color: '#475569', maxWidth: 150 }}>
                                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.product_code}>
                                                    {b.product_code}
                                                </div>
                                            </td>
                                            <td style={{ color: '#64748b' }}>v{b.version}</td>
                                            <td><span className="badge badge-info">{b.item_count} items</span></td>
                                            <td><span className="badge badge-secondary">{b.operation_count} ops</span></td>
                                            <td><StatusBadge status={b.status} /></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => viewDetail(b.id)}><Eye size={13} /> View</button>
                                                    {b.status === 'draft' && (
                                                        <button className="btn btn-success btn-sm" onClick={() => handleActivate(b)}>
                                                            <CheckCircle size={13} /> Activate
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!boms.length && (
                                        <tr><td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Layers size={24} /></div>
                                                <h3>No BOMs created</h3>
                                                <p>Define your first Bill of Materials</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={15} onPageChange={setPage} />
                </div>

                {/* Create BOM Modal */}
                <Modal isOpen={modalOpen} onClose={handleCloseModal} title="Create Bill of Materials" size="xl"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />} Create BOM
                            </button>
                        </>
                    }
                >
                    <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label required">Product Name</label>
                            <input 
                                className={`form-control${formErrors.product_name ? ' is-invalid' : ''}`} 
                                value={form.product_name} 
                                onChange={e => {
                                    // BOM_006: Strip invalid characters as user types
                                    const val = e.target.value.replace(/[^A-Za-z0-9\s\-_.,()/%]/g, '');
                                    setForm({ ...form, product_name: val });
                                    if (formErrors.product_name) setFormErrors({ ...formErrors, product_name: '' });
                                }} 
                                required 
                                placeholder="Product name" 
                            />
                            {formErrors.product_name && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>{formErrors.product_name}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Product Code</label>
                            <input 
                                className={`form-control${formErrors.product_code ? ' is-invalid' : ''}`} 
                                value={form.product_code} 
                                onChange={e => {
                                    setForm({ ...form, product_code: e.target.value });
                                    if (formErrors.product_code) setFormErrors({ ...formErrors, product_code: '' });
                                }} 
                                required 
                                placeholder="PROD-001" 
                            />
                            {formErrors.product_code && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>{formErrors.product_code}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Drawing Number</label>
                            <input className="form-control" value={form.drawing_number} onChange={e => setForm({ ...form, drawing_number: e.target.value })} placeholder="DRG-001-RevA" />
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <strong style={{ fontSize: 13 }}>📦 Raw Materials Required</strong>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add</button>
                        </div>
                        {formErrors.items_empty && <span style={{ color: '#ef4444', fontSize: 12, marginBottom: 8, display: 'block' }}>{formErrors.items_empty}</span>}
                        {form.items.map((item, i) => {
                            const rowHasError = !!formErrors[`item_${i}_material`] || !!formErrors[`item_${i}_qty`];
                            return (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 1fr', gap: 8, marginBottom: 8, padding: '10px', background: rowHasError ? '#fff5f5' : '#f8fafc', borderRadius: 8, border: `1px solid ${rowHasError ? '#ef4444' : '#e2e8f0'}` }}>
                                <div className="form-group">
                                    <label className="form-label required" style={{ fontSize: 10 }}>Material</label>
                                    <select className={`form-control${formErrors[`item_${i}_material`] ? ' is-invalid' : ''}`} value={item.material_id} onChange={e => updateItem(i, 'material_id', e.target.value)}>
                                        <option value="">Select material...</option>
                                        {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
                                    </select>
                                    {formErrors[`item_${i}_material`] && <span style={{ color: '#ef4444', fontSize: 10, marginTop: 2, display: 'block' }}>{formErrors[`item_${i}_material`]}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label required" style={{ fontSize: 10 }}>Quantity</label>
                                    <input className={`form-control${formErrors[`item_${i}_qty`] ? ' is-invalid' : ''}`} type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min={0.01} step="0.01" />
                                    {formErrors[`item_${i}_qty`] && <span style={{ color: '#ef4444', fontSize: 10, marginTop: 2, display: 'block' }}>{formErrors[`item_${i}_qty`]}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 10 }}>Unit</label>
                                    <select className="form-control" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)}>
                                        <option>kg</option><option>mtr</option><option>pcs</option><option>ltr</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 10 }}>Scrap %</label>
                                    <input className="form-control" type="number" value={item.scrap_percentage} onChange={e => updateItem(i, 'scrap_percentage', parseFloat(e.target.value))} min={0} max={100} />
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <strong style={{ fontSize: 13 }}>⚙️ Operations Sequence</strong>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={addOp}><Plus size={13} /> Add</button>
                        </div>
                        {form.operations.map((op, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1fr 1fr', gap: 8, marginBottom: 8, padding: '10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', alignItems: 'end' }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 10 }}>Operation Name</label>
                                    <input className="form-control" value={op.operation_name} onChange={e => updateOp(i, 'operation_name', e.target.value)} placeholder="e.g. CNC Turning" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 10 }}>Type</label>
                                    <select className="form-control" value={op.operation_type} onChange={e => updateOp(i, 'operation_type', e.target.value)}>
                                        <option value="cnc">CNC</option><option value="milling">Milling</option>
                                        <option value="turning">Turning</option><option value="grinding">Grinding</option>
                                        <option value="welding">Welding</option><option value="quality_check">Quality Check</option>
                                        <option value="assembly">Assembly</option><option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 10 }}>Est. Hours</label>
                                    <input className="form-control" type="number" value={op.estimated_time_hours} onChange={e => updateOp(i, 'estimated_time_hours', parseFloat(e.target.value))} min={0} step="0.5" />
                                </div>
                            </div>
                        ))}
                    </div>
                </Modal>

                {/* BOM Detail Modal */}
                <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title={`BOM: ${detailModal?.product_name}`} size="xl">
                    {detailModal && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                                {[
                                    { label: 'Product Code', value: detailModal.product_code },
                                    { label: 'BOM Number', value: detailModal.bom_number },
                                    { label: 'Version', value: `v${detailModal.version}` },
                                    { label: 'Drawing', value: detailModal.drawing_number || '—' },
                                    { label: 'Status', value: <StatusBadge status={detailModal.status} /> },
                                    { label: 'Created By', value: detailModal.created_by_name },
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <h4 style={{ fontWeight: 700, marginBottom: 12 }}>📦 Bill of Materials</h4>
                                <table><thead><tr><th>Material</th><th>Code</th><th>Quantity</th><th>Unit</th><th>Scrap %</th><th>Critical</th></tr></thead>
                                    <tbody>
                                        {detailModal.items?.map((item: any) => (
                                            <tr key={item.id}>
                                                <td style={{ fontWeight: 600 }}>{item.material_name}</td>
                                                <td style={{ color: '#64748b' }}>{item.material_code || '—'}</td>
                                                <td style={{ fontWeight: 700 }}>{item.quantity}</td>
                                                <td>{item.unit}</td>
                                                <td>{item.scrap_percentage}%</td>
                                                <td>{item.is_critical ? <span className="badge badge-danger">Critical</span> : <span className="badge badge-secondary">No</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div>
                                <h4 style={{ fontWeight: 700, marginBottom: 12 }}>⚙️ Operations Sequence</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {detailModal.operations?.map((op: any) => (
                                        <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{op.sequence_number}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600 }}>{op.operation_name}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{op.operation_type?.replace('_', ' ')}</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>{op.estimated_time_hours}h estimated</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </>
    );
}
