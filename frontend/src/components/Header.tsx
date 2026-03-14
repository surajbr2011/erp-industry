import { useAuthStore } from '../store/authStore';

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
    const { user } = useAuthStore();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <header className="header">
            <div className="header-left">
                <div>
                    <div className="header-title">{title}</div>
                    {subtitle && <div className="header-subtitle">{subtitle}</div>}
                </div>
            </div>
            <div className="header-right">
                <div style={{ textAlign: 'right', fontSize: '12px' }}>
                    <div style={{ color: '#475569', fontWeight: 600 }}>{timeStr}</div>
                    <div style={{ color: '#94a3b8' }}>{dateStr}</div>
                </div>
                <div style={{ width: 1, height: 32, background: '#e2e8f0' }} />
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', background: '#f1f5f9', borderRadius: 8
                }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: 'white'
                    }}>
                        {user?.name?.charAt(0)}
                    </div>
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{user?.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'capitalize' }}>
                            {user?.role?.replace('_', ' ')}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
