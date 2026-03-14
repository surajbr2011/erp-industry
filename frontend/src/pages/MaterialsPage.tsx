import { useEffect, useState } from 'react';
import { Plus, Search, AlertTriangle, Package, ArrowUpDown, Upload, Download } from 'lucide-react';
import { materialsAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const INITIAL_FORM = {
    code: '', name: '', description: '', category: '', unit: 'kg',
    minimum_stock: 0, reorder_point: 0, unit_cost: 0, material_type: 'raw_material',
    specifications: '', hsn_code: ''
};

export default function MaterialsPage() {
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [lowStockFilter, setLowStockFilter] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [adjustModal, setAdjustModal] = useState<any>(null);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(INITIAL_FORM);
    const [adjustForm, setAdjustForm] = useState({ adjustment: 0, reason: '' });
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await materialsAPI.getAll({ page, limit: 20, search, low_stock: lowStockFilter ? 'true' : undefined });
            setMaterials(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, search, lowStockFilter]);

    const openModal = (mat?: any) => {
        if (mat) { setEditing(mat); setForm({ ...INITIAL_FORM, ...mat }); }
        else { setEditing(null); setForm(INITIAL_FORM); }
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) { await materialsAPI.update(editing.id, form); toast.success('Material updated!'); }
            else { await materialsAPI.create(form); toast.success('Material created!'); }
            setModalOpen(false);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally { setSaving(false); }
    };

    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await materialsAPI.adjustStock(adjustModal.id, adjustForm);
            toast.success('Stock adjusted!');
            setAdjustModal(null);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to adjust stock');
        } finally { setSaving(false); }
    };

    const handleExport = async () => {
        try {
            const response = await materialsAPI.export();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'materials_database.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error('Export failed');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const r = await materialsAPI.bulkUpload(file);
            toast.success(r.data.message);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Import failed');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const getStockStatus = (mat: any) => {
        const stock = parseFloat(mat.current_stock);
        const min = parseFloat(mat.minimum_stock);
        const reorder = parseFloat(mat.reorder_point);
        if (stock <= min) return { label: 'Critical', color: '#dc2626', bg: '#fef2f2' };
        if (stock <= reorder) return { label: 'Low', color: '#d97706', bg: '#fffbeb' };
        return { label: 'OK', color: '#16a34a', bg: '#f0fdf4' };
    };

    const f = (key: string) => (e: any) => setForm({ ...form, [key]: e.target.value });

    return (
        <>
            <Header title="Material Inventory" subtitle="Raw material stock management and batch tracking" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Material Inventory</h2>
                        <p>{total} materials tracked</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            className={`btn ${lowStockFilter ? 'btn-warning' : 'btn-secondary'}`}
                            onClick={() => { setLowStockFilter(!lowStockFilter); setPage(1); }}
                        >
                            <AlertTriangle size={15} /> Low Stock
                        </button>
                        <button className="btn btn-secondary" onClick={handleExport}>
                            <Download size={15} /> Export
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <label className={`btn btn-secondary ${importing ? 'loading' : ''}`} style={{ cursor: 'pointer', marginBottom: 0 }}>
                                <Upload size={15} /> {importing ? 'Importing...' : 'Import'}
                                <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleImport} disabled={importing} />
                            </label>
                            <a href="#" onClick={(e) => {
                                e.preventDefault();
                                materialsAPI.downloadTemplate().then(res => {
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', 'materials_template.xlsx');
                                    link.click();
                                });
                            }} style={{ fontSize: 10, color: '#2563eb', textAlign: 'center', fontWeight: 600 }}>Template</a>
                        </div>
                        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={16} /> Add Material</button>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="search-wrapper" style={{ flex: 1, maxWidth: 320 }}>
                            <Search size={15} className="search-icon" />
                            <input className="form-control search-input" placeholder="Search materials..." value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }} />
                        </div>
                    </div>

                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>Material</th><th>Category</th><th>Type</th><th>Current Stock</th>
                                    <th>Min Stock</th><th>Unit Cost</th><th>Stock Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {materials.map(m => {
                                        const status = getStockStatus(m);
                                        return (
                                            <tr key={m.id}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                                                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.code}</div>
                                                </td>
                                                <td>{m.category || '—'}</td>
                                                <td>
                                                    <span className="badge badge-info" style={{ fontSize: 11 }}>
                                                        {m.material_type?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontWeight: 700, color: status.color }}>
                                                        {parseFloat(m.current_stock).toFixed(2)} {m.unit}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#64748b' }}>{m.minimum_stock} {m.unit}</td>
                                                <td style={{ fontWeight: 600 }}>₹{parseFloat(m.unit_cost || 0).toFixed(2)}</td>
                                                <td>
                                                    <span style={{ padding: '3px 10px', background: status.bg, color: status.color, borderRadius: 12, fontSize: 11.5, fontWeight: 700, border: `1px solid ${status.color}40` }}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => openModal(m)}>Edit</button>
                                                        <button className="btn btn-primary btn-sm" onClick={() => { setAdjustModal(m); setAdjustForm({ adjustment: 0, reason: '' }); }}>
                                                            <ArrowUpDown size={13} /> Adjust
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {!materials.length && (
                                        <tr><td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Package size={24} /></div>
                                                <h3>No materials found</h3>
                                                <p>{lowStockFilter ? 'All stocks are healthy!' : 'Add materials to your inventory'}</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
                </div>

                {/* Add/Edit Modal */}
                <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
                    title={editing ? 'Edit Material' : 'Add Material'} size="lg"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />}
                                {editing ? 'Update' : 'Create'}
                            </button>
                        </>
                    }
                >
                    <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label required">Material Code</label>
                            <input className="form-control" value={form.code} onChange={f('code')} required placeholder="MAT-001" />
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Material Name</label>
                            <input className="form-control" value={form.name} onChange={f('name')} required placeholder="e.g. EN8 Round Bar 50mm" />
                        </div>
                    </div>
                    <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <input className="form-control" value={form.category} onChange={f('category')} placeholder="e.g. Steel, Aluminum" />
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Unit</label>
                            <select className="form-control" value={form.unit} onChange={f('unit')}>
                                <option>kg</option><option>mtr</option><option>pcs</option><option>ltr</option><option>ton</option><option>mtr²</option><option>mtr³</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Material Type</label>
                            <select className="form-control" value={form.material_type} onChange={f('material_type')}>
                                <option value="raw_material">Raw Material</option>
                                <option value="semi_finished">Semi-Finished</option>
                                <option value="consumable">Consumable</option>
                                <option value="packaging">Packaging</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Min Stock</label>
                            <input className="form-control" type="number" value={form.minimum_stock} onChange={f('minimum_stock')} min={0} step="0.001" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Reorder Point</label>
                            <input className="form-control" type="number" value={form.reorder_point} onChange={f('reorder_point')} min={0} step="0.001" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Unit Cost (₹)</label>
                            <input className="form-control" type="number" value={form.unit_cost} onChange={f('unit_cost')} min={0} step="0.01" />
                        </div>
                    </div>
                    <div className="form-row form-row-2">
                        <div className="form-group">
                            <label className="form-label">HSN Code</label>
                            <input className="form-control" value={form.hsn_code || ''} onChange={f('hsn_code')} placeholder="HSN Code" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Specifications</label>
                            <input className="form-control" value={form.specifications || ''} onChange={f('specifications')} placeholder="Technical specs..." />
                        </div>
                    </div>
                </Modal>

                {/* Adjust Stock Modal */}
                <Modal isOpen={!!adjustModal} onClose={() => setAdjustModal(null)}
                    title={`Adjust Stock: ${adjustModal?.name}`} size="sm"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setAdjustModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAdjust} disabled={saving}>Adjust Stock</button>
                        </>
                    }
                >
                    {adjustModal && (
                        <div>
                            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Current Stock</div>
                                <div style={{ fontSize: 24, fontWeight: 800 }}>{adjustModal.current_stock} {adjustModal.unit}</div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Adjustment (+/-)</label>
                                <input className="form-control" type="number" step="0.001"
                                    value={adjustForm.adjustment}
                                    onChange={e => setAdjustForm({ ...adjustForm, adjustment: parseFloat(e.target.value) })}
                                    placeholder="Positive to add, negative to reduce" />
                                <div className="form-hint">New stock will be: {(parseFloat(adjustModal.current_stock) + (adjustForm.adjustment || 0)).toFixed(2)} {adjustModal.unit}</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Reason</label>
                                <textarea className="form-control" rows={2} value={adjustForm.reason}
                                    onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    placeholder="Reason for adjustment..." required />
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </>
    );
}
