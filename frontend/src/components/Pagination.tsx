import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    page: number;
    total: number;
    limit: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onPageChange }: PaginationProps) {
    const totalPages = Math.ceil(total / limit);
    const from = Math.min((page - 1) * limit + 1, total);
    const to = Math.min(page * limit, total);

    if (total === 0) return null;

    return (
        <div className="pagination">
            <div className="pagination-info">
                Showing {from}–{to} of {total} results
            </div>
            <div className="pagination-controls">
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                >
                    <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = page - 2 + i;

                    return (
                        <button
                            key={pageNum}
                            className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                            onClick={() => onPageChange(pageNum)}
                        >
                            {pageNum}
                        </button>
                    );
                })}
                <button
                    className="pagination-btn"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
