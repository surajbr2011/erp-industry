import { useEffect, useState } from 'react';
import { Plus, Search, CheckCircle } from 'lucide-react';
import { inspectionsAPI, partsAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function InspectionsPage() {
    const [inspections, setInspections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [result, setResult] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        part_serial_number: '', plan_id: '', result: 'passed',
        notes: '', measurements: [] as any[]
    });
    const [partSearch, setPartSearch] = useState('');
    const [foundPart, setFoundPart] = useState<any>(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await inspectionsAPI.getAll({ page, limit: 15, result: result || undefined });
            setInspections(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, result]);
    useEffect(() => { inspectionsAPI.getPlans().then(r => setPlans(r.data.data)); }, []);

    const searchPart = async () => {
        if (!partSearch.trim()) return;
        try {
            const r = await partsAPI.trace(partSearch.trim());
            setFoundPart(r.data.data.part);
            setForm({ ...form, part_serial_number: partSearch.trim() });
        } catch {
            toast.error('Part not found');
            setFoundPart(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!foundPart) { toast.error('Please find a valid part first'); return; }
        setSaving(true);
        try {
            await inspectionsAPI.create({ ...form, part_id: foundPart.id });
            toast.success('Inspection recorded!');
            setModalOpen(false);
            setFoundPart(null);
            setPartSearch('');
            setForm({ part_serial_number: '', plan_id: '', result: 'passed', notes: '', measurements: [] });
            load();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to create inspection');
        } finally { setSaving(false); }
    };

    return (
        <>
            <Header title="Quality Inspection" subtitle="Manage quality control and inspection records" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>Quality Inspections</h2>
                        <p>{total} inspections recorded</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={16} /> New Inspection</button>
                </div>

                {/* QC Stats */}
                <div className="grid-4 mb-6" style={{ marginBottom: 20 }}>
                    {[
                        { label: 'Total', value: total, color: '#2563eb', bg: '#eff6ff' },
                        { label: 'Passed', value: inspections.filter(i => i.result === 'passed').length, color: '#16a34a', bg: '#f0fdf4' },
                        { label: 'Failed', value: inspections.filter(i => i.result === 'failed').length, color: '#dc2626', bg: '#fef2f2' },
                        { label: 'Rework', value: inspections.filter(i => i.result === 'rework_required').length, color: '#d97706', bg: '#fffbeb' },
                    ].map(s => (
                        <div key={s.label} style={{ padding: '16px 20px', background: s.bg, borderRadius: 12 }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="filter-bar">
                            {['', 'passed', 'failed', 'rework_required', 'partial_pass'].map(s => (
                                <button key={s} className={`btn btn-sm ${result === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setResult(s); setPage(1); }}>
                                    {s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
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
                                    <th>Inspection No.</th><th>Part Serial</th><th>Product</th>
                                    <th>Inspector</th><th>Date</th><th>Result</th><th>Notes</th>
                                </tr></thead>
                                <tbody>
                                    {inspections.map(ins => (
                                        <tr key={ins.id}>
                                            <td><span style={{ fontWeight: 700, color: '#2563eb' }}>{ins.inspection_number}</span></td>
                                            <td><span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{ins.serial_number}</span></td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{ins.product_name}</div>
                                            </td>
                                            <td style={{ color: '#475569' }}>{ins.inspector_name}</td>
                                            <td style={{ color: '#94a3b8', fontSize: 12 }}>{format(new Date(ins.created_at), 'dd MMM yyyy')}</td>
                                            <td><StatusBadge status={ins.result} /></td>
                                            <td style={{ maxWidth: 200 }}>
                                                <span style={{ fontSize: 12, color: '#64748b' }} className="truncate">{ins.notes || '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {!inspections.length && (
                                        <tr><td colSpan={7}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><CheckCircle size={24} /></div>
                                                <h3>No inspections recorded</h3>
                                                <p>Record your first quality inspection</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={15} onPageChange={setPage} />
                </div>

                {/* New Inspection Modal */}
                <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Record Quality Inspection" size="md"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !foundPart}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />} Record Inspection
                            </button>
                        </>
                    }
                >
                    <div>
                        {/* Part Search */}
                        <div style={{ marginBottom: 20, padding: '16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                            <label className="form-label">Search Part by Serial Number</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-control" value={partSearch} onChange={e => setPartSearch(e.target.value)}
                                    placeholder="Enter serial number..." onKeyDown={e => e.key === 'Enter' && searchPart()} />
                                <button type="button" className="btn btn-primary" onClick={searchPart}><Search size={14} /></button>
                            </div>
                            {foundPart && (
                                <div style={{ marginTop: 10, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CheckCircle size={16} color="#16a34a" />
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 13 }}>{foundPart.serial_number}</div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>{foundPart.product_name} • <StatusBadge status={foundPart.status} /></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label required">Inspection Result</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                {[
                                    { value: 'passed', label: '✅ Passed', color: '#16a34a', bg: '#f0fdf4' },
                                    { value: 'failed', label: '❌ Failed', color: '#dc2626', bg: '#fef2f2' },
                                    { value: 'rework_required', label: '🔄 Rework Required', color: '#d97706', bg: '#fffbeb' },
                                    { value: 'partial_pass', label: '⚡ Partial Pass', color: '#2563eb', bg: '#eff6ff' },
                                ].map(r => (
                                    <label key={r.value} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                                        background: form.result === r.value ? r.bg : '#f8fafc',
                                        border: `1.5px solid ${form.result === r.value ? r.color : '#e2e8f0'}`,
                                        fontWeight: form.result === r.value ? 700 : 500, fontSize: 13,
                                        color: form.result === r.value ? r.color : '#475569'
                                    }}>
                                        <input type="radio" name="result" value={r.value} checked={form.result === r.value}
                                            onChange={() => setForm({ ...form, result: r.value })} style={{ display: 'none' }} />
                                        {r.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Inspection Plan (Optional)</label>
                            <select className="form-control" value={form.plan_id} onChange={e => setForm({ ...form, plan_id: e.target.value })}>
                                <option value="">No plan / General inspection</option>
                                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notes / Findings</label>
                            <textarea className="form-control" rows={3} value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                placeholder="Document observations, measurements, defects found..." />
                        </div>
                    </div>
                </Modal>
            </div>
        </>
    );
}
