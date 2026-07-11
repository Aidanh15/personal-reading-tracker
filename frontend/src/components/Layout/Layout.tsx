import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpenIcon, MagnifyingGlassIcon, HomeIcon, SparklesIcon } from '@heroicons/react/24/outline';
import SearchBar from '../UI/SearchBar';
import { SearchFilters } from '../../types';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { label: 'Dashboard', path: '/', icon: HomeIcon },
  { label: 'Search', path: '/search', icon: MagnifyingGlassIcon },
  { label: 'Review', path: '/review', icon: SparklesIcon },
];

function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleHeaderSearch = (filters: SearchFilters) => {
    navigate(filters.query ? `/search?q=${encodeURIComponent(filters.query)}` : '/search');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-900/10 bg-paper-100/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center gap-5 px-4 sm:px-6 lg:px-10">
          <Link to="/" className="group flex shrink-0 items-center gap-3" aria-label="Reading Tracker home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-950 text-paper-50 shadow-sm transition group-hover:rotate-2 group-hover:bg-copper-600">
              <BookOpenIcon className="h-5 w-5" />
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-lg font-semibold leading-none text-ink-950">Reading Tracker</span>
              <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.2em] text-ink-400">A private library</span>
            </span>
          </Link>

          <div className="mx-auto hidden w-full max-w-md md:block">
            <SearchBar onSearch={handleHeaderSearch} placeholder="Search the library…" showFilters={false} className="w-full" />
          </div>

          <nav className="ml-auto flex items-center rounded-full border border-ink-900/10 bg-paper-50/80 p-1 shadow-sm" aria-label="Primary navigation">
            {navigation.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 ${
                    isActive(item.path) ? 'bg-ink-950 text-paper-50 shadow-sm' : 'text-ink-500 hover:text-ink-950'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        {children}
      </main>

      <footer className="mt-12 border-t border-ink-900/10">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-4 py-8 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <p>Personal Reading Tracker</p>
          <p>Read slowly · Remember deeply</p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
