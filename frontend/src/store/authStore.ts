import { create } from 'zustand';
import { authAPI } from '../services/api';

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    department?: string;
    phone?: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,

    loadFromStorage: () => {
        const token = localStorage.getItem('erp_token');
        const userStr = localStorage.getItem('erp_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token, isAuthenticated: true });
            } catch {
                localStorage.removeItem('erp_token');
                localStorage.removeItem('erp_user');
            }
        }
    },

    login: async (email, password) => {
        set({ isLoading: true });
        try {
            const response = await authAPI.login({ email, password });
            const { token, user } = response.data;
            localStorage.setItem('erp_token', token);
            localStorage.setItem('erp_user', JSON.stringify(user));
            set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
            set({ isLoading: false });
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_user');
        set({ user: null, token: null, isAuthenticated: false });
    },
}));

export const ROLES = {
    ADMIN: 'admin',
    PURCHASE_MANAGER: 'purchase_manager',
    PRODUCTION_MANAGER: 'production_manager',
    MACHINE_OPERATOR: 'machine_operator',
    QUALITY_INSPECTOR: 'quality_inspector',
};

export const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrator',
    purchase_manager: 'Purchase Manager',
    production_manager: 'Production Manager',
    machine_operator: 'Machine Operator',
    quality_inspector: 'Quality Inspector',
};

export const hasRole = (user: User | null, ...roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
};
