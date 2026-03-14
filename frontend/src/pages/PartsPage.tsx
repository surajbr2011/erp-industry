import { useEffect, useState } from 'react';
import { Search, QrCode, Eye, Package } from 'lucide-react';
import { partsAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function PartsPage() {
    const [parts, setParts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [serialSearch, setSerialSearch] = useState('');
    const [traceModal, setTraceModal] = useState<any>(null);
    const [traceLoading, setTraceLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await partsAPI.getAll({ page, limit: 20, search });
            setParts(r.data.data);
            setTotal(r.data.pagination.total);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [page, search]);

    const handleTrace = async (serial?: string) => {
        const sn = serial || serialSearch.trim();
        if (!sn) return;
        setTraceLoading(true);
        try {
            const r = await partsAPI.trace(sn);
            setTraceModal(r.data.data);
        } catch {
            toast.error('Part not found with that serial number');
        } finally { setTraceLoading(false); }
    };

    const iconForEvent = (type: string) => {
        const map: Record<string, string> = {
            created: '🔧', operation_started: '▶️', operation_completed: '✅',
            inspection_passed: '✅', inspection_failed: '❌', rework_required: '🔄',
            dispatched: '🚚', status_updated: '📝', material_issued: '📦'
        };
        return map[type] || '📌';
    };

    return (
        <>
            <Header title="Part Traceability" subtitle="Track individual parts through their complete lifecycle" />
            <div className="page-content">
                {/* Trace Search Box */}
                <div className="card mb-6" style={{ marginBottom: 20 }}>
                    <div className="card-body" style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <QrCode size={32} color="#2563eb" />
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Part Trace Search</h3>
                                <p style={{ color: '#64748b', fontSize: 13 }}>Enter a serial number to view complete part history and traceability</p>
                            </div>
                            <div style={{ display: 'flex', gap: 12, flex: 2 }}>
                                <div className="search-wrapper" style={{ flex: 1 }}>
                                    <Search size={15} className="search-icon" />
                                    <input className="form-control search-input" placeholder="Enter serial number (e.g. SN-20240101-001)"
                                        value={serialSearch} onChange={e => setSerialSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleTrace()} />
                                </div>
                                <button className="btn btn-primary" onClick={() => handleTrace()} disabled={traceLoading}>
                                    {traceLoading ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : <Search size={15} />}
                                    Trace Part
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="page-header">
                    <div className="page-header-left">
                        <h2>All Parts</h2>
                        <p>{total} parts generated</p>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <div className="search-wrapper" style={{ flex: 1, maxWidth: 320 }}>
                            <Search size={15} className="search-icon" />
                            <input className="form-control search-input" placeholder="Search by serial, product..." value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }} />
                        </div>
                    </div>

                    <div className="table-container">
                        {loading ? (
                            <div className="loading-overlay"><div className="loading-spinner loading-spinner-lg" /></div>
                        ) : (
                            <table>
                                <thead><tr>
                                    <th>Serial Number</th><th>Product</th><th>Work Order</th>
                                    <th>Created At</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {parts.map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: 13 }}>{p.serial_number}</div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{p.product_name}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.product_code}</div>
                                            </td>
                                            <td style={{ color: '#475569', fontSize: 13 }}>{p.wo_number || '—'}</td>
                                            <td style={{ color: '#94a3b8', fontSize: 12 }}>{format(new Date(p.created_at), 'dd MMM yyyy HH:mm')}</td>
                                            <td><StatusBadge status={p.status} /></td>
                                            <td>
                                                <button className="btn btn-primary btn-sm" onClick={() => handleTrace(p.serial_number)}>
                                                    <Eye size={13} /> Trace
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!parts.length && (
                                        <tr><td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Package size={24} /></div>
                                                <h3>No parts found</h3>
                                                <p>Parts are generated from completed Work Orders</p>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
                </div>

                {/* Trace Modal */}
                <Modal isOpen={!!traceModal} onClose={() => setTraceModal(null)} title="Part Traceability Report" size="xl">
                    {traceModal && (
                        <div>
                            {/* Header Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                                {[
                                    { label: 'Serial Number', value: <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 800 }}>{traceModal.part.serial_number}</span> },
                                    { label: 'Product', value: traceModal.part.product_name },
                                    { label: 'Status', value: <StatusBadge status={traceModal.part.status} /> },
                                    { label: 'Work Order', value: traceModal.part.wo_number || '—' },
                                    { label: 'Created', value: format(new Date(traceModal.part.created_at), 'dd MMM yyyy HH:mm') },
                                    { label: 'QR Code', value: <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{traceModal.part.qr_code?.substring(0, 16)}...</span> },
                                ].map((item, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8 }}>
                                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Inspections */}
                            {traceModal.inspections?.length > 0 && (
                                <div style={{ marginBottom: 24 }}>
                                    <h4 style={{ fontWeight: 700, marginBottom: 12 }}>🔍 Quality Inspections</h4>
                                    {traceModal.inspections.map((ins: any, i: number) => (
                                        <div key={i} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, marginBottom: 8, border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <span style={{ fontWeight: 600 }}>{ins.inspection_number}</span>
                                                <StatusBadge status={ins.result} />
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b' }}>Inspector: {ins.inspector_name} • {format(new Date(ins.created_at), 'dd MMM yyyy')}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Materials Used */}
                            {traceModal.materials_used?.length > 0 && (
                                <div style={{ marginBottom: 24 }}>
                                    <h4 style={{ fontWeight: 700, marginBottom: 12 }}>📦 Materials Used</h4>
                                    <table>
                                        <thead><tr><th>Material</th><th>Batch</th><th>Quantity</th><th>Unit</th></tr></thead>
                                        <tbody>
                                            {traceModal.materials_used.map((m: any, i: number) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600 }}>{m.material_name}</td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{m.batch_number || '—'}</td>
                                                    <td style={{ fontWeight: 700 }}>{m.quantity}</td>
                                                    <td>{m.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* History Timeline */}
                            <div>
                                <h4 style={{ fontWeight: 700, marginBottom: 12 }}>📋 Part History Timeline</h4>
                                <div style={{ position: 'relative', paddingLeft: 24 }}>
                                    <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: '#e2e8f0', borderRadius: 1 }} />
                                    {traceModal.history?.map((h: any, i: number) => (
                                        <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                                            <div style={{ position: 'absolute', left: -19, top: 4, width: 10, height: 10, borderRadius: '50%', background: '#2563eb', border: '2px solid white', boxShadow: '0 0 0 2px #dbeafe' }} />
                                            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{iconForEvent(h.event_type)} {h.event_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{format(new Date(h.event_timestamp), 'dd MMM yyyy HH:mm')}</span>
                                                </div>
                                                {h.notes && <div style={{ fontSize: 12, color: '#64748b' }}>{h.notes}</div>}
                                                {h.performed_by_name && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>By: {h.performed_by_name}</div>}
                                            </div>
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
