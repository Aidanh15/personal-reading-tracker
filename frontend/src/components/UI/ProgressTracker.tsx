import { useState } from 'react';
import { Book, ProgressUpdateData } from '../../types';
import Button from './Button';
import Input from './Input';
import ProgressBar from './ProgressBar';

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
      default: return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: Book['status']) => {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
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
              <div className="flex items-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`h-4 w-4 ${star <= book.personalRating! ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
                <span className="ml-1 text-sm text-gray-600">({book.personalRating}/5)</span>
              </div>
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
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, personalRating: star }))}
                className={`p-1 rounded hover:bg-gray-100 ${star <= formData.personalRating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </button>
            ))}
            {formData.personalRating > 0 && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, personalRating: 0 }))}
                className="ml-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
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