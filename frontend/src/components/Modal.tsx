import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`modal${size === 'lg' ? ' modal-lg' : size === 'xl' ? ' modal-xl' : size === 'sm' ? ' modal-sm' : ''}`}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="btn btn-icon btn-secondary" onClick={onClose} style={{ padding: 6 }}>
                        <X size={16} />
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    );
}

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning';
    isLoading?: boolean;
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', isLoading }: ConfirmDialogProps) {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-sm">
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                    <button className="btn btn-icon btn-secondary" onClick={onClose} style={{ padding: 6 }}>
                        <X size={16} />
                    </button>
                </div>
                <div className="modal-body">
                    <p style={{ color: '#475569', fontSize: 14 }}>{message}</p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className={`btn btn-${variant}`}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : null}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
