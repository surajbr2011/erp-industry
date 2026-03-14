import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('erp_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor - handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('erp_token');
            localStorage.removeItem('erp_user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth
export const authAPI = {
    login: (data: { email: string; password: string }) => api.post('/auth/login', data),
    me: () => api.get('/auth/me'),
    changePassword: (data: any) => api.put('/auth/change-password', data),
};

// Users
export const usersAPI = {
    getAll: (params?: any) => api.get('/users', { params }),
    create: (data: any) => api.post('/users', data),
    update: (id: number, data: any) => api.put(`/users/${id}`, data),
    delete: (id: number) => api.delete(`/users/${id}`),
};

// Suppliers
export const suppliersAPI = {
    getAll: (params?: any) => api.get('/suppliers', { params }),
    getById: (id: number) => api.get(`/suppliers/${id}`),
    create: (data: any) => api.post('/suppliers', data),
    update: (id: number, data: any) => api.put(`/suppliers/${id}`, data),
    delete: (id: number) => api.delete(`/suppliers/${id}`),
    bulkUpload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/suppliers/bulk-upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    export: () => api.get('/suppliers/export/all', { responseType: 'blob' }),
    downloadTemplate: () => api.get('/suppliers/export/template', { responseType: 'blob' }),
};

// RFQs
export const rfqsAPI = {
    getAll: (params?: any) => api.get('/rfqs', { params }),
    getById: (id: number) => api.get(`/rfqs/${id}`),
    create: (data: any) => api.post('/rfqs', data),
    send: (id: number) => api.put(`/rfqs/${id}/send`),
    addQuotation: (id: number, data: any) => api.post(`/rfqs/${id}/quotations`, data),
    approveQuotation: (id: number) => api.put(`/rfqs/quotations/${id}/approve`),
};

// Purchase Orders
export const purchaseOrdersAPI = {
    getAll: (params?: any) => api.get('/purchase-orders', { params }),
    getById: (id: number) => api.get(`/purchase-orders/${id}`),
    create: (data: any) => api.post('/purchase-orders', data),
    updateStatus: (id: number, status: string) => api.put(`/purchase-orders/${id}/status`, { status }),
    receive: (id: number, data: any) => api.post(`/purchase-orders/${id}/receive`, data),
};

// Materials
export const materialsAPI = {
    getAll: (params?: any) => api.get('/materials', { params }),
    getById: (id: number) => api.get(`/materials/${id}`),
    create: (data: any) => api.post('/materials', data),
    update: (id: number, data: any) => api.put(`/materials/${id}`, data),
    adjustStock: (id: number, data: any) => api.post(`/materials/${id}/adjust-stock`, data),
    getBatches: (params?: any) => api.get('/materials/batches/all', { params }),
    bulkUpload: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/materials/bulk-upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    export: () => api.get('/materials/export/all', { responseType: 'blob' }),
    downloadTemplate: () => api.get('/materials/export/template', { responseType: 'blob' }),
};

// BOMs
export const bomsAPI = {
    getAll: (params?: any) => api.get('/boms', { params }),
    getById: (id: number) => api.get(`/boms/${id}`),
    create: (data: any) => api.post('/boms', data),
    update: (id: number, data: any) => api.put(`/boms/${id}`, data),
};

// Work Orders
export const workOrdersAPI = {
    getAll: (params?: any) => api.get('/work-orders', { params }),
    getById: (id: number) => api.get(`/work-orders/${id}`),
    create: (data: any) => api.post('/work-orders', data),
    updateStatus: (id: number, status: string) => api.put(`/work-orders/${id}/status`, { status }),
    updateOperation: (id: number, data: any) => api.put(`/work-orders/operations/${id}`, data),
    generateParts: (id: number, quantity: number) => api.post(`/work-orders/${id}/generate-parts`, { quantity }),
};

// Machines
export const machinesAPI = {
    getAll: (params?: any) => api.get('/machines', { params }),
    getById: (id: number) => api.get(`/machines/${id}`),
    create: (data: any) => api.post('/machines', data),
    update: (id: number, data: any) => api.put(`/machines/${id}`, data),
    getLogs: (params?: any) => api.get('/machines/logs/all', { params }),
};

// Parts
export const partsAPI = {
    getAll: (params?: any) => api.get('/parts', { params }),
    getById: (id: number) => api.get(`/parts/${id}`),
    trace: (serial: string) => api.get(`/parts/trace/${serial}`),
    updateStatus: (id: number, status: string, notes?: string) => api.put(`/parts/${id}/status`, { status, notes }),
};

// Inspections
export const inspectionsAPI = {
    getAll: (params?: any) => api.get('/inspections', { params }),
    getById: (id: number) => api.get(`/inspections/${id}`),
    create: (data: any) => api.post('/inspections', data),
    getPlans: () => api.get('/inspections/plans/all'),
    createPlan: (data: any) => api.post('/inspections/plans', data),
};

// Finished Goods
export const finishedGoodsAPI = {
    getAll: (params?: any) => api.get('/finished-goods', { params }),
    create: (data: any) => api.post('/finished-goods', data),
    dispatch: (id: number, data: any) => api.post(`/finished-goods/${id}/dispatch`, data),
    getDispatches: (params?: any) => api.get('/finished-goods/dispatches/all', { params }),
};

// Reports
export const reportsAPI = {
    dashboard: () => api.get('/reports/dashboard'),
    production: (params?: any) => api.get('/reports/production', { params }),
    quality: (params?: any) => api.get('/reports/quality', { params }),
    inventory: () => api.get('/reports/inventory'),
    purchase: (params?: any) => api.get('/reports/purchase', { params }),
};

export default api;
