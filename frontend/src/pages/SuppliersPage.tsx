import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Building2, Star, Upload, Download } from 'lucide-react';
import { suppliersAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const INITIAL_FORM = {
    name: '', code: '', contact_person: '', email: '', phone: '', address: '',
    city: '', state: '', country: 'India', pincode: '', gst_number: '', payment_terms: '', lead_time_days: 0, notes: ''
};

export default function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await suppliersAPI.getAll({ page, limit: 15, search });
            setSuppliers(r.data.data);
            setTotal(r.data.pagination.total);
        } catch { toast.error('Failed to load suppliers'); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, search]);

    const openModal = (supplier?: any) => {
        if (supplier) {
            setEditing(supplier);
            setForm({ ...INITIAL_FORM, ...supplier });
        } else {
            setEditing(null);
            setForm(INITIAL_FORM);
        }
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                await suppliersAPI.update(editing.id, form);
                toast.success('Supplier updated!');
            } else {
                await suppliersAPI.create(form);
                toast.success('Supplier created!');
            }
            setModalOpen(false);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally { setSaving(false); }
    };

    const handleDeactivate = async (id: number) => {
        if (!confirm('Deactivate this supplier?')) return;
        try {
            await suppliersAPI.delete(id);
            toast.success('Supplier deactivated');
            load();
        } catch { toast.error('Failed to deactivate'); }
    };

    const handleExport = async () => {
        try {
            const response = await suppliersAPI.export();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'suppliers_database.xlsx');
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
            const r = await suppliersAPI.bulkUpload(file);
            toast.success(r.data.message);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Import failed');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const f = (key: string) => (e: any) => setForm({ ...form, [key]: e.target.value });

    return (
        <>
            <Header title="Supplier Management" subtitle="Manage your supplier database and performance" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Suppliers</h2>
                        <p>{total} suppliers registered</p>
                    </div>
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
                            suppliersAPI.downloadTemplate().then(res => {
                                const url = window.URL.createObjectURL(new Blob([res.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', 'suppliers_template.xlsx');
                                link.click();
                            });
                        }} style={{ fontSize: 10, color: '#2563eb', textAlign: 'center', fontWeight: 600 }}>Template</a>
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}>
                        <Plus size={16} /> Add Supplier
                    </button>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="search-wrapper" style={{ flex: 1, maxWidth: 320 }}>
                            <Search size={15} className="search-icon" />
                            <input
                                className="form-control search-input"
                                placeholder="Search suppliers..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                            />
                        </div>
                    </div>

                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Supplier</th>
                                        <th>Contact</th>
                                        <th>Location</th>
                                        <th>Payment Terms</th>
                                        <th>Lead Time</th>
                                        <th>Rating</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map(s => (
                                        <tr key={s.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 36, height: 36, borderRadius: 8,
                                                        background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#2563eb', fontWeight: 700, fontSize: 14, flexShrink: 0
                                                    }}>
                                                        {s.name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13 }}>{s.contact_person}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.email}</div>
                                            </td>
                                            <td style={{ color: '#475569' }}>{s.city}, {s.state}</td>
                                            <td style={{ color: '#475569' }}>{s.payment_terms || '—'}</td>
                                            <td style={{ color: '#475569' }}>{s.lead_time_days} days</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Star size={13} fill="#f59e0b" color="#f59e0b" />
                                                    <span style={{ fontWeight: 600 }}>{parseFloat(s.rating || 0).toFixed(1)}</span>
                                                </div>
                                            </td>
                                            <td><StatusBadge status={s.status} /></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(s)}>
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(s.id)}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!suppliers.length && (
                                        <tr><td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Building2 size={24} /></div>
                                                <h3>No suppliers found</h3>
                                                <p>Add your first supplier to get started</p>
                                                <button className="btn btn-primary" onClick={() => openModal()}>Add Supplier</button>
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
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    title={editing ? 'Edit Supplier' : 'Add New Supplier'}
                    size="lg"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : null}
                                {editing ? 'Update' : 'Create'} Supplier
                            </button>
                        </>
                    }
                >
                    <form onSubmit={handleSubmit}>
                        <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label required">Supplier Name</label>
                                <input className="form-control" value={form.name} onChange={f('name')} required placeholder="e.g. Steel India Ltd" />
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Supplier Code</label>
                                <input className="form-control" value={form.code} onChange={f('code')} required placeholder="e.g. SUP-001" />
                            </div>
                        </div>
                        <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Contact Person</label>
                                <input className="form-control" value={form.contact_person} onChange={f('contact_person')} placeholder="Full name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-control" type="email" value={form.email} onChange={f('email')} placeholder="email@example.com" />
                            </div>
                        </div>
                        <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-control" value={form.phone} onChange={f('phone')} placeholder="Contact number" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">GST Number</label>
                                <input className="form-control" value={form.gst_number} onChange={f('gst_number')} placeholder="27AABCS1234A1Z5" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Lead Time (Days)</label>
                                <input className="form-control" type="number" value={form.lead_time_days} onChange={f('lead_time_days')} min={0} />
                            </div>
                        </div>
                        <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label">City</label>
                                <input className="form-control" value={form.city} onChange={f('city')} placeholder="City" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">State</label>
                                <input className="form-control" value={form.state} onChange={f('state')} placeholder="State" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payment Terms</label>
                                <select className="form-control" value={form.payment_terms} onChange={f('payment_terms')}>
                                    <option value="">Select...</option>
                                    <option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option>
                                    <option>Advance</option><option>50% Advance</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea className="form-control" value={form.notes} onChange={f('notes')} rows={2} placeholder="Additional notes..." />
                        </div>
                    </form>
                </Modal>
            </div>
        </>
    );
}
