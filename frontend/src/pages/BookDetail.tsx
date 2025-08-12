
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { useBooks } from '../contexts/BooksContext';
import { useHighlights } from '../contexts/HighlightsContext';
import { Book, Highlight, HighlightFormData, ProgressUpdateData } from '../types';
import ProgressTracker from '../components/UI/ProgressTracker';
import Button from '../components/UI/Button';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import HighlightManager from '../components/UI/HighlightManager';

function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBookById, updateBookProgress, loading: booksLoading } = useBooks();
  const { 
    getHighlightsByBookId, 
    fetchHighlights, 
    addHighlight, 
    updateHighlight, 
    deleteHighlight,
    bulkImportHighlights,
    loading: highlightsLoading 
  } = useHighlights();

  const [book, setBook] = useState<Book | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const bookId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (!bookId) {
      navigate('/');
      return;
    }

    const foundBook = getBookById(bookId);
    if (!foundBook) {
      navigate('/');
      return;
    }

    setBook(foundBook);
    
    // Fetch highlights for this book
    fetchHighlights(bookId);
  }, [bookId, getBookById, fetchHighlights, navigate]);

  useEffect(() => {
    if (bookId) {
      const bookHighlights = getHighlightsByBookId(bookId);
      setHighlights(bookHighlights);
    }
  }, [bookId, getHighlightsByBookId]);

  // Handler functions for HighlightManager
  const handleAddHighlight = async (data: HighlightFormData) => {
    if (!bookId) return;
    await addHighlight(bookId, data);
  };

  const handleUpdateHighlight = async (id: number, data: Partial<HighlightFormData>) => {
    await updateHighlight(id, data);
  };

  const handleDeleteHighlight = async (id: number) => {
    await deleteHighlight(id);
  };

  const handleBulkImport = async (highlightsData: HighlightFormData[]) => {
    if (!bookId) return;
    await bulkImportHighlights(bookId, highlightsData);
  };

  // Handler for ProgressTracker
  const handleUpdateProgress = async (data: ProgressUpdateData) => {
    if (!bookId) return;
    await updateBookProgress(bookId, data);
  };

  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/')}
          className="!p-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
          <p className="text-gray-600">by {book.authors.join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Book Information */}
          <div className="card">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-24 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                  <BookOpenIcon className="h-8 w-8 text-gray-400" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{book.title}</h2>
                  <p className="text-gray-600">by {book.authors.join(', ')}</p>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>Position #{book.position} in reading list</span>
                  {book.totalPages && <span>{book.totalPages} pages</span>}
                </div>

                {book.startedDate && (
                  <p className="text-sm text-gray-500">
                    Started: {new Date(book.startedDate).toLocaleDateString()}
                  </p>
                )}

                {book.completedDate && (
                  <p className="text-sm text-gray-500">
                    Completed: {new Date(book.completedDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Highlights Section */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Highlights
            </h3>
            <HighlightManager
              highlights={highlights}
              loading={highlightsLoading}
              onAddHighlight={handleAddHighlight}
              onUpdateHighlight={handleUpdateHighlight}
              onDeleteHighlight={handleDeleteHighlight}
              onBulkImport={handleBulkImport}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Progress Tracker */}
          <div className="card">
            <ProgressTracker
              book={book}
              onUpdateProgress={handleUpdateProgress}
              loading={booksLoading}
            />
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span className="font-medium">
                  {book.status === 'not_started' && 'Not Started'}
                  {book.status === 'in_progress' && 'In Progress'}
                  {book.status === 'completed' && 'Completed'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">{book.progressPercentage}%</span>
              </div>

              {book.totalPages && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pages Read</span>
                  <span className="font-medium">
                    {book.currentPage || 0} / {book.totalPages}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Highlights</span>
                <span className="font-medium">{highlights.length}</span>
              </div>

              {book.personalRating && book.personalRating > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Rating</span>
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`h-4 w-4 ${
                          star <= book.personalRating! ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}

export default BookDetail;