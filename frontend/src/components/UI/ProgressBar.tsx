
import { ProgressBarProps } from '../../types';

function ProgressBar({ progress, className = '', showPercentage = false }: ProgressBarProps) {
  // Ensure progress is between 0 and 100
  const normalizedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex-1 progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${normalizedProgress}%` }}
          role="progressbar"
          aria-valuenow={normalizedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showPercentage && (
        <span className="text-sm text-gray-600 font-medium min-w-[3rem] text-right">
          {Math.round(normalizedProgress)}%
        </span>
      )}
    </div>
  );
}

export default ProgressBar;