import React, { useState } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { useApiError } from '../hooks/useApiError';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { validateForm, commonRules } from '../utils/validation';
import { Button, Input, TextArea } from './UI';

const ErrorHandlingDemo: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useNotification();
  const { handleError } = useApiError();
  const { isOnline, isOffline } = useOnlineStatus();
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    pages: '',
    rating: '',
    notes: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validationResult = validateForm(formData, {
      title: commonRules.bookTitle,
      author: commonRules.authorName,
      pages: { ...commonRules.pageNumber, required: false },
      rating: { ...commonRules.rating, required: false },
      notes: { maxLength: 1000 },
    });

    if (!validationResult.isValid) {
      setErrors(validationResult.fieldErrors);
      showError('Validation Error', 'Please fix the errors below');
      return;
    }

    setErrors({});
    showSuccess('Form Submitted', 'Your book has been added successfully!');
    
    // Reset form
    setFormData({
      title: '',
      author: '',
      pages: '',
      rating: '',
      notes: '',
    });
  };

  const simulateApiError = () => {
    try {
      // Simulate different types of API errors
      const errorTypes = [
        { status: 404, message: 'Book not found', code: 'NOT_FOUND' },
        { status: 500, message: 'Internal server error', code: 'SERVER_ERROR' },
        { status: 401, message: 'Unauthorized access', code: 'UNAUTHORIZED' },
        { status: 400, message: 'Invalid request data', code: 'VALIDATION_ERROR' },
      ];
      
      const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];
      
      if (!randomError) {
        throw new Error('Unknown error occurred');
      }
      
      // Create a mock API error
      const error = new Error(randomError.message);
      (error as any).status = randomError.status;
      (error as any).code = randomError.code;
      
      throw error;
    } catch (error) {
      handleError(error);
    }
  };

  const simulateNetworkError = () => {
    try {
      const error = new Error('Network error - please check your connection');
      (error as any).code = 'NETWORK_ERROR';
      throw error;
    } catch (error) {
      handleError(error);
    }
  };

  const throwComponentError = () => {
    // This will be caught by the ErrorBoundary
    throw new Error('Simulated component error for testing ErrorBoundary');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Error Handling Demo</h2>
        
        {/* Online Status Indicator */}
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-2">Network Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`font-medium ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          {isOffline && (
            <p className="text-sm text-gray-600 mt-2">
              Some features may not work while offline. The app will automatically reconnect when your connection is restored.
            </p>
          )}
        </div>

        {/* Toast Notification Demos */}
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Toast Notifications</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              onClick={() => showSuccess('Success!', 'Operation completed successfully')}
              variant="primary"
              size="sm"
            >
              Success
            </Button>
            <Button
              onClick={() => showError('Error!', 'Something went wrong')}
              variant="secondary"
              size="sm"
            >
              Error
            </Button>
            <Button
              onClick={() => showWarning('Warning!', 'Please be careful')}
              variant="secondary"
              size="sm"
            >
              Warning
            </Button>
            <Button
              onClick={() => showInfo('Info', 'Here is some information')}
              variant="secondary"
              size="sm"
            >
              Info
            </Button>
          </div>
        </div>

        {/* API Error Simulation */}
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">API Error Handling</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              onClick={simulateApiError}
              variant="secondary"
              size="sm"
            >
              Simulate API Error
            </Button>
            <Button
              onClick={simulateNetworkError}
              variant="secondary"
              size="sm"
            >
              Simulate Network Error
            </Button>
          </div>
        </div>

        {/* Error Boundary Demo */}
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Error Boundary</h3>
          <Button
            onClick={throwComponentError}
            variant="secondary"
            size="sm"
          >
            Trigger Component Error
          </Button>
          <p className="text-sm text-gray-600 mt-2">
            This will trigger a React component error that will be caught by the ErrorBoundary.
          </p>
        </div>

        {/* Form Validation Demo */}
        <div className="p-4 rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Form Validation</h3>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <Input
              label="Book Title *"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              error={errors['title']}
              placeholder="Enter book title"
            />
            
            <Input
              label="Author *"
              value={formData.author}
              onChange={(e) => handleInputChange('author', e.target.value)}
              error={errors['author'] || undefined}
              placeholder="Enter author name"
            />
            
            <Input
              label="Number of Pages"
              type="number"
              value={formData.pages}
              onChange={(e) => handleInputChange('pages', e.target.value)}
              error={errors['pages'] || undefined}
              placeholder="Enter page count"
            />
            
            <Input
              label="Rating (1-5)"
              type="number"
              min="1"
              max="5"
              value={formData.rating}
              onChange={(e) => handleInputChange('rating', e.target.value)}
              error={errors['rating'] || undefined}
              placeholder="Rate the book"
            />
            
            <TextArea
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              error={errors['notes'] || undefined}
              placeholder="Add your notes about the book"
              rows={3}
            />
            
            <Button type="submit" variant="primary">
              Add Book
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ErrorHandlingDemo;