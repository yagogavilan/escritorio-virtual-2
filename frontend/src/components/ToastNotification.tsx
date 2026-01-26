import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'error' | 'success' | 'warning';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastNotificationProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} className="text-emerald-500" />;
      case 'error':
        return <AlertCircle size={20} className="text-red-500" />;
      case 'warning':
        return <AlertCircle size={20} className="text-amber-500" />;
      default:
        return <Info size={20} className="text-indigo-500" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-indigo-50 border-indigo-200';
    }
  };

  const getTextStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'text-emerald-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-amber-900';
      default:
        return 'text-indigo-900';
    }
  };

  return (
    <div
      className={`${getStyles()} border shadow-lg p-4 rounded-xl flex items-start gap-3 animate-in slide-in-from-right-10 fade-in duration-300 max-w-md backdrop-blur-sm`}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <p className={`${getTextStyles()} font-medium text-sm leading-snug`}>
          {toast.message}
        </p>

        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onClose(toast.id);
            }}
            className={`mt-2 text-xs font-semibold underline ${
              toast.type === 'error' ? 'text-red-700 hover:text-red-900' :
              toast.type === 'success' ? 'text-emerald-700 hover:text-emerald-900' :
              toast.type === 'warning' ? 'text-amber-700 hover:text-amber-900' :
              'text-indigo-700 hover:text-indigo-900'
            } transition-colors`}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => onClose(toast.id)}
        className={`flex-shrink-0 p-1 rounded-lg transition-colors ${
          toast.type === 'error' ? 'hover:bg-red-100 text-red-400' :
          toast.type === 'success' ? 'hover:bg-emerald-100 text-emerald-400' :
          toast.type === 'warning' ? 'hover:bg-amber-100 text-amber-400' :
          'hover:bg-indigo-100 text-indigo-400'
        }`}
      >
        <X size={16} />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none">
      <div className="pointer-events-auto space-y-3">
        {toasts.map(toast => (
          <ToastNotification key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </div>
  );
};

// Hook para usar o sistema de toast
export const useToast = (setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) => {
  const showToast = (message: string, type: Toast['type'] = 'info', action?: Toast['action']) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type, action };
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const success = (message: string, action?: Toast['action']) => showToast(message, 'success', action);
  const error = (message: string, action?: Toast['action']) => showToast(message, 'error', action);
  const warning = (message: string, action?: Toast['action']) => showToast(message, 'warning', action);
  const info = (message: string, action?: Toast['action']) => showToast(message, 'info', action);

  return { showToast, success, error, warning, info };
};
