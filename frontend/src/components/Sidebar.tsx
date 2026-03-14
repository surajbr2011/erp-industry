import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Building2, FileText, ShoppingCart, Package,
    Layers, ClipboardList, Search,
    CheckSquare, Archive, BarChart3, LogOut, Factory, Cog
} from 'lucide-react';
import { useAuthStore, ROLE_LABELS } from '../store/authStore';

const navItems = [
    {
        section: 'Overview', links: [
            { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['all'] },
        ]
    },
    {
        section: 'Procurement', links: [
            { to: '/suppliers', icon: Building2, label: 'Suppliers', roles: ['admin', 'purchase_manager'] },
            { to: '/rfqs', icon: FileText, label: 'RFQ Management', roles: ['admin', 'purchase_manager'] },
            { to: '/purchase-orders', icon: ShoppingCart, label: 'Purchase Orders', roles: ['admin', 'purchase_manager'] },
            { to: '/materials', icon: Package, label: 'Material Inventory', roles: ['admin', 'purchase_manager', 'production_manager'] },
        ]
    },
    {
        section: 'Production', links: [
            { to: '/boms', icon: Layers, label: 'Bill of Materials', roles: ['admin', 'production_manager'] },
            { to: '/work-orders', icon: ClipboardList, label: 'Work Orders', roles: ['admin', 'production_manager', 'machine_operator'] },
            { to: '/machines', icon: Cog, label: 'Machine Operations', roles: ['admin', 'production_manager', 'machine_operator'] },
        ]
    },
    {
        section: 'Quality & Traceability', links: [
            { to: '/parts', icon: Search, label: 'Part Traceability', roles: ['all'] },
            { to: '/inspections', icon: CheckSquare, label: 'Quality Inspection', roles: ['admin', 'production_manager', 'quality_inspector'] },
            { to: '/finished-goods', icon: Archive, label: 'Finished Goods', roles: ['admin', 'production_manager', 'quality_inspector'] },
        ]
    },
    {
        section: 'Analytics', links: [
            { to: '/reports', icon: BarChart3, label: 'Reports & Analytics', roles: ['admin', 'production_manager', 'purchase_manager'] },
        ]
    },
    {
        section: 'Admin', links: [
            { to: '/users', icon: Users, label: 'User Management', roles: ['admin'] },
        ]
    },
];

export default function Sidebar() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const canAccess = (roles: string[]) => {
        if (roles.includes('all')) return true;
        return user ? roles.includes(user.role) : false;
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <Factory size={22} color="white" strokeWidth={2.5} />
                </div>
                <div className="sidebar-logo-text">
                    <h1>TRINIX ERP</h1>
                    <span>Manufacturing System</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => {
                    const visibleLinks = section.links.filter(l => canAccess(l.roles));
                    if (!visibleLinks.length) return null;
                    return (
                        <div className="sidebar-section" key={section.section}>
                            <div className="sidebar-section-label">{section.section}</div>
                            {visibleLinks.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    end={link.to === '/'}
                                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                                >
                                    <link.icon size={18} />
                                    {link.label}
                                </NavLink>
                            ))}
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <div className="sidebar-user-role">{user ? ROLE_LABELS[user.role] : ''}</div>
                    </div>
                    <button
                        className="btn btn-icon"
                        onClick={handleLogout}
                        title="Logout"
                        style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', marginLeft: 'auto' }}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
