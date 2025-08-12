import { Routes, Route } from 'react-router-dom'
import { BooksProvider } from './contexts/BooksContext'
import { HighlightsProvider } from './contexts/HighlightsContext'
import { NotificationProvider, useNotification } from './contexts/NotificationContext'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import BookDetail from './pages/BookDetail'
import SearchPage from './pages/SearchPage'
import ComponentDemo from './pages/ComponentDemo'
import NotFound from './pages/NotFound'
import { ToastContainer, OfflineIndicator } from './components/UI'

function AppContent() {
  const { toasts, removeToast } = useNotification();

  return (
    <>
      <BooksProvider>
        <HighlightsProvider>
          <OfflineIndicator />
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/books/:id" element={<BookDetail />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/components" element={<ComponentDemo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
          <ToastContainer 
            toasts={toasts} 
            onClose={removeToast} 
          />
        </HighlightsProvider>
      </BooksProvider>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ErrorBoundary>
  )
}

export default App