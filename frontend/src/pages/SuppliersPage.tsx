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
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // SUP_001: Only letters, digits, spaces, & - . , ( ) allowed in Supplier Name
    const SUPPLIER_NAME_REGEX = /^[A-Za-z0-9\s\-&.,()]+$/;
    // SUP_002: RFC-5322 compliant email format
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // SUP_003: 7–15 digits (optional leading + / spaces / hyphens); rejects all-same-digit sequences
    const PHONE_REGEX = /^\+?[\d\s\-]{7,15}$/;
    const isAllSameDigit = (val: string) => /^(\d)\1+$/.test(val.replace(/[\s\-+]/g, ''));
    // SUP_004: Indian GSTIN — 15 chars: 2-digit state + 5 alpha PAN prefix + 4 digits + 1 alpha + 1 alphanumeric + Z + 1 alphanumeric
    const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    // SUP_008: Contact Person — letters, spaces, hyphens, apostrophes, dots only (covers Dr. O'Brien, Mary-Jane)
    const CONTACT_PERSON_REGEX = /^[A-Za-z\s\-''.]+$/;
    // SUP_010: Maximum realistic supplier lead time in days (1 year)
    const MAX_LEAD_DAYS = 365;
    // SUP_005: City must contain only letters, spaces, hyphens and dots (no digits)
    const CITY_REGEX = /^[A-Za-z\s\-.]+$/;
    // SUP_006: Valid Indian states and Union Territories
    const INDIAN_STATES = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        // Union Territories
        'Andaman and Nicobar Islands', 'Chandigarh',
        'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
        'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

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
        setFormErrors({});
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

        // SUP_001: Client-side validation — Supplier Name character check
        const newErrors: Record<string, string> = {};
        if (!form.name.trim()) {
            newErrors.name = 'Supplier Name is required';
        } else if (!SUPPLIER_NAME_REGEX.test(form.name)) {
            newErrors.name = 'Supplier Name contains invalid characters. Allowed: letters, digits, spaces, & - . , ( )';
        }
        // SUP_013: Email is mandatory
        if (!form.email.trim()) {
            newErrors.email = 'Email address is required';
        // SUP_002: Client-side validation — Email format check (only when non-empty)
        } else if (!EMAIL_REGEX.test(form.email)) {
            newErrors.email = 'Please enter a valid email address (e.g. contact@example.com)';
        }
        // SUP_003: Client-side validation — Phone number check
        if (!editing && !form.phone.trim()) {
            // SUP_014: Phone is mandatory on create
            newErrors.phone = 'Phone number is required';
        } else if (form.phone) {
            const digitsOnly = form.phone.replace(/[\s\-+]/g, '');
            if (!PHONE_REGEX.test(form.phone)) {
                newErrors.phone = 'Phone must be 7–15 digits (e.g. +91 98765 43210)';
            } else if (isAllSameDigit(form.phone)) {
                newErrors.phone = 'Phone number cannot be all the same digit (e.g. 0000000000)';
            } else if (/^0+$/.test(digitsOnly)) {
                newErrors.phone = 'Phone number cannot be all zeros';
            }
        }
        // SUP_004: Client-side validation — GST number format check
        if (!editing && !form.gst_number.trim()) {
            // SUP_014: GST Number is mandatory on create
            newErrors.gst_number = 'GST Number is required';
        } else if (form.gst_number && !GST_REGEX.test(form.gst_number.toUpperCase())) {
            newErrors.gst_number = 'Invalid GST number. Expected format: 27AABCS1234A1Z5 (15 characters)';
        }
        // SUP_005: Client-side validation — City must be alphabetic only
        if (!editing && !form.city.trim()) {
            // SUP_014: City is mandatory on create
            newErrors.city = 'City is required';
        } else if (form.city && !CITY_REGEX.test(form.city)) {
            newErrors.city = 'City name must contain only letters, spaces, hyphens or dots (no numbers)';
        }
        // SUP_006: Client-side validation — State must be a valid Indian state/UT
        if (!editing && !form.state) {
            // SUP_014: State is mandatory on create
            newErrors.state = 'State is required — please select from the list';
        } else if (form.state && !INDIAN_STATES.includes(form.state)) {
            newErrors.state = 'Please select a valid Indian state or Union Territory from the list';
        }
        // SUP_007 / SUP_009 / SUP_010: Lead Time must be a positive integer between 1 and 365
        const leadDays = Number(form.lead_time_days);
        if (form.lead_time_days !== '' && (isNaN(leadDays) || leadDays < 1)) {
            newErrors.lead_time_days = leadDays < 0
                ? 'Lead Time cannot be negative. Enter a value of 1 or more'
                : 'Lead Time must be at least 1 day (0 is not allowed)';
        } else if (form.lead_time_days !== '' && leadDays > MAX_LEAD_DAYS) {
            newErrors.lead_time_days = `Lead Time cannot exceed ${MAX_LEAD_DAYS} days (1 year). Enter a realistic value`;
        }
        // SUP_008: Contact Person must contain only name characters
        if (form.contact_person && !CONTACT_PERSON_REGEX.test(form.contact_person)) {
            newErrors.contact_person = "Contact Person name can only contain letters, spaces, hyphens, apostrophes or dots";
        }
        // SUP_014: Payment Terms is mandatory on create
        if (!editing && !form.payment_terms) {
            newErrors.payment_terms = 'Payment Terms is required';
        }
        if (Object.keys(newErrors).length > 0) {
            setFormErrors(newErrors);
            return;
        }
        setFormErrors({});

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
            const status  = err.response?.status;
            const message = err.response?.data?.message || 'Failed to save';
            // SUP_011: surface duplicate-email as an inline field error
            if (status === 409 && message.toLowerCase().includes('email')) {
                setFormErrors(fe => ({ ...fe, email: message }));
            // SUP_012: surface duplicate-code as an inline field error
            } else if (status === 409 && message.toLowerCase().includes('code')) {
                setFormErrors(fe => ({ ...fe, code: message }));
            } else {
                toast.error(message);
            }
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
                                <input
                                    className={`form-control${formErrors.name ? ' is-invalid' : ''}`}
                                    value={form.name}
                                    onChange={e => { f('name')(e); setFormErrors(fe => ({ ...fe, name: '' })); }}
                                    required
                                    placeholder="e.g. Steel India Ltd"
                                />
                                {formErrors.name && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.name}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label required">Supplier Code</label>
                                <input className="form-control" value={form.code} onChange={f('code')} required placeholder="e.g. SUP-001" />
                            </div>
                        </div>
                        <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Contact Person</label>
                                {/* SUP_008: validate name characters */}
                                <input
                                    className={`form-control${formErrors.contact_person ? ' is-invalid' : ''}`}
                                    value={form.contact_person}
                                    onChange={e => {
                                        // strip digits and symbols that aren't valid in names
                                        const val = e.target.value.replace(/[^A-Za-z\s\-''.]/g, '');
                                        setForm(prev => ({ ...prev, contact_person: val }));
                                        setFormErrors(fe => ({ ...fe, contact_person: '' }));
                                    }}
                                    placeholder="e.g. Rajesh Kumar"
                                />
                                {formErrors.contact_person && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.contact_person}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                {/* SUP_013: Email is mandatory — marked with required class for red asterisk */}
                                <label className="form-label required">Email</label>
                                <input
                                    className={`form-control${formErrors.email ? ' is-invalid' : ''}`}
                                    type="email"
                                    value={form.email}
                                    onChange={e => { f('email')(e); setFormErrors(fe => ({ ...fe, email: '' })); }}
                                    placeholder="email@example.com"
                                    required
                                />
                                {formErrors.email && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.email}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                {/* SUP_014: Phone is mandatory on create */}
                                <label className="form-label required">Phone</label>
                                <input
                                    className={`form-control${formErrors.phone ? ' is-invalid' : ''}`}
                                    value={form.phone}
                                    onChange={e => { f('phone')(e); setFormErrors(fe => ({ ...fe, phone: '' })); }}
                                    placeholder="e.g. +91 98765 43210"
                                    maxLength={20}
                                />
                                {formErrors.phone && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.phone}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                {/* SUP_014: GST Number is mandatory on create */}
                                <label className="form-label required">GST Number</label>
                                <input
                                    className={`form-control${formErrors.gst_number ? ' is-invalid' : ''}`}
                                    value={form.gst_number}
                                    onChange={e => {
                                        // auto-uppercase as user types
                                        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                        setForm(prev => ({ ...prev, gst_number: val }));
                                        setFormErrors(fe => ({ ...fe, gst_number: '' }));
                                    }}
                                    placeholder="27AABCS1234A1Z5"
                                    maxLength={15}
                                />
                                {formErrors.gst_number && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.gst_number}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Lead Time (Days)</label>
                                {/* SUP_007/SUP_009/SUP_010: min=1, max=365, minus key blocked */}
                                <input
                                    className={`form-control${formErrors.lead_time_days ? ' is-invalid' : ''}`}
                                    type="number"
                                    value={form.lead_time_days}
                                    onKeyDown={e => {
                                        // SUP_009: block minus sign at keyboard level
                                        if (e.key === '-' || e.key === 'Subtract') e.preventDefault();
                                    }}
                                    onChange={e => {
                                        // SUP_009: strip any negative sign if somehow entered
                                        const raw = e.target.value.replace(/-/g, '');
                                        setForm(prev => ({ ...prev, lead_time_days: raw }));
                                        setFormErrors(fe => ({ ...fe, lead_time_days: '' }));
                                    }}
                                    min={1}
                                    max={MAX_LEAD_DAYS}
                                    placeholder="e.g. 7"
                                />
                                {formErrors.lead_time_days && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.lead_time_days}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                            <div className="form-group">
                                {/* SUP_014: City is mandatory on create */}
                                <label className="form-label required">City</label>
                                <input
                                    className={`form-control${formErrors.city ? ' is-invalid' : ''}`}
                                    value={form.city}
                                    onChange={e => {
                                        // SUP_005: strip digits as user types
                                        const val = e.target.value.replace(/[0-9]/g, '');
                                        setForm(prev => ({ ...prev, city: val }));
                                        setFormErrors(fe => ({ ...fe, city: '' }));
                                    }}
                                    placeholder="e.g. Mumbai"
                                />
                                {formErrors.city && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.city}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                {/* SUP_014: State is mandatory on create */}
                                <label className="form-label required">State</label>
                                {/* SUP_006: replaced free-text input with validated dropdown */}
                                <select
                                    className={`form-control${formErrors.state ? ' is-invalid' : ''}`}
                                    value={form.state}
                                    onChange={e => { f('state')(e); setFormErrors(fe => ({ ...fe, state: '' })); }}
                                >
                                    <option value="">Select State / UT...</option>
                                    <optgroup label="States">
                                        <option>Andhra Pradesh</option>
                                        <option>Arunachal Pradesh</option>
                                        <option>Assam</option>
                                        <option>Bihar</option>
                                        <option>Chhattisgarh</option>
                                        <option>Goa</option>
                                        <option>Gujarat</option>
                                        <option>Haryana</option>
                                        <option>Himachal Pradesh</option>
                                        <option>Jharkhand</option>
                                        <option>Karnataka</option>
                                        <option>Kerala</option>
                                        <option>Madhya Pradesh</option>
                                        <option>Maharashtra</option>
                                        <option>Manipur</option>
                                        <option>Meghalaya</option>
                                        <option>Mizoram</option>
                                        <option>Nagaland</option>
                                        <option>Odisha</option>
                                        <option>Punjab</option>
                                        <option>Rajasthan</option>
                                        <option>Sikkim</option>
                                        <option>Tamil Nadu</option>
                                        <option>Telangana</option>
                                        <option>Tripura</option>
                                        <option>Uttar Pradesh</option>
                                        <option>Uttarakhand</option>
                                        <option>West Bengal</option>
                                    </optgroup>
                                    <optgroup label="Union Territories">
                                        <option>Andaman and Nicobar Islands</option>
                                        <option>Chandigarh</option>
                                        <option>Dadra and Nagar Haveli and Daman and Diu</option>
                                        <option>Delhi</option>
                                        <option>Jammu and Kashmir</option>
                                        <option>Ladakh</option>
                                        <option>Lakshadweep</option>
                                        <option>Puducherry</option>
                                    </optgroup>
                                </select>
                                {formErrors.state && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.state}
                                    </span>
                                )}
                            </div>
                            <div className="form-group">
                                {/* SUP_014: Payment Terms is mandatory on create */}
                                <label className="form-label required">Payment Terms</label>
                                <select
                                    className={`form-control${formErrors.payment_terms ? ' is-invalid' : ''}`}
                                    value={form.payment_terms}
                                    onChange={e => { f('payment_terms')(e); setFormErrors(fe => ({ ...fe, payment_terms: '' })); }}
                                >
                                    <option value="">Select...</option>
                                    <option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option>
                                    <option>Advance</option><option>50% Advance</option>
                                </select>
                                {formErrors.payment_terms && (
                                    <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                                        {formErrors.payment_terms}
                                    </span>
                                )}
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
