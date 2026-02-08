/**
 * Tooltip Component
 *
 * Reusable tooltip with configurable position and styling
 */

import { useState, useRef, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export default function Tooltip({
  children,
  content,
  position = 'top',
  delay = 200,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Calculate position when tooltip becomes visible
  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipEl = tooltipRef.current;

      // Get tooltip dimensions (approximate if not yet rendered)
      const tooltipWidth = tooltipEl?.offsetWidth || 200;
      const tooltipHeight = tooltipEl?.offsetHeight || 40;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipHeight - 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
          break;
        case 'bottom':
          top = triggerRect.bottom + 8;
          left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
          break;
        case 'left':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipHeight / 2);
          left = triggerRect.left - tooltipWidth - 8;
          break;
        case 'right':
          top = triggerRect.top + (triggerRect.height / 2) - (tooltipHeight / 2);
          left = triggerRect.right + 8;
          break;
      }

      // Keep tooltip within viewport
      const padding = 8;
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

      setTooltipPosition({ top, left });
    }
  }, [isVisible, position]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-transparent border-r-transparent border-b-transparent border-t-gray-900',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-transparent border-r-transparent border-t-transparent border-b-gray-900',
    left: 'right-0 top-1/2 translate-x-full -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900',
    right: 'left-0 top-1/2 -translate-x-full -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900',
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={`inline-flex ${className}`}
      >
        {children}
      </span>

      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            zIndex: 9999,
          }}
          className="animate-fade-in"
        >
          <div className="relative bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-xs">
            {content}
            <span
              className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
