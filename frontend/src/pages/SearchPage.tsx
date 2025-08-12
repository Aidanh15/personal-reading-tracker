
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchResult, SearchFilters } from '../types';
import { searchApi } from '../services/api';
import SearchBar from '../components/UI/SearchBar';
import SearchResults from '../components/UI/SearchResults';

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');

  // Get initial query from URL params
  const initialQuery = searchParams.get('q') || '';

  // Handle search execution
  const handleSearch = async (filters: SearchFilters) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentQuery(filters.query || '');

      // Update URL params
      if (filters.query) {
        setSearchParams({ q: filters.query });
      } else {
        setSearchParams({});
      }

      // Execute search
      const searchResults = await searchApi.search(filters);
      setResults(searchResults);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Execute initial search if query is provided in URL
  useEffect(() => {
    if (initialQuery) {
      handleSearch({ query: initialQuery });
    }
  }, []); // Only run on mount

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Search</h1>
          <p className="text-gray-600 mt-1">Find books and highlights in your reading collection</p>
        </div>
        
        {/* Search Bar */}
        <SearchBar
          onSearch={handleSearch}
          initialQuery={initialQuery}
          autoFocus={!initialQuery}
          showFilters={true}
          className="w-full"
        />
      </div>

      {/* Search Results */}
      <SearchResults
        results={results}
        loading={loading}
        error={error}
        query={currentQuery}
      />
    </div>
  );
}

export default SearchPage;