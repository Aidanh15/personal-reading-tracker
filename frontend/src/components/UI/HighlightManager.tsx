import React, { useState, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilIcon,
  DocumentTextIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { Highlight, HighlightFormData } from '../../types';
import Button from './Button';
import Input from './Input';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';

interface HighlightManagerProps {
  highlights: Highlight[];
  loading: boolean;
  onAddHighlight: (data: HighlightFormData) => Promise<void>;
  onUpdateHighlight: (id: number, data: Partial<HighlightFormData>) => Promise<void>;
  onDeleteHighlight: (id: number) => Promise<void>;
  onBulkImport?: (highlights: HighlightFormData[]) => Promise<void>;
}

interface KindleHighlight {
  text: string;
  location?: string | undefined;
  pageNumber?: number | undefined;
  notes?: string | undefined;
}

const HighlightManager: React.FC<HighlightManagerProps> = ({
  highlights,
  loading,
  onAddHighlight,
  onUpdateHighlight,
  onDeleteHighlight,
  onBulkImport
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [importText, setImportText] = useState('');
  const [parsedHighlights, setParsedHighlights] = useState<KindleHighlight[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'page' | 'relevance'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [highlightForm, setHighlightForm] = useState<HighlightFormData>({
    quoteText: '',
    location: '',
    personalNotes: ''
  });

  // Filter and sort highlights based on search query and sort options
  const filteredHighlights = useMemo(() => {
    let filtered = highlights;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = highlights.filter(highlight =>
        highlight.quoteText.toLowerCase().includes(query) ||
        (highlight.personalNotes && highlight.personalNotes.toLowerCase().includes(query)) ||
        (highlight.location && highlight.location.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'page':
          if (a.pageNumber && b.pageNumber) {
            comparison = a.pageNumber - b.pageNumber;
          } else if (a.pageNumber) {
            comparison = -1;
          } else if (b.pageNumber) {
            comparison = 1;
          }
          break;
        case 'relevance':
          // For relevance, prioritize highlights with search matches in quote text
          if (searchQuery.trim()) {
            const aInQuote = a.quoteText.toLowerCase().includes(searchQuery.toLowerCase());
            const bInQuote = b.quoteText.toLowerCase().includes(searchQuery.toLowerCase());
            if (aInQuote && !bInQuote) comparison = -1;
            else if (!aInQuote && bInQuote) comparison = 1;
          }
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [highlights, searchQuery, sortBy, sortOrder]);

  const resetForm = () => {
    setHighlightForm({
      quoteText: '',
      location: '',
      personalNotes: ''
    });
  };

  const handleAddHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightForm.quoteText.trim()) return;

    try {
      await onAddHighlight(highlightForm);
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add highlight:', error);
    }
  };

  const handleEditHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHighlight || !highlightForm.quoteText.trim()) return;

    try {
      await onUpdateHighlight(editingHighlight.id, highlightForm);
      setEditingHighlight(null);
      resetForm();
    } catch (error) {
      console.error('Failed to update highlight:', error);
    }
  };

  const handleDeleteHighlight = async (id: number) => {
    if (!confirm('Are you sure you want to delete this highlight?')) return;

    try {
      await onDeleteHighlight(id);
    } catch (error) {
      console.error('Failed to delete highlight:', error);
    }
  };

  const openEditModal = (highlight: Highlight) => {
    setEditingHighlight(highlight);
    const formData: HighlightFormData = {
      quoteText: highlight.quoteText,
      location: highlight.location || '',
      personalNotes: highlight.personalNotes || ''
    };
    if (highlight.pageNumber !== undefined) {
      formData.pageNumber = highlight.pageNumber;
    }
    setHighlightForm(formData);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowImportModal(false);
    setEditingHighlight(null);
    resetForm();
    setImportText('');
    setParsedHighlights([]);
  };

  // Parse Kindle highlights from text
  const parseKindleHighlights = (text: string): KindleHighlight[] => {
    const highlights: KindleHighlight[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    let currentHighlight: Partial<KindleHighlight> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and separators
      if (!line || line === '==========') continue;

      // Check if this is a location/page line (contains "Location" or "Page")
      if (line.includes('Location') || line.includes('Page')) {
        // Extract location and page information
        const locationMatch = line.match(/Location (\d+)/);
        const pageMatch = line.match(/Page (\d+)/);

        if (locationMatch) {
          currentHighlight.location = `Location ${locationMatch[1]}`;
        }
        if (pageMatch && pageMatch[1]) {
          currentHighlight.pageNumber = parseInt(pageMatch[1], 10);
        }
        continue;
      }

      // If we have a current highlight and this looks like quote text
      if (line.length > 20 && !line.includes('Added on')) {
        currentHighlight.text = line;

        // Look ahead for notes (next non-empty line that's not a separator)
        if (i + 1 < lines.length && lines[i + 1] && lines[i + 1] !== '==========') {
          const nextLine = lines[i + 1];
          if (nextLine && !nextLine.includes('Location') && !nextLine.includes('Page') && !nextLine.includes('Added on')) {
            currentHighlight.notes = nextLine;
            i++; // Skip the notes line in next iteration
          }
        }

        // Save the highlight if we have text
        if (currentHighlight.text) {
          highlights.push({
            text: currentHighlight.text,
            location: currentHighlight.location,
            pageNumber: currentHighlight.pageNumber,
            notes: currentHighlight.notes
          });
        }

        // Reset for next highlight
        currentHighlight = {};
      }
    }

    return highlights;
  };

  const handleImportTextChange = (text: string) => {
    setImportText(text);
    if (text.trim()) {
      const parsed = parseKindleHighlights(text);
      setParsedHighlights(parsed);
    } else {
      setParsedHighlights([]);
    }
  };

  const handleBulkImport = async () => {
    if (!onBulkImport || parsedHighlights.length === 0) return;

    try {
      const highlightData: HighlightFormData[] = parsedHighlights.map(highlight => {
        const data: HighlightFormData = {
          quoteText: highlight.text,
          location: highlight.location || '',
          personalNotes: highlight.notes || ''
        };
        if (highlight.pageNumber !== undefined) {
          data.pageNumber = highlight.pageNumber;
        }
        return data;
      });

      await onBulkImport(highlightData);
      closeModals();
    } catch (error) {
      console.error('Failed to import highlights:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search highlights..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              role="searchbox"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="page-asc">Page Order</option>
            <option value="page-desc">Reverse Page Order</option>
            {searchQuery && <option value="relevance-desc">Most Relevant</option>}
          </select>

          {onBulkImport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowImportModal(true)}
              disabled={loading}
            >
              <ClipboardDocumentIcon className="h-4 w-4 mr-2" />
              Import
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            disabled={loading}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Highlight
          </Button>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-sm text-gray-600">
        {searchQuery ? (
          <span>
            Found {filteredHighlights.length} highlight{filteredHighlights.length !== 1 ? 's' : ''}
            matching "{searchQuery}"
          </span>
        ) : (
          <span>
            {highlights.length} highlight{highlights.length !== 1 ? 's' : ''} total
          </span>
        )}
      </div>

      {/* Highlights list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredHighlights.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {searchQuery ? 'No highlights found' : 'No highlights yet'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery
              ? 'Try adjusting your search terms or clear the search to see all highlights.'
              : 'Start adding highlights to capture meaningful passages from this book.'
            }
          </p>
          {!searchQuery && (
            <div className="mt-6">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddModal(true)}
              >
                Add First Highlight
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHighlights.map((highlight) => (
            <article key={highlight.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <blockquote className="text-gray-900 italic mb-3 leading-relaxed">
                    "{highlight.quoteText}"
                  </blockquote>

                  <div className="flex items-center flex-wrap gap-4 text-sm text-gray-500 mb-2">
                    {highlight.pageNumber && (
                      <span className="flex items-center">
                        <span className="font-medium">Page {highlight.pageNumber}</span>
                      </span>
                    )}
                    {highlight.location && (
                      <span>{highlight.location}</span>
                    )}
                    <span>
                      Added {new Date(highlight.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {highlight.personalNotes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 leading-relaxed">{highlight.personalNotes}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditModal(highlight)}
                    className="!p-2"
                    disabled={loading}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteHighlight(highlight.id)}
                    className="!p-2"
                    disabled={loading}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Add/Edit Highlight Modal */}
      <Modal
        isOpen={showAddModal || editingHighlight !== null}
        onClose={closeModals}
        title={editingHighlight ? 'Edit Highlight' : 'Add Highlight'}
        size="lg"
      >
        <form onSubmit={editingHighlight ? handleEditHighlight : handleAddHighlight} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quote Text *
            </label>
            <textarea
              value={highlightForm.quoteText}
              onChange={(e) => setHighlightForm(prev => ({ ...prev, quoteText: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter the highlighted text..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Page Number"
              value={highlightForm.pageNumber?.toString() || ''}
              onChange={(e) => setHighlightForm(prev => ({
                ...prev,
                pageNumber: e.target.value ? Number(e.target.value) : undefined
              }))}
              min={1}
              placeholder="Optional"
            />

            <Input
              type="text"
              label="Location"
              value={highlightForm.location || ''}
              onChange={(e) => setHighlightForm(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Chapter 5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personal Notes
            </label>
            <textarea
              value={highlightForm.personalNotes || ''}
              onChange={(e) => setHighlightForm(prev => ({ ...prev, personalNotes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add your thoughts about this highlight..."
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={closeModals}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !highlightForm.quoteText.trim()}
            >
              {editingHighlight ? 'Update Highlight' : 'Add Highlight'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      {onBulkImport && (
        <Modal
          isOpen={showImportModal}
          onClose={closeModals}
          title="Import Kindle Highlights"
          size="xl"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Kindle Highlights
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Copy and paste your Kindle highlights text file content here. The system will automatically parse individual highlights.
              </p>
              <textarea
                value={importText}
                onChange={(e) => handleImportTextChange(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Paste your Kindle highlights here..."
              />
            </div>

            {parsedHighlights.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Preview ({parsedHighlights.length} highlights found)
                </h4>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {parsedHighlights.slice(0, 5).map((highlight, index) => (
                    <div key={index} className="p-3 border-b border-gray-100 last:border-b-0">
                      <p className="text-sm text-gray-900 italic mb-1">"{highlight.text}"</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {highlight.pageNumber && <span>Page {highlight.pageNumber}</span>}
                        {highlight.location && <span>{highlight.location}</span>}
                      </div>
                      {highlight.notes && (
                        <p className="text-xs text-gray-600 mt-1 bg-gray-50 p-2 rounded">
                          {highlight.notes}
                        </p>
                      )}
                    </div>
                  ))}
                  {parsedHighlights.length > 5 && (
                    <div className="p-3 text-center text-sm text-gray-500">
                      ... and {parsedHighlights.length - 5} more highlights
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModals}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkImport}
                loading={loading}
                disabled={loading || parsedHighlights.length === 0}
              >
                Import {parsedHighlights.length} Highlights
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default HighlightManager;