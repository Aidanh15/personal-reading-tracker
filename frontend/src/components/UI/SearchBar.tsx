import { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { SearchFilters } from '../../types';

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  placeholder?: string;
  className?: string;
  showFilters?: boolean;
  initialQuery?: string;
  autoFocus?: boolean;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'suggestion';
  timestamp?: number;
}

const SEARCH_HISTORY_KEY = 'reading-tracker-search-history';
const MAX_HISTORY_ITEMS = 10;

function SearchBar({ 
  onSearch, 
  placeholder = "Search books and highlights...", 
  className = "",
  showFilters = true,
  initialQuery = "",
  autoFocus = false
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchSuggestion[]>([]);
  const [filters, setFilters] = useState<Omit<SearchFilters, 'query'>>({
    sortBy: 'relevance',
    sortOrder: 'desc'
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Load search history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setSearchHistory(history);
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }, []);

  // Save search history to localStorage
  const saveSearchHistory = useCallback((newHistory: SearchSuggestion[]) => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      setSearchHistory(newHistory);
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);

  // Add search to history
  const addToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const newItem: SearchSuggestion = {
      id: `history-${Date.now()}`,
      text: searchQuery.trim(),
      type: 'history',
      timestamp: Date.now()
    };

    setSearchHistory(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(item => item.text !== newItem.text);
      // Add new item at the beginning
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveSearchHistory(updated);
      return updated;
    });
  }, [saveSearchHistory]);

  // Handle search execution
  const executeSearch = useCallback((searchQuery: string = query) => {
    const trimmedQuery = searchQuery.trim();
    
    if (trimmedQuery) {
      addToHistory(trimmedQuery);
      onSearch({ ...filters, query: trimmedQuery });
      
      // Navigate to search page if not already there
      if (window.location.pathname !== '/search') {
        navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      }
    } else {
      onSearch(filters);
    }
    
    setShowSuggestions(false);
    inputRef.current?.blur();
  }, [query, filters, onSearch, navigate, addToHistory]);

  // Handle input change with debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        executeSearch(query);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query]); // Only depend on query, not executeSearch to avoid infinite loops

  // Handle input focus
  const handleFocus = () => {
    setIsExpanded(true);
    setShowSuggestions(true);
  };

  // Handle input blur (with delay to allow clicking suggestions)
  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      if (!query.trim()) {
        setIsExpanded(false);
      }
    }, 150);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    executeSearch(suggestion.text);
  };

  // Clear search
  const clearSearch = () => {
    setQuery('');
    onSearch(filters);
    setIsExpanded(false);
    inputRef.current?.focus();
  };

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  // Handle filter changes
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Re-execute search with new filters if there's a query
    if (query.trim()) {
      onSearch({ ...newFilters, query: query.trim() });
    }
  };

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        if (!query.trim()) {
          setIsExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className={`relative transition-all duration-200 ${
        isExpanded ? 'w-full' : 'w-64'
      }`}>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch();
              } else if (e.key === 'Escape') {
                clearSearch();
              }
            }}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {searchHistory.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span>Recent Searches</span>
                  <button
                    onClick={clearHistory}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Clear
                  </button>
                </div>
                {searchHistory.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 text-sm"
                  >
                    <ClockIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700">{suggestion.text}</span>
                  </button>
                ))}
              </>
            )}
            
            {searchHistory.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No recent searches
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search Filters */}
      {showFilters && isExpanded && (
        <div className="mt-3 flex flex-wrap gap-3 items-center">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={filters.sortBy || 'relevance'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="relevance">Relevance</option>
              <option value="title">Title</option>
              <option value="dateAdded">Date Added</option>
              <option value="progress">Progress</option>
              <option value="status">Status</option>
            </select>
          </div>

          {/* Sort Order Filter */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Order:</label>
            <select
              value={filters.sortOrder || 'desc'}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;