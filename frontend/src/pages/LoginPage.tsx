import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, Eye, EyeOff, AlertCircle, Lock, Mail } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, isLoading } = useAuthStore();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(formData.email, formData.password);
            toast.success('Welcome back!');
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        }
    };

    const quickLogin = (role: string) => {
        const credentials: Record<string, { email: string; password: string }> = {
            admin: { email: 'admin@trinixerp.com', password: 'Password@123' },
            purchase: { email: 'purchase@trinixerp.com', password: 'Password@123' },
            production: { email: 'production@trinixerp.com', password: 'Password@123' },
            operator: { email: 'operator@trinixerp.com', password: 'Password@123' },
            quality: { email: 'quality@trinixerp.com', password: 'Password@123' },
        };
        setFormData(credentials[role]);
    };

    return (
        <div className="login-page">
            <div className="login-bg-pattern" />

            {/* Decorative elements */}
            <div style={{
                position: 'absolute', top: 60, left: 60, width: 200, height: 200,
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '50%'
            }} />
            <div style={{
                position: 'absolute', bottom: 80, right: 80, width: 300, height: 300,
                border: '1px solid rgba(255,255,255,0.04)', borderRadius: '50%'
            }} />

            <div className="login-card">
                <div className="login-logo">
                    <div className="login-logo-icon">
                        <Factory size={26} color="white" strokeWidth={2.5} />
                    </div>
                    <div className="login-logo-text">
                        <h1>TRINIX ERP</h1>
                        <span>Manufacturing System</span>
                    </div>
                </div>

                <div className="login-welcome">
                    <h2>Welcome Back</h2>
                    <p>Sign in to access your ERP dashboard</p>
                </div>

                {error && (
                    <div className="alert alert-danger mb-4" style={{ marginBottom: 20 }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Email Address</label>
                        <div className="search-wrapper">
                            <Mail size={16} className="search-icon" />
                            <input
                                type="email"
                                className="form-control search-input"
                                placeholder="Enter your email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label">Password</label>
                        <div className="search-wrapper">
                            <Lock size={16} className="search-icon" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="form-control search-input"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                style={{ paddingRight: 40 }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8',
                                    display: 'flex', alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full btn-lg"
                        disabled={isLoading}
                        style={{ width: '100%', marginBottom: 20 }}
                    >
                        {isLoading ? (
                            <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> Signing In...</>
                        ) : (
                            'Sign In to ERP'
                        )}
                    </button>
                </form>

                {/* Quick Login */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Quick Demo Login
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                            { role: 'admin', label: '🔑 Admin' },
                            { role: 'purchase', label: '🛒 Purchase' },
                            { role: 'production', label: '🏭 Production' },
                            { role: 'operator', label: '⚙️ Operator' },
                        ].map(({ role, label }) => (
                            <button
                                key={role}
                                type="button"
                                onClick={() => quickLogin(role)}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 12 }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                        Password: <strong>Password@123</strong>
                    </div>
                </div>
            </div>
        </div>
    );
}
