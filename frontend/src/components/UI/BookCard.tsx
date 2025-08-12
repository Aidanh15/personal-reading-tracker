import { Link } from 'react-router-dom';
import { Book } from '../../types';
import ProgressBar from './ProgressBar';
import BookCover from '../BookCover';
import { BookOpenIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

interface BookCardProps {
  book: Book;
  onClick?: (book: Book) => void;
  showPosition?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
}

function BookCard({ book, onClick, showPosition = false, variant = 'default' }: BookCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(book);
    }
  };

  const getStatusIcon = () => {
    switch (book.status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <BookOpenIcon className="h-5 w-5 text-blue-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    
    switch (book.status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'in_progress':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getStatusText = () => {
    switch (book.status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'Reading';
      default:
        return 'Not Started';
    }
  };

  const getCoverSize = () => {
    switch (variant) {
      case 'compact':
        return 'sm';
      case 'detailed':
        return 'lg';
      default:
        return 'md';
    }
  };

  const cardContent = (
    <div className="flex space-x-4">
      {/* Book Cover */}
      <div className="flex-shrink-0">
        <BookCover
          title={book.title}
          authors={book.authors}
          {...(book.coverImageUrl && { coverImageUrl: book.coverImageUrl })}
          size={getCoverSize()}
        />
      </div>

      {/* Book Content */}
      <div className="flex-1 space-y-3 min-w-0">
        {/* Header with position and status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {showPosition && (
              <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                {book.position}
              </span>
            )}
            {getStatusIcon()}
          </div>
          <span className={getStatusBadge()}>
            {getStatusText()}
          </span>
        </div>

        {/* Book information */}
        <div className="space-y-1">
          <h3 className={`font-semibold text-gray-900 ${
            variant === 'compact' ? 'text-sm line-clamp-1' : 'text-base line-clamp-2'
          }`}>
            {book.title}
          </h3>
          <p className={`text-gray-600 ${
            variant === 'compact' ? 'text-xs truncate' : 'text-sm line-clamp-1'
          }`}>
            {book.authors.join(', ')}
          </p>
        </div>

        {/* Progress information */}
        {book.status !== 'not_started' && (
          <div className="space-y-2">
            <ProgressBar 
              progress={book.progressPercentage} 
              showPercentage={variant !== 'compact'}
              className="h-2"
            />
            
            {variant === 'detailed' && (
              <div className="flex justify-between text-xs text-gray-500">
                {book.currentPage && book.totalPages ? (
                  <span>Page {book.currentPage} of {book.totalPages}</span>
                ) : (
                  <span>{book.progressPercentage}% complete</span>
                )}
                
                {book.status === 'completed' && book.completedDate && (
                  <span>
                    Finished {new Date(book.completedDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rating for completed books */}
        {book.status === 'completed' && book.personalRating && variant === 'detailed' && (
          <div className="flex items-center space-x-1">
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
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <div
        onClick={handleClick}
        className="card hover:shadow-md transition-shadow cursor-pointer p-4"
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      to={`/books/${book.id}`}
      className="card hover:shadow-md transition-shadow cursor-pointer p-4 block"
    >
      {cardContent}
    </Link>
  );
}

export default BookCard;