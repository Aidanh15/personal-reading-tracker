import { useState } from 'react';
import { Book, ProgressUpdateData } from '../../types';
import Button from './Button';
import Input from './Input';
import ProgressBar from './ProgressBar';
import StarRating from './StarRating';

export interface ProgressTrackerProps {
  book: Book;
  onUpdateProgress: (data: ProgressUpdateData) => Promise<void>;
  loading?: boolean;
}

function ProgressTracker({ book, onUpdateProgress, loading = false }: ProgressTrackerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    currentPage: book.currentPage || 0,
    progressPercentage: book.progressPercentage,
    status: book.status,
    personalRating: book.personalRating || 0,
    personalReview: book.personalReview || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const updateData: ProgressUpdateData = {
        progressPercentage: formData.progressPercentage,
        status: formData.status
      };

      // Only add optional properties if they have values
      if (formData.currentPage > 0) {
        updateData.currentPage = formData.currentPage;
      }
      if (formData.personalRating && formData.personalRating > 0) {
        updateData.personalRating = formData.personalRating;
      }
      if (formData.personalReview && formData.personalReview.trim()) {
        updateData.personalReview = formData.personalReview;
      }

      // Set completion date if marking as completed
      if (formData.status === 'completed' && book.status !== 'completed') {
        updateData.completedDate = new Date().toISOString();
      }

      await onUpdateProgress(updateData);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const handleCancel = () => {
    setFormData({
      currentPage: book.currentPage || 0,
      progressPercentage: book.progressPercentage,
      status: book.status,
      personalRating: book.personalRating || 0,
      personalReview: book.personalReview || ''
    });
    setIsEditing(false);
  };

  const handleProgressChange = (value: number) => {
    setFormData(prev => ({
      ...prev,
      progressPercentage: value,
      // Auto-calculate current page if total pages is known
      currentPage: book.totalPages ? Math.round((value / 100) * book.totalPages) : prev.currentPage
    }));
  };

  const handlePageChange = (page: number) => {
    setFormData(prev => ({
      ...prev,
      currentPage: page,
      // Auto-calculate progress percentage if total pages is known
      progressPercentage: book.totalPages ? Math.round((page / book.totalPages) * 100) : prev.progressPercentage
    }));
  };

  const getStatusColor = (status: Book['status']) => {
    switch (status) {
      case 'not_started': return 'text-gray-600';
      case 'in_progress': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'did_not_finish': return 'text-rose-700';
      default: return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: Book['status']) => {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'did_not_finish': return 'Did Not Finish';
      default: return 'Unknown';
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Reading Progress</h3>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
            disabled={loading}
          >
            Update Progress
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className={`text-sm font-medium ${getStatusColor(book.status)}`}>
                {getStatusLabel(book.status)}
              </span>
            </div>
            <ProgressBar progress={book.progressPercentage} showPercentage />
          </div>

          {book.totalPages && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Page {book.currentPage || 0} of {book.totalPages}</span>
              <span>{book.totalPages - (book.currentPage || 0)} pages remaining</span>
            </div>
          )}

          {book.startedDate && (
            <div className="text-sm text-gray-600">
              Started: {new Date(book.startedDate).toLocaleDateString()}
            </div>
          )}

          {book.completedDate && (
            <div className="text-sm text-gray-600">
              Completed: {new Date(book.completedDate).toLocaleDateString()}
            </div>
          )}

          {book.personalRating && book.personalRating > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Rating:</span>
              <StarRating value={book.personalRating} />
            </div>
          )}

          {book.personalReview && (
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-700">Review:</span>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                {book.personalReview}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Update Reading Progress</h3>
      </div>

      <div className="space-y-4">
        {/* Status Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reading Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Book['status'] }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="did_not_finish">Did Not Finish</option>
          </select>
        </div>

        {/* Progress Percentage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Progress Percentage
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              value={formData.progressPercentage}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>0%</span>
              <span className="font-medium">{formData.progressPercentage}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Current Page */}
        {book.totalPages && (
          <Input
            type="number"
            label="Current Page"
            value={formData.currentPage}
            onChange={(e) => handlePageChange(Number(e.target.value))}
            min={0}
            max={book.totalPages}
            helperText={`Out of ${book.totalPages} total pages`}
          />
        )}

        {/* Personal Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personal Rating (Optional)
          </label>
          <StarRating
            size="md"
            value={formData.personalRating || null}
            onChange={rating => setFormData(prev => ({ ...prev, personalRating: rating ?? 0 }))}
          />
        </div>

        {/* Personal Review */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Personal Review (Optional)
          </label>
          <textarea
            value={formData.personalReview}
            onChange={(e) => setFormData(prev => ({ ...prev, personalReview: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Share your thoughts about this book..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading}
        >
          Save Progress
        </Button>
      </div>
    </form>
  );
}

export default ProgressTracker;
