import React, {PropsWithChildren} from 'react';

type SkeletonProps = {
    className?: string;
} & PropsWithChildren;

export const Skeleton: React.FC<SkeletonProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-gray-100 animate-pulse rounded-xl ${className}`}>
            {children}
        </div>
    );
};
