import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  MagnifyingGlassIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'magnifying-glass-icon', ...props });
  },
  PlusIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'plus-icon', ...props });
  },
  PencilIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'pencil-icon', ...props });
  },
  TrashIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'trash-icon', ...props });
  },
  DocumentDuplicateIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'document-duplicate-icon', ...props });
  },
  XMarkIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'x-mark-icon', ...props });
  },
  ArrowLeftIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'arrow-left-icon', ...props });
  },
  BookOpenIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'book-open-icon', ...props });
  },
  ClockIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'clock-icon', ...props });
  },
  StarIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'star-icon', ...props });
  },
  ClipboardDocumentIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'clipboard-document-icon', ...props });
  },
  DocumentTextIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'document-text-icon', ...props });
  },
  ChevronDownIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'chevron-down-icon', ...props });
  },
  ChevronUpIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'chevron-up-icon', ...props });
  },
  CalendarIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'calendar-icon', ...props });
  },
  HomeIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'home-icon', ...props });
  },
  CheckCircleIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'check-circle-icon', ...props });
  },
  AdjustmentsHorizontalIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'adjustments-horizontal-icon', ...props });
  },
  FunnelIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'funnel-icon', ...props });
  },
  ChatBubbleLeftRightIcon: (props: any) => {
    return React.createElement('svg', { 'data-testid': 'chat-bubble-left-right-icon', ...props });
  },
}));

// Mock IntersectionObserver
(globalThis as any).IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
(globalThis as any).ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});