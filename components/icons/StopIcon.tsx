
import React from 'react';

export const StopIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6 text-white" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLineCap="round" strokeLineJoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLineCap="round" strokeLineJoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
    </svg>
);
