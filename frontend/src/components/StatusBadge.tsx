// Status badge helper
const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
    // Work Orders
    pending: { label: 'Pending', className: 'badge badge-secondary', dot: 'dot-gray' },
    released: { label: 'Released', className: 'badge badge-info', dot: 'dot-info' },
    in_process: { label: 'In Process', className: 'badge badge-warning', dot: 'dot-warning' },
    completed: { label: 'Completed', className: 'badge badge-success', dot: 'dot-success' },
    on_hold: { label: 'On Hold', className: 'badge badge-warning', dot: 'dot-warning' },
    cancelled: { label: 'Cancelled', className: 'badge badge-danger', dot: 'dot-danger' },
    // POs
    draft: { label: 'Draft', className: 'badge badge-secondary', dot: 'dot-gray' },
    sent: { label: 'Sent', className: 'badge badge-info', dot: 'dot-info' },
    approved: { label: 'Approved', className: 'badge badge-success', dot: 'dot-success' },
    received: { label: 'Received', className: 'badge badge-success', dot: 'dot-success' },
    partially_received: { label: 'Partial', className: 'badge badge-warning', dot: 'dot-warning' },
    // Quality
    passed: { label: 'Passed', className: 'badge badge-success', dot: 'dot-success' },
    failed: { label: 'Failed', className: 'badge badge-danger', dot: 'dot-danger' },
    rework: { label: 'Rework', className: 'badge badge-warning', dot: 'dot-warning' },
    rework_required: { label: 'Rework', className: 'badge badge-warning', dot: 'dot-warning' },
    partial_pass: { label: 'Partial Pass', className: 'badge badge-warning', dot: 'dot-warning' },
    // Machines
    available: { label: 'Available', className: 'badge badge-success', dot: 'dot-success' },
    in_use: { label: 'In Use', className: 'badge badge-info', dot: 'dot-info' },
    maintenance: { label: 'Maintenance', className: 'badge badge-warning', dot: 'dot-warning' },
    breakdown: { label: 'Breakdown', className: 'badge badge-danger', dot: 'dot-danger' },
    idle: { label: 'Idle', className: 'badge badge-secondary', dot: 'dot-gray' },
    // Suppliers/Materials
    active: { label: 'Active', className: 'badge badge-success', dot: 'dot-success' },
    inactive: { label: 'Inactive', className: 'badge badge-secondary', dot: 'dot-gray' },
    blacklisted: { label: 'Blacklisted', className: 'badge badge-danger', dot: 'dot-danger' },
    // BOM
    // Parts
    in_production: { label: 'In Production', className: 'badge badge-info', dot: 'dot-info' },
    inspecting: { label: 'Inspecting', className: 'badge badge-warning', dot: 'dot-warning' },
    scrapped: { label: 'Scrapped', className: 'badge badge-danger', dot: 'dot-danger' },
    dispatched: { label: 'Dispatched', className: 'badge badge-purple', dot: 'dot-info' },
    // Priority
    low: { label: 'Low', className: 'badge badge-secondary', dot: 'dot-gray' },
    normal: { label: 'Normal', className: 'badge badge-info', dot: 'dot-info' },
    high: { label: 'High', className: 'badge badge-warning', dot: 'dot-warning' },
    urgent: { label: 'Urgent', className: 'badge badge-danger', dot: 'dot-danger' },
    // RFQ
    quotations_received: { label: 'Quotes In', className: 'badge badge-info', dot: 'dot-info' },
    closed: { label: 'Closed', className: 'badge badge-secondary', dot: 'dot-gray' },
    // QC batch
    rejected: { label: 'Rejected', className: 'badge badge-danger', dot: 'dot-danger' },
    under_review: { label: 'Under Review', className: 'badge badge-info', dot: 'dot-info' },
};

interface StatusBadgeProps {
    status: string;
    showDot?: boolean;
}

export default function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
    const config = statusConfig[status] || { label: status, className: 'badge badge-secondary', dot: 'dot-gray' };
    return (
        <span className={config.className}>
            {showDot && <span className={`status-dot ${config.dot}`} />}
            {config.label}
        </span>
    );
}
