import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Shield, Users } from 'lucide-react';
import { usersAPI } from '../services/api';
import Header from '../components/Header';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { ROLE_LABELS } from '../store/authStore';
import toast from 'react-hot-toast';

const ROLES = ['admin', 'purchase_manager', 'production_manager', 'machine_operator', 'quality_inspector'];
const INITIAL_FORM = { name: '', email: '', password: '', role: 'machine_operator', department: '', phone: '' };

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState<any>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const r = await usersAPI.getAll();
            setUsers(r.data.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const openModal = (u?: any) => {
        if (u) { setEditing(u); setForm({ ...INITIAL_FORM, ...u, password: '' }); }
        else { setEditing(null); setForm(INITIAL_FORM); }
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editing) {
                const { password, ...rest } = form;
                await usersAPI.update(editing.id, password ? form : rest);
                toast.success('User updated!');
            } else {
                await usersAPI.create(form);
                toast.success('User created!');
            }
            setModalOpen(false);
            load();
        } catch (err: any) { // @ts-ignore
            toast.error(err.response?.data?.message || 'Failed to save');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Deactivate this user?')) return;
        try {
            await usersAPI.delete(id);
            toast.success('User deactivated');
            load();
        } catch { toast.error('Failed to deactivate'); }
    };

    const f = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

    const getRoleColor = (role: string) => {
        const map: Record<string, string> = {
            admin: 'badge-danger', purchase_manager: 'badge-info',
            production_manager: 'badge-warning', machine_operator: 'badge-secondary',
            quality_inspector: 'badge-success'
        };
        return map[role] || 'badge-secondary';
    };

    return (
        <>
            <Header title="User Management" subtitle="Manage system users and their access roles" />
            <div className="page-content">
                <div className="page-header">
                    <div className="page-header-left">
                        <h2>User Management</h2>
                        <p>{users.length} system users</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}><Plus size={16} /> Add User</button>
                </div>

                {/* Role Summary */}
                <div className="grid-3 mb-6" style={{ marginBottom: 20 }}>
                    {ROLES.slice(0, 3).map(role => (
                        <div key={role} style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Users size={20} color="#2563eb" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: 20, color: '#1e293b' }}>{users.filter(u => u.role === role).length}</div>
                                <div style={{ fontSize: 12, color: '#64748b' }}>{ROLE_LABELS[role]}</div>
                            </div>
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
                                    <th>User</th><th>Role</th><th>Department</th><th>Phone</th><th>Status</th><th>Actions</th>
                                </tr></thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                                                        {u.name?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{u.name}</div>
                                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${getRoleColor(u.role)}`}><Shield size={11} />{ROLE_LABELS[u.role] || u.role}</span>
                                            </td>
                                            <td style={{ color: '#475569' }}>{u.department || '—'}</td>
                                            <td style={{ color: '#475569' }}>{u.phone || '—'}</td>
                                            <td><StatusBadge status={u.is_active ? 'active' : 'inactive'} /></td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(u)}><Edit2 size={13} /></button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!users.length && (
                                        <tr><td colSpan={6}>
                                            <div className="empty-state">
                                                <div className="empty-state-icon"><Users size={24} /></div>
                                                <h3>No users found</h3>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Add New User'} size="md"
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                                {saving && <span className="loading-spinner" style={{ width: 14, height: 14 }} />}
                                {editing ? 'Update' : 'Create'} User
                            </button>
                        </>
                    }
                >
                    <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label required">Full Name</label>
                            <input className="form-control" value={form.name} onChange={f('name')} required placeholder="Full name" />
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Email</label>
                            <input className="form-control" type="email" value={form.email} onChange={f('email')} required placeholder="email@company.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label required">Role</label>
                            <select className="form-control" value={form.role} onChange={f('role')} required>
                                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <input className="form-control" value={form.department || ''} onChange={f('department')} placeholder="e.g. Manufacturing" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-control" value={form.phone || ''} onChange={f('phone')} placeholder="Phone number" />
                        </div>
                        <div className="form-group">
                            <label className={editing ? 'form-label' : 'form-label required'}>
                                {editing ? 'New Password (leave blank to keep)' : 'Password'}
                            </label>
                            <input className="form-control" type="password" value={form.password} onChange={f('password')} required={!editing} placeholder={editing ? 'Leave blank to keep current' : 'Min 8 characters'} minLength={editing ? 0 : 8} />
                        </div>
                    </div>
                </Modal>
            </div>
        </>
    );
}
