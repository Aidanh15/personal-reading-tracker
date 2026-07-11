import React, { useState } from 'react';

interface BookCoverProps {
  title: string;
  authors: string[];
  coverImageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const BookCover: React.FC<BookCoverProps> = ({
  title,
  authors,
  coverImageUrl,
  size = 'md',
  className = '',
  showFallback = true
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Size configurations
  const sizeClasses = {
    sm: 'w-16 h-24',
    md: 'w-24 h-36',
    lg: 'w-32 h-48',
    xl: 'w-40 h-60'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImageLoading(false);
  };

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  // Generate fallback cover with book info
  const renderFallbackCover = () => {
    const authorText = authors.length > 0 ? authors[0] : 'Unknown Author';
    const displayTitle = title.length > 30 ? title.substring(0, 30) + '...' : title;
    const displayAuthor = authorText && authorText.length > 20 ? authorText.substring(0, 20) + '...' : authorText;

    return (
      <div
        className={`
          ${sizeClasses[size]} 
          bg-gradient-to-br from-ink-800 via-ink-900 to-copper-700
          rounded-xl shadow-book border border-paper-50/10
          flex flex-col justify-between 
          p-3 text-white 
          ${className}
        `}
      >
        <div className="flex-1 flex flex-col justify-center">
          <div className="mx-auto mb-3 h-px w-6 bg-copper-300/70" />
          <h3 className={`${textSizes[size]} font-display font-semibold leading-tight mb-2 text-center`}>
            {displayTitle}
          </h3>
          <p className={`${size === 'sm' ? 'text-xs' : 'text-xs'} opacity-90 text-center`}>
            {displayAuthor}
          </p>
        </div>
        <div className="text-center">
          <div className={`${size === 'sm' ? 'text-xs' : 'text-xs'} opacity-75`}>
            <span className="font-display italic">R</span>
          </div>
        </div>
      </div>
    );
  };

  // If no cover URL or image failed to load, show fallback
  if (!coverImageUrl || imageError) {
    return showFallback ? renderFallbackCover() : (
      <div className={`${sizeClasses[size]} bg-ink-100 rounded-xl flex items-center justify-center ${className}`}>
        <span className="text-ink-400 text-sm">No cover</span>
      </div>
    );
  }

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Loading placeholder */}
      {imageLoading && (
        <div className={`absolute inset-0 ${sizeClasses[size]} bg-ink-100 rounded-xl flex items-center justify-center animate-pulse`}>
          <div className="text-ink-400 text-xs">Loading</div>
        </div>
      )}
      
      {/* Actual book cover image */}
      <img
        src={coverImageUrl}
        alt={`Cover of ${title} by ${authors.join(', ')}`}
        className={`
          ${sizeClasses[size]} 
          object-cover 
          rounded-xl
          shadow-book
          transition-opacity 
          duration-300
          ${imageLoading ? 'opacity-0' : 'opacity-100'}
        `}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
      
      {/* Hover overlay for better accessibility */}
      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-200 rounded-xl flex items-end justify-center opacity-0 hover:opacity-100">
        <div className="bg-black bg-opacity-75 text-white text-xs p-2 rounded-b-xl w-full text-center">
          {title}
        </div>
      </div>
    </div>
  );
};

export default BookCover;
