import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpenIcon, 
  ChatBubbleLeftRightIcon, 
  FunnelIcon,
  AdjustmentsHorizontalIcon 
} from '@heroicons/react/24/outline';
import { SearchResult } from '../../types';
// import BookCard from './BookCard';
import LoadingSpinner from './LoadingSpinner';

interface SearchResultsProps {
  results: SearchResult | null;
  loading: boolean;
  error: string | null;
  query: string;
}

type ResultType = 'all' | 'books' | 'highlights';

function SearchResults({ results, loading, error, query }: SearchResultsProps) {
  const [activeFilter, setActiveFilter] = useState<ResultType>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Highlight matching text in search results
  const highlightText = (text: string, searchQuery: string): JSX.Element => {
    if (!searchQuery.trim()) {
      return <span>{text}</span>;
    }

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Filter results based on active filter
  const getFilteredResults = () => {
    if (!results) return { books: [], highlights: [] };

    switch (activeFilter) {
      case 'books':
        return { books: results.books, highlights: [] };
      case 'highlights':
        return { books: [], highlights: results.highlights };
      default:
        return { books: results.books, highlights: results.highlights };
    }
  };

  const filteredResults = getFilteredResults();
  const totalFilteredResults = filteredResults.books.length + filteredResults.highlights.length;

  // Get result counts for filter buttons
  const getResultCounts = () => {
    if (!results) return { all: 0, books: 0, highlights: 0 };
    
    return {
      all: results.books.length + results.highlights.length,
      books: results.books.length,
      highlights: results.highlights.length
    };
  };

  const counts = getResultCounts();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-lg font-medium text-red-800 mb-2">Search Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!results || (!query.trim() && totalFilteredResults === 0)) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <BookOpenIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Start searching</h3>
          <p>Enter a search term to find books and highlights</p>
        </div>
      </div>
    );
  }

  if (totalFilteredResults === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <BookOpenIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
          <p>No books or highlights match your search for "{query}"</p>
          <p className="text-sm mt-2">Try adjusting your search terms or filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Search Results
            {query && (
              <span className="text-gray-600 font-normal"> for "{query}"</span>
            )}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalFilteredResults} result{totalFilteredResults !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4" />
          <span>Filters</span>
        </button>
      </div>

      {/* Filter Buttons */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-1">
            <FunnelIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 mr-3">Show:</span>
            
            {(['all', 'books', 'highlights'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  activeFilter === filter
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'books' ? 'Books' : 'Highlights'}
                <span className="ml-1 text-xs opacity-75">
                  ({counts[filter]})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Books Results */}
      {filteredResults.books.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <BookOpenIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Books ({filteredResults.books.length})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResults.books.map((book) => (
              <div key={book.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <Link to={`/books/${book.id}`} className="block">
                  <h4 className="font-medium text-gray-900 mb-2">
                    {highlightText(book.title, query)}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">
                    by {highlightText(book.authors.join(', '), query)}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      book.status === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : book.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {book.status.replace('_', ' ')}
                    </span>
                    {book.status === 'in_progress' && (
                      <span className="text-xs text-gray-500">
                        {book.progressPercentage}% complete
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights Results */}
      {filteredResults.highlights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-medium text-gray-900">
              Highlights ({filteredResults.highlights.length})
            </h3>
          </div>
          
          <div className="space-y-3">
            {filteredResults.highlights.map((highlight) => (
              <div key={highlight.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <Link to={`/books/${highlight.bookId}`} className="block">
                  <div className="mb-3">
                    <blockquote className="text-gray-900 italic border-l-4 border-blue-200 pl-4 mb-2">
                      "{highlightText(highlight.quoteText, query)}"
                    </blockquote>
                    {highlight.personalNotes && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Note:</span> {highlightText(highlight.personalNotes, query)}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div>
                      <span className="font-medium text-gray-700">
                        {highlightText(highlight.bookTitle, query)}
                      </span>
                      <span className="mx-2">•</span>
                      <span>{highlightText(highlight.bookAuthors.join(', '), query)}</span>
                    </div>
                    {highlight.pageNumber && (
                      <span>Page {highlight.pageNumber}</span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchResults;