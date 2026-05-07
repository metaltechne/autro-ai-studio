import React from 'react';
import { Button } from './Button';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) {
        return null;
    }

    const getPageNumbers = () => {
        const pageNumbers: (number | string)[] = [];
        const maxPagesToShow = 5; // The number of page links to show around the current page
        const half = Math.floor(maxPagesToShow / 2);

        if (totalPages <= maxPagesToShow + 2) {
            // Show all pages if there aren't many
            for (let i = 1; i <= totalPages; i++) {
                pageNumbers.push(i);
            }
        } else {
            // Always show the first page
            pageNumbers.push(1);
            if (currentPage > half + 2) {
                pageNumbers.push('...');
            }

            let start = Math.max(2, currentPage - half);
            let end = Math.min(totalPages - 1, currentPage + half);
            
            // Adjust window if we are near the start
            if (currentPage <= half + 1) {
                end = maxPagesToShow;
            }
             // Adjust window if we are near the end
            if (currentPage >= totalPages - half) {
                start = totalPages - maxPagesToShow + 1;
            }

            for (let i = start; i <= end; i++) {
                pageNumbers.push(i);
            }

            if (currentPage < totalPages - half - 1) {
                pageNumbers.push('...');
            }
            // Always show the last page
            pageNumbers.push(totalPages);
        }
        return pageNumbers;
    };
    
    const pageNumbers = getPageNumbers();

    return (
        <nav className="flex justify-center items-center mt-8 space-x-2 print-hide">
            <Button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                variant="secondary"
                size="sm"
            >
                Anterior
            </Button>
            
            <div className="flex items-center space-x-1">
            {pageNumbers.map((num, index) => (
                typeof num === 'number' ? (
                     <button
                        key={`${num}-${index}`}
                        onClick={() => onPageChange(num)}
                        className={`px-3 py-1.5 text-sm font-medium border rounded-md transition-colors ${
                            currentPage === num
                                ? 'bg-autro-blue text-white border-autro-blue'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {num}
                    </button>
                ) : (
                    <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-sm font-medium text-gray-500">
                        {num}
                    </span>
                )
            ))}
            </div>

            <Button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                variant="secondary"
                size="sm"
            >
                Próximo
            </Button>
        </nav>
    );
};
