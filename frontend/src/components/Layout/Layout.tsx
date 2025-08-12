import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpenIcon, MagnifyingGlassIcon, HomeIcon } from '@heroicons/react/24/outline';
import SearchBar from '../UI/SearchBar';
import { SearchFilters } from '../../types';

interface LayoutProps {
  children: ReactNode;
}

function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Handle search from header - navigate to search page
  const handleHeaderSearch = (filters: SearchFilters) => {
    // This will be handled by the SearchPage component
    // We just need to navigate there with the query
    if (filters.query) {
      window.location.href = `/search?q=${encodeURIComponent(filters.query)}`;
    } else {
      window.location.href = '/search';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <BookOpenIcon className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Reading Tracker</span>
              </Link>
            </div>

            {/* Center Search Bar */}
            <div className="flex-1 max-w-lg mx-8">
              <SearchBar
                onSearch={handleHeaderSearch}
                placeholder="Search books and highlights..."
                showFilters={false}
                className="w-full"
              />
            </div>

            {/* Navigation */}
            <nav className="flex items-center space-x-4">
              <Link
                to="/"
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <HomeIcon className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              
              <Link
                to="/search"
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/search')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                <span>Search</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-sm text-gray-500">
            <p>&copy; 2024 Personal Reading Tracker. Built with React & TypeScript.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;