import { useEffect } from 'react';
import { useBooks } from '../contexts/BooksContext';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import BookCard from '../components/UI/BookCard';
import { BookOpenIcon, PlusIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

function Dashboard() {
  const { books, loading, error, fetchBooks } = useBooks();
  const [showCompletedBooks, setShowCompletedBooks] = useState(false);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  if (loading && books.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg font-medium">Error loading books</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={fetchBooks}
          className="btn-primary"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Sort books by position for optimized reading order
  const sortedBooks = [...books].sort((a, b) => a.position - b.position);
  
  // Filter books by status while maintaining optimized order
  const inProgressBooks = sortedBooks.filter(book => book.status === 'in_progress');
  const upNextBooks = sortedBooks.filter(book => book.status === 'not_started');
  const completedBooks = sortedBooks.filter(book => book.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reading Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Follow your AI-optimized reading sequence and track progress
          </p>
        </div>
        <button className="btn-primary flex items-center space-x-2 self-start sm:self-auto">
          <PlusIcon className="h-4 w-4" />
          <span>Add Book</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpenIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Total Books</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{books.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <BookOpenIcon className="h-5 w-5 md:h-6 md:w-6 text-yellow-600" />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Reading</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{inProgressBooks.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <BookOpenIcon className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Completed</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{completedBooks.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-gray-100 rounded-lg">
              <BookOpenIcon className="h-5 w-5 md:h-6 md:w-6 text-gray-600" />
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-xs md:text-sm font-medium text-gray-600">Up Next</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">{upNextBooks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Currently Reading Section */}
      {inProgressBooks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Currently Reading</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {inProgressBooks.map(book => (
              <BookCard 
                key={book.id} 
                book={book} 
                variant="detailed"
                showPosition={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Up Next Section - Books in optimized reading order */}
      {upNextBooks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Up Next</h2>
            <span className="text-sm text-gray-500">Optimized reading order</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {upNextBooks.map(book => (
              <BookCard 
                key={book.id} 
                book={book} 
                variant="default"
                showPosition={true}
              />
            ))}
          </div>
        </section>
      )}

      {/* Previously Read Section - Collapsible */}
      {completedBooks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Previously Read ({completedBooks.length})
            </h2>
            <button
              onClick={() => setShowCompletedBooks(!showCompletedBooks)}
              className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>{showCompletedBooks ? 'Hide' : 'Show'}</span>
              {showCompletedBooks ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          
          {showCompletedBooks && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {completedBooks.map(book => (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  variant="detailed"
                  showPosition={false}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty State */}
      {books.length === 0 && (
        <div className="text-center py-12 card">
          <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No books yet</h3>
          <p className="text-gray-600 mb-4">Start building your reading list by adding your first book.</p>
          <button className="btn-primary">Add Your First Book</button>
        </div>
      )}
    </div>
  );
}

export default Dashboard;