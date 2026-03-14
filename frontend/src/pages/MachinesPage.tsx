import { useEffect, useState } from 'react';
import { Plus, Cog } from 'lucide-react';
import { machinesAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const INITIAL_FORM = {
    name: '', machine_code: '', type: '', location: '', manufacturer: '',
    model_number: '', year_of_manufacture: '', capacity: '', capacity_unit: 'unit/hr',
    maintenance_interval_days: 90, notes: ''
};

export default function MachinesPage() {
    const [machines, setMachines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await machinesAPI.getAll({ page, limit: 15 });
            setMachines(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page]);

    const openModal = (m?: any) => {
        if (m) { setEditing(m); setForm({ ...INITIAL_FORM, ...m }); }
        else { setEditing(null); setForm(INITIAL_FORM); }
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) { await machinesAPI.update(editing.id, form); toast.success('Machine updated!'); }
            else { await machinesAPI.create(form); toast.success('Machine added!'); }
            setModalOpen(false);
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally { setSaving(false); }
    };

    const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

    const getStatusColor = (status: string) => {
        const map: Record<string, string> = { available: '#16a34a', in_use: '#2563eb', maintenance: '#d97706', breakdown: '#dc2626', idle: '#64748b' };
        return map[status] || '#64748b';
    };

    return (
        <>
            <Header title="Machine Operations" subtitle="Monitor machine status and utilization" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Machine Operations</h2>
                        <p>{total} machines registered</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}><Plus size={16} /> Add Machine</button>
                </div>

                {/* Status Summary */}
                <div className="grid-4 mb-6" style={{ marginBottom: 20 }}>
                    {[
                        { label: 'Available', status: 'available', color: '#16a34a', bg: '#f0fdf4' },
                        { label: 'In Use', status: 'in_use', color: '#2563eb', bg: '#eff6ff' },
                        { label: 'Maintenance', status: 'maintenance', color: '#d97706', bg: '#fffbeb' },
                        { label: 'Breakdown', status: 'breakdown', color: '#dc2626', bg: '#fef2f2' },
                    ].map(s => (
                        <div key={s.status} style={{ padding: '16px 20px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 12 }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>
                                {machines.filter(m => m.status === s.status).length}
                            </div>
                            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>Machine</th><th>Type</th><th>Location</th><th>Manufacturer</th>
                                    <th>Current Operation</th><th>Next Maintenance</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {machines.map(m => (
                                        <tr key={m.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${getStatusColor(m.status)}15`, border: `2px solid ${getStatusColor(m.status)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getStatusColor(m.status) }}>
                                                        <Cog size={18} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{m.name}</div>
                                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{m.machine_code}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{m.type}</td>
                                            <td>{m.location}</td>
                                            <td style={{ color: '#64748b' }}>{m.manufacturer || '—'}</td>
                                            <td>
                                                {m.current_wo_number ? (
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>
                                                        WO: {m.current_wo_number}
                                                    </span>
                                                ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                                            </td>
                                            <td>
                                                {m.next_maintenance_date ? (
                                                    <span style={{ fontSize: 12, color: new Date(m.next_maintenance_date) < new Date() ? '#dc2626' : '#475569', fontWeight: new Date(m.next_maintenance_date) < new Date() ? 700 : 400 }}>
                                                        {format(new Date(m.next_maintenance_date), 'dd MMM yyyy')}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td><StatusBadge status={m.status} /></td>
                                            <td>
                                                <button className="btn btn-secondary btn-sm" onClick={() => openModal(m)}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!machines.length && (
                                        <tr><td colSpan={8}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Cog size={24} /></div>
                                                <h3>No machines registered</h3>
                                                <p>Add your machines to track operations and maintenance</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={15} onPageChange={setPage} />
                </div>

                <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Machine' : 'Add Machine'} size="lg"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />}
                                {editing ? 'Update' : 'Add'} Machine
                            </button>
                        </>
                    }
                >
                    <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label required">Machine Name</label>
                            <input className="form-control" value={form.name} onChange={f('name')} required placeholder="e.g. CNC Lathe 1" />
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Machine Code</label>
                            <input className="form-control" value={form.machine_code} onChange={f('machine_code')} required placeholder="MCH-001" />
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Type</label>
                            <select className="form-control" value={form.type} onChange={f('type')} required>
                                <option value="">Select type...</option>
                                <option>CNC Lathe</option><option>CNC Milling</option><option>VMC</option>
                                <option>HMC</option><option>Drilling</option><option>Grinding</option>
                                <option>Welding</option><option>Press</option><option>Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <input className="form-control" value={form.location} onChange={f('location')} placeholder="e.g. Bay 1, Shop Floor A" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Manufacturer</label>
                            <input className="form-control" value={form.manufacturer} onChange={f('manufacturer')} placeholder="e.g. HAAS, DMG Mori" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Model Number</label>
                            <input className="form-control" value={form.model_number} onChange={f('model_number')} placeholder="Model No." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Year of Manufacture</label>
                            <input className="form-control" type="number" value={form.year_of_manufacture} onChange={f('year_of_manufacture')} placeholder="2022" min={1980} max={2030} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Maintenance Interval (days)</label>
                            <input className="form-control" type="number" value={form.maintenance_interval_days} onChange={f('maintenance_interval_days')} min={1} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-control" value={form.notes} onChange={f('notes')} rows={2} />
                    </div>
                </Modal>
            </div>
        </>
    );
}
