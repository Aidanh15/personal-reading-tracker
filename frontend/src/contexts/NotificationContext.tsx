import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ToastProps } from '../components/UI/Toast';

interface NotificationState {
  toasts: ToastProps[];
}

type NotificationAction =
  | { type: 'ADD_TOAST'; payload: Omit<ToastProps, 'onClose'> }
  | { type: 'REMOVE_TOAST'; payload: string };

interface NotificationContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
  removeToast: (id: string) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const notificationReducer = (
  state: NotificationState,
  action: NotificationAction
): NotificationState => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, { ...action.payload, onClose: () => {} }],
      };
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.payload),
      };
    default:
      return state;
  }
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, { toasts: [] });

  const generateId = () => Math.random().toString(36).substring(2, 11);

  const addToast = (toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = generateId();
    dispatch({
      type: 'ADD_TOAST',
      payload: { ...toast, id },
    });
  };

  const removeToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  };

  const showSuccess = (title: string, message?: string) => {
    addToast({ type: 'success', title, ...(message && { message }) });
  };

  const showError = (title: string, message?: string) => {
    addToast({ type: 'error', title, ...(message && { message }), duration: 7000 }); // Longer duration for errors
  };

  const showWarning = (title: string, message?: string) => {
    addToast({ type: 'warning', title, ...(message && { message }) });
  };

  const showInfo = (title: string, message?: string) => {
    addToast({ type: 'info', title, ...(message && { message }) });
  };

  // Add onClose handler to toasts
  const toastsWithHandler = state.toasts.map((toast) => ({
    ...toast,
    onClose: removeToast,
  }));

  const value: NotificationContextType = {
    toasts: toastsWithHandler,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};