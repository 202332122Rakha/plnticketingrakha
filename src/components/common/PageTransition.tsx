import React from 'react';

interface PageTransitionProps {
  pageKey: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Enterprise Page Transition Wrapper
 * Applies smooth fade-up (opacity + 8px translateY) with cubic-bezier(0.22, 1, 0.36, 1)
 * without blank white frames or layout shifts.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  pageKey,
  children,
  className = '',
}) => {
  return (
    <div
      key={pageKey}
      className={`animate-page-enter w-full ${className}`}
    >
      {children}
    </div>
  );
};
