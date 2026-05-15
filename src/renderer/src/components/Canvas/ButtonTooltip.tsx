type ButtonTooltipProps = {
  label: string;
  children: React.ReactNode;
};

export function ButtonTooltip({ label, children }: ButtonTooltipProps) {
  return (
    <div className="btn-tooltip-wrap">
      {children}
      <div className="btn-tooltip" role="tooltip">
        {label}
      </div>
      <style>{`
        .btn-tooltip-wrap {
          position: relative;
          display: inline-flex;
        }

        .btn-tooltip {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%) translateY(3px);
          background: var(--foreground);
          color: var(--background);
          font-size: 9px;
          font-weight: 500;
          white-space: nowrap;
          padding: 2px 6px;
          border-radius: 4px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease, transform 0.15s ease;
          z-index: 9999;
        }

        .btn-tooltip-wrap:hover .btn-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(0px);
        }
      `}</style>
    </div>
  );
}
